import { createFileRoute } from "@tanstack/react-router";
import { readSitePotentialPackStatus } from "@/lib/sitePotential/betaServer";
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

export const Route = createFileRoute("/api/site-potential/pack-status")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => handleSitePotentialPackStatusRequest(request),
    },
  },
});

export async function handleSitePotentialPackStatusRequest(request: Request) {
  const url = new URL(request.url);
  const parcelId = url.searchParams.get("parcelId");
  const siteProjectId = url.searchParams.get("siteProjectId");
  const designPackId = url.searchParams.get("designPackId");

  if (!parcelId || !siteProjectId) {
    return json({ success: false, error: "parcelId and siteProjectId are required." }, 400);
  }

  try {
    const { user } = await authenticateApiRequest(request);
    const result = await readSitePotentialPackStatus({
      serviceSupabase: createServiceRoleSupabaseClient(),
      userId: user.id,
      parcelId,
      siteProjectId,
      designPackId,
    });
    if (!result.ok) {
      return json({ success: false, error: result.error }, result.status);
    }
    return json({ success: true, ...result.pack }, 200);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return json({ success: false, error: error.message }, error.status);
    }
    return json({ success: false, error: "Could not read Site Potential pack status." }, 500);
  }
}

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
