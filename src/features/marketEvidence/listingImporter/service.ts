// Frontend service wrapper for the listing URL importer.
// The real deterministic + OpenAI-backed extraction pipeline lives server-side
// at POST /api/listings/import (built by the backend/Codex phase). This wrapper
// only handles HTTP and typed error mapping. It NEVER performs scraping or
// contains API keys — those responsibilities belong to the server.

import type {
  ListingImportError,
  ListingImportRequest,
  ListingImportResponse,
} from "./types";

const IMPORT_ENDPOINT = "/api/listings/import";

function toError(code: ListingImportError["code"], message: string, details?: string): ListingImportResponse {
  return { success: false, error: { code, message, details } };
}

export function isValidHttpUrl(input: string): boolean {
  try {
    const u = new URL(input.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function importListingFromUrl(
  request: ListingImportRequest,
  init?: { signal?: AbortSignal },
): Promise<ListingImportResponse> {
  if (!isValidHttpUrl(request.url)) {
    return toError("INVALID_URL", "Please paste a full property listing URL that starts with http:// or https://.");
  }

  let response: Response;
  try {
    response = await fetch(IMPORT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: request.url.trim(),
        selectedParcelId: request.selectedParcelId ?? null,
      }),
      signal: init?.signal,
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      return toError("UNKNOWN", "Import was cancelled.");
    }
    return toError("NETWORK_ERROR", "Could not reach the import service. Check your connection and try again.");
  }

  if (response.status === 501 || response.status === 404) {
    return toError(
      "NOT_CONFIGURED",
      "The listing import service is not yet configured on this deployment.",
      "The POST /api/listings/import endpoint responded with " + response.status + ".",
    );
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // fall through
  }

  if (!response.ok) {
    const err = (payload as { error?: ListingImportError } | null)?.error;
    if (err && typeof err === "object" && typeof err.code === "string") {
      return { success: false, error: err };
    }
    return toError("UNKNOWN", `Import failed (HTTP ${response.status}).`);
  }

  if (
    payload &&
    typeof payload === "object" &&
    (payload as { success?: unknown }).success === true &&
    (payload as { listing?: unknown }).listing
  ) {
    return payload as ListingImportResponse;
  }

  return toError("UNKNOWN", "The import service returned an unexpected response.");
}
