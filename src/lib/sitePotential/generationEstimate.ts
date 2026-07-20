import { SITE_POTENTIAL_PACK_SIZE } from "./config";

export interface SitePotentialEstimateItem {
  status: string;
  generatedAssetId?: string | null;
}

export interface SitePotentialGenerationEstimateInput {
  status: string;
  requestedCount?: number | null;
  completedCount?: number | null;
  items?: SitePotentialEstimateItem[];
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
    Math.max(0, Number(input.completedCount ?? itemCompletedCount)),
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
