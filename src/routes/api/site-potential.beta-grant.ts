import { createFileRoute } from "@tanstack/react-router";
import { grantBetaCredits } from "@/lib/sitePotential/betaServer";
import { isBetaAdminAllowed } from "@/lib/sitePotential/betaEntitlements";
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

export const Route = createFileRoute("/api/site-potential/beta-grant")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => handleBetaGrantRequest(request),
    },
  },
});

export async function handleBetaGrantRequest(request: Request) {
  let body: { targetUserId?: string; credits?: number; reason?: string; expiresAt?: string } = {};
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "Request body must be valid JSON." }, 400);
  }
  if (!body.targetUserId) {
    return json({ success: false, error: "targetUserId is required." }, 400);
  }
  if (!body.reason?.trim()) {
    return json({ success: false, error: "A grant reason is required." }, 400);
  }

  try {
    const { user } = await authenticateApiRequest(request);
    const allowed = isBetaAdminAllowed(process.env, user);
    if (!allowed.allowed) {
      return json({ success: false, error: allowed.reason }, 403);
    }
    const result = await grantBetaCredits({
      serviceSupabase: createServiceRoleSupabaseClient(),
      targetUserId: body.targetUserId,
      grantedBy: user.id,
      credits: Number(body.credits ?? 1),
      reason: body.reason,
      expiresAt: body.expiresAt ?? null,
    });
    if (!result.ok) return json({ success: false, error: result.error }, result.status);
    return json({ success: true, credit: result.credit }, 200);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return json({ success: false, error: error.message }, error.status);
    }
    return json({ success: false, error: "Could not grant beta credits." }, 500);
  }
}

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
