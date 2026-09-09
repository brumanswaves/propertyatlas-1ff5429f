import { createFileRoute } from "@tanstack/react-router";
import { handleInvestigationUploadRequest } from "@/lib/investigation/investigationUploadServer";

export const Route = createFileRoute("/api/investigations/upload")({
  server: { handlers: { POST: ({ request }) => handleInvestigationUploadRequest(request) } },
});
