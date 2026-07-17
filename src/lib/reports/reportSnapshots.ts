import type { DecisionIntelligence } from "./buildDecisionIntelligence";
import type { ReportViewModel } from "./buildReportViewModel";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";

export const REPORT_SNAPSHOT_SCHEMA_VERSION = 1;
export const MAX_REPORT_SNAPSHOTS_PER_PARCEL = 10;

export type ReportSnapshotChangeType = "added" | "resolved" | "changed" | "removed";

export interface ReportSnapshot {
  schemaVersion: typeof REPORT_SNAPSHOT_SCHEMA_VERSION;
  parcelId: string;
  reportGeneratedAt: string;
  savedAt: string;
  identity: {
    parcelId: string;
    erfNumber: string | null;
    portion: string | null;
    lpi: string | null;
    parcelKey: string | null;
    municipality: string | null;
    province: string | null;
    marketAddressLine: string | null;
    areaM2: number | null;
  };
  decision: {
    verdict: DecisionIntelligence["verdict"];
    confidencePercent: number;
    categories: Array<{
      id: string;
      label: string;
      score: number;
      state: string;
    }>;
    contradictions: Array<{ id: string; severity: string }>;
    risks: Array<{ id: string; severity: string }>;
    missingInformation: string[];
  };
  market: {
    evidenceCount: number;
    includedCount: number;
    evidenceIds: string[];
    evidenceConfidence: Array<{ id: string; confidence: string }>;
    subjectListingId: string | null;
    strongestComparableIds: string[];
    indicativeMedianAskingPrice: number | null;
    latestMarketEvidenceAt: string | null;
  };
  documents: {
    assetCount: number;
    uploadedReportCount: number;
    sgDiagramCount: number;
    assets: Array<{ id: string; category: string }>;
  };
  sitePotential: {
    selectedConceptAssetId: string | null;
    conceptCount: number;
    skipped: boolean;
  };
  strategy: {
    chosenScenarioId: string | null;
    scenarioCount: number;
  };
}

export interface BuildReportSnapshotInput {
  report: ReportViewModel;
  decision: DecisionIntelligence;
  assets: ErfAsset[];
  savedAt?: string;
}

export interface ReportSnapshotChange {
  id: string;
  type: ReportSnapshotChangeType;
  category: string;
  label: string;
  previousValue?: string | null;
  currentValue?: string | null;
}

export interface ReportSnapshotComparison {
  previous: ReportSnapshot | null;
  current: ReportSnapshot;
  isDuplicate: boolean;
  changes: ReportSnapshotChange[];
  counts: Record<ReportSnapshotChangeType, number>;
}

type SnapshotStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function reportSnapshotStorageKey(parcelId: string) {
  return `easyerf.reportSnapshots.v1.${parcelId}`;
}

export function buildReportSnapshot(input: BuildReportSnapshotInput): ReportSnapshot {
  const report = input.report;
  const parcelId = report.parcelId;
  const currentAssets = input.assets
    .filter((asset) => asset.parcel_id === parcelId)
    .map((asset) => ({
      id: cleanText(asset.id, 160),
      category: cleanText(asset.asset_category, 120),
    }))
    .sort(byId);

  return {
    schemaVersion: REPORT_SNAPSHOT_SCHEMA_VERSION,
    parcelId,
    reportGeneratedAt: report.generatedAt,
    savedAt: input.savedAt ?? new Date().toISOString(),
    identity: {
      parcelId,
      erfNumber: nullable(report.identity.erfNumber),
      portion: nullable(report.identity.portion),
      lpi: nullable(report.identity.lpi),
      parcelKey: nullable(report.identity.parcelKey),
      municipality: nullable(report.identity.municipality),
      province: nullable(report.identity.province),
      marketAddressLine: nullable(report.identity.marketAddressLine),
      areaM2: numberOrNull(report.identity.areaM2),
    },
    decision: {
      verdict: input.decision.verdict,
      confidencePercent: input.decision.confidencePercent,
      categories: input.decision.confidenceCategories
        .map((category) => ({
          id: cleanText(category.id, 80),
          label: cleanText(category.label, 120),
          score: category.score,
          state: cleanText(category.state, 80),
        }))
        .sort(byId),
      contradictions: input.decision.contradictions
        .map((item) => ({ id: cleanText(item.id, 160), severity: cleanText(item.severity, 80) }))
        .sort(byId),
      risks: report.risks
        .map((item) => ({ id: cleanText(item.id, 160), severity: cleanText(item.severity, 80) }))
        .sort(byId),
      missingInformation: sortedStrings(input.decision.stillNeeded),
    },
    market: {
      evidenceCount: report.market.evidenceCount,
      includedCount: report.market.includedCount,
      evidenceIds: sortedStrings([
        ...report.market.strongest.map((item) => item.id),
        ...(report.market.subjectListing ? [report.market.subjectListing.id] : []),
      ]),
      evidenceConfidence: [
        ...report.market.strongest,
        ...(report.market.subjectListing ? [report.market.subjectListing] : []),
      ]
        .map((item) => ({ id: cleanText(item.id, 160), confidence: cleanText(item.confidence, 80) }))
        .sort(byId),
      subjectListingId: report.market.subjectListing?.id ?? null,
      strongestComparableIds: sortedStrings(report.market.strongest.map((item) => item.id)),
      indicativeMedianAskingPrice: report.market.canShowIndicativeValue
        ? numberOrNull(report.market.summary.medianAskingPrice)
        : null,
      latestMarketEvidenceAt: report.market.latestUpdatedAt ?? null,
    },
    documents: {
      assetCount: currentAssets.length,
      uploadedReportCount: currentAssets.filter((asset) => asset.category === "paid_report").length,
      sgDiagramCount: currentAssets.filter((asset) => asset.category === "sg_diagram").length,
      assets: currentAssets,
    },
    sitePotential: {
      selectedConceptAssetId:
        report.site.selectedDesign?.parcel_id === parcelId ? report.site.selectedDesign.id : null,
      conceptCount: currentAssets.filter((asset) => asset.category === "generated_design").length,
      skipped: report.site.skipped,
    },
    strategy: {
      chosenScenarioId:
        report.strategy.chosen?.parcelId === parcelId ? report.strategy.chosen.id : null,
      scenarioCount: report.strategy.scenarioCount,
    },
  };
}

export function compareReportSnapshots(
  previous: ReportSnapshot | null,
  current: ReportSnapshot,
): ReportSnapshotComparison {
  const changes = previous ? detectChanges(previous, current) : [];
  return {
    previous,
    current,
    isDuplicate: Boolean(previous && snapshotFingerprint(previous) === snapshotFingerprint(current)),
    changes,
    counts: {
      added: changes.filter((change) => change.type === "added").length,
      resolved: changes.filter((change) => change.type === "resolved").length,
      changed: changes.filter((change) => change.type === "changed").length,
      removed: changes.filter((change) => change.type === "removed").length,
    },
  };
}

export function readReportSnapshots(
  parcelId: string,
  storage: SnapshotStorage | undefined = defaultStorage(),
): ReportSnapshot[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(reportSnapshotStorageKey(parcelId)) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => coerceSnapshot(item))
      .filter((item): item is ReportSnapshot => Boolean(item && item.parcelId === parcelId))
      .slice(0, MAX_REPORT_SNAPSHOTS_PER_PARCEL);
  } catch {
    return [];
  }
}

export function saveReportSnapshot(
  snapshot: ReportSnapshot,
  storage: SnapshotStorage | undefined = defaultStorage(),
): ReportSnapshot[] {
  if (!storage) return [];
  const existing = readReportSnapshots(snapshot.parcelId, storage);
  if (existing[0] && snapshotFingerprint(existing[0]) === snapshotFingerprint(snapshot)) {
    return existing;
  }
  const next = [snapshot, ...existing].slice(0, MAX_REPORT_SNAPSHOTS_PER_PARCEL);
  storage.setItem(reportSnapshotStorageKey(snapshot.parcelId), JSON.stringify(next));
  return next;
}

export function clearReportSnapshots(
  parcelId: string,
  storage: SnapshotStorage | undefined = defaultStorage(),
) {
  storage?.removeItem(reportSnapshotStorageKey(parcelId));
}

export function snapshotFingerprint(snapshot: ReportSnapshot): string {
  const { reportGeneratedAt: _reportGeneratedAt, savedAt: _savedAt, ...stable } = snapshot;
  return stableStringify(stable);
}

function detectChanges(previous: ReportSnapshot, current: ReportSnapshot): ReportSnapshotChange[] {
  const changes: ReportSnapshotChange[] = [];

  compareNullableField(changes, "identity", "market-address", "Market address", previous.identity.marketAddressLine, current.identity.marketAddressLine);
  compareNullableField(changes, "identity", "erf-area", "Erf area", displayArea(previous.identity.areaM2), displayArea(current.identity.areaM2));
  compareNullableField(changes, "identity", "municipality", "Municipality", previous.identity.municipality, current.identity.municipality);

  for (const field of ["erfNumber", "portion", "lpi", "parcelKey", "province"] as const) {
    compareNullableField(
      changes,
      "identity",
      field,
      identityLabel(field),
      previous.identity[field],
      current.identity[field],
    );
  }

  compareChanged(changes, "decision", "verdict", "Decision verdict", previous.decision.verdict, current.decision.verdict);
  compareChanged(
    changes,
    "decision",
    "confidence",
    "Decision confidence",
    `${previous.decision.confidencePercent}%`,
    `${current.decision.confidencePercent}%`,
  );
  compareSeveritySet(changes, "risk", "Risk", previous.decision.risks, current.decision.risks);
  compareSeveritySet(
    changes,
    "contradiction",
    "Contradiction",
    previous.decision.contradictions,
    current.decision.contradictions,
  );
  compareMissingInformation(changes, previous.decision.missingInformation, current.decision.missingInformation);
  compareCategories(changes, previous.decision.categories, current.decision.categories);

  compareIdSet(changes, "market", "evidence", "Market evidence", previous.market.evidenceIds, current.market.evidenceIds);
  compareEvidenceConfidence(changes, previous.market.evidenceConfidence, current.market.evidenceConfidence);
  compareNullableField(changes, "market", "subject-listing", "Subject listing", previous.market.subjectListingId, current.market.subjectListingId);
  compareNullableField(
    changes,
    "market",
    "indicative-median",
    "Indicative median asking price",
    currency(previous.market.indicativeMedianAskingPrice),
    currency(current.market.indicativeMedianAskingPrice),
  );

  compareIdSet(
    changes,
    "documents",
    "asset",
    "Document or file",
    previous.documents.assets.map((asset) => asset.id),
    current.documents.assets.map((asset) => asset.id),
  );
  compareNullableField(
    changes,
    "site-potential",
    "selected-concept",
    "Selected Site Potential concept",
    previous.sitePotential.selectedConceptAssetId,
    current.sitePotential.selectedConceptAssetId,
  );
  compareChanged(
    changes,
    "site-potential",
    "concept-count",
    "Site Potential concept count",
    String(previous.sitePotential.conceptCount),
    String(current.sitePotential.conceptCount),
  );
  compareNullableField(
    changes,
    "strategy",
    "selected-strategy",
    "Selected strategy",
    previous.strategy.chosenScenarioId,
    current.strategy.chosenScenarioId,
  );
  compareChanged(
    changes,
    "strategy",
    "scenario-count",
    "Saved strategy scenario count",
    String(previous.strategy.scenarioCount),
    String(current.strategy.scenarioCount),
  );

  return changes;
}

function compareNullableField(
  changes: ReportSnapshotChange[],
  category: string,
  id: string,
  label: string,
  previous: string | null,
  current: string | null,
) {
  if (previous === current) return;
  const type: ReportSnapshotChangeType = previous && current ? "changed" : previous ? "removed" : "added";
  changes.push({
    id: `${category}-${id}`,
    category,
    type,
    label,
    previousValue: previous,
    currentValue: current,
  });
}

function compareChanged(
  changes: ReportSnapshotChange[],
  category: string,
  id: string,
  label: string,
  previous: string,
  current: string,
) {
  if (previous === current) return;
  changes.push({ id: `${category}-${id}`, category, type: "changed", label, previousValue: previous, currentValue: current });
}

function compareIdSet(
  changes: ReportSnapshotChange[],
  category: string,
  idPrefix: string,
  label: string,
  previousIds: string[],
  currentIds: string[],
) {
  const previous = new Set(previousIds);
  const current = new Set(currentIds);
  for (const id of [...current].sort()) {
    if (!previous.has(id)) {
      changes.push({ id: `${category}-${idPrefix}-added-${id}`, category, type: "added", label: `${label} added`, currentValue: id });
    }
  }
  for (const id of [...previous].sort()) {
    if (!current.has(id)) {
      changes.push({ id: `${category}-${idPrefix}-removed-${id}`, category, type: "removed", label: `${label} removed`, previousValue: id });
    }
  }
}

function compareSeveritySet(
  changes: ReportSnapshotChange[],
  category: string,
  label: string,
  previousItems: Array<{ id: string; severity: string }>,
  currentItems: Array<{ id: string; severity: string }>,
) {
  const previous = new Map(previousItems.map((item) => [item.id, item.severity]));
  const current = new Map(currentItems.map((item) => [item.id, item.severity]));
  for (const [id, severity] of [...current].sort()) {
    if (!previous.has(id)) {
      changes.push({ id: `${category}-added-${id}`, category, type: "added", label: `${label} added`, currentValue: `${id} (${severity})` });
    } else if (previous.get(id) !== severity) {
      changes.push({ id: `${category}-changed-${id}`, category, type: "changed", label: `${label} severity changed`, previousValue: previous.get(id), currentValue: severity });
    }
  }
  for (const [id, severity] of [...previous].sort()) {
    if (!current.has(id)) {
      changes.push({ id: `${category}-removed-${id}`, category, type: "resolved", label: `${label} removed`, previousValue: `${id} (${severity})` });
    }
  }
}

function compareMissingInformation(changes: ReportSnapshotChange[], previousItems: string[], currentItems: string[]) {
  const previous = new Set(previousItems);
  const current = new Set(currentItems);
  for (const item of [...previous].sort()) {
    if (!current.has(item)) {
      changes.push({ id: `missing-resolved-${item}`, category: "missing information", type: "resolved", label: "Missing information resolved", previousValue: item });
    }
  }
  for (const item of [...current].sort()) {
    if (!previous.has(item)) {
      changes.push({ id: `missing-added-${item}`, category: "missing information", type: "added", label: "New missing information item", currentValue: item });
    }
  }
}

function compareCategories(
  changes: ReportSnapshotChange[],
  previousItems: ReportSnapshot["decision"]["categories"],
  currentItems: ReportSnapshot["decision"]["categories"],
) {
  const previous = new Map(previousItems.map((item) => [item.id, item]));
  for (const current of currentItems) {
    const old = previous.get(current.id);
    if (!old) continue;
    if (old.score !== current.score || old.state !== current.state) {
      changes.push({
        id: `category-changed-${current.id}`,
        category: "confidence",
        type: "changed",
        label: `${current.label} confidence changed`,
        previousValue: `${old.score} / ${old.state}`,
        currentValue: `${current.score} / ${current.state}`,
      });
    }
  }
}

function compareEvidenceConfidence(
  changes: ReportSnapshotChange[],
  previousItems: ReportSnapshot["market"]["evidenceConfidence"],
  currentItems: ReportSnapshot["market"]["evidenceConfidence"],
) {
  const previous = new Map(previousItems.map((item) => [item.id, item.confidence]));
  for (const current of currentItems) {
    const old = previous.get(current.id);
    if (old && old !== current.confidence) {
      changes.push({
        id: `market-confidence-${current.id}`,
        category: "market",
        type: "changed",
        label: "Evidence confidence changed",
        previousValue: old,
        currentValue: current.confidence,
      });
    }
  }
}

function coerceSnapshot(value: unknown): ReportSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as ReportSnapshot;
  if (raw.schemaVersion !== REPORT_SNAPSHOT_SCHEMA_VERSION) return null;
  if (typeof raw.parcelId !== "string" || !raw.parcelId) return null;
  if (typeof raw.savedAt !== "string" || typeof raw.reportGeneratedAt !== "string") return null;
  if (!raw.identity || raw.identity.parcelId !== raw.parcelId) return null;
  if (!raw.decision || !raw.market || !raw.documents || !raw.sitePotential || !raw.strategy) return null;
  return raw;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
}

function defaultStorage(): SnapshotStorage | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

function byId<T extends { id: string }>(a: T, b: T) {
  return a.id.localeCompare(b.id);
}

function sortedStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();
}

function nullable(value: string | null | undefined) {
  return value ? cleanText(value, 240) : null;
}

function numberOrNull(value: number | null | undefined) {
  return Number.isFinite(value) ? Number(value) : null;
}

function cleanText(value: string, max = 240) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function currency(value: number | null | undefined) {
  return value == null ? null : `R${Math.round(value).toLocaleString()}`;
}

function displayArea(value: number | null | undefined) {
  return value == null ? null : `${Math.round(value).toLocaleString()} sqm`;
}

function identityLabel(field: "erfNumber" | "portion" | "lpi" | "parcelKey" | "province") {
  switch (field) {
    case "erfNumber":
      return "Erf number";
    case "portion":
      return "Portion";
    case "lpi":
      return "LPI";
    case "parcelKey":
      return "Parcel key";
    case "province":
      return "Province";
  }
}
