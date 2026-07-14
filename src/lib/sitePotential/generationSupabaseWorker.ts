import { SITE_POTENTIAL_PACK_SIZE } from "./config";
import { requestImageEditWithOpenAI, requestImageGenerationWithOpenAI } from "./generation";
import {
  designPackItemRows,
  designPackStatusFromItems,
  leaseExpiresAt,
  sanitizedGenerationError,
  SITE_POTENTIAL_MAX_ATTEMPTS,
  type DesignPackItemStatus,
} from "./generationJobs";
import type {
  ExistingGeneratedAsset,
  FinalizeGeneratedItemInput,
  GenerationWorkerClaim,
  GenerationWorkerContext,
  MarkGenerationFailureInput,
  SitePotentialGenerationStore,
  SitePotentialImageClient,
  StoredReferenceAsset,
  UploadedGeneratedImage,
} from "./generationWorker";
import { createServiceRoleSupabaseClient } from "./serverAuth";
import {
  ERF_FILE_BUCKET,
  buildErfAssetStoragePath,
  safeFileName,
} from "@/lib/workbench/erfFileVault";
import type { SitePotentialProject } from "./types";

type SupabaseServiceClient = ReturnType<typeof createServiceRoleSupabaseClient>;

interface DbError {
  message: string;
}

interface RpcClient {
  rpc<T>(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ data: T | null; error: DbError | null }>;
}

type DesignPackItemRow = {
  id: string;
  user_id: string;
  design_pack_id: string;
  option_index: number;
  status: DesignPackItemStatus;
  generated_asset_id: string | null;
  attempt_count: number;
  failure_code: string | null;
  failure_message: string | null;
  lease_expires_at?: string | null;
  next_attempt_at?: string | null;
  worker_id?: string | null;
};

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

type AssetRow = StoredReferenceAsset & {
  asset_type?: string | null;
  source_label?: string | null;
  size_bytes?: number | null;
  metadata?: Record<string, unknown>;
};

export const openAiSitePotentialImageClient: SitePotentialImageClient = {
  generate: requestImageGenerationWithOpenAI,
  edit: requestImageEditWithOpenAI,
};

function rpc<T>(
  serviceSupabase: SupabaseServiceClient,
  name: string,
  args: Record<string, unknown>,
) {
  return (serviceSupabase as unknown as RpcClient).rpc<T>(name, args);
}

export async function queueSitePotentialGeneration(input: {
  serviceSupabase: SupabaseServiceClient;
  userId: string;
  parcelId: string;
  siteProjectId: string;
  designPackId: string;
}) {
  const { data: pack, error: packError } = await input.serviceSupabase
    .from("erf_design_packs")
    .select("*")
    .eq("id", input.designPackId)
    .eq("site_project_id", input.siteProjectId)
    .eq("user_id", input.userId)
    .single();
  if (packError || !pack) {
    return { ok: false as const, status: 404, error: "Design entitlement not found." };
  }
  const designPack = pack as DesignPackRow;
  if (designPack.entitlement_status !== "paid") {
    return {
      ok: false as const,
      status: 402,
      error: "Verified payment or test entitlement is required.",
    };
  }

  const { error: itemError } = await input.serviceSupabase
    .from("erf_design_pack_items")
    .upsert(designPackItemRows({ userId: input.userId, designPackId: input.designPackId }), {
      onConflict: "design_pack_id,option_index",
      ignoreDuplicates: true,
    });
  if (itemError) throw new Error(itemError.message);

  const items = await readDesignPackItems(input.serviceSupabase, input.designPackId, input.userId);
  const status = designPackStatusFromItems(items);
  if (status.status !== "complete" && status.status !== "generating") {
    const packUpdate = {
      status: status.status,
      next_attempt_at: new Date().toISOString(),
      ...(status.hasRetryableWork ? { failure_code: null, failure_message: null } : {}),
    };
    await input.serviceSupabase
      .from("erf_design_packs")
      .update(packUpdate)
      .eq("id", input.designPackId)
      .eq("user_id", input.userId);
  }
  await input.serviceSupabase
    .from("erf_site_projects")
    .update({ generation_status: status.status === "complete" ? "concepts_ready" : "generating" })
    .eq("id", input.siteProjectId)
    .eq("user_id", input.userId);

  return {
    ok: true as const,
    status: status.status === "complete" ? "complete" : "queued",
    items,
    completedCount: status.completedCount,
  };
}

export function createSupabaseGenerationStore(
  serviceSupabase: SupabaseServiceClient,
): SitePotentialGenerationStore {
  return {
    async recoverStaleJobs(now) {
      const { data, error } = await rpc<
        Array<{ recovered_items: number; recovered_packs: number }>
      >(serviceSupabase, "recover_stale_site_potential_jobs", {
        p_now: now.toISOString(),
        p_max_attempts: SITE_POTENTIAL_MAX_ATTEMPTS,
      });
      if (error) throw new Error(error.message);
      const row = data?.[0];
      return {
        recoveredItems: Number(row?.recovered_items ?? 0),
        recoveredPacks: Number(row?.recovered_packs ?? 0),
      };
    },
    async claimNextItem(workerId, now) {
      const { data, error } = await rpc<
        Array<{
          item_id: string;
          user_id: string;
          design_pack_id: string;
          site_project_id: string;
          parcel_id: string;
          option_index: number;
          attempt_count: number;
        }>
      >(serviceSupabase, "claim_next_site_potential_item", {
        p_worker_id: workerId,
        p_lease_expires_at: leaseExpiresAt(now),
        p_now: now.toISOString(),
        p_max_attempts: SITE_POTENTIAL_MAX_ATTEMPTS,
      });
      if (error) throw new Error(error.message);
      const row = data?.[0];
      if (!row) return null;
      return {
        itemId: row.item_id,
        workerId,
        userId: row.user_id,
        designPackId: row.design_pack_id,
        siteProjectId: row.site_project_id,
        parcelId: row.parcel_id,
        optionIndex: Number(row.option_index),
        attemptCount: Number(row.attempt_count),
      };
    },
    async loadContext(claim) {
      const { data: project, error: projectError } = await serviceSupabase
        .from("erf_site_projects")
        .select("*")
        .eq("id", claim.siteProjectId)
        .eq("user_id", claim.userId)
        .single();
      if (projectError || !project) throw new Error("Site Potential project not found.");
      const { data: assets, error: assetsError } = await serviceSupabase
        .from("erf_assets")
        .select("*")
        .eq("user_id", claim.userId)
        .eq("parcel_id", claim.parcelId)
        .neq("status", "deleted");
      if (assetsError) throw new Error(assetsError.message);
      return {
        project: project as SitePotentialProject,
        inputAssets: (assets ?? []) as AssetRow[],
      } satisfies GenerationWorkerContext;
    },
    async findExistingAssetForItem(claim) {
      const { data, error } = await serviceSupabase
        .from("erf_assets")
        .select("id")
        .eq("user_id", claim.userId)
        .eq("parcel_id", claim.parcelId)
        .eq("asset_category", "generated_design")
        .contains("metadata", { designPackItemId: claim.itemId })
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? ({ id: String(data.id) } satisfies ExistingGeneratedAsset) : null;
    },
    async findPrimaryConceptReference(claim) {
      const { data, error } = await serviceSupabase
        .from("erf_assets")
        .select("*")
        .eq("user_id", claim.userId)
        .eq("parcel_id", claim.parcelId)
        .eq("asset_category", "generated_design")
        .contains("metadata", { designPackId: claim.designPackId, optionIndex: 1 })
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? (data as AssetRow satisfies StoredReferenceAsset) : null;
    },
    async renewLease(claim, now) {
      const { data, error } = await rpc<boolean>(
        serviceSupabase,
        "renew_site_potential_item_lease",
        {
          p_item_id: claim.itemId,
          p_worker_id: claim.workerId,
          p_lease_expires_at: leaseExpiresAt(now),
          p_now: now.toISOString(),
        },
      );
      if (error) throw new Error(error.message);
      return data === true;
    },
    async downloadReferenceAsset(asset) {
      const { data, error } = await serviceSupabase.storage
        .from(asset.storage_bucket || ERF_FILE_BUCKET)
        .download(String(asset.storage_path));
      if (error || !data) {
        throw new Error("Could not retrieve permitted source photograph from the Erf File Vault.");
      }
      return {
        bytes: new Uint8Array(await data.arrayBuffer()),
        mimeType: asset.mime_type || data.type || "image/png",
        fileName: asset.original_file_name || "easy-erf-reference.png",
      };
    },
    async uploadGeneratedImage(claim, imageBytes) {
      const assetId = crypto.randomUUID();
      const fileName = safeFileName(`easy-erf-concept-${claim.optionIndex}.png`);
      const storagePath = buildErfAssetStoragePath({
        userId: claim.userId,
        parcelId: claim.parcelId,
        category: "generated_design",
        assetId,
        fileName,
      });
      const { error } = await serviceSupabase.storage
        .from(ERF_FILE_BUCKET)
        .upload(storagePath, imageBytes, {
          contentType: "image/png",
          upsert: false,
        });
      if (error) throw new Error(error.message);
      return {
        assetId,
        storageBucket: ERF_FILE_BUCKET,
        storagePath,
        fileName,
        mimeType: "image/png",
        sizeBytes: imageBytes.byteLength,
      };
    },
    async removeUploadedImage(upload) {
      await serviceSupabase.storage.from(upload.storageBucket).remove([upload.storagePath]);
    },
    async finalizeGeneratedItem(input) {
      const { data, error } = await rpc<AssetRow>(serviceSupabase, "finalize_site_potential_item", {
        p_worker_id: input.claim.workerId,
        p_item_id: input.claim.itemId,
        p_asset_id: input.upload.assetId,
        p_user_id: input.claim.userId,
        p_parcel_id: input.claim.parcelId,
        p_site_project_id: input.claim.siteProjectId,
        p_asset_type: input.assetType,
        p_storage_bucket: input.upload.storageBucket,
        p_storage_path: input.upload.storagePath,
        p_original_file_name: input.upload.fileName,
        p_mime_type: input.upload.mimeType,
        p_size_bytes: input.upload.sizeBytes,
        p_metadata: input.metadata,
      });
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Generated design finalisation did not return an asset.");
      return { id: data.id };
    },
    async finalizeExistingAsset(claim, asset) {
      const { error } = await serviceSupabase
        .from("erf_design_pack_items")
        .update({
          status: "complete",
          generated_asset_id: asset.id,
          worker_id: null,
          lease_expires_at: null,
          failure_code: null,
          failure_message: null,
        })
        .eq("id", claim.itemId)
        .eq("user_id", claim.userId);
      if (error) throw new Error(error.message);
    },
    async markItemFailed(input) {
      const { error } = await serviceSupabase
        .from("erf_design_pack_items")
        .update({
          status: "failed",
          worker_id: null,
          lease_expires_at: null,
          failure_code: input.code,
          failure_message: input.message,
          next_attempt_at: input.retryable ? input.nextAttemptAt : null,
        })
        .eq("id", input.claim.itemId)
        .eq("user_id", input.claim.userId);
      if (error) throw new Error(error.message);
      const items = await readDesignPackItems(
        serviceSupabase,
        input.claim.designPackId,
        input.claim.userId,
      );
      const status = designPackStatusFromItems(items);
      const { error: packError } = await serviceSupabase
        .from("erf_design_packs")
        .update({
          status: status.status,
          completed_count: status.completedCount,
          worker_id: null,
          lease_expires_at: null,
          heartbeat_at: new Date().toISOString(),
          failure_code: input.code,
          failure_message: input.message,
          next_attempt_at: input.nextAttemptAt ?? new Date().toISOString(),
        })
        .eq("id", input.claim.designPackId)
        .eq("user_id", input.claim.userId);
      if (packError) throw new Error(packError.message);
      const { error: projectError } = await serviceSupabase
        .from("erf_site_projects")
        .update({
          generation_status:
            status.status === "complete"
              ? "concepts_ready"
              : status.terminal
                ? "failed"
                : "generating",
        })
        .eq("id", input.claim.siteProjectId)
        .eq("user_id", input.claim.userId);
      if (projectError) throw new Error(projectError.message);
    },
  };
}

async function readDesignPackItems(
  serviceSupabase: SupabaseServiceClient,
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

export function formatQueueStatus(items: DesignPackItemRow[]) {
  const status = designPackStatusFromItems(items);
  return {
    status: status.status,
    completedCount: status.completedCount,
    hasRetryableWork: status.hasRetryableWork,
    terminal: status.terminal,
    requestedCount: SITE_POTENTIAL_PACK_SIZE,
    items: items.map((item) => ({
      id: item.id,
      optionIndex: item.option_index,
      status: item.status,
      generatedAssetId: item.generated_asset_id,
      attemptCount: item.attempt_count,
      failureCode: item.failure_code,
      failureMessage: sanitizedGenerationError(item.failure_message ?? ""),
    })),
  };
}
