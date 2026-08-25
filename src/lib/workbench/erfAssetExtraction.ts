/**
 * Erf File Vault document extraction — browser client.
 *
 * The browser calls the deployed `extract-erf-asset` Supabase Edge Function
 * directly with the signed-in user's access token. No service-role key, shared
 * function secret, or OpenAI key is ever present in browser code.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  type ErfExtractionStatus,
  type ErfIdentityMatchStatus,
} from "../../../supabase/functions/_shared/erfExtractionContract";
import {
  erfAssetExtractedClaims,
  erfAssetExtractionError,
  erfAssetExtractionLabel,
  erfAssetExtractionStatus,
  erfAssetHasSearchableExtraction,
  erfAssetIdentityMatchReason,
  erfAssetIdentityMatchStatus,
  isExtractableErfAsset,
} from "@/lib/evidence/extractionMetadata";

// Re-exported so UI code keeps one import site while the runtime-neutral
// readers live in the evidence layer.
export {
  erfAssetExtractedClaims,
  erfAssetExtractionError,
  erfAssetExtractionLabel,
  erfAssetExtractionStatus,
  erfAssetHasSearchableExtraction,
  erfAssetIdentityMatchReason,
  erfAssetIdentityMatchStatus,
  isExtractableErfAsset,
};

export const EXTRACT_ERF_ASSET_FUNCTION_NAME = "extract-erf-asset";
export const DOCUMENT_READER_UNAVAILABLE_MESSAGE =
  "Easy Erf's document reader could not start. Your uploaded file remains stored. Try reading it again shortly.";

export type ExtractErfAssetResult =
  | {
      success: true;
      extractionStatus: ErfExtractionStatus;
      identityMatchStatus: ErfIdentityMatchStatus | null;
      claimCount: number;
      documentType: string | null;
      warning: string | null;
    }
  | {
      success: false;
      code: string | null;
      error: string;
      extractionStatus: ErfExtractionStatus | null;
      identityMatchStatus?: ErfIdentityMatchStatus | null;
    };

export interface ExtractErfAssetOptions {
  /** Must equal the asset's parcel_id; the server re-checks it. */
  expectedParcelId: string;
  /** Only allowed for failed / partial / unverified assets. */
  retry?: boolean;
}

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




/**
 * Requests server-side extraction for one vault asset. Resolves with the
 * outcome; it never throws for an expected failure so callers can surface a
 * precise message instead of a generic error.
 */
export async function extractErfAsset(
  assetId: string,
  options: ExtractErfAssetOptions,
  deps: ExtractErfAssetDeps = {},
): Promise<ExtractErfAssetResult> {
  const expectedParcelId = String(options?.expectedParcelId ?? "").trim();
  if (!expectedParcelId) {
    return {
      success: false,
      code: "INVALID_REQUEST",
      error: "The active erf could not be identified for this document.",
      extractionStatus: null,
    };
  }
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
      body: JSON.stringify({
        assetId,
        expectedParcelId,
        ...(options.retry ? { retry: true } : {}),
      }),
    });
  } catch {
    return {
      success: false,
      code: "SERVER_UNAVAILABLE",
      error: DOCUMENT_READER_UNAVAILABLE_MESSAGE,
      extractionStatus: null,
    };
  }

  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    code?: string;
    error?: string;
    message?: string;
    claimCount?: number;
    documentType?: string | null;
    warning?: string | null;
    extractionStatus?: ErfExtractionStatus;
    identityMatchStatus?: ErfIdentityMatchStatus | null;
    identityMatchReason?: string | null;
  } | null;

  if (!response.ok || !payload || payload.success !== true) {
    const serverUnavailable = response.status >= 500 && !payload?.error;
    return {
      success: false,
      code:
        typeof payload?.code === "string"
          ? payload.code
          : serverUnavailable
            ? "SERVER_UNAVAILABLE"
            : null,
      error:
        typeof payload?.error === "string" && payload.error
          ? payload.error
          : serverUnavailable
            ? DOCUMENT_READER_UNAVAILABLE_MESSAGE
            : "This document could not be read right now.",
      extractionStatus: payload?.extractionStatus ?? null,
      identityMatchStatus: payload?.identityMatchStatus ?? null,
    };
  }

  return {
    success: true,
    extractionStatus: payload.extractionStatus ?? "ready",
    claimCount: typeof payload.claimCount === "number" ? payload.claimCount : 0,
    documentType: payload.documentType ?? null,
    warning: payload.warning ?? null,
    identityMatchStatus: payload.identityMatchStatus ?? null,
  };
}
