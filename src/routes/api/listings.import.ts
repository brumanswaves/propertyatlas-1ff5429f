import { createFileRoute } from "@tanstack/react-router";
import { importListing } from "@/lib/listingImport/importListing";
import { statusForError, type ListingImportDependencies } from "@/lib/listingImport/types";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

export const Route = createFileRoute("/api/listings/import")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => handleListingImportRequest(request),
    },
  },
});

export async function handleListingImportRequest(
  request: Request,
  deps: ListingImportDependencies = {},
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(
      {
        success: false,
        error: {
          code: "INVALID_URL",
          message: "Request body must be valid JSON.",
        },
      },
      400,
    );
  }

  const result = await importListing(body as { url: string; selectedParcelId?: string | null }, deps);
  if (result.success) return json(result, 200);
  const status = statusForError(result.error.code);
  return json(result, status);
}

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
