import { createFileRoute } from "@tanstack/react-router";
import { readSitePotentialAccessStatus } from "@/lib/sitePotential/betaServer";
import { resolveSitePotentialRuntimeReadiness } from "@/lib/sitePotential/betaEntitlements";
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
    const runtime = resolveSitePotentialRuntimeReadiness(process.env);
    if (!runtime.ready) {
      return json(
        {
          success: true,
          enabled: runtime.status !== "GENERATION_DISABLED",
          creditsRemaining: 0,
          canGenerate: false,
          runtimeStatus: runtime.status,
        },
        200,
      );
    }
    const { user } = await authenticateApiRequest(request);
    const parcelId = new URL(request.url).searchParams.get("parcelId");
    const status = await readSitePotentialAccessStatus({
      serviceSupabase: createServiceRoleSupabaseClient(),
      userId: user.id,
      parcelId,
    });
    return json({ success: true, enabled: true, runtimeStatus: runtime.status, ...status }, 200);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return json({ success: false, error: error.message }, error.status);
    }
    return json({ success: false, error: "Could not read Site Potential access status." }, 500);
  }
}

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
