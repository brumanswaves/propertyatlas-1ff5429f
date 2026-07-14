import { SITE_POTENTIAL_DISCLAIMER, SITE_POTENTIAL_PACK_SIZE } from "./config";
import type { SitePotentialMode } from "./types";

export type DesignPackItemStatus = "queued" | "generating" | "complete" | "failed" | "cancelled";

export interface DesignPackItemLike {
  id: string;
  option_index: number;
  status: DesignPackItemStatus;
  generated_asset_id?: string | null;
  attempt_count?: number | null;
  lease_expires_at?: string | null;
  next_attempt_at?: string | null;
  worker_id?: string | null;
}

export interface DesignPackStatusResult {
  status: "queued" | "generating" | "complete" | "partial_failed" | "failed";
  completedCount: number;
  hasRetryableWork: boolean;
  terminal: boolean;
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
export const SITE_POTENTIAL_LEASE_MS = 10 * 60 * 1000;
export const SITE_POTENTIAL_LEASE_RENEWAL_MS = 60 * 1000;
export const SITE_POTENTIAL_OPENAI_TIMEOUT_MS = SITE_POTENTIAL_LEASE_MS - 60 * 1000;
export const SITE_POTENTIAL_MAX_ATTEMPTS = 3;

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
      (item) =>
        !item.generated_asset_id &&
        (item.status === "queued" ||
          (item.status === "failed" && (item.attempt_count ?? 0) < SITE_POTENTIAL_MAX_ATTEMPTS)),
    )
    .sort((a, b) => a.option_index - b.option_index);
}

export function leaseExpiresAt(now = new Date(), leaseMs = SITE_POTENTIAL_LEASE_MS) {
  return new Date(now.getTime() + leaseMs).toISOString();
}

export function isLeaseExpired(value: string | null | undefined, now = new Date()) {
  if (!value) return false;
  const expiresAt = new Date(value).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= now.getTime();
}

export function nextAttemptAt(input: {
  attemptCount: number;
  now?: Date;
  baseDelayMs?: number;
  maxDelayMs?: number;
}) {
  const now = input.now ?? new Date();
  const baseDelayMs = input.baseDelayMs ?? 30_000;
  const maxDelayMs = input.maxDelayMs ?? 15 * 60_000;
  const exponent = Math.max(0, input.attemptCount);
  const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** exponent);
  return new Date(now.getTime() + delay).toISOString();
}

export function isPermanentGenerationFailure(code: string | null | undefined) {
  return (
    code === "INVALID_INPUT" || code === "MODERATION_BLOCKED" || code === "SOURCE_IMAGE_INVALID"
  );
}

export function recoverStaleDesignPackItems(
  items: DesignPackItemLike[],
  now = new Date(),
  maxAttempts = SITE_POTENTIAL_MAX_ATTEMPTS,
) {
  return items.map((item) => {
    if (item.status !== "generating" || !isLeaseExpired(item.lease_expires_at, now)) return item;
    if ((item.attempt_count ?? 0) >= maxAttempts) {
      return {
        ...item,
        status: "failed" as DesignPackItemStatus,
        worker_id: null,
        lease_expires_at: null,
      };
    }
    return {
      ...item,
      status: "queued" as DesignPackItemStatus,
      worker_id: null,
      lease_expires_at: null,
      next_attempt_at: now.toISOString(),
    };
  });
}

export function isDesignPackItemEligibleForCompletion(
  item: DesignPackItemLike,
  maxAttempts = SITE_POTENTIAL_MAX_ATTEMPTS,
) {
  return (
    !item.generated_asset_id &&
    (item.status === "queued" ||
      item.status === "generating" ||
      (item.status === "failed" && (item.attempt_count ?? 0) < maxAttempts))
  );
}

export function designPackStatusFromItems(
  items: DesignPackItemLike[],
  requestedCount = SITE_POTENTIAL_PACK_SIZE,
  maxAttempts = SITE_POTENTIAL_MAX_ATTEMPTS,
): DesignPackStatusResult {
  const completedCount = items.filter(
    (item) => item.status === "complete" && item.generated_asset_id,
  ).length;
  const failedCount = items.filter((item) => item.status === "failed").length;
  const generatingCount = items.filter((item) => item.status === "generating").length;
  const eligibleCount = items.filter((item) =>
    isDesignPackItemEligibleForCompletion(item, maxAttempts),
  ).length;
  if (completedCount >= requestedCount) {
    return { status: "complete", completedCount, hasRetryableWork: false, terminal: true };
  }
  if (generatingCount > 0) {
    return { status: "generating", completedCount, hasRetryableWork: true, terminal: false };
  }
  if (failedCount > 0 && eligibleCount > 0) {
    return { status: "partial_failed", completedCount, hasRetryableWork: true, terminal: false };
  }
  if (eligibleCount > 0) {
    return { status: "queued", completedCount, hasRetryableWork: true, terminal: false };
  }
  if (failedCount > 0 && completedCount > 0) {
    return { status: "partial_failed", completedCount, hasRetryableWork: false, terminal: true };
  }
  if (failedCount > 0) {
    return { status: "failed", completedCount, hasRetryableWork: false, terminal: true };
  }
  return { status: "queued", completedCount, hasRetryableWork: false, terminal: false };
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
  originalSourceAssetIds?: string[];
  primaryConceptAssetId?: string | null;
  model: string;
  prompt: string;
  promptVersion?: string;
  openAiRequestId?: string | null;
}) {
  return {
    designPackId: input.designPackId,
    designPackItemId: input.designPackItemId,
    optionIndex: input.optionIndex,
    siteProjectId: input.siteProjectId,
    sourceAssetIds: input.sourceAssetIds,
    originalSourceAssetIds: input.originalSourceAssetIds ?? input.sourceAssetIds,
    primaryConceptAssetId: input.primaryConceptAssetId ?? null,
    model: input.model,
    promptVersion: input.promptVersion ?? SITE_POTENTIAL_PROMPT_VERSION,
    openAiRequestId: input.openAiRequestId ?? null,
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
