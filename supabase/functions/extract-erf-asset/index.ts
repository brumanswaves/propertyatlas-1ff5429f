// Erf document extraction. Browser requests use the signed-in user's token;
// service credentials and document bytes never leave this Edge Function.
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
  applyParentLineageClaimPolicy,
  erfExtractionResponseFormat,
  erfExtractionSystemPrompt,
  extractGeneralPlanReference,
  isSgDiagramCategory,
  isSupportedExtractionMimeType,
  looksLikeGeneralPlanDocument,
  matchDocumentIdentity,
  normalizeExtractionResult,
  expectedIdentityFromCanonicalLpi,
  parseLegalPortionToken,
  type ErfExpectedIdentity,
  type ErfExtractionFailureCode,
  type ErfExtractionMetadataPatch,
  type ErfExtractionStatus,
  type ErfIdentityMatchStatus,
  type ErfKnownParcelLineage,
} from "../_shared/erfExtractionContract.ts";
import {
  buildExtractionContent,
  findUnsupportedContentMime,
  isTiffExtractionMimeType,
  type NormalizedExtractionPage,
} from "../_shared/erfExtractionMedia.ts";
import {
  applyGeneralPlanSubjectClaimPolicy,
  evaluateGeneralPlanSubjectMatch,
} from "../_shared/generalPlanSubjectEvidence.ts";
import {
  OPENAI_TIFF_EXTRACTION_PROVIDER,
  OPENAI_TIFF_EXPECTED_PREPROCESS_IMAGES,
  OPENAI_TIFF_FAST_PREPROCESS_PROVIDER,
  OpenAiTiffBackgroundError,
  cleanupOpenAiTiffResources,
  pollOpenAiTiffBackground,
  startOpenAiTiffBackground,
  type OpenAiTiffResources,
} from "./openAiTiffBackground.ts";

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response> | Response): unknown;
};

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
    Deno.env.get("SUPABASE_ANON_KEY")?.trim() ||
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim() ||
    "";
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

async function patchAssetMetadata(asset: AssetRow, patch: Partial<ErfExtractionMetadataPatch>) {
  const key = serviceKey();
  if (!key) return false;
  const metadata = { ...(asset.metadata ?? {}), ...patch };
  try {
    const response = await fetch(
      `${supabaseUrl()}/rest/v1/erf_assets?id=eq.${encodeURIComponent(asset.id)}`,
      {
        method: "PATCH",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ metadata, updated_at: new Date().toISOString() }),
      },
    );
    if (response.ok) asset.metadata = metadata;
    return response.ok;
  } catch {
    return false;
  }
}

function derivedPreviewPath(asset: AssetRow, mimeType: string) {
  const parent = asset.storage_path.includes("/")
    ? asset.storage_path.slice(0, asset.storage_path.lastIndexOf("/"))
    : asset.storage_path;
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : "png";
  return `${parent}/derived/sg-overview.${extension}`;
}

const TIFF_PREVIEW_MAX_BYTES = 5 * 1024 * 1024;
const TIFF_PREPROCESS_MAX_TOTAL_BYTES = TIFF_PREVIEW_MAX_BYTES * OPENAI_TIFF_EXPECTED_PREPROCESS_IMAGES;

interface TiffPreviewImage {
  bytes: Uint8Array;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
}

function previewMimeType(bytes: Uint8Array, contentType: string | null) {
  const declared = (contentType ?? "").split(";", 1)[0]?.trim().toLowerCase() ?? "";
  if (["image/png", "image/jpeg", "image/webp"].includes(declared)) return declared;
  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  if (isPng) return "image/png";
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (isJpeg) return "image/jpeg";
  const isWebp =
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return isWebp ? "image/webp" : null;
}

async function fetchTiffPreviewImage(previewUrl: string, apiKey: string, requestId: string) {
  try {
    const url = new URL(previewUrl);
    if (url.protocol !== "https:") {
      log("sg_preview_fetch_failed", requestId, { reasonCode: "https_required" });
      return null;
    }
    const headers = url.hostname === "api.openai.com" ? { Authorization: `Bearer ${apiKey}` } : undefined;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      log("sg_preview_fetch_failed", requestId, { status: response.status, reasonCode: "http_error" });
      return null;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.byteLength || bytes.byteLength > TIFF_PREVIEW_MAX_BYTES) {
      log("sg_preview_too_large", requestId, { bytes: bytes.byteLength, reasonCode: "max_5mb" });
      return null;
    }
    const mimeType = previewMimeType(bytes, response.headers.get("content-type"));
    if (!mimeType) {
      log("sg_preview_invalid_mime", requestId, {
        mime: response.headers.get("content-type") ?? null,
        bytes: bytes.byteLength,
        reasonCode: "unsupported_image",
      });
      return null;
    }
    return { bytes, mimeType } as TiffPreviewImage;
  } catch {
    log("sg_preview_fetch_failed", requestId, { reasonCode: "request_error" });
    return null;
  }
}

async function fetchTiffPreprocessImages(
  previewUrls: string[],
  apiKey: string,
  requestId: string,
) {
  if (previewUrls.length !== OPENAI_TIFF_EXPECTED_PREPROCESS_IMAGES) {
    log("sg_fast_preprocess_unusable", requestId, {
      imageCount: previewUrls.length,
      reasonCode: "expected_five_images",
    });
    return null;
  }
  const images: TiffPreviewImage[] = [];
  let totalBytes = 0;
  for (const previewUrl of previewUrls) {
    const image = await fetchTiffPreviewImage(previewUrl, apiKey, requestId);
    if (!image) return null;
    totalBytes += image.bytes.byteLength;
    if (totalBytes > TIFF_PREPROCESS_MAX_TOTAL_BYTES) {
      log("sg_fast_preprocess_unusable", requestId, {
        imageCount: images.length + 1,
        bytes: totalBytes,
        reasonCode: "total_image_limit",
      });
      return null;
    }
    images.push(image);
  }
  return images;
}

async function storeTiffPreview(
  asset: AssetRow,
  image: TiffPreviewImage | null,
  requestId: string,
) {
  if (!image) {
    log("sg_preview_missing", requestId, { reasonCode: "no_image_output" });
    return null;
  }
  try {
    const { bytes, mimeType } = image;
    const path = derivedPreviewPath(asset, mimeType);
    const key = serviceKey();
    if (!key) {
      log("sg_preview_upload_failed", requestId, { mime: mimeType, bytes: bytes.byteLength, reasonCode: "storage_unavailable" });
      return null;
    }
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const upload = await fetch(
      `${supabaseUrl()}/storage/v1/object/${encodeURIComponent(asset.storage_bucket)}/${encodedPath}`,
      {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": mimeType,
          "x-upsert": "true",
        },
        body: bytes as unknown as BodyInit,
      },
    );
    if (!upload.ok) {
      log("sg_preview_upload_failed", requestId, {
        status: upload.status,
        mime: mimeType,
        bytes: bytes.byteLength,
        reasonCode: "storage_http_error",
      });
      return null;
    }
    const patch = {
      sgPreviewStoragePath: path,
      sgPreviewMimeType: mimeType,
      sgPreviewGeneratedAt: new Date().toISOString(),
    };
    log("sg_preview_stored", requestId, { mime: mimeType, bytes: bytes.byteLength });
    return patch;
  } catch {
    log("sg_preview_upload_failed", requestId, { reasonCode: "request_error" });
    return null;
  }
}

function tiffPreviewPages(images: TiffPreviewImage[]): NormalizedExtractionPage[] {
  return images.map((image, index) => ({
    pageNumber: 1,
    mimeType: "image/png",
    base64: toBase64(image.bytes),
    width: 0,
    height: 0,
    detail:
      index === 0
        ? null
        : {
            index,
            row: index <= 2 ? 1 : 2,
            col: index % 2 === 1 ? 1 : 2,
            rows: 2,
            cols: 2,
            x0: 0,
            y0: 0,
            x1: 0,
            y1: 0,
          },
  }));
}

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
      `${supabaseUrl()}/rest/v1/erf_assets?id=eq.${encodeURIComponent(asset.id)}&updated_at=eq.${encodeURIComponent(asset.updated_at)}`,
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

async function loadExpectedIdentity(asset: AssetRow): Promise<ErfExpectedIdentity> {
  const fromLpi = expectedIdentityFromCanonicalLpi(asset.parcel_id);
  const expected: ErfExpectedIdentity = {
    parcelId: asset.parcel_id,
    ...fromLpi,
  };
  const context = asset.metadata?.expectedIdentityContext;
  if (context && typeof context === "object") {
    const raw = context as Record<string, unknown>;
    const text = (key: string) => typeof raw[key] === "string" && raw[key].trim() ? raw[key].trim() : null;
    const contextLpi = String(text("lpiCode") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const contextErf = String(text("erfNumber") ?? "").replace(/\D/g, "").replace(/^0+/, "") || "0";
    const contextPortion = String(text("portionNumber") ?? "").replace(/\D/g, "").replace(/^0+/, "") || "0";
    const trustedCore =
      (!fromLpi.lpiCode || contextLpi === fromLpi.lpiCode) &&
      (!fromLpi.erfNumber || contextErf === String(fromLpi.erfNumber)) &&
      (!fromLpi.portionNumber || contextPortion === String(fromLpi.portionNumber));
    if (trustedCore) {
      expected.municipality = text("municipality");
      expected.province = text("province");
      expected.town = text("town");
      expected.streetAddress = text("streetAddress");
    }
  }
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
    const parcel = (userData?.parcel ?? userData?.officialParcel ?? userData) as Record<
      string,
      unknown
    > | null;
    if (!parcel || typeof parcel !== "object") return expected;
    const pick = (...keys: string[]) => {
      for (const keyName of keys) {
        const value = parcel[keyName];
        if (typeof value === "string" && value.trim()) return value;
        if (typeof value === "number") return String(value);
      }
      return null;
    };
    return {
      ...expected,
      lpiCode: expected.lpiCode ?? pick("lpi", "lpiCode"),
      erfNumber: expected.erfNumber ?? pick("erfNumber", "erf"),
      portionNumber: expected.portionNumber ?? pick("portion", "portionNumber"),
      municipality: expected.municipality ?? pick("municipality"),
      province: expected.province ?? pick("province"),
      town: expected.town ?? pick("town", "suburb"),
      streetAddress: expected.streetAddress ?? pick("streetAddress", "address"),
    };
  } catch {
    return expected;
  }
}

async function loadKnownParcelLineage(asset: AssetRow): Promise<ErfKnownParcelLineage | null> {
  const key = serviceKey();
  if (!key) return null;
  try {
    const response = await fetch(
      `${supabaseUrl()}/rest/v1/erf_assets?user_id=eq.${encodeURIComponent(
        asset.user_id,
      )}&parcel_id=eq.${encodeURIComponent(
        asset.parcel_id,
      )}&select=id,source_label,original_file_name,asset_category,metadata&limit=50`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!response.ok) return null;
    const rows = (await response.json().catch(() => null)) as Array<{
      id: string;
      source_label: string | null;
      original_file_name: string | null;
      metadata?: Record<string, unknown> | null;
    }> | null;
    for (const row of rows ?? []) {
      if (row.id === asset.id) continue;
      const metadata = row.metadata ?? {};
      const automaticallyMatched = metadata.identityMatchStatus === "matched";
      const userConfirmedUnverifiedForParcel =
        metadata.identityMatchStatus === "unverified" &&
        metadata.identityBinding === "user_confirmed" &&
        metadata.identityUserConfirmedParcelId === asset.parcel_id;
      if (!automaticallyMatched && !userConfirmedUnverifiedForParcel) continue;
      const raw = metadata.documentLineage as Record<string, unknown> | null | undefined;
      const fromLineage = raw && typeof raw === "object" ? raw : null;
      const identityRaw = metadata.extractedIdentity as Record<string, unknown> | null | undefined;
      const parsed = parseLegalPortionToken(
        identityRaw && typeof identityRaw === "object" ? identityRaw.portionNumber : null,
      );
      const parentErfNumber =
        typeof fromLineage?.parentErfNumber === "string" && fromLineage.parentErfNumber
          ? fromLineage.parentErfNumber
          : parsed.parentErfNumber;
      if (!parentErfNumber) continue;
      const generalPlanReference =
        (typeof fromLineage?.generalPlanReference === "string" && fromLineage.generalPlanReference
          ? fromLineage.generalPlanReference
          : parsed.generalPlanReference) ??
        extractGeneralPlanReference(
          typeof fromLineage?.lineage === "string" ? fromLineage.lineage : null,
        );
      return {
        parentErfNumber,
        generalPlanReference,
        sourceLabel:
          row.source_label ||
          row.original_file_name ||
          (userConfirmedUnverifiedForParcel
            ? "a user-confirmed document on this erf"
            : "an identity-matched document on this erf"),
      };
    }
  } catch {
    return null;
  }
  return null;
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

function dossierPromptValue(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).replace(/[\r\n\t]+/g, " ").trim().slice(0, 160);
  return normalized || null;
}

/**
 * The active dossier identity is comparison context only. It helps the model
 * distinguish subject-erf evidence from a parent plan or the wrong property,
 * but is never itself an extracted document fact.
 */
function dossierAwareExtractionPrompt(assetCategory: string, expected: ErfExpectedIdentity) {
  const context = [
    dossierPromptValue(expected.erfNumber) ? `Erf ${dossierPromptValue(expected.erfNumber)}` : null,
    dossierPromptValue(expected.portionNumber) ? `Portion ${dossierPromptValue(expected.portionNumber)}` : null,
    dossierPromptValue(expected.lpiCode) ? `LPI ${dossierPromptValue(expected.lpiCode)}` : null,
    dossierPromptValue(expected.municipality) ? `Municipality ${dossierPromptValue(expected.municipality)}` : null,
    dossierPromptValue(expected.province) ? `Province ${dossierPromptValue(expected.province)}` : null,
    dossierPromptValue(expected.town) ? `Town or locality ${dossierPromptValue(expected.town)}` : null,
    dossierPromptValue(expected.streetAddress) ? `Working address ${dossierPromptValue(expected.streetAddress)}` : null,
  ].filter((value): value is string => Boolean(value));

  return [
    erfExtractionSystemPrompt(assetCategory),
    "Review this document in the context of the active Easy Erf dossier.",
    `Active dossier identifiers: ${context.length ? context.join("; ") : "not available"}.`,
    "Use these identifiers only to compare the document with the active dossier and distinguish subject-erf evidence, parent or General Plan context, uncertainty, or a wrong property.",
    "The dossier identifiers are comparison context only: never copy them into extracted identity or claims unless they are literally stated in the document. Preserve uncertainty when the document does not establish identity.",
  ].join("\n");
}

async function runFastTiffVisionExtraction(input: {
  asset: AssetRow;
  expectedIdentity: ErfExpectedIdentity;
  pages: NormalizedExtractionPage[];
  apiKey: string;
  model: string;
  requestId: string;
}) {
  const content = buildExtractionContent({
    fileName: input.asset.original_file_name,
    mimeType: "image/tiff",
    pages: input.pages,
    subjectErfNumber: input.expectedIdentity.erfNumber ?? null,
  });
  const offendingMime = findUnsupportedContentMime(content);
  if (offendingMime) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ERF_EXTRACTION_TIMEOUT_MS);
  try {
    log("sg_fast_extract_started", input.requestId, { imageCount: input.pages.length });
    const response = await fetch(ERF_EXTRACTION_OPENAI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${input.apiKey}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: input.model,
        temperature: 0,
        max_tokens: 8000,
        response_format: erfExtractionResponseFormat(),
        messages: [
          { role: "system", content: dossierAwareExtractionPrompt(input.asset.asset_category, input.expectedIdentity) },
          { role: "user", content },
        ],
      }),
    });
    const payload = (await response.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: string } }>;
    } | null;
    const raw = payload?.choices?.[0]?.message?.content;
    if (!response.ok || typeof raw !== "string") return null;
    try {
      const parsed = JSON.parse(raw);
      const result = normalizeExtractionResult(parsed, { assetCategory: input.asset.asset_category });
      if (!result || (!result.extractedText && result.claims.length === 0)) return null;
      log("sg_fast_extract_completed", input.requestId, {
        imageCount: input.pages.length,
        claimCount: result.claims.length,
      });
      return parsed;
    } catch {
      return null;
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (request: Request) => {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const fail = (code: ErfExtractionFailureCode, error: string, status: number) =>
    json({ success: false, code, error: `${error} (ref ${requestId})`, requestId }, status);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") return fail("INVALID_REQUEST", "Method not allowed.", 405);

  const presented = (request.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
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
  const expectedParcelId =
    typeof body?.expectedParcelId === "string" ? body.expectedParcelId.trim() : "";
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
  const mimeType = (asset.mime_type || "").split(";")[0].trim().toLowerCase();
  const isTiff = isTiffExtractionMimeType(mimeType);
  const openaiResponseId = metadataString(asset.metadata, "openaiResponseId");
  if (lockIsFresh(asset.metadata) && !(isTiff && openaiResponseId)) {
    log("already_processing", requestId);
    return fail("ALREADY_PROCESSING", "This document is already being read.", 409);
  }

  const isCurrentReady =
    currentStatus === "ready" &&
    (currentIdentity === "matched" || currentIdentity === "parent_lineage_match") &&
    currentVersion === ERF_EXTRACTION_VERSION;
  if (isCurrentReady && !(retryRequested && isInternalCaller)) {
    log("idempotent_ready", requestId);
    return json(
      {
        requestId,
        assetId: asset.id,
        success: true,
        extractionStatus: "ready",
        identityMatchStatus: currentIdentity,
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
      {
        success: false,
        code: "UNSUPPORTED_FILE_TYPE",
        error: "This file type cannot be read automatically.",
      },
      200,
    );
  }
  if (asset.size_bytes > ERF_EXTRACTION_MAX_FILE_BYTES) {
    return finish(
      "unsupported",
      { extractionError: "This file is too large to read automatically." },
      {
        success: false,
        code: "FILE_TOO_LARGE",
        error: "This file is too large to read automatically.",
      },
      200,
    );
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
  if (!apiKey) return fail("OPENAI_NOT_CONFIGURED", "Document reading is not configured yet.", 503);

  const expectedIdentity = await loadExpectedIdentity(asset);
  const knownLineage = isSgDiagramCategory(asset.asset_category)
    ? await loadKnownParcelLineage(asset)
    : null;
  const mime = mimeType || "application/pdf";
  let model = Deno.env.get("ERF_EXTRACTION_MODEL")?.trim() || ERF_EXTRACTION_MODEL_DEFAULT;
  let parsed: unknown = null;
  let previewPatch: Partial<ErfExtractionMetadataPatch> = {};
  let normalizedExtractionMimeType: string | null = null;
  let backgroundResources: OpenAiTiffResources | null = null;

  const finishResult = async (
    status: ErfExtractionStatus,
    patch: Partial<ErfExtractionMetadataPatch>,
    responseBody: Record<string, unknown>,
    httpStatus: number,
  ) => {
    const response = await finish(
      status,
      backgroundResources
        ? {
            ...patch,
            extractionProvider: null,
            openaiResponseId: null,
            openaiFileId: null,
            openaiContainerId: null,
            openaiBackgroundStartedAt: null,
          }
        : patch,
      responseBody,
      httpStatus,
    );
    if (backgroundResources && response.status < 500) {
      const cleanup = await cleanupOpenAiTiffResources({
        apiKey,
        ...backgroundResources,
      });
      if (!cleanup.allDeleted) log("openai_cleanup_incomplete", requestId);
    }
    return response;
  };

  const startDeepTiffFallback = async (reasonCode: string) => {
    log("sg_deep_fallback_started", requestId, { reasonCode });
    const bytes = await downloadAsset(asset);
    if (!bytes?.byteLength) {
      return finishResult(
        "failed",
        { extractionError: "The stored file could not be opened." },
        { success: false, code: "DOWNLOAD_FAILED", error: "The stored file could not be opened." },
        200,
      );
    }
    const deepModel = Deno.env.get("ERF_SG_TIFF_MODEL")?.trim() ?? "";
    if (!deepModel) {
      return finishResult(
        "failed",
        { extractionError: "Large survey plan reading is not configured yet." },
        {
          success: false,
          code: "OPENAI_NOT_CONFIGURED",
          error: "Large survey plan reading is not configured yet.",
        },
        200,
      );
    }
    try {
      const job = await startOpenAiTiffBackground({
        apiKey,
        bytes,
        fileName: asset.original_file_name,
        mimeType: mime,
        model: deepModel,
        systemPrompt: dossierAwareExtractionPrompt(asset.asset_category, expectedIdentity),
        mode: "deep_review",
      });
      const previousResources = backgroundResources;
      const written = await patchAssetMetadata(asset, {
        extractionStatus: "processing",
        extractionProvider: OPENAI_TIFF_EXTRACTION_PROVIDER,
        extractionModel: deepModel,
        extractionVersion: ERF_EXTRACTION_VERSION,
        extractedAt: null,
        extractionError: null,
        extractionWarning: null,
        originalMimeType: mime,
        normalizedExtractionMimeType: null,
        openaiResponseId: job.responseId,
        openaiFileId: job.fileId,
        openaiContainerId: job.containerId,
        openaiBackgroundStartedAt: new Date().toISOString(),
      });
      if (!written) {
        await cleanupOpenAiTiffResources({ apiKey, ...job });
        return finishResult(
          "failed",
          { extractionError: "The fallback review could not be saved." },
          { success: false, code: "SERVER_UNAVAILABLE", error: "The fallback review could not be saved." },
          503,
        );
      }
      if (previousResources) await cleanupOpenAiTiffResources({ apiKey, ...previousResources });
      backgroundResources = null;
      return json(
        {
          success: true,
          requestId,
          assetId: asset.id,
          extractionStatus: "processing",
          identityMatchStatus: null,
          claimCount: 0,
          documentType: null,
          warning: "Large SG plans can take several minutes. You can leave this page and come back.",
        },
        200,
      );
    } catch {
      return finishResult(
        "failed",
        { extractionError: "The survey plan fallback review could not start. Try again." },
        {
          success: false,
          code: "SERVER_UNAVAILABLE",
          error: "The survey plan fallback review could not start. Try again.",
        },
        200,
      );
    }
  };

  if (isTiff && openaiResponseId) {
    const isFastPreprocess =
      metadataString(asset.metadata, "extractionProvider") === OPENAI_TIFF_FAST_PREPROCESS_PROVIDER;
    model = metadataString(asset.metadata, "extractionModel") ??
      Deno.env.get("ERF_SG_TIFF_MODEL")?.trim() ??
      "";
    if (!model) {
      return fail("OPENAI_NOT_CONFIGURED", "Large survey plan reading is not configured yet.", 503);
    }
    let poll;
    try {
      poll = await pollOpenAiTiffBackground({
        apiKey,
        responseId: openaiResponseId,
        fileId: metadataString(asset.metadata, "openaiFileId"),
        containerId: metadataString(asset.metadata, "openaiContainerId"),
      });
    } catch (error) {
      const expiredResponse =
        error instanceof OpenAiTiffBackgroundError &&
        error.stage === "retrieve" &&
        (error.statusCode === 404 || error.statusCode === 410);
      if (expiredResponse) {
        backgroundResources = {
          fileId: metadataString(asset.metadata, "openaiFileId"),
          containerId: metadataString(asset.metadata, "openaiContainerId"),
        };
        if (isFastPreprocess) return startDeepTiffFallback("preprocess_response_expired");
        return finishResult(
          "failed",
          { extractionError: "The previous survey-plan review expired. Try reading the diagram again." },
          {
            success: false,
            code: "SERVER_UNAVAILABLE",
            error: "The previous survey-plan review expired. Try reading the diagram again.",
          },
          200,
        );
      }
      log("openai_background_poll_failed", requestId, {
        errorClass: error instanceof Error ? error.name : "UnknownError",
      });
      return fail("SERVER_UNAVAILABLE", "The survey plan review could not be checked yet.", 503);
    }
    backgroundResources = { fileId: poll.fileId, containerId: poll.containerId };
    if (poll.state === "processing") {
      if (poll.containerId !== metadataString(asset.metadata, "openaiContainerId")) {
        await patchAssetMetadata(asset, { openaiContainerId: poll.containerId });
      }
      return json(
        {
          success: true,
          requestId,
          assetId: asset.id,
          extractionStatus: "processing",
          identityMatchStatus: null,
          claimCount: 0,
          documentType: null,
          warning: "Large SG plans can take several minutes. You can leave this page and come back.",
        },
        200,
      );
    }
    if (poll.state === "failed") {
      if (isFastPreprocess) return startDeepTiffFallback("preprocess_failed");
      return finishResult(
        "failed",
        { extractionError: "The survey plan background review failed. Try again." },
        {
          success: false,
          code: "SERVER_UNAVAILABLE",
          error: "The survey plan background review failed. Try again.",
        },
        200,
      );
    }
    if (isFastPreprocess) {
      log("sg_fast_preprocess_completed", requestId, { imageCount: poll.previewUrls.length });
      const images = await fetchTiffPreprocessImages(poll.previewUrls, apiKey, requestId);
      if (!images) return startDeepTiffFallback("preprocess_images_unavailable");
      previewPatch = (await storeTiffPreview(asset, images[0], requestId)) ?? {};
      const fastModel = Deno.env.get("ERF_EXTRACTION_MODEL")?.trim() || ERF_EXTRACTION_MODEL_DEFAULT;
      parsed = await runFastTiffVisionExtraction({
        asset,
        expectedIdentity,
        pages: tiffPreviewPages(images),
        apiKey,
        model: fastModel,
        requestId,
      });
      if (!parsed) return startDeepTiffFallback("fast_vision_unusable");
      model = fastModel;
      normalizedExtractionMimeType = "image/png";
    } else {
      parsed = poll.parsed;
      const preview = poll.previewUrls[0]
        ? await fetchTiffPreviewImage(poll.previewUrls[0], apiKey, requestId)
        : null;
      previewPatch = (await storeTiffPreview(asset, preview, requestId)) ?? {};
    }
  } else {
    const locked = await claimProcessingLock(asset, requestId);
    if (!locked) {
      log("lock_contended", requestId);
      return fail("ALREADY_PROCESSING", "This document is already being read.", 409);
    }

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

    if (isTiff) {
      model = Deno.env.get("ERF_SG_TIFF_MODEL")?.trim() ?? "";
      if (!model) {
        return finish(
          "failed",
          { extractionError: "Large survey plan reading is not configured yet." },
          {
            success: false,
            code: "OPENAI_NOT_CONFIGURED",
            error: "Large survey plan reading is not configured yet.",
          },
          200,
        );
      }
      try {
        log("sg_fast_preprocess_started", requestId, { bytes: bytes.byteLength });
        const job = await startOpenAiTiffBackground({
          apiKey,
          bytes,
          fileName: asset.original_file_name,
          mimeType: mime,
          model,
          systemPrompt: dossierAwareExtractionPrompt(asset.asset_category, expectedIdentity),
          mode: "fast_preprocess",
        });
        const startedAt = new Date().toISOString();
        const written = await patchAssetMetadata(asset, {
          extractionStatus: "processing",
          extractionProvider: OPENAI_TIFF_FAST_PREPROCESS_PROVIDER,
          extractionModel: model,
          extractionVersion: ERF_EXTRACTION_VERSION,
          extractedAt: null,
          extractionError: null,
          extractionWarning: null,
          originalMimeType: mime,
          normalizedExtractionMimeType,
          openaiResponseId: job.responseId,
          openaiFileId: job.fileId,
          openaiContainerId: job.containerId,
          openaiBackgroundStartedAt: startedAt,
          sgPreviewStoragePath: null,
          sgPreviewMimeType: null,
          sgPreviewGeneratedAt: null,
        });
        if (!written) {
          await cleanupOpenAiTiffResources({ apiKey, ...job });
          return fail("SERVER_UNAVAILABLE", "The background review could not be saved.", 503);
        }
        return json(
          {
            success: true,
            requestId,
            assetId: asset.id,
            extractionStatus: "processing",
            identityMatchStatus: null,
            claimCount: 0,
            documentType: null,
            warning: "Large SG plans can take several minutes. You can leave this page and come back.",
          },
          200,
        );
      } catch (error) {
        log("openai_background_start_failed", requestId, {
          errorClass: error instanceof Error ? error.name : "UnknownError",
        });
        return startDeepTiffFallback("preprocess_start_failed");
      }
    }

    const dataUrl = `data:${mime};base64,${toBase64(bytes)}`;
    const content = buildExtractionContent({
      fileName: asset.original_file_name,
      mimeType: mime,
      dataUrl,
      subjectErfNumber: expectedIdentity.erfNumber ?? null,
    });
    const offendingMime = findUnsupportedContentMime(content);
    if (offendingMime) {
      log("blocked_unsupported_content", requestId);
      return finish(
        "failed",
        { extractionError: "This file type cannot be read automatically." },
        {
          success: false,
          code: "UNSUPPORTED_FILE_TYPE",
          error: "This file type cannot be read automatically.",
        },
        200,
      );
    }

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
            { role: "system", content: dossierAwareExtractionPrompt(asset.asset_category, expectedIdentity) },
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
      const raw = payload?.choices?.[0]?.message?.content;
      if (typeof raw === "string") {
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = null;
        }
      }
    } catch (error) {
      const name = error instanceof Error ? error.name : "UnknownError";
      const timedOut = name === "AbortError" || name === "TimeoutError";
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
  }

  try {
    const result = normalizeExtractionResult(parsed, { assetCategory: asset.asset_category });
    if (!result) {
      log("malformed_model_response", requestId);
      return finishResult(
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
      return finishResult(
        "failed",
        { extractionError: "No readable text was found in this document." },
        {
          success: false,
          code: "NO_READABLE_TEXT",
          error: "No readable text was found in this document.",
        },
        200,
      );
    }

    const documentGeneralPlanReference =
      extractGeneralPlanReference(result.extractedText) ??
      extractGeneralPlanReference(result.summary) ??
      extractGeneralPlanReference(result.documentType) ??
      extractGeneralPlanReference(result.identity.sgCode);

    log("identity_inputs", requestId, {
      assetId: asset.id,
      normalizedImageCount: 0,
      normalizedSourcePageCount: 0,
      normalizedPageSizes: [],
      documentTypePresent: Boolean(result.documentType),
      extractedTextChars: result.extractedText.length,
      claimCount: result.claims.length,
      documentErfNumber: result.identity.erfNumber ?? null,
      documentSgCode: result.identity.sgCode ?? null,
      looksLikeGeneralPlan: looksLikeGeneralPlanDocument(result.documentType, result.extractedText),
      documentGeneralPlanReference,
      knownParentErfPresent: Boolean(knownLineage?.parentErfNumber),
      knownGeneralPlanReferencePresent: Boolean(knownLineage?.generalPlanReference),
    });

    const baselineIdentity = matchDocumentIdentity(expectedIdentity, result.identity, {
      assetCategory: asset.asset_category,
      documentType: result.documentType,
      documentText: result.extractedText,
      documentGeneralPlanReference,
      knownLineage,
    });
    const generalPlanSubject = evaluateGeneralPlanSubjectMatch({
      expected: expectedIdentity,
      document: result.identity,
      assetCategory: asset.asset_category,
      documentType: result.documentType,
      documentText: result.extractedText,
      documentGeneralPlanReference,
      baseline: baselineIdentity,
    });
    const isParentLineage = baselineIdentity.status === "parent_lineage_match";
    const generalPlanSupportsSubject = generalPlanSubject.supportsSubject;
    const identityMatchStatus: ErfIdentityMatchStatus =
      generalPlanSupportsSubject && baselineIdentity.status === "mismatch"
        ? "unverified"
        : baselineIdentity.status;
    const identityReason = isParentLineage
      ? baselineIdentity.reason
      : generalPlanSubject.reason ?? baselineIdentity.reason;
    const generalPlanClaims = generalPlanSupportsSubject
      ? applyGeneralPlanSubjectClaimPolicy(result.claims, {
          subjectErfNumber: expectedIdentity.erfNumber,
          generalPlanReference: generalPlanSubject.generalPlanReference,
        })
      : result.claims;

    if (identityMatchStatus !== "matched" && !isParentLineage) {
      const message =
        identityMatchStatus === "mismatch"
          ? ERF_EXTRACTION_MISMATCH_MESSAGE
          : ERF_EXTRACTION_UNVERIFIED_MESSAGE;
      log("identity_requires_review", requestId, { identityMatchStatus });
      return finishResult(
        "partial",
        {
          extractionModel: model,
          extractionError: message,
          identityMatchStatus,
          identityMatchReason: identityReason,
          extractedIdentity: result.identity,
          documentLineage: baselineIdentity.lineage ?? null,
          extractedText: result.extractedText,
          extractedClaims: generalPlanClaims,
          extractedDocumentType: result.documentType,
          extractedProvider: result.provider,
          extractedDocumentDate: result.documentDate,
          extractionSummary: result.summary,
          pageCount: result.pageCount,
          ...previewPatch,
        },
        {
          success: true,
          code:
            identityMatchStatus === "mismatch" ? "IDENTITY_MISMATCH" : "IDENTITY_UNVERIFIED",
          warning: message,
          readable: true,
          identityMatchStatus,
          identityMatchReason: identityReason,
        },
        200,
      );
    }

    const claims = isParentLineage
      ? applyParentLineageClaimPolicy(result.claims, {
          subjectErfNumber: expectedIdentity.erfNumber ?? null,
          parentErfNumber: baselineIdentity.lineage?.parentErfNumber ?? null,
          generalPlanReference: baselineIdentity.lineage?.generalPlanReference ?? null,
        })
      : generalPlanSupportsSubject
        ? generalPlanClaims
        : result.claims;

    const status: ErfExtractionStatus = claims.length > 0 ? "ready" : "partial";
    const combinedWarning =
      [
        result.warning,
        isParentLineage || generalPlanSupportsSubject ? identityReason : null,
      ]
        .filter((entry) => Boolean(entry))
        .join(" ") || null;

    log("extraction_ready", requestId, {
      status,
      claimCount: claims.length,
      identityMatchStatus,
      generalPlanSubjectSupport: generalPlanSupportsSubject,
    });
    return finishResult(
      status,
      {
        identityMatchStatus,
        identityMatchReason: identityReason,
        extractedIdentity: result.identity,
        documentLineage: baselineIdentity.lineage ?? null,
        extractionModel: model,
        originalMimeType: mime,
        normalizedExtractionMimeType,
        extractionWarning: combinedWarning,
        extractedText: result.extractedText,
        extractedClaims: claims,
        extractedDocumentType: result.documentType,
        extractedProvider: result.provider,
        extractedDocumentDate: result.documentDate,
        extractionSummary: result.summary,
        pageCount: result.pageCount,
        ...previewPatch,
      },
      {
        success: true,
        identityMatchStatus,
        claimCount: claims.length,
        documentType: result.documentType,
        pageCount: result.pageCount,
        warning: combinedWarning,
      },
      200,
    );
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    const timedOut = name === "AbortError" || name === "TimeoutError";
    console.error(
      JSON.stringify({ fn: "extract-erf-asset", stage: "fetch_error", requestId, errorClass: name }),
    );
    return finishResult(
      "failed",
      { extractionError: timedOut ? "Reading this document timed out." : "Reading this document failed." },
      {
        success: false,
        code: timedOut ? "TIMEOUT" : "SERVER_UNAVAILABLE",
        error: timedOut ? "Reading this document timed out." : "Reading this document failed.",
      },
      200,
    );
  }
});
