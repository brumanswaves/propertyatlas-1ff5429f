import { createFileRoute } from "@tanstack/react-router";
import {
  resolveSitePotentialRuntimeReadiness,
  sitePotentialRuntimeMessage,
} from "@/lib/sitePotential/betaEntitlements";
import { consumeSitePotentialEntitlement } from "@/lib/sitePotential/betaServer";
import {
  formatQueueStatus,
  queueSitePotentialGeneration,
} from "@/lib/sitePotential/generationSupabaseWorker";
import { sourceAssetsForGenerationMode } from "@/lib/sitePotential/generationJobs";
import {
  ApiRequestError,
  authenticateApiRequest,
  createServiceRoleSupabaseClient,
} from "@/lib/sitePotential/serverAuth";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

type AssetRow = ErfAsset & Record<string, unknown>;

export const Route = createFileRoute("/api/site-potential/beta-redeem")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => handleBetaRedeemRequest(request),
    },
  },
});

export async function handleBetaRedeemRequest(request: Request) {
  let body: { parcelId?: string; siteProjectId?: string; requestId?: string } = {};
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "Request body must be valid JSON." }, 400);
  }
  if (!body.parcelId || !body.siteProjectId) {
    return json({ success: false, error: "parcelId and siteProjectId are required." }, 400);
  }

  try {
    const runtime = resolveSitePotentialRuntimeReadiness(process.env);
    if (!runtime.ready) {
      return json(
        {
          success: false,
          code: runtime.status,
          error: `${sitePotentialRuntimeMessage(runtime.status)} No free allowance or credit has been used.`,
        },
        runtime.status === "GENERATION_DISABLED" ? 403 : 503,
      );
    }

    const { supabase, user } = await authenticateApiRequest(request);
    const serviceSupabase = createServiceRoleSupabaseClient();

    const { data: project, error: projectError } = await supabase
      .from("erf_site_projects")
      .select("*")
      .eq("id", body.siteProjectId)
      .eq("parcel_id", body.parcelId)
      .eq("user_id", user.id)
      .single();
    if (projectError || !project) {
      return json({ success: false, error: "Site Potential project not found." }, 404);
    }
    if (project.mode !== "vacant_land" && project.mode !== "renovation") {
      return json(
        { success: false, error: "Choose a Site Potential mode before generating." },
        400,
      );
    }
    if (project.mode === "renovation" && !project.rights_confirmed_at) {
      return json(
        { success: false, error: "Confirm image rights before generating renovation concepts." },
        400,
      );
    }

    const { data: inputAssets, error: assetsError } = await serviceSupabase
      .from("erf_assets")
      .select("*")
      .eq("user_id", user.id)
      .eq("parcel_id", body.parcelId)
      .neq("status", "deleted");
    if (assetsError) throw new Error(assetsError.message);
    const sourceAssets = sourceAssetsForGenerationMode(
      project.mode,
      (inputAssets ?? []) as AssetRow[],
    );
    if (
      project.mode === "renovation" &&
      !sourceAssets.some((asset) => asset.asset_category === "existing_house_photo")
    ) {
      return json(
        { success: false, error: "Upload at least one permitted property photo first." },
        400,
      );
    }

    const entitlement = await consumeSitePotentialEntitlement({
      serviceSupabase,
      userId: user.id,
      parcelId: body.parcelId,
      siteProjectId: body.siteProjectId,
      requestId: body.requestId || crypto.randomUUID(),
    });
    if (!entitlement.ok) {
      return json({ success: false, error: entitlement.error }, entitlement.status);
    }

    const queued = await queueSitePotentialGeneration({
      serviceSupabase,
      userId: user.id,
      parcelId: body.parcelId,
      siteProjectId: body.siteProjectId,
      designPackId: entitlement.designPackId,
    });
    if (!queued.ok) return json({ success: false, error: queued.error }, queued.status);

    return json(
      {
        success: true,
        accepted: queued.status !== "complete",
        durableJobQueued: queued.status !== "complete",
        paymentProvider: entitlement.entitlementSource,
        designPackId: entitlement.designPackId,
        creditsRemaining: entitlement.betaCreditsRemaining,
        betaCreditsRemaining: entitlement.betaCreditsRemaining,
        purchasedCreditsRemaining: entitlement.purchasedCreditsRemaining,
        message:
          queued.status === "complete"
            ? "Concept pack is already complete."
            : "Three independent property concepts have been queued for generation.",
        ...formatQueueStatus(queued.items),
      },
      queued.status === "complete" ? 200 : 202,
    );
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return json({ success: false, error: error.message }, error.status);
    }
    return json({ success: false, error: "Beta credit redemption failed." }, 500);
  }
}

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
