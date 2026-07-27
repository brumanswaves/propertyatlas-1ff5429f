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
  ERF_EXTRACTION_MAX_FILE_BYTES,
  ERF_EXTRACTION_MODEL_DEFAULT,
  ERF_EXTRACTION_OPENAI_URL,
  ERF_EXTRACTION_TIMEOUT_MS,
  ERF_EXTRACTION_VERSION,
  erfExtractionResponseFormat,
  erfExtractionSystemPrompt,
  isSupportedExtractionMimeType,
  normalizeExtractionResult,
  type ErfExtractionFailureCode,
  type ErfExtractionMetadataPatch,
  type ErfExtractionStatus,
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

async function patchAssetMetadata(asset: AssetRow, patch: ErfExtractionMetadataPatch) {
  const key = serviceKey();
  if (!key) return;
  const metadata = { ...(asset.metadata ?? {}), ...patch };
  await fetch(`${supabaseUrl()}/rest/v1/erf_assets?id=eq.${encodeURIComponent(asset.id)}`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ metadata }),
  });
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

  const body = (await request.json().catch(() => null)) as { assetId?: unknown; force?: unknown } | null;
  const assetId = typeof body?.assetId === "string" ? body.assetId.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(assetId)) {
    return fail("INVALID_REQUEST", "A valid assetId is required.", 400);
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

  const finish = async (
    status: ErfExtractionStatus,
    patch: Partial<ErfExtractionMetadataPatch>,
    responseBody: Record<string, unknown>,
    httpStatus: number,
  ) => {
    await patchAssetMetadata(asset, {
      extractionStatus: status,
      extractionModel: null,
      extractionVersion: ERF_EXTRACTION_VERSION,
      extractedAt: new Date().toISOString(),
      extractionError: null,
      extractionWarning: null,
      ...patch,
    });
    return json({ requestId, assetId: asset.id, extractionStatus: status, ...responseBody }, httpStatus);
  };

  if (!isSupportedExtractionMimeType(asset.mime_type)) {
    log("unsupported_type", requestId, { mimeType: asset.mime_type });
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

  await patchAssetMetadata(asset, {
    extractionStatus: "processing",
    extractionModel: null,
    extractionVersion: ERF_EXTRACTION_VERSION,
    extractedAt: null,
    extractionError: null,
    extractionWarning: null,
  });

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

  const mime = (asset.mime_type || "application/pdf").split(";")[0].trim().toLowerCase();
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

    const status: ErfExtractionStatus = result.claims.length > 0 ? "ready" : "partial";
    log("extraction_ready", requestId, { status, claimCount: result.claims.length });
    return finish(
      status,
      {
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
