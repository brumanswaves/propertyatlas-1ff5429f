import { createFileRoute } from "@tanstack/react-router";
import { SITE_POTENTIAL_PACK_SIZE } from "@/lib/sitePotential/config";
import {
  buildSitePotentialPrompt,
  editImageBase64WithOpenAI,
  generateImageBase64WithOpenAI,
  openAiImageModelFromEnv,
  type ImageEditReference,
} from "@/lib/sitePotential/generation";
import {
  buildGeneratedDesignMetadata,
  designPackItemRows,
  designPackStatusFromItems,
  requiresImageEditPath,
  retryableDesignPackItems,
  sanitizedGenerationError,
  sourceAssetsForGenerationMode,
} from "@/lib/sitePotential/generationJobs";
import {
  ApiRequestError,
  authenticateApiRequest,
  createServiceRoleSupabaseClient,
} from "@/lib/sitePotential/serverAuth";
import {
  ERF_FILE_BUCKET,
  buildErfAssetStoragePath,
  safeFileName,
  type ErfAsset,
} from "@/lib/workbench/erfFileVault";
import type { SitePotentialProject } from "@/lib/sitePotential/types";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

type DesignPackRow = {
  id: string;
  user_id: string;
  parcel_id: string;
  site_project_id: string;
  entitlement_status: string;
  requested_count: number;
  completed_count: number;
  status: string;
};

type DesignPackItemRow = {
  id: string;
  user_id: string;
  design_pack_id: string;
  option_index: number;
  status: "queued" | "generating" | "complete" | "failed" | "cancelled";
  generated_asset_id: string | null;
  attempt_count: number;
  failure_code: string | null;
  failure_message: string | null;
};

type AssetRow = ErfAsset & Record<string, unknown>;

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
            "AI concept generation is disabled until the secure entitlement backend is configured.",
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

    const { data: pack, error: packError } = await serviceSupabase
      .from("erf_design_packs")
      .select("*")
      .eq("id", body.designPackId)
      .eq("site_project_id", body.siteProjectId)
      .eq("user_id", user.id)
      .single();
    if (packError || !pack) {
      return json({ success: false, error: "Design entitlement not found." }, 404);
    }
    const designPack = pack as DesignPackRow;
    if (designPack.entitlement_status !== "paid") {
      return json(
        { success: false, error: "Verified payment or test entitlement is required." },
        402,
      );
    }

    await ensureDesignPackItems(serviceSupabase, user.id, designPack.id);
    const currentItems = await readDesignPackItems(serviceSupabase, designPack.id, user.id);
    const currentStatus = designPackStatusFromItems(currentItems);

    if (currentStatus.status === "complete") {
      const assets = await readGeneratedDesignAssets(
        serviceSupabase,
        user.id,
        body.parcelId,
        designPack.id,
      );
      await reconcilePackStatus(serviceSupabase, designPack.id, currentItems, null);
      return json(
        { success: true, reused: true, status: "complete", assets, items: currentItems },
        200,
      );
    }

    const { data: claimedPack, error: claimError } = await serviceSupabase
      .from("erf_design_packs")
      .update({ status: "generating", failure_code: null, failure_message: null })
      .eq("id", designPack.id)
      .eq("user_id", user.id)
      .in("status", ["queued", "partial_failed", "failed"])
      .select("*")
      .maybeSingle();
    if (claimError) throw new Error(claimError.message);
    if (!claimedPack) {
      const items = await readDesignPackItems(serviceSupabase, designPack.id, user.id);
      return json(
        {
          success: true,
          accepted: true,
          status: designPackStatusFromItems(items).status,
          message: "Concept generation is already in progress.",
          items,
        },
        202,
      );
    }

    await serviceSupabase
      .from("erf_site_projects")
      .update({ generation_status: "generating" })
      .eq("id", body.siteProjectId)
      .eq("user_id", user.id);

    const reference = sourceAssets[0]
      ? await downloadReferenceAsset(serviceSupabase, sourceAssets[0] as AssetRow)
      : null;
    const generatedAssets: unknown[] = [];

    const retryItems = retryableDesignPackItems(
      await readDesignPackItems(serviceSupabase, designPack.id, user.id),
    );
    for (const item of retryItems) {
      const claimedItem = await claimDesignPackItem(serviceSupabase, item.id, user.id);
      if (!claimedItem) continue;
      try {
        const prompt = buildSitePotentialPrompt(
          {
            mode: project.mode,
            designBrief: project.design_brief,
            selectedStyle: project.selected_style,
            renovationLevel: project.renovation_level,
            requestedRooms: project.requested_rooms ?? [],
            requestedFeatures: project.requested_features ?? [],
            customInstructions: project.custom_instructions,
            parcelSummary: `Parcel ${body.parcelId}`,
          },
          claimedItem.option_index - 1,
        );
        const b64 =
          requiresImageEditPath(project.mode, sourceAssets) && reference
            ? await editImageBase64WithOpenAI(prompt, reference)
            : await generateImageBase64WithOpenAI(prompt);
        const imageBytes = Uint8Array.from(Buffer.from(b64, "base64"));
        const asset = await storeGeneratedDesign({
          serviceSupabase,
          userId: user.id,
          parcelId: body.parcelId,
          siteProjectId: body.siteProjectId,
          designPackId: designPack.id,
          item: claimedItem,
          project: project as SitePotentialProject,
          prompt,
          sourceAssetIds: sourceAssets.map((asset) => asset.id),
          imageBytes,
        });
        generatedAssets.push(asset);
      } catch (error) {
        await serviceSupabase
          .from("erf_design_pack_items")
          .update({
            status: "failed",
            attempt_count: claimedItem.attempt_count + 1,
            failure_code: "GENERATION_FAILED",
            failure_message: sanitizedGenerationError(error),
          })
          .eq("id", claimedItem.id)
          .eq("user_id", user.id);
      }
    }

    const finalItems = await readDesignPackItems(serviceSupabase, designPack.id, user.id);
    const failedMessages = finalItems
      .filter((item) => item.status === "failed" && item.failure_message)
      .map((item) => `Option ${item.option_index}: ${item.failure_message}`);
    const finalStatus = await reconcilePackStatus(
      serviceSupabase,
      designPack.id,
      finalItems,
      failedMessages.join(" | ") || null,
    );
    await serviceSupabase
      .from("erf_site_projects")
      .update({
        generation_status: finalStatus.completedCount ? "concepts_ready" : "failed",
      })
      .eq("id", body.siteProjectId)
      .eq("user_id", user.id);
    const assets = await readGeneratedDesignAssets(
      serviceSupabase,
      user.id,
      body.parcelId,
      designPack.id,
    );

    return json(
      {
        success: finalStatus.completedCount > 0,
        status: finalStatus.status,
        assets,
        items: finalItems,
        warnings: failedMessages,
        generatedThisRequest: generatedAssets.length,
      },
      finalStatus.completedCount > 0 ? 200 : 500,
    );
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return json({ success: false, error: error.message }, error.status);
    }
    return json({ success: false, error: sanitizedGenerationError(error) }, 500);
  }
}

function isLiveGenerationEnabled() {
  return process.env.SITE_POTENTIAL_GENERATION_ENABLED === "true";
}

async function ensureDesignPackItems(
  serviceSupabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  userId: string,
  designPackId: string,
) {
  const { error } = await serviceSupabase
    .from("erf_design_pack_items")
    .upsert(designPackItemRows({ userId, designPackId }), {
      onConflict: "design_pack_id,option_index",
      ignoreDuplicates: true,
    });
  if (error) throw new Error(error.message);
}

async function readDesignPackItems(
  serviceSupabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  designPackId: string,
  userId: string,
) {
  const { data, error } = await serviceSupabase
    .from("erf_design_pack_items")
    .select("*")
    .eq("design_pack_id", designPackId)
    .eq("user_id", userId)
    .order("option_index", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as DesignPackItemRow[];
}

async function claimDesignPackItem(
  serviceSupabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  itemId: string,
  userId: string,
) {
  const { data, error } = await serviceSupabase
    .from("erf_design_pack_items")
    .update({ status: "generating", failure_code: null, failure_message: null })
    .eq("id", itemId)
    .eq("user_id", userId)
    .is("generated_asset_id", null)
    .in("status", ["queued", "failed"])
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as DesignPackItemRow | null;
}

async function downloadReferenceAsset(
  serviceSupabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  asset: AssetRow,
): Promise<ImageEditReference> {
  const { data, error } = await serviceSupabase.storage
    .from(asset.storage_bucket || ERF_FILE_BUCKET)
    .download(asset.storage_path);
  if (error || !data) {
    throw new Error("Could not retrieve permitted source photograph from the Erf File Vault.");
  }
  const bytes = new Uint8Array(await data.arrayBuffer());
  return {
    bytes,
    mimeType: asset.mime_type || data.type || "image/png",
    fileName: asset.original_file_name || "easy-erf-reference.png",
  };
}

async function storeGeneratedDesign(input: {
  serviceSupabase: ReturnType<typeof createServiceRoleSupabaseClient>;
  userId: string;
  parcelId: string;
  siteProjectId: string;
  designPackId: string;
  item: DesignPackItemRow;
  project: SitePotentialProject;
  prompt: string;
  sourceAssetIds: string[];
  imageBytes: Uint8Array;
}) {
  const assetId = crypto.randomUUID();
  const fileName = safeFileName(`easy-erf-concept-${input.item.option_index}.png`);
  const storagePath = buildErfAssetStoragePath({
    userId: input.userId,
    parcelId: input.parcelId,
    category: "generated_design",
    assetId,
    fileName,
  });
  const { error: uploadError } = await input.serviceSupabase.storage
    .from(ERF_FILE_BUCKET)
    .upload(storagePath, input.imageBytes, {
      contentType: "image/png",
      upsert: false,
    });
  if (uploadError) throw new Error(uploadError.message);

  const { data: asset, error: assetError } = await input.serviceSupabase
    .from("erf_assets")
    .insert({
      id: assetId,
      user_id: input.userId,
      parcel_id: input.parcelId,
      asset_category: "generated_design",
      asset_type: input.project.mode === "renovation" ? "renovation_concept" : "new_build_concept",
      source_label: "Easy Erf Site Potential AI concept",
      storage_bucket: ERF_FILE_BUCKET,
      storage_path: storagePath,
      original_file_name: fileName,
      mime_type: "image/png",
      size_bytes: input.imageBytes.byteLength,
      status: "ready",
      metadata: buildGeneratedDesignMetadata({
        designPackId: input.designPackId,
        designPackItemId: input.item.id,
        optionIndex: input.item.option_index,
        siteProjectId: input.siteProjectId,
        sourceAssetIds: input.sourceAssetIds,
        model: openAiImageModelFromEnv(),
        prompt: input.prompt,
      }),
    })
    .select("*")
    .single();
  if (assetError) {
    await input.serviceSupabase.storage.from(ERF_FILE_BUCKET).remove([storagePath]);
    throw new Error(assetError.message);
  }
  await input.serviceSupabase.from("erf_site_project_assets").insert({
    user_id: input.userId,
    site_project_id: input.siteProjectId,
    asset_id: assetId,
    role: "generated_option",
    display_order: input.item.option_index,
  });
  await input.serviceSupabase
    .from("erf_design_pack_items")
    .update({
      status: "complete",
      generated_asset_id: assetId,
      attempt_count: input.item.attempt_count + 1,
      failure_code: null,
      failure_message: null,
    })
    .eq("id", input.item.id)
    .eq("user_id", input.userId);
  return asset;
}

async function readGeneratedDesignAssets(
  serviceSupabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  userId: string,
  parcelId: string,
  designPackId: string,
) {
  const { data, error } = await serviceSupabase
    .from("erf_assets")
    .select("*")
    .eq("user_id", userId)
    .eq("parcel_id", parcelId)
    .eq("asset_category", "generated_design")
    .contains("metadata", { designPackId });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function reconcilePackStatus(
  serviceSupabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  designPackId: string,
  items: DesignPackItemRow[],
  failureMessage: string | null,
) {
  const next = designPackStatusFromItems(items);
  const { error } = await serviceSupabase
    .from("erf_design_packs")
    .update({
      status: next.status,
      completed_count: next.completedCount,
      failure_code: failureMessage ? "PARTIAL_GENERATION_FAILURE" : null,
      failure_message: failureMessage,
    })
    .eq("id", designPackId);
  if (error) throw new Error(error.message);
  return next;
}

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
