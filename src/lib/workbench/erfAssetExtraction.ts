/**
 * Erf File Vault document extraction — browser client.
 *
 * The browser calls the deployed `extract-erf-asset` Supabase Edge Function
 * directly with the signed-in user's access token. No service-role key, shared
 * function secret, or OpenAI key is ever present in browser code.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  isSupportedExtractionMimeType,
  type ErfExtractedClaim,
  type ErfExtractionStatus,
} from "../../../supabase/functions/_shared/erfExtractionContract";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";

export const EXTRACT_ERF_ASSET_FUNCTION_NAME = "extract-erf-asset";

/** Categories whose contents are worth reading into evidence. */
const EXTRACTABLE_CATEGORIES = new Set([
  "official_document",
  "sg_diagram",
  "paid_report",
  "title_deed",
  "zoning_document",
  "topography",
]);

export type ExtractErfAssetResult =
  | {
      success: true;
      extractionStatus: ErfExtractionStatus;
      claimCount: number;
      documentType: string | null;
      warning: string | null;
    }
  | { success: false; code: string | null; error: string; extractionStatus: ErfExtractionStatus | null };

export interface ExtractErfAssetDeps {
  fetchImpl?: typeof fetch;
  functionsUrl?: string;
  apiKey?: string;
  accessToken?: string;
}

function defaultFunctionsUrl() {
  const base =
    (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ??
    (typeof process !== "undefined" ? process.env?.SUPABASE_URL : undefined) ??
    "";
  return `${base.replace(/\/+$/, "")}/functions/v1/${EXTRACT_ERF_ASSET_FUNCTION_NAME}`;
}

function defaultApiKey() {
  return (
    (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
    (typeof process !== "undefined" ? process.env?.SUPABASE_PUBLISHABLE_KEY : undefined) ??
    ""
  );
}

/** True when this asset is a document Easy Erf should try to read. */
export function isExtractableErfAsset(asset: {
  asset_category: string;
  mime_type: string;
}) {
  return EXTRACTABLE_CATEGORIES.has(asset.asset_category) && isSupportedExtractionMimeType(asset.mime_type);
}

export function erfAssetExtractionStatus(asset: Pick<ErfAsset, "metadata">): ErfExtractionStatus {
  const value = asset.metadata?.extractionStatus ?? asset.metadata?.extraction_status;
  const known: ErfExtractionStatus[] = [
    "not_started",
    "queued",
    "processing",
    "ready",
    "partial",
    "unsupported",
    "failed",
  ];
  return typeof value === "string" && (known as string[]).includes(value)
    ? (value as ErfExtractionStatus)
    : "not_started";
}

export function erfAssetExtractedClaims(asset: Pick<ErfAsset, "metadata">): ErfExtractedClaim[] {
  const raw = asset.metadata?.extractedClaims ?? asset.metadata?.extracted_claims;
  return Array.isArray(raw) ? (raw as ErfExtractedClaim[]) : [];
}

export function erfAssetExtractionError(asset: Pick<ErfAsset, "metadata">): string | null {
  const value = asset.metadata?.extractionError ?? asset.metadata?.extraction_error;
  return typeof value === "string" && value.trim() ? value : null;
}

/** Human label for the extraction state, used across Sources and Reports. */
export function erfAssetExtractionLabel(asset: Pick<ErfAsset, "metadata">) {
  const status = erfAssetExtractionStatus(asset);
  switch (status) {
    case "ready":
      return `Read — ${erfAssetExtractedClaims(asset).length} extracted values`;
    case "partial":
      return "Read — no structured values found";
    case "processing":
      return "Reading document…";
    case "queued":
      return "Queued for reading";
    case "unsupported":
      return "Cannot be read automatically";
    case "failed":
      return erfAssetExtractionError(asset) ?? "Reading failed";
    default:
      return "Not read yet";
  }
}

/**
 * Requests server-side extraction for one vault asset. Resolves with the
 * outcome; it never throws for an expected failure so callers can surface a
 * precise message instead of a generic error.
 */
export async function extractErfAsset(
  assetId: string,
  deps: ExtractErfAssetDeps = {},
): Promise<ExtractErfAssetResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const url = deps.functionsUrl ?? defaultFunctionsUrl();
  const apiKey = deps.apiKey ?? defaultApiKey();

  let accessToken = deps.accessToken ?? "";
  if (!accessToken) {
    const { data } = await supabase.auth.getSession();
    accessToken = data.session?.access_token ?? "";
  }
  if (!accessToken) {
    return { success: false, code: "AUTH_REQUIRED", error: "Sign in to read this document.", extractionStatus: null };
  }

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: apiKey,
      },
      body: JSON.stringify({ assetId }),
    });
  } catch {
    return {
      success: false,
      code: "SERVER_UNAVAILABLE",
      error: "Document reading is temporarily unavailable.",
      extractionStatus: null,
    };
  }

  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    code?: string;
    error?: string;
    claimCount?: number;
    documentType?: string | null;
    warning?: string | null;
    extractionStatus?: ErfExtractionStatus;
  } | null;

  if (!response.ok || !payload || payload.success !== true) {
    return {
      success: false,
      code: typeof payload?.code === "string" ? payload.code : null,
      error:
        typeof payload?.error === "string" && payload.error
          ? payload.error
          : "This document could not be read right now.",
      extractionStatus: payload?.extractionStatus ?? null,
    };
  }

  return {
    success: true,
    extractionStatus: payload.extractionStatus ?? "ready",
    claimCount: typeof payload.claimCount === "number" ? payload.claimCount : 0,
    documentType: payload.documentType ?? null,
    warning: payload.warning ?? null,
  };
}
