import { SITE_POTENTIAL_PACK_SIZE } from "./config";
import { SITE_POTENTIAL_MAX_ATTEMPTS } from "./generationJobs";

export interface SitePotentialEstimateItem {
  status: string;
  generatedAssetId?: string | null;
  attemptCount?: number | null;
  nextAttemptAt?: string | null;
}

export interface SitePotentialGenerationEstimateInput {
  status: string;
  requestedCount?: number | null;
  completedCount?: number | null;
  items?: SitePotentialEstimateItem[];
  hasRetryableWork?: boolean | null;
}

export interface SitePotentialGenerationEstimate {
  label: string;
  message: string;
  detail: string;
  remainingCount: number;
  active: boolean;
}

export function buildSitePotentialGenerationEstimate(
  input: SitePotentialGenerationEstimateInput | null,
): SitePotentialGenerationEstimate | null {
  if (!input) return null;
  const requestedCount = clampConceptCount(input.requestedCount ?? SITE_POTENTIAL_PACK_SIZE);
  const itemCompletedCount = Array.isArray(input.items)
    ? input.items.filter((item) => Boolean(item.generatedAssetId) || item.status === "complete").length
    : 0;
  const completedCount = Math.min(
    requestedCount,
    Math.max(0, finiteCount(input.completedCount ?? itemCompletedCount, itemCompletedCount)),
  );
  const remainingCount = Math.max(0, requestedCount - completedCount);
  if (remainingCount === 0 || input.status === "complete") {
    return {
      label: "Estimated time",
      message: `All ${requestedCount} concepts are ready.`,
      detail: "Open each concept as it appears in the generated concepts section.",
      remainingCount: 0,
      active: false,
    };
  }
  if (input.status === "queued" && completedCount === 0) {
    return {
      label: "Estimated time",
      message: `Approximately ${estimateRangeForRemaining(requestedCount)} for ${formatConceptCount(requestedCount)}.`,
      detail: "Images appear individually as they complete.",
      remainingCount,
      active: true,
    };
  }
  if (input.status === "generating" && completedCount === 0) {
    return {
      label: "Estimated time",
      message: "The first concept is being created. This normally takes several minutes.",
      detail: "Keep this page open or return later; concepts appear one by one.",
      remainingCount,
      active: true,
    };
  }
  if (input.status === "partial_failed" || input.status === "failed") {
    const hasRetryableWork =
      typeof input.hasRetryableWork === "boolean"
        ? input.hasRetryableWork
        : hasRetryableEstimateWork(input.items);
    if (!hasRetryableWork) {
      return {
        label: "Estimated time",
        message:
          input.status === "partial_failed"
            ? `Generation stopped with ${completedCount} of ${requestedCount} concepts ready. No completion estimate is available.`
            : "Generation could not be completed. No completion estimate is available.",
        detail: "You can review any completed concepts or start another pack when available.",
        remainingCount,
        active: false,
      };
    }
    return {
      label: "Estimated time",
      message: "A retry is in progress. This can add several minutes.",
      detail: `${formatRemaining(remainingCount)} still ${remainingCount === 1 ? "needs" : "need"} to finish.`,
      remainingCount,
      active: true,
    };
  }
  return {
    label: "Estimated time remaining",
    message: `${formatRemaining(remainingCount)}. Estimated remaining time: approximately ${estimateRangeForRemaining(remainingCount)}.`,
    detail: "This is a broad queue estimate, not a countdown.",
    remainingCount,
    active: true,
  };
}

function clampConceptCount(value: number) {
  if (!Number.isFinite(value)) return SITE_POTENTIAL_PACK_SIZE;
  return Math.max(1, Math.min(6, Math.round(value)));
}

function finiteCount(value: number | null | undefined, fallback: number) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.round(count) : fallback;
}

function hasRetryableEstimateWork(items: SitePotentialEstimateItem[] | undefined) {
  return Boolean(
    items?.some(
      (item) =>
        !item.generatedAssetId &&
        (item.status === "queued" ||
          item.status === "generating" ||
          Boolean(item.nextAttemptAt) ||
          (item.status === "failed" &&
            Number.isFinite(Number(item.attemptCount)) &&
            Number(item.attemptCount) < SITE_POTENTIAL_MAX_ATTEMPTS)),
    ),
  );
}

function estimateRangeForRemaining(remainingCount: number) {
  if (remainingCount <= 1) return "2-8 minutes";
  if (remainingCount === 2) return "4-15 minutes";
  return "5-20 minutes";
}

function formatConceptCount(count: number) {
  if (count === 1) return "one concept";
  if (count === 2) return "two concepts";
  if (count === 3) return "three concepts";
  return `${count} concepts`;
}

function formatRemaining(remainingCount: number) {
  if (remainingCount === 1) return "1 concept remains";
  return `${remainingCount} concepts remain`;
}
