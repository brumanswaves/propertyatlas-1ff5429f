export type ReportDecisionMode = "standard" | "investor";

const REPORT_DECISION_MODES: ReportDecisionMode[] = ["standard", "investor"];

export function reportDecisionModeStorageKey(parcelId: string) {
  return `easyerf.reportDecisionLens.${parcelId}`;
}

export function coerceReportDecisionMode(value: unknown): ReportDecisionMode {
  return REPORT_DECISION_MODES.includes(value as ReportDecisionMode)
    ? (value as ReportDecisionMode)
    : "standard";
}

export function readReportDecisionMode(
  parcelId: string,
  storage: Storage | undefined = typeof window !== "undefined" ? window.localStorage : undefined,
): ReportDecisionMode {
  if (!storage) return "standard";
  return coerceReportDecisionMode(storage.getItem(reportDecisionModeStorageKey(parcelId)));
}

export function writeReportDecisionMode(
  parcelId: string,
  mode: ReportDecisionMode,
  storage: Storage | undefined = typeof window !== "undefined" ? window.localStorage : undefined,
) {
  const next = coerceReportDecisionMode(mode);
  storage?.setItem(reportDecisionModeStorageKey(parcelId), next);
  return next;
}

