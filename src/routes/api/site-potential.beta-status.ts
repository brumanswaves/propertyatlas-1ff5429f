import { createFileRoute } from "@tanstack/react-router";
import { readBetaCreditStatus } from "@/lib/sitePotential/betaServer";
import { isSitePotentialBetaEnabled } from "@/lib/sitePotential/betaEntitlements";
import {
  ApiRequestError,
  authenticateApiRequest,
  createServiceRoleSupabaseClient,
} from "@/lib/sitePotential/serverAuth";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

export const Route = createFileRoute("/api/site-potential/beta-status")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => handleBetaStatusRequest(request),
    },
  },
});

export async function handleBetaStatusRequest(request: Request) {
  try {
    const { user } = await authenticateApiRequest(request);
    const enabled = isSitePotentialBetaEnabled(process.env);
    if (!enabled) {
      return json({ success: true, enabled: false, creditsRemaining: 0 }, 200);
    }
    const status = await readBetaCreditStatus({
      serviceSupabase: createServiceRoleSupabaseClient(),
      userId: user.id,
    });
    return json({ success: true, enabled, ...status }, 200);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return json({ success: false, error: error.message }, error.status);
    }
    return json({ success: false, error: "Could not read beta credit status." }, 500);
  }
}

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
