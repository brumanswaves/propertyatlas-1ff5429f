import {
  extractErfAsset,
  type ExtractErfAssetOptions,
  type ExtractErfAssetResult,
} from "./erfAssetExtraction";

export const SG_READING_RESPONSE_DEADLINE_MS = 30_000;
export const SG_READING_UNKNOWN: ExtractErfAssetResult = {
  success: false,
  code: "REVIEW_STATUS_UNKNOWN",
  extractionStatus: null,
  error:
    "The reader has not acknowledged this request yet. Your original is saved. Continue or refresh file status before trying again; a review may still be running.",
};
const pending = new Map<string, Promise<ExtractErfAssetResult>>();
const uncertain = new Map<string, string>();
const requestKey = (userId: string, assetId: string, options: ExtractErfAssetOptions) =>
  JSON.stringify([userId, options.expectedParcelId, options.investigationOrderId ?? null, assetId]);

export function resolveSgReadingStatus(
  userId: string,
  assetId: string,
  options: ExtractErfAssetOptions,
  status: string,
  revision: string,
) {
  const key = requestKey(userId, assetId, options);
  if (
    uncertain.has(key) &&
    uncertain.get(key) !== revision &&
    ["ready", "partial", "failed", "unsupported", "processing"].includes(status)
  )
    uncertain.delete(key);
  return !uncertain.has(key) && !pending.has(key);
}

/** Coalesce manual/automatic checks, never interpret a browser deadline as job cancellation. */
export async function requestSgReading(
  userId: string,
  assetId: string,
  options: ExtractErfAssetOptions,
  extract = extractErfAsset,
  revision = "",
  knownBackgroundJob = false,
): Promise<ExtractErfAssetResult> {
  const key = requestKey(userId, assetId, options);
  if (uncertain.has(key)) return SG_READING_UNKNOWN;
  let operation = pending.get(key);
  if (!operation) {
    operation = extract(assetId, options)
      .then((result) => {
        if (
          !result.success &&
          (result.requestOutcome === "unknown" ||
            (result.requestOutcome !== "definitive" && result.code === "SERVER_UNAVAILABLE"))
        ) {
          if (knownBackgroundJob) return result;
          uncertain.set(key, revision);
          return SG_READING_UNKNOWN;
        }
        return result;
      })
      .catch(() => {
        if (knownBackgroundJob) return { ...SG_READING_UNKNOWN, code: "SERVER_UNAVAILABLE" };
        uncertain.set(key, revision);
        return SG_READING_UNKNOWN;
      });
    pending.set(key, operation);
    const current = operation;
    void operation.finally(() => {
      if (pending.get(key) === current) pending.delete(key);
    });
  }
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      operation,
      new Promise<ExtractErfAssetResult>((resolve) => {
        timer = setTimeout(() => resolve(SG_READING_UNKNOWN), SG_READING_RESPONSE_DEADLINE_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}
