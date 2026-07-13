import { createFileRoute } from "@tanstack/react-router";
import { SITE_POTENTIAL_DISCLAIMER, SITE_POTENTIAL_PACK_SIZE } from "@/lib/sitePotential/config";
import {
  buildSitePotentialPrompt,
  generateImageBase64WithOpenAI,
  openAiImageModelFromEnv,
} from "@/lib/sitePotential/generation";
import { authenticateApiRequest } from "@/lib/sitePotential/serverAuth";
import {
  ERF_FILE_BUCKET,
  buildErfAssetStoragePath,
  safeFileName,
} from "@/lib/workbench/erfFileVault";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

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
    const { supabase, user } = await authenticateApiRequest(request);

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

    const { data: inputAssets, error: assetsError } = await supabase
      .from("erf_assets")
      .select("*")
      .eq("user_id", user.id)
      .eq("parcel_id", body.parcelId)
      .neq("status", "deleted");
    if (assetsError) throw new Error(assetsError.message);
    const renovationPhotoCount = (inputAssets ?? []).filter(
      (asset: Record<string, unknown>) => asset.asset_category === "existing_house_photo",
    ).length;
    if (project.mode === "renovation" && renovationPhotoCount === 0) {
      return json(
        { success: false, error: "Upload at least one permitted property photo first." },
        400,
      );
    }

    const { data: pack, error: packError } = await supabase
      .from("erf_design_packs")
      .select("*")
      .eq("id", body.designPackId)
      .eq("site_project_id", body.siteProjectId)
      .eq("user_id", user.id)
      .single();
    if (packError || !pack) {
      return json({ success: false, error: "Design entitlement not found." }, 404);
    }
    if (pack.entitlement_status !== "paid") {
      return json(
        { success: false, error: "Verified payment or test entitlement is required." },
        402,
      );
    }
    if (pack.status === "complete") {
      const { data: existing } = await supabase
        .from("erf_assets")
        .select("*")
        .eq("user_id", user.id)
        .eq("parcel_id", body.parcelId)
        .eq("asset_category", "generated_design")
        .contains("metadata", { designPackId: body.designPackId });
      return json({ success: true, reused: true, assets: existing ?? [] }, 200);
    }

    await supabase
      .from("erf_design_packs")
      .update({ status: "generating" })
      .eq("id", body.designPackId)
      .eq("user_id", user.id);
    await supabase
      .from("erf_site_projects")
      .update({ generation_status: "generating" })
      .eq("id", body.siteProjectId)
      .eq("user_id", user.id);

    const generatedAssets: unknown[] = [];
    const failures: string[] = [];
    for (let i = 0; i < SITE_POTENTIAL_PACK_SIZE; i += 1) {
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
        i,
      );
      try {
        const b64 = await generateImageBase64WithOpenAI(prompt);
        const imageBytes = Uint8Array.from(Buffer.from(b64, "base64"));
        const assetId = crypto.randomUUID();
        const fileName = safeFileName(`easy-erf-concept-${i + 1}.png`);
        const storagePath = buildErfAssetStoragePath({
          userId: user.id,
          parcelId: body.parcelId,
          category: "generated_design",
          assetId,
          fileName,
        });
        const { error: uploadError } = await supabase.storage
          .from(ERF_FILE_BUCKET)
          .upload(storagePath, imageBytes, {
            contentType: "image/png",
            upsert: false,
          });
        if (uploadError) throw new Error(uploadError.message);

        const { data: asset, error: assetError } = await supabase
          .from("erf_assets")
          .insert({
            id: assetId,
            user_id: user.id,
            parcel_id: body.parcelId,
            asset_category: "generated_design",
            asset_type: project.mode === "renovation" ? "renovation_concept" : "new_build_concept",
            source_label: "Easy Erf Site Potential AI concept",
            storage_bucket: ERF_FILE_BUCKET,
            storage_path: storagePath,
            original_file_name: fileName,
            mime_type: "image/png",
            size_bytes: imageBytes.byteLength,
            status: "ready",
            metadata: {
              designPackId: body.designPackId,
              siteProjectId: body.siteProjectId,
              optionIndex: i + 1,
              title: `Concept ${i + 1}`,
              model: openAiImageModelFromEnv(),
              disclaimer: SITE_POTENTIAL_DISCLAIMER,
              prompt,
            },
          })
          .select("*")
          .single();
        if (assetError) {
          await supabase.storage.from(ERF_FILE_BUCKET).remove([storagePath]);
          throw new Error(assetError.message);
        }
        await supabase.from("erf_site_project_assets").insert({
          user_id: user.id,
          site_project_id: body.siteProjectId,
          asset_id: assetId,
          role: "generated_option",
          display_order: i + 1,
        });
        generatedAssets.push(asset);
      } catch (error) {
        failures.push(error instanceof Error ? error.message : `Concept ${i + 1} failed.`);
      }
    }

    const complete = generatedAssets.length === SITE_POTENTIAL_PACK_SIZE;
    const status = complete ? "complete" : generatedAssets.length ? "partial_failed" : "failed";
    await supabase
      .from("erf_design_packs")
      .update({
        status,
        completed_count: generatedAssets.length,
        failure_code: failures.length ? "PARTIAL_GENERATION_FAILURE" : null,
        failure_message: failures.join(" | ") || null,
      })
      .eq("id", body.designPackId)
      .eq("user_id", user.id);
    await supabase
      .from("erf_site_projects")
      .update({
        generation_status: generatedAssets.length ? "concepts_ready" : "failed",
      })
      .eq("id", body.siteProjectId)
      .eq("user_id", user.id);

    return json(
      {
        success: generatedAssets.length > 0,
        assets: generatedAssets,
        warnings: failures,
      },
      generatedAssets.length ? 200 : 500,
    );
  } catch (error) {
    return json(
      { success: false, error: error instanceof Error ? error.message : "Generation failed." },
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
