import { SITE_POTENTIAL_PACK_SIZE } from "./config";
import { SITE_POTENTIAL_MAX_ATTEMPTS } from "./generationJobs";

export const SITE_POTENTIAL_WORKER_ACTIVE_MS = 90_000;
export const SITE_POTENTIAL_STALLED_AFTER_MS = 90_000;

export type SitePotentialConceptSlotStatus =
  | "Waiting"
  | "Generating"
  | "Saving"
  | "Ready"
  | "Retrying"
  | "Failed";

export interface SitePotentialRuntimeItem {
  optionIndex: number;
  status: string;
  generatedAssetReady?: boolean | null;
  attemptCount?: number | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  nextAttemptAt?: string | null;
}

export interface SitePotentialRuntimeProgressInput {
  status: string;
  requestedCount?: number | null;
  completedCount?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  workerHeartbeatAt?: string | null;
  workerActive?: boolean | null;
  hasRetryableWork?: boolean | null;
  terminal?: boolean | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  items?: SitePotentialRuntimeItem[];
}

export interface SitePotentialRuntimeProgressSlot {
  optionIndex: number;
  status: SitePotentialConceptSlotStatus;
  detail: string;
}

export interface SitePotentialRuntimeProgress {
  heading: string;
  detail: string;
  progressLabel: string;
  completedCount: number;
  requestedCount: number;
  progressPercent: number;
  startedLabel: string;
  lastCheckedLabel: string;
  estimate: string | null;
  stalled: boolean;
  workerActive: boolean;
  slots: SitePotentialRuntimeProgressSlot[];
  sanitizedFailure: string | null;
}

export function buildSitePotentialRuntimeProgress(
  input: SitePotentialRuntimeProgressInput | null,
  now = new Date(),
  lastCheckedAt: Date | null = now,
): SitePotentialRuntimeProgress | null {
  if (!input) return null;
  const requestedCount = clampCount(input.requestedCount ?? SITE_POTENTIAL_PACK_SIZE);
  const items = normalizeItems(input.items, requestedCount);
  const completedCount = Math.min(
    requestedCount,
    Math.max(
      0,
      finiteCount(
        input.completedCount,
        items.filter((item) => item.generatedAssetReady || item.status === "complete").length,
      ),
    ),
  );
  const createdAt = parseDate(input.createdAt);
  const workerHeartbeatAt = parseDate(input.workerHeartbeatAt);
  const workerActive =
    input.workerActive === true ||
    items.some((item) => item.status === "generating") ||
    Boolean(
      workerHeartbeatAt &&
        now.getTime() - workerHeartbeatAt.getTime() <= SITE_POTENTIAL_WORKER_ACTIVE_MS,
    );
  const anyGenerating = items.some((item) => item.status === "generating");
  const retryableSlot = items.find(
    (item) =>
      !item.generatedAssetReady &&
      item.status === "failed" &&
      finiteCount(item.attemptCount, 0) < SITE_POTENTIAL_MAX_ATTEMPTS,
  );
  const firstGenerating = items.find((item) => item.status === "generating");
  const stalled =
    input.status === "queued" &&
    completedCount === 0 &&
    !workerActive &&
    !anyGenerating &&
    Boolean(createdAt && now.getTime() - createdAt.getTime() >= SITE_POTENTIAL_STALLED_AFTER_MS);
  const terminal =
    input.terminal === true ||
    input.status === "failed" ||
    (input.status === "partial_failed" && input.hasRetryableWork === false);

  let heading = "Request accepted";
  let detail = "Easy Erf saved the request and is checking the background queue.";
  let estimate: string | null = null;

  if (input.status === "complete" || completedCount >= requestedCount) {
    heading = `All ${requestedCount} concepts ready`;
    detail = "Review the generated concepts and select the one to include in the Easy Erf Report.";
  } else if (terminal) {
    heading = "Generation needs attention";
    detail =
      safeFailureMessage(input.failureMessage) ||
      "Generation stopped before all concepts were created.";
  } else if (retryableSlot) {
    heading = `Retrying concept ${retryableSlot.optionIndex}`;
    detail = "Easy Erf will retry eligible failed concepts without using another credit.";
    estimate = "Retries can add several minutes.";
  } else if (firstGenerating) {
    heading = `Creating concept ${firstGenerating.optionIndex} of ${requestedCount}`;
    detail = "The image generator has started and the worker is processing this concept.";
    estimate = "Each concept can take several minutes.";
  } else if (completedCount > 0) {
    heading = `${completedCount} of ${requestedCount} concepts ready`;
    detail = "Completed concepts are saved as they finish. Remaining concepts are still queued.";
    estimate = "Remaining concepts can take several minutes once the generator starts.";
  } else if (stalled) {
    heading = "Waiting for generator";
    detail = "The generator has not started yet. Easy Erf is checking the background worker.";
  } else if (input.status === "queued") {
    heading = "Waiting for generator";
    detail = "Waiting for the image generator to start.";
    estimate = "Broad estimate after the generator starts: 5-20 minutes.";
  }

  return {
    heading,
    detail,
    progressLabel: `${completedCount} of ${requestedCount}`,
    completedCount,
    requestedCount,
    progressPercent: Math.round((completedCount / requestedCount) * 100),
    startedLabel: createdAt ? `Started ${formatRelativeTime(createdAt, now)} ago` : "Start time not recorded",
    lastCheckedLabel: lastCheckedAt
      ? `Last status check ${formatRelativeTime(lastCheckedAt, now)} ago`
      : "Last status check not recorded",
    estimate,
    stalled,
    workerActive,
    sanitizedFailure: safeFailureMessage(input.failureMessage),
    slots: items.map((item) => ({
      optionIndex: item.optionIndex,
      status: slotStatus(item),
      detail: slotDetail(item),
    })),
  };
}

function normalizeItems(items: SitePotentialRuntimeItem[] | undefined, requestedCount: number) {
  const byIndex = new Map<number, SitePotentialRuntimeItem>();
  for (const item of items ?? []) {
    if (Number.isFinite(item.optionIndex) && item.optionIndex > 0) byIndex.set(item.optionIndex, item);
  }
  return Array.from({ length: requestedCount }, (_, index) => {
    const optionIndex = index + 1;
    return byIndex.get(optionIndex) ?? { optionIndex, status: "queued", generatedAssetReady: false };
  });
}

function slotStatus(item: SitePotentialRuntimeItem): SitePotentialConceptSlotStatus {
  if (item.generatedAssetReady || item.status === "complete") return "Ready";
  if (item.status === "generating") return item.generatedAssetReady ? "Saving" : "Generating";
  if (
    item.status === "failed" &&
    finiteCount(item.attemptCount, 0) < SITE_POTENTIAL_MAX_ATTEMPTS
  ) {
    return "Retrying";
  }
  if (item.status === "failed") return "Failed";
  return "Waiting";
}

function slotDetail(item: SitePotentialRuntimeItem) {
  if (item.generatedAssetReady || item.status === "complete") return "Saved to the Erf File Vault.";
  if (item.status === "generating") return "The background worker has claimed this concept.";
  if (
    item.status === "failed" &&
    finiteCount(item.attemptCount, 0) < SITE_POTENTIAL_MAX_ATTEMPTS
  ) {
    return "Eligible for retry without another credit.";
  }
  if (item.status === "failed") return safeFailureMessage(item.failureMessage) ?? "Maximum attempts reached.";
  return "Waiting for the generator.";
}

function clampCount(value: number) {
  if (!Number.isFinite(value)) return SITE_POTENTIAL_PACK_SIZE;
  return Math.max(1, Math.min(6, Math.round(value)));
}

function finiteCount(value: number | null | undefined, fallback: number) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.round(count) : fallback;
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatRelativeTime(date: Date, now: Date) {
  const seconds = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

function safeFailureMessage(value: unknown) {
  if (!value) return null;
  return String(value)
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/SUPABASE_SERVICE_ROLE_KEY/gi, "[redacted]")
    .slice(0, 180);
}
