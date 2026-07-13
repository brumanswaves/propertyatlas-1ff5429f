import { SITE_POTENTIAL_DISCLAIMER, SITE_POTENTIAL_PACK_SIZE } from "./config";
import type { SitePotentialMode } from "./types";

export type DesignPackItemStatus = "queued" | "generating" | "complete" | "failed" | "cancelled";

export interface DesignPackItemLike {
  id: string;
  option_index: number;
  status: DesignPackItemStatus;
  generated_asset_id?: string | null;
  attempt_count?: number | null;
}

export interface SourceAssetLike {
  id: string;
  asset_category: string;
  mime_type?: string | null;
  storage_bucket?: string | null;
  storage_path?: string | null;
  original_file_name?: string | null;
  created_at?: string | null;
}

export const DESIGN_PACK_OPTION_INDEXES = Array.from(
  { length: SITE_POTENTIAL_PACK_SIZE },
  (_, index) => index + 1,
);

export const SITE_POTENTIAL_PROMPT_VERSION = "site-potential-2026-07-secure-v2";

export function designPackItemRows(input: {
  userId: string;
  designPackId: string;
  optionCount?: number;
}) {
  const count = input.optionCount ?? SITE_POTENTIAL_PACK_SIZE;
  return Array.from({ length: count }, (_, index) => ({
    user_id: input.userId,
    design_pack_id: input.designPackId,
    option_index: index + 1,
    status: "queued" as DesignPackItemStatus,
  }));
}

export function retryableDesignPackItems(items: DesignPackItemLike[]) {
  return items
    .filter(
      (item) => !item.generated_asset_id && (item.status === "queued" || item.status === "failed"),
    )
    .sort((a, b) => a.option_index - b.option_index);
}

export function designPackStatusFromItems(items: DesignPackItemLike[]) {
  const completedCount = items.filter(
    (item) => item.status === "complete" && item.generated_asset_id,
  ).length;
  const failedCount = items.filter((item) => item.status === "failed").length;
  const generatingCount = items.filter((item) => item.status === "generating").length;
  if (completedCount >= SITE_POTENTIAL_PACK_SIZE) {
    return { status: "complete" as const, completedCount };
  }
  if (generatingCount > 0) {
    return { status: "generating" as const, completedCount };
  }
  if (completedCount > 0 && failedCount > 0) {
    return { status: "partial_failed" as const, completedCount };
  }
  if (failedCount > 0 && completedCount === 0) {
    return { status: "failed" as const, completedCount };
  }
  return { status: "queued" as const, completedCount };
}

export function sourceAssetsForGenerationMode(mode: SitePotentialMode, assets: SourceAssetLike[]) {
  const active = assets.filter((asset) => asset.storage_path);
  if (mode === "renovation") {
    return active.filter((asset) => asset.asset_category === "existing_house_photo").slice(0, 1);
  }
  return active
    .filter(
      (asset) =>
        asset.asset_category === "site_photo" || asset.asset_category === "inspiration_image",
    )
    .slice(0, 1);
}

export function requiresImageEditPath(mode: SitePotentialMode, sourceAssets: SourceAssetLike[]) {
  return mode === "renovation" || sourceAssets.length > 0;
}

export function buildGeneratedDesignMetadata(input: {
  designPackId: string;
  designPackItemId: string;
  optionIndex: number;
  siteProjectId: string;
  sourceAssetIds: string[];
  model: string;
  prompt: string;
  promptVersion?: string;
}) {
  return {
    designPackId: input.designPackId,
    designPackItemId: input.designPackItemId,
    optionIndex: input.optionIndex,
    siteProjectId: input.siteProjectId,
    sourceAssetIds: input.sourceAssetIds,
    model: input.model,
    promptVersion: input.promptVersion ?? SITE_POTENTIAL_PROMPT_VERSION,
    disclaimer: SITE_POTENTIAL_DISCLAIMER,
    prompt: input.prompt,
  };
}

export function sanitizedGenerationError(error: unknown) {
  const raw = error instanceof Error ? error.message : "Concept generation failed.";
  return raw
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .slice(0, 500);
}
