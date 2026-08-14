import {
  resolveSitePotentialRuntimeReadiness,
  sitePotentialRuntimeMessage,
} from "./betaEntitlements";
import {
  consumeSitePotentialEntitlement,
  readSitePotentialAccessStatus,
  readSitePotentialPackStatus,
  retrySitePotentialPack,
} from "./betaServer";
import {
  formatQueueStatus,
  queueSitePotentialGeneration,
} from "./generationSupabaseWorker";
import { sourceAssetsForGenerationMode } from "./generationJobs";
import {
  ApiRequestError,
  authenticateApiRequest,
  createServiceRoleSupabaseClient,
} from "./serverAuth";
import { sitePotentialServerEnv } from "./runtimeEnv";
import type { SitePotentialMode } from "./runtimeTypes";

export const SITE_POTENTIAL_EDGE_API_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
} as const;

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...SITE_POTENTIAL_EDGE_API_CORS_HEADERS,
    },
  });
}

function methodNotAllowed() {
  return json({ success: false, error: "Method not allowed." }, 405);
}

function runtimeReadiness() {
  return resolveSitePotentialRuntimeReadiness(sitePotentialServerEnv());
}

function isGenerationMode(value: unknown): value is SitePotentialMode {
  return value === "vacant_land" || value === "renovation" || value === "other_building";
}

export async function handleEdgeBetaStatusRequest(request: Request) {
  if (request.method !== "GET") return methodNotAllowed();
  try {
    const runtime = runtimeReadiness();
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
    console.error("Site Potential beta status failed", error);
    return json({ success: false, error: "Could not read Site Potential access status." }, 500);
  }
}

export async function handleEdgeBetaRedeemRequest(request: Request) {
  if (request.method !== "POST") return methodNotAllowed();

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
    const runtime = runtimeReadiness();
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
    if (!isGenerationMode(project.mode) || project.mode === "other_building") {
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
      (inputAssets ?? []) as Parameters<typeof sourceAssetsForGenerationMode>[1],
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
    console.error("Site Potential beta redemption failed", error);
    return json({ success: false, error: "Beta credit redemption failed." }, 500);
  }
}

export async function handleEdgePackStatusRequest(request: Request) {
  if (request.method !== "GET") return methodNotAllowed();

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
    if (!result.ok) return json({ success: false, error: result.error }, result.status);
    return json({ success: true, ...result.pack }, 200);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return json({ success: false, error: error.message }, error.status);
    }
    console.error("Site Potential pack status failed", error);
    return json({ success: false, error: "Could not read Site Potential pack status." }, 500);
  }
}

export async function handleEdgeRetryPackRequest(request: Request) {
  if (request.method !== "POST") return methodNotAllowed();

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
    console.error("Site Potential retry failed", error);
    return json({ success: false, error: "Could not retry Site Potential generation." }, 500);
  }
}

export async function handleSitePotentialEdgeApiRequest(request: Request) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: SITE_POTENTIAL_EDGE_API_CORS_HEADERS,
    });
  }

  const path = new URL(request.url).pathname.replace(/\/+$/, "").split("/").pop() ?? "";
  switch (path) {
    case "beta-status":
      return handleEdgeBetaStatusRequest(request);
    case "beta-redeem":
      return handleEdgeBetaRedeemRequest(request);
    case "pack-status":
      return handleEdgePackStatusRequest(request);
    case "retry-pack":
      return handleEdgeRetryPackRequest(request);
    default:
      return json({ success: false, error: "Site Potential endpoint not found." }, 404);
  }
}
