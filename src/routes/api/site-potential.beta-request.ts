import { createFileRoute } from "@tanstack/react-router";
import { isSitePotentialBetaEnabled } from "@/lib/sitePotential/betaEntitlements";
import { requestBetaAccess } from "@/lib/sitePotential/betaServer";
import {
  ApiRequestError,
  authenticateApiRequest,
  createServiceRoleSupabaseClient,
} from "@/lib/sitePotential/serverAuth";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

export const Route = createFileRoute("/api/site-potential/beta-request")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => handleBetaRequest(request),
    },
  },
});

export async function handleBetaRequest(request: Request) {
  let body: { parcelId?: string; requestedMode?: string; reason?: string } = {};
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "Request body must be valid JSON." }, 400);
  }

  try {
    if (!isSitePotentialBetaEnabled(process.env)) {
      return json({ success: false, error: "Site Potential beta access is disabled." }, 403);
    }
    const { user } = await authenticateApiRequest(request);
    const result = await requestBetaAccess({
      serviceSupabase: createServiceRoleSupabaseClient(),
      userId: user.id,
      email: user.email,
      parcelId: body.parcelId,
      requestedMode: body.requestedMode,
      reason: body.reason || "Requested from Site Potential beta UI.",
    });
    return json({ success: true, created: result.created, request: result.request }, 200);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return json({ success: false, error: error.message }, error.status);
    }
    return json({ success: false, error: "Could not request beta access." }, 500);
  }
}

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
