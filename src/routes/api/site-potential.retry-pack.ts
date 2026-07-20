import { createFileRoute } from "@tanstack/react-router";
import { retrySitePotentialPack } from "@/lib/sitePotential/betaServer";
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

export const Route = createFileRoute("/api/site-potential/retry-pack")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => handleSitePotentialRetryPackRequest(request),
    },
  },
});

export async function handleSitePotentialRetryPackRequest(request: Request) {
  let body: { parcelId?: string; siteProjectId?: string; designPackId?: string } = {};
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "Request body must be valid JSON." }, 400);
  }
  if (!body.parcelId || !body.siteProjectId || !body.designPackId) {
    return json(
      { success: false, error: "parcelId, siteProjectId and designPackId are required." },
      400,
    );
  }

  try {
    const { user } = await authenticateApiRequest(request);
    const result = await retrySitePotentialPack({
      serviceSupabase: createServiceRoleSupabaseClient(),
      userId: user.id,
      parcelId: body.parcelId,
      siteProjectId: body.siteProjectId,
      designPackId: body.designPackId,
    });
    if (!result.ok) return json({ success: false, error: result.error }, result.status);
    return json({ success: true, retried: result.retried, ...result.pack }, 200);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return json({ success: false, error: error.message }, error.status);
    }
    return json({ success: false, error: "Could not retry Site Potential generation." }, 500);
  }
}

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
