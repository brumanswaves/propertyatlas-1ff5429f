import { createFileRoute } from "@tanstack/react-router";
import {
  formatQueueStatus,
  queueSitePotentialGeneration,
} from "@/lib/sitePotential/generationSupabaseWorker";
import {
  ApiRequestError,
  authenticateApiRequest,
  createServiceRoleSupabaseClient,
} from "@/lib/sitePotential/serverAuth";
import { sourceAssetsForGenerationMode } from "@/lib/sitePotential/generationJobs";
import type { SitePotentialMode } from "@/lib/sitePotential/types";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

type AssetRow = ErfAsset & Record<string, unknown>;

function isGenerationMode(value: unknown): value is SitePotentialMode {
  return value === "vacant_land" || value === "renovation" || value === "other_building";
}

export const Route = createFileRoute("/api/site-potential/generate")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => handleGenerateSitePotentialRequest(request),
    },
  },
});

export async function handleGenerateSitePotentialRequest(request: Request) {
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
    if (!isLiveGenerationEnabled()) {
      return json(
        {
          success: false,
          error:
            "AI concept generation is disabled until the durable worker and entitlement backend are configured.",
        },
        403,
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

    if (!isGenerationMode(project.mode)) {
      return json(
        {
          success: false,
          error: "Choose vacant land or existing-house renovation before generating.",
        },
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
    if (project.mode === "renovation" && sourceAssets.length === 0) {
      return json(
        { success: false, error: "Upload at least one permitted property photo first." },
        400,
      );
    }

    const queued = await queueSitePotentialGeneration({
      serviceSupabase,
      userId: user.id,
      parcelId: body.parcelId,
      siteProjectId: body.siteProjectId,
      designPackId: body.designPackId,
    });
    if (!queued.ok) return json({ success: false, error: queued.error }, queued.status);

    return json(
      {
        success: true,
        accepted: queued.status !== "complete",
        durableJobQueued: queued.status !== "complete",
        message:
          queued.status === "complete"
            ? "Concept pack is already complete."
            : "Concept generation has been queued for the durable Site Potential worker.",
        ...formatQueueStatus(queued.items),
      },
      queued.status === "complete" ? 200 : 202,
    );
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return json({ success: false, error: error.message }, error.status);
    }
    return json({ success: false, error: "Generation queueing failed." }, 500);
  }
}

function isLiveGenerationEnabled() {
  return process.env.SITE_POTENTIAL_GENERATION_ENABLED === "true";
}

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
