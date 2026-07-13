import { createFileRoute } from "@tanstack/react-router";
import { SITE_POTENTIAL_PACK_SIZE, SITE_POTENTIAL_PRICE_CENTS } from "@/lib/sitePotential/config";
import { authenticateApiRequest } from "@/lib/sitePotential/serverAuth";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

export const Route = createFileRoute("/api/site-potential/dev-entitlement")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => handleDevEntitlementRequest(request),
    },
  },
});

export async function handleDevEntitlementRequest(request: Request) {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.SITE_POTENTIAL_DEV_ENTITLEMENTS !== "true"
  ) {
    return json(
      {
        success: false,
        error: "Development entitlement is disabled in this environment.",
      },
      403,
    );
  }

  let body: { parcelId?: string; siteProjectId?: string } = {};
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "Request body must be valid JSON." }, 400);
  }
  if (!body.parcelId || !body.siteProjectId) {
    return json({ success: false, error: "parcelId and siteProjectId are required." }, 400);
  }

  try {
    const { supabase, user } = await authenticateApiRequest(request);
    const { data: project, error: projectError } = await supabase
      .from("erf_site_projects")
      .select("id,user_id,parcel_id")
      .eq("id", body.siteProjectId)
      .eq("parcel_id", body.parcelId)
      .eq("user_id", user.id)
      .single();
    if (projectError || !project) {
      return json({ success: false, error: "Site Potential project not found." }, 404);
    }
    const idempotencyKey = `dev:${user.id}:${body.siteProjectId}`;
    const { data, error } = await supabase
      .from("erf_design_packs")
      .upsert(
        {
          user_id: user.id,
          parcel_id: body.parcelId,
          site_project_id: body.siteProjectId,
          payment_provider: "development",
          payment_reference: idempotencyKey,
          entitlement_status: "paid",
          idempotency_key: idempotencyKey,
          requested_count: SITE_POTENTIAL_PACK_SIZE,
          completed_count: 0,
          status: "queued",
          prompt_snapshot: {
            provider: "development",
            priceCents: SITE_POTENTIAL_PRICE_CENTS,
            grantedAt: new Date().toISOString(),
          },
        },
        { onConflict: "user_id,idempotency_key" },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return json({ success: true, designPack: data }, 200);
  } catch (error) {
    return json(
      { success: false, error: error instanceof Error ? error.message : "Entitlement failed." },
      500,
    );
  }
}

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
