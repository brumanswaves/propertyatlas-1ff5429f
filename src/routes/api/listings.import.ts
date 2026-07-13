// Stub endpoint for the listing URL importer.
//
// The real listing extraction pipeline belongs in a later backend phase. Until
// that lands, this route returns a typed 501 so
// the frontend can surface a clear "not configured" state without ever
// fabricating imported listing data.
import { createFileRoute } from "@tanstack/react-router";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

export const Route = createFileRoute("/api/listings/import")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async () => {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "SERVICE_NOT_CONFIGURED",
              message:
                "Listing import service is not connected yet. You can still save evidence manually below.",
              details:
                "Backend implementation of POST /api/listings/import is pending.",
            },
          }),
          {
            status: 501,
            headers: { "Content-Type": "application/json", ...CORS_HEADERS },
          },
        );
      },
    },
  },
});
