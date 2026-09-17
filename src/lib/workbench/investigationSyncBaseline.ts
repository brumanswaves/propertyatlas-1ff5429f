import { browserScopedParcelKey, type BrowserStorage } from "./erfWorkspaceState";

/** Bookkeeping only: never a second source of investigation facts. */
export function readInvestigationSyncBaseline(storage: BrowserStorage, parcelId: string, userId: string, namespace = "investigation") {
  try {
    const value: unknown = JSON.parse(storage.getItem(browserScopedParcelKey(`${namespace}-sync-baseline`, parcelId, userId)) ?? "null");
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch { return null; }
}

export function writeInvestigationSyncBaseline(storage: BrowserStorage, parcelId: string, userId: string, value: Record<string, unknown>, namespace = "investigation") {
  storage.setItem(browserScopedParcelKey(`${namespace}-sync-baseline`, parcelId, userId), JSON.stringify(value));
}

export function sameInvestigationContent(left: unknown, right: unknown): boolean {
  const normalize = (value: unknown, path: string[] = []): unknown => {
    if (Array.isArray(value)) return value.map((item) => normalize(item, path));
    if (!value || typeof value !== "object") return value;
    // Strategy bookkeeping can drift without changing any financial assumption.
    const strategyWorkspace = path.length === 1 && path[0] === "strategyWorkspace";
    return Object.fromEntries(Object.entries(value).filter(([key]) =>
      !["syncedAt", "workspaceUpdatedAt", "updatedAt", "lastViewedAt", "lastMeaningfulActionAt"].includes(key) &&
      !(strategyWorkspace && ["draftUpdatedAt", "chosenScenarioUpdatedAt"].includes(key)),
    ).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, normalize(item, [...path, key])]));
  };
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

export function investigationSyncDecision(local: unknown, remote: unknown, baseline: unknown, hasLocal: boolean) {
  if (!hasLocal || sameInvestigationContent(local, remote)) return "hydrate";
  if (baseline != null && sameInvestigationContent(local, baseline)) return "hydrate";
  if (baseline != null && sameInvestigationContent(remote, baseline)) return "save-local";
  return "conflict";
}

/** Keep both versions before an explicit restore, never silently discard a draft. */
export function preserveInvestigationConflict(storage: BrowserStorage, parcelId: string, userId: string, local: unknown, remote: unknown) {
  const key = browserScopedParcelKey("investigation-conflict-backups", parcelId, userId);
  const previous: unknown = JSON.parse(storage.getItem(key) ?? "[]");
  if (!Array.isArray(previous)) throw new Error("The existing draft backup cannot be read. Nothing was replaced.");
  storage.setItem(key, JSON.stringify([...previous, { capturedAt: new Date().toISOString(), local, remote }]));
}
