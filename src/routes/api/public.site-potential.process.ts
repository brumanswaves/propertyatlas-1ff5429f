import { createFileRoute } from "@tanstack/react-router";
import {
  handleProcessSitePotentialRequest,
  SITE_POTENTIAL_WORKER_CORS_HEADERS,
} from "@/lib/sitePotential/processWorkerRequest";

export const Route = createFileRoute("/api/public/site-potential/process")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: SITE_POTENTIAL_WORKER_CORS_HEADERS }),
      POST: async ({ request }) => handleProcessSitePotentialRequest(request),
    },
  },
});
