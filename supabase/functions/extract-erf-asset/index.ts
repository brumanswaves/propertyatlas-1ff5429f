// Erf document extraction.
//
// Browser -> this function with the signed-in user's Supabase access token.
// The token is verified against Supabase Auth; the asset owner is then checked
// against the verified user id. No user id is ever trusted from the body.
// A server-to-server caller may present ASK_EASY_ERF_FN_SECRET (or the
// service-role key) for backfill and fixtures; that never weakens user auth.
//
// OPENAI_API_KEY and SUPABASE_SERVICE_ROLE_KEY never leave this function.
import {
  ERF_EXTRACTION_LOCK_TTL_MS,
  ERF_EXTRACTION_MAX_FILE_BYTES,
  ERF_EXTRACTION_MAX_REQUEST_BYTES,
  ERF_EXTRACTION_MISMATCH_MESSAGE,
  ERF_EXTRACTION_UNVERIFIED_MESSAGE,
  ERF_EXTRACTION_MODEL_DEFAULT,
  ERF_EXTRACTION_OPENAI_URL,
  ERF_EXTRACTION_TIMEOUT_MS,
  ERF_EXTRACTION_VERSION,
  erfExtractionResponseFormat,
  erfExtractionSystemPrompt,
  isSupportedExtractionMimeType,
  matchDocumentIdentity,
  normalizeExtractionResult,
  parseCanonicalLpi,
  type ErfExpectedIdentity,
  type ErfExtractionFailureCode,
  type ErfExtractionMetadataPatch,
  type ErfExtractionStatus,
  type ErfIdentityMatchStatus,
} from "../_shared/erfExtractionContract.ts";

declare const Deno: { env: { get(key: string): string | undefined } };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function log(stage: string, requestId: string, extra: Record<string, unknown> = {}) {
  // Only safe stage/status metadata. Never keys, tokens or document content.
  console.log(JSON.stringify({ fn: "extract-erf-asset", stage, requestId, ...extra }));
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const supabaseUrl = () => (Deno.env.get("SUPABASE_URL") ?? "").trim().replace(/\/+$/, "");
const serviceKey = () => (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();

async function verifyUserToken(token: string): Promise<{ userId: string } | null> {
  const url = supabaseUrl();
  const anonKey =
    Deno.env.get("SUPABASE_ANON_KEY")?.trim() || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim() || "";
  if (!url || !anonKey) return null;
  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    });
    if (!response.ok) return null;
    const user = (await response.json().catch(() => null)) as { id?: unknown } | null;
    return user && typeof user.id === "string" && user.id ? { userId: user.id } : null;
  } catch {
    return null;
  }
}

interface AssetRow {
  id: string;
  user_id: string;
  parcel_id: string;
  asset_category: string;
  storage_bucket: string;
  storage_path: string;
  original_file_name: string;
  mime_type: string;
  size_bytes: number;
  metadata: Record<string, unknown> | null;
  updated_at: string;
}

async function loadAsset(assetId: string): Promise<AssetRow | null> {
  const key = serviceKey();
  if (!key) return null;
  const response = await fetch(
    `${supabaseUrl()}/rest/v1/erf_assets?id=eq.${encodeURIComponent(assetId)}&select=*&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!response.ok) return null;
  const rows = (await response.json().catch(() => null)) as AssetRow[] | null;
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

/**
 * Writes a metadata patch and reports whether the write actually landed.
 * A silent failure here would let the caller pretend success, so every call
 * site must check the boolean.
 */
async function patchAssetMetadata(asset: AssetRow, patch: Partial<ErfExtractionMetadataPatch>) {
  const key = serviceKey();
  if (!key) return false;
  const metadata = { ...(asset.metadata ?? {}), ...patch };
  try {
    const response = await fetch(`${supabaseUrl()}/rest/v1/erf_assets?id=eq.${encodeURIComponent(asset.id)}`, {
      method: "PATCH",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ metadata, updated_at: new Date().toISOString() }),
    });
    if (response.ok) asset.metadata = metadata;
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Atomic claim: PATCH only succeeds when `updated_at` still equals the value we
 * read, so two concurrent requests can never both take the processing lock and
 * call OpenAI. No migration required.
 */
async function claimProcessingLock(asset: AssetRow, requestId: string) {
  const key = serviceKey();
  if (!key) return false;
  const startedAt = new Date().toISOString();
  const metadata = {
    ...(asset.metadata ?? {}),
    extractionStatus: "processing",
    extractionRequestId: requestId,
    extractionStartedAt: startedAt,
    extractionVersion: ERF_EXTRACTION_VERSION,
    extractionError: null,
  };
  try {
    const response = await fetch(
      `${supabaseUrl()}/rest/v1/erf_assets?id=eq.${encodeURIComponent(asset.id)}&updated_at=eq.${encodeURIComponent(
        asset.updated_at,
      )}`,
      {
        method: "PATCH",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({ metadata, updated_at: startedAt }),
      },
    );
    if (!response.ok) return false;
    const rows = (await response.json().catch(() => null)) as AssetRow[] | null;
    if (!Array.isArray(rows) || rows.length !== 1) return false;
    asset.metadata = metadata;
    asset.updated_at = startedAt;
    return true;
  } catch {
    return false;
  }
}

function metadataString(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function lockIsFresh(metadata: Record<string, unknown> | null) {
  if (metadataString(metadata, "extractionStatus") !== "processing") return false;
  const startedAt = metadataString(metadata, "extractionStartedAt");
  if (!startedAt) return false;
  const started = Date.parse(startedAt);
  return Number.isFinite(started) && Date.now() - started < ERF_EXTRACTION_LOCK_TTL_MS;
}

/**
 * Builds the expected parcel identity entirely server-side: the canonical LPI
 * from the parcel id plus whatever the owner's saved_properties row already
 * knows. Nothing about identity is accepted from the browser.
 */
async function loadExpectedIdentity(asset: AssetRow): Promise<ErfExpectedIdentity> {
  const expected: ErfExpectedIdentity = {
    parcelId: asset.parcel_id,
    lpiCode: parseCanonicalLpi(asset.parcel_id),
  };
  const key = serviceKey();
  if (!key) return expected;
  try {
    const response = await fetch(
      `${supabaseUrl()}/rest/v1/saved_properties?user_id=eq.${encodeURIComponent(
        asset.user_id,
      )}&parcel_id=eq.${encodeURIComponent(asset.parcel_id)}&select=user_data&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!response.ok) return expected;
    const rows = (await response.json().catch(() => null)) as Array<{ user_data?: unknown }> | null;
    const userData = (rows?.[0]?.user_data ?? null) as Record<string, unknown> | null;
    const parcel = (userData?.parcel ?? userData?.officialParcel ?? userData) as Record<string, unknown> | null;
    if (!parcel || typeof parcel !== "object") return expected;
    const pick = (...keys: string[]) => {
      for (const k of keys) {
        const value = parcel[k];
        if (typeof value === "string" && value.trim()) return value;
        if (typeof value === "number") return String(value);
      }
      return null;
    };
    return {
      ...expected,
      lpiCode: expected.lpiCode ?? pick("lpi", "lpiCode"),
      erfNumber: pick("erfNumber", "erf"),
      portionNumber: pick("portion", "portionNumber"),
      municipality: pick("municipality"),
      province: pick("province"),
      town: pick("town", "suburb"),
      streetAddress: pick("streetAddress", "address"),
    };
  } catch {
    return expected;
  }
}

async function downloadAsset(asset: AssetRow): Promise<Uint8Array | null> {
  const key = serviceKey();
  if (!key) return null;
  const bucket = asset.storage_bucket || "erf-files";
  const paths = [asset.storage_path, asset.storage_path.replace(/^\/+/, "")];
  for (const path of Array.from(new Set(paths))) {
    const response = await fetch(
      `${supabaseUrl()}/storage/v1/object/${encodeURIComponent(bucket)}/${path
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (response.ok) return new Uint8Array(await response.arrayBuffer());
  }
  return null;
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

Deno.serve(async (request: Request) => {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  const fail = (code: ErfExtractionFailureCode, error: string, status: number) =>
    json({ success: false, code, error: `${error} (ref ${requestId})`, requestId }, status);

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return fail("INVALID_REQUEST", "Method not allowed.", 405);

  const presented = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!presented) return fail("AUTH_REQUIRED", "Sign in is required.", 401);

  const internalSecrets = [
    Deno.env.get("ASK_EASY_ERF_FN_SECRET") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  ].filter((value) => value.length > 0);
  const isInternalCaller = internalSecrets.some((value) => safeEqual(presented, value));

  let callerUserId: string | null = null;
  if (!isInternalCaller) {
    const user = await verifyUserToken(presented);
    if (!user) {
      log("auth_rejected", requestId);
      return fail("AUTH_REQUIRED", "Sign in is required.", 401);
    }
    callerUserId = user.userId;
  }
  log("auth_ok", requestId, { caller: isInternalCaller ? "internal" : "user" });

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > ERF_EXTRACTION_MAX_REQUEST_BYTES) {
    return fail("REQUEST_TOO_LARGE", "That request was too large.", 413);
  }
  const rawBody = await request.text().catch(() => "");
  if (rawBody.length > ERF_EXTRACTION_MAX_REQUEST_BYTES) {
    return fail("REQUEST_TOO_LARGE", "That request was too large.", 413);
  }
  let body: { assetId?: unknown; expectedParcelId?: unknown; retry?: unknown } | null = null;
  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    body = null;
  }
  const assetId = typeof body?.assetId === "string" ? body.assetId.trim() : "";
  const expectedParcelId = typeof body?.expectedParcelId === "string" ? body.expectedParcelId.trim() : "";
  const retryRequested = body?.retry === true;
  if (!/^[0-9a-f-]{36}$/i.test(assetId)) {
    return fail("INVALID_REQUEST", "A valid assetId is required.", 400);
  }
  if (!expectedParcelId || expectedParcelId.length > 200) {
    return fail("INVALID_REQUEST", "A valid expectedParcelId is required.", 400);
  }

  if (!serviceKey() || !supabaseUrl()) {
    return fail("SERVER_UNAVAILABLE", "Extraction is not configured.", 503);
  }

  const asset = await loadAsset(assetId);
  if (!asset) return fail("ASSET_NOT_FOUND", "That file could not be found.", 404);
  if (callerUserId && asset.user_id !== callerUserId) {
    log("forbidden", requestId);
    return fail("FORBIDDEN", "That file does not belong to this account.", 403);
  }

  // Parcel binding: refuse before any download or model call.
  if (expectedParcelId !== asset.parcel_id) {
    log("parcel_binding_rejected", requestId);
    return fail("PARCEL_MISMATCH", "That document does not belong to the selected erf.", 409);
  }

  const finish = async (
    status: ErfExtractionStatus,
    patch: Partial<ErfExtractionMetadataPatch>,
    responseBody: Record<string, unknown>,
    httpStatus: number,
  ) => {
    const written = await patchAssetMetadata(asset, {
      extractionStatus: status,
      extractionModel: null,
      extractionVersion: ERF_EXTRACTION_VERSION,
      extractedAt: new Date().toISOString(),
      extractionError: null,
      extractionWarning: null,
      extractionRequestId: requestId,
      ...patch,
    });
    if (!written) {
      return fail("SERVER_UNAVAILABLE", "The extraction result could not be saved.", 503);
    }
    return json({ requestId, assetId: asset.id, extractionStatus: status, ...responseBody }, httpStatus);
  };

  const currentStatus = metadataString(asset.metadata, "extractionStatus");
  const currentIdentity = metadataString(asset.metadata, "identityMatchStatus");
  const currentVersion = Number(asset.metadata?.extractionVersion ?? 0);

  if (lockIsFresh(asset.metadata)) {
    log("already_processing", requestId);
    return fail("ALREADY_PROCESSING", "This document is already being read.", 409);
  }

  const isCurrentReady =
    currentStatus === "ready" && currentIdentity === "matched" && currentVersion === ERF_EXTRACTION_VERSION;
  if (isCurrentReady && !(retryRequested && isInternalCaller)) {
    log("idempotent_ready", requestId);
    return json(
      {
        requestId,
        assetId: asset.id,
        success: true,
        extractionStatus: "ready",
        identityMatchStatus: "matched",
        claimCount: Array.isArray(asset.metadata?.extractedClaims)
          ? (asset.metadata!.extractedClaims as unknown[]).length
          : 0,
        documentType: metadataString(asset.metadata, "extractedDocumentType"),
        warning: null,
        reused: true,
      },
      200,
    );
  }

  const mimeType = (asset.mime_type || "").split(";")[0].trim().toLowerCase();
  if (asset.asset_category === "paid_report" && mimeType !== "application/pdf") {
    log("paid_report_not_pdf", requestId);
    return finish(
      "unsupported",
      { extractionError: "A paid report must be uploaded as a PDF to be read." },
      {
        success: false,
        code: "UNSUPPORTED_FILE_TYPE",
        error: "A paid report must be uploaded as a PDF to be read.",
      },
      200,
    );
  }
  if (!isSupportedExtractionMimeType(asset.mime_type)) {
    log("unsupported_type", requestId);
    return finish(
      "unsupported",
      { extractionError: "This file type cannot be read automatically." },
      { success: false, code: "UNSUPPORTED_FILE_TYPE", error: "This file type cannot be read automatically." },
      200,
    );
  }
  if (asset.size_bytes > ERF_EXTRACTION_MAX_FILE_BYTES) {
    return finish(
      "unsupported",
      { extractionError: "This file is too large to read automatically." },
      { success: false, code: "FILE_TOO_LARGE", error: "This file is too large to read automatically." },
      200,
    );
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
  if (!apiKey) return fail("OPENAI_NOT_CONFIGURED", "Document reading is not configured yet.", 503);

  const locked = await claimProcessingLock(asset, requestId);
  if (!locked) {
    log("lock_contended", requestId);
    return fail("ALREADY_PROCESSING", "This document is already being read.", 409);
  }

  const expectedIdentity = await loadExpectedIdentity(asset);

  const bytes = await downloadAsset(asset);
  if (!bytes || bytes.byteLength === 0) {
    log("download_failed", requestId);
    return finish(
      "failed",
      { extractionError: "The stored file could not be opened." },
      { success: false, code: "DOWNLOAD_FAILED", error: "The stored file could not be opened." },
      200,
    );
  }

  const mime = mimeType || "application/pdf";
  const dataUrl = `data:${mime};base64,${toBase64(bytes)}`;
  const content =
    mime === "application/pdf"
      ? [
          { type: "text", text: `Extract this property document: ${asset.original_file_name}` },
          { type: "file", file: { filename: asset.original_file_name, file_data: dataUrl } },
        ]
      : [
          { type: "text", text: `Extract this property document image: ${asset.original_file_name}` },
          { type: "image_url", image_url: { url: dataUrl } },
        ];

  const model = Deno.env.get("ERF_EXTRACTION_MODEL")?.trim() || ERF_EXTRACTION_MODEL_DEFAULT;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ERF_EXTRACTION_TIMEOUT_MS);
  try {
    log("openai_request_start", requestId, { model, bytes: bytes.byteLength });
    const response = await fetch(ERF_EXTRACTION_OPENAI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 8000,
        response_format: erfExtractionResponseFormat(),
        messages: [
          { role: "system", content: erfExtractionSystemPrompt() },
          { role: "user", content },
        ],
      }),
    });

    const payload = (await response.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { type?: string; code?: string };
    } | null;
    log("openai_response", requestId, { status: response.status });

    if (!response.ok) {
      console.error(
        JSON.stringify({
          fn: "extract-erf-asset",
          stage: "openai_request_failed",
          requestId,
          status: response.status,
          errorType: payload?.error?.type ?? null,
          errorCode: payload?.error?.code ?? null,
        }),
      );
      const code: ErfExtractionFailureCode =
        response.status === 429
          ? "RATE_LIMITED"
          : response.status >= 400 && response.status < 500
            ? "UPSTREAM_REQUEST_REJECTED"
            : "SERVER_UNAVAILABLE";
      return finish(
        "failed",
        { extractionError: "Reading this document failed. Try again." },
        { success: false, code, error: "Reading this document failed. Try again." },
        200,
      );
    }

    let parsed: unknown = null;
    const raw = payload?.choices?.[0]?.message?.content;
    if (typeof raw === "string") {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
    }
    const result = normalizeExtractionResult(parsed);
    if (!result) {
      log("malformed_model_response", requestId);
      return finish(
        "failed",
        { extractionError: "The document could not be read into structured evidence." },
        {
          success: false,
          code: "MALFORMED_MODEL_RESPONSE",
          error: "The document could not be read into structured evidence.",
        },
        200,
      );
    }
    if (!result.extractedText && result.claims.length === 0) {
      return finish(
        "failed",
        { extractionError: "No readable text was found in this document." },
        { success: false, code: "NO_READABLE_TEXT", error: "No readable text was found in this document." },
        200,
      );
    }

    const identity = matchDocumentIdentity(expectedIdentity, result.identity);
    const identityMatchStatus: ErfIdentityMatchStatus = identity.status;

    if (identityMatchStatus !== "matched") {
      // Quarantine: no extracted text, no claims, no document facts retained.
      const message =
        identityMatchStatus === "mismatch" ? ERF_EXTRACTION_MISMATCH_MESSAGE : ERF_EXTRACTION_UNVERIFIED_MESSAGE;
      log("identity_rejected", requestId, { identityMatchStatus });
      return finish(
        "failed",
        {
          extractionModel: model,
          extractionError: message,
          identityMatchStatus,
          identityMatchReason: identity.reason,
          extractedIdentity: result.identity,
          extractedText: "",
          extractedClaims: [],
          extractedDocumentType: null,
          extractedProvider: null,
          extractedDocumentDate: null,
          extractionSummary: null,
          pageCount: null,
        },
        {
          success: false,
          code: identityMatchStatus === "mismatch" ? "IDENTITY_MISMATCH" : "IDENTITY_UNVERIFIED",
          error: message,
          identityMatchStatus,
          identityMatchReason: identity.reason,
        },
        200,
      );
    }

    const status: ErfExtractionStatus = result.claims.length > 0 ? "ready" : "partial";
    log("extraction_ready", requestId, { status, claimCount: result.claims.length });
    return finish(
      status,
      {
        identityMatchStatus,
        identityMatchReason: identity.reason,
        extractedIdentity: result.identity,
        extractionModel: model,
        extractionWarning: result.warning,
        extractedText: result.extractedText,
        extractedClaims: result.claims,
        extractedDocumentType: result.documentType,
        extractedProvider: result.provider,
        extractedDocumentDate: result.documentDate,
        extractionSummary: result.summary,
        pageCount: result.pageCount,
      },
      {
        success: true,
        identityMatchStatus,
        claimCount: result.claims.length,
        documentType: result.documentType,
        pageCount: result.pageCount,
        warning: result.warning,
      },
      200,
    );
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    const timedOut = name === "AbortError" || name === "TimeoutError";
    console.error(JSON.stringify({ fn: "extract-erf-asset", stage: "fetch_error", requestId, errorClass: name }));
    return finish(
      "failed",
      { extractionError: timedOut ? "Reading this document timed out." : "Reading this document failed." },
      {
        success: false,
        code: timedOut ? "TIMEOUT" : "SERVER_UNAVAILABLE",
        error: timedOut ? "Reading this document timed out." : "Reading this document failed.",
      },
      200,
    );
  } finally {
    clearTimeout(timeout);
  }
});
