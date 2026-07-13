// Stub endpoint for the listing URL importer.
//
// The real deterministic + OpenAI-backed extraction pipeline is built in the
// backend (Codex) phase. Until that lands, this route returns a typed 501 so
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
              code: "NOT_CONFIGURED",
              message:
                "The listing import service is not yet configured on this deployment.",
              details:
                "Backend implementation of the deterministic + AI extraction pipeline is pending.",
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
