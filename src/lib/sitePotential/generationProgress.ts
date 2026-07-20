import { SITE_POTENTIAL_PACK_SIZE } from "./config";

export const SITE_POTENTIAL_WORKER_ACTIVE_MS = 90_000;
export const SITE_POTENTIAL_STALLED_AFTER_MS = 90_000;

export type SitePotentialConceptSlotStatus =
  | "Waiting"
  | "Generating"
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
  updatedAt?: string | null;
  canRetry?: boolean | null;
}

export interface SitePotentialRuntimeProgressInput {
  status: string;
  requestedCount?: number | null;
  completedCount?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  nextAttemptAt?: string | null;
  workerHeartbeatAt?: string | null;
  workerActive?: boolean | null;
  hasRetryableWork?: boolean | null;
  canRetry?: boolean | null;
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
  canRetry: boolean;
  slots: SitePotentialRuntimeProgressSlot[];
  sanitizedFailure: string | null;
}

export type PublicSitePotentialFailureCode =
  | "generator_unavailable"
  | "source_image_unavailable"
  | "generation_timeout"
  | "image_save_failed"
  | "maximum_attempts_reached"
  | "unknown_generation_failure";

const PUBLIC_FAILURE_MESSAGES: Record<PublicSitePotentialFailureCode, string> = {
  generator_unavailable:
    "The image generator is temporarily unavailable. Refresh the status or retry this pack later.",
  source_image_unavailable:
    "One or more source images could not be used. Check the uploaded files and retry if needed.",
  generation_timeout:
    "The generator took too long to finish this concept. You can retry eligible concepts.",
  image_save_failed:
    "The concept image could not be saved to the Erf File Vault. Refresh the vault or retry.",
  maximum_attempts_reached:
    "Maximum retry attempts were reached for this concept pack.",
  unknown_generation_failure:
    "Generation stopped before all concepts were created. Refresh the status or retry eligible concepts.",
};

export function mapSitePotentialFailureForPublic(
  code: unknown,
  message?: unknown,
): { code: PublicSitePotentialFailureCode; message: string } | null {
  const rawCode = String(code ?? "").toLowerCase();
  const rawMessage = String(message ?? "").toLowerCase();
  const joined = `${rawCode} ${rawMessage}`;
  if (!joined.trim()) return null;
  if (/max(imum)?[_\s-]?attempt|attempts?[_\s-]?exhausted/.test(joined)) {
    return publicFailure("maximum_attempts_reached");
  }
  if (/timeout|timed[_\s-]?out|lease[_\s-]?expired/.test(joined)) {
    return publicFailure("generation_timeout");
  }
  if (/save|storage|bucket|upload/.test(joined)) {
    return publicFailure("image_save_failed");
  }
  if (/source|input[_\s-]?image|photo|asset[_\s-]?unavailable/.test(joined)) {
    return publicFailure("source_image_unavailable");
  }
  if (/openai|generator|provider|rate[_\s-]?limit|unavailable/.test(joined)) {
    return publicFailure("generator_unavailable");
  }
  return publicFailure("unknown_generation_failure");
}

function publicFailure(code: PublicSitePotentialFailureCode) {
  return { code, message: PUBLIC_FAILURE_MESSAGES[code] };
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
  const retryableSlot = items.find((item) => item.canRetry === true);
  const firstGenerating = items.find((item) => item.status === "generating");
  const stalledAnchor = newestDate([
    parseDate(input.updatedAt),
    parseDate(input.nextAttemptAt),
    ...items.map((item) => parseDate(item.nextAttemptAt)),
    createdAt,
  ]);
  const nextRetryOrPackAttempt = newestFutureDate(
    [parseDate(input.nextAttemptAt), ...items.map((item) => parseDate(item.nextAttemptAt))],
    now,
  );
  const stalled =
    input.status === "queued" &&
    completedCount === 0 &&
    !workerActive &&
    !anyGenerating &&
    !nextRetryOrPackAttempt &&
    Boolean(
      stalledAnchor &&
        now.getTime() - stalledAnchor.getTime() >= SITE_POTENTIAL_STALLED_AFTER_MS,
    );
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
      mapSitePotentialFailureForPublic(input.failureCode, input.failureMessage)?.message ||
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
    canRetry: input.canRetry === true || items.some((item) => item.canRetry === true),
    sanitizedFailure: mapSitePotentialFailureForPublic(input.failureCode, input.failureMessage)
      ?.message ?? null,
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
  if (item.status === "generating") return "Generating";
  if (item.canRetry === true) {
    return "Retrying";
  }
  if (item.status === "failed") return "Failed";
  return "Waiting";
}

function slotDetail(item: SitePotentialRuntimeItem) {
  if (item.generatedAssetReady || item.status === "complete") return "Saved to the Erf File Vault.";
  if (item.status === "generating") return "The background worker has claimed this concept.";
  if (item.canRetry === true) {
    return "Eligible for retry without another credit.";
  }
  if (item.status === "failed") {
    return (
      mapSitePotentialFailureForPublic(item.failureCode, item.failureMessage)?.message ??
      "Maximum attempts reached."
    );
  }
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

function newestDate(values: Array<Date | null>) {
  return values
    .filter((value): value is Date => Boolean(value))
    .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
}

function newestFutureDate(values: Array<Date | null>, now: Date) {
  return (
    values
      .filter((value): value is Date => value instanceof Date && value.getTime() > now.getTime())
      .sort((left, right) => right.getTime() - left.getTime())[0] ?? null
  );
}

function formatRelativeTime(date: Date, now: Date) {
  const seconds = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}
