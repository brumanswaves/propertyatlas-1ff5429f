import { createFileRoute } from "@tanstack/react-router";
import { handleInvestigationReviewRequest } from "@/lib/investigation/investigationReviewServer";

export const Route = createFileRoute("/api/investigations/review")({
  server: { handlers: { POST: ({ request }) => handleInvestigationReviewRequest(request) } },
});
