import { createFileRoute } from "@tanstack/react-router";
import { handleInvestigationAssetRequest } from "@/lib/investigation/investigationAssetServer";

export const Route = createFileRoute("/api/investigations/asset")({
  server: { handlers: { POST: ({ request }) => handleInvestigationAssetRequest(request) } },
});
