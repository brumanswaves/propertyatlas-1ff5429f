import {
  browserScopedParcelKey,
  type BrowserPersistenceUserId,
} from "@/lib/workbench/erfWorkspaceState";

export type ReportDecisionMode = "standard" | "investor";

const REPORT_DECISION_MODES: ReportDecisionMode[] = ["standard", "investor"];
type ReportDecisionModeStorage = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): ReportDecisionModeStorage | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

export function reportDecisionModeStorageKey(
  parcelId: string,
  userId: BrowserPersistenceUserId = null,
) {
  return browserScopedParcelKey("report-decision-lens", parcelId, userId);
}

export function coerceReportDecisionMode(value: unknown): ReportDecisionMode {
  return REPORT_DECISION_MODES.includes(value as ReportDecisionMode)
    ? (value as ReportDecisionMode)
    : "standard";
}

export function readReportDecisionMode(
  parcelId: string,
  storage: ReportDecisionModeStorage | undefined = defaultStorage(),
  userId: BrowserPersistenceUserId = null,
): ReportDecisionMode {
  if (!storage) return "standard";
  try {
    return coerceReportDecisionMode(storage.getItem(reportDecisionModeStorageKey(parcelId, userId)));
  } catch {
    return "standard";
  }
}

export function writeReportDecisionMode(
  parcelId: string,
  mode: ReportDecisionMode,
  storage: ReportDecisionModeStorage | undefined = defaultStorage(),
  userId: BrowserPersistenceUserId = null,
) {
  const next = coerceReportDecisionMode(mode);
  try {
    storage?.setItem(reportDecisionModeStorageKey(parcelId, userId), next);
  } catch {
    return next;
  }
  return next;
}
