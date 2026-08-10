import type { DecisionIntelligence } from "./buildDecisionIntelligence";
import type { ReportViewModel } from "./buildReportViewModel";
import { calculateMarketEvidenceSummary } from "@/features/marketEvidence/calculateMarketEvidenceSummary";
import type {
  MarketEvidenceConfidence,
  MarketEvidenceListingRole,
  SavedMarketEvidence,
} from "@/features/marketEvidence/types";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";
import {
  browserScopedParcelKey,
  type BrowserPersistenceUserId,
  type ErfStrategyScenario,
} from "@/lib/workbench/erfWorkspaceState";

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
    evidence: Array<{
      id: string;
      confidence: MarketEvidenceConfidence;
      includeInSummary: boolean;
      listingRole: MarketEvidenceListingRole | null;
    }>;
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
  savedEvidence: SavedMarketEvidence[];
  strategyScenarios: ErfStrategyScenario[];
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

export interface SaveReportSnapshotResult {
  snapshots: ReportSnapshot[];
  saved: boolean;
}

export interface ReportSnapshotState {
  parcelId: string;
  snapshots: ReportSnapshot[];
}

const DECISION_VERDICTS = [
  "proceed",
  "proceed_with_conditions",
  "investigate_further",
  "high_risk",
] as const;
const READINESS_STATES = ["confirmed", "partial", "missing", "not_reviewed"] as const;
const SEVERITIES = ["low", "medium", "high"] as const;
const EVIDENCE_CONFIDENCES = ["high", "medium", "low", "excluded"] as const;
const LISTING_ROLES = ["subject_active_listing", "comparable_evidence", "market_note"] as const;

export function reportSnapshotStorageKey(
  parcelId: string,
  userId: BrowserPersistenceUserId = null,
) {
  return browserScopedParcelKey("report-snapshots.v1", parcelId, userId);
}

export function snapshotsForActiveParcel(parcelId: string, state: ReportSnapshotState) {
  return state.parcelId === parcelId ? state.snapshots : [];
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
  const currentEvidence = input.savedEvidence
    .filter((evidence) => evidence.parcelId === parcelId)
    .slice()
    .sort(byId);
  const marketSummary = calculateMarketEvidenceSummary(currentEvidence);
  const subjectListing = currentEvidence.find(
    (evidence) => evidence.listingRole === "subject_active_listing",
  );
  const strongestComparableIds = currentEvidence
    .filter(
      (evidence) =>
        evidence.listingRole !== "subject_active_listing" &&
        evidence.includeInSummary &&
        evidence.relationship !== "not_related" &&
        evidence.confidence !== "excluded",
    )
    .sort((a, b) => confidenceRank(b.confidence) - confidenceRank(a.confidence) || a.id.localeCompare(b.id))
    .slice(0, 3)
    .map((evidence) => evidence.id);
  const currentScenarios = input.strategyScenarios
    .filter((scenario) => scenario.parcelId === parcelId)
    .slice()
    .sort(byId);
  const chosenScenarioId =
    report.strategy.chosen?.parcelId === parcelId &&
    currentScenarios.some((scenario) => scenario.id === report.strategy.chosen?.id)
      ? report.strategy.chosen.id
      : currentScenarios.find((scenario) => scenario.selected)?.id ?? null;

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
      evidenceCount: currentEvidence.length,
      includedCount: marketSummary.includedEvidence,
      evidence: currentEvidence
        .map((item) => ({
          id: cleanText(item.id, 160),
          confidence: item.confidence,
          includeInSummary: item.includeInSummary,
          listingRole: item.listingRole ?? null,
        }))
        .sort(byId),
      evidenceIds: currentEvidence.map((item) => cleanText(item.id, 160)).sort(),
      evidenceConfidence: currentEvidence
        .map((item) => ({ id: cleanText(item.id, 160), confidence: cleanText(item.confidence, 80) }))
        .sort(byId),
      subjectListingId: subjectListing?.id ?? null,
      strongestComparableIds,
      indicativeMedianAskingPrice: marketSummary.includedEvidence >= 3
        ? numberOrNull(marketSummary.medianAskingPrice)
        : null,
      latestMarketEvidenceAt: marketSummary.lastUpdated ?? null,
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
      chosenScenarioId,
      scenarioCount: currentScenarios.length,
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
  userId: BrowserPersistenceUserId = null,
): ReportSnapshot[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(reportSnapshotStorageKey(parcelId, userId)) ?? "[]") as unknown;
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
  userId: BrowserPersistenceUserId = null,
): SaveReportSnapshotResult {
  if (!storage) return { snapshots: [], saved: false };
  const normalized = coerceSnapshot(snapshot) ?? snapshot;
  const existing = readReportSnapshots(normalized.parcelId, storage, userId);
  if (existing[0] && snapshotFingerprint(existing[0]) === snapshotFingerprint(normalized)) {
    return { snapshots: existing, saved: false };
  }
  const next = [normalized, ...existing].slice(0, MAX_REPORT_SNAPSHOTS_PER_PARCEL);
  storage.setItem(reportSnapshotStorageKey(normalized.parcelId, userId), JSON.stringify(next));
  return { snapshots: next, saved: true };
}

export function clearReportSnapshots(
  parcelId: string,
  storage: SnapshotStorage | undefined = defaultStorage(),
  userId: BrowserPersistenceUserId = null,
) {
  storage?.removeItem(reportSnapshotStorageKey(parcelId, userId));
}

export function snapshotFingerprint(snapshot: ReportSnapshot): string {
  const { reportGeneratedAt: _reportGeneratedAt, savedAt: _savedAt, ...stable } = snapshot;
  return stableStringify({
    ...stable,
    market: {
      ...stable.market,
      latestMarketEvidenceAt: null,
    },
  });
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

  compareIdSet(
    changes,
    "market",
    "evidence",
    "Market evidence",
    previous.market.evidence.map((item) => item.id),
    current.market.evidence.map((item) => item.id),
  );
  compareEvidenceState(changes, previous.market.evidence, current.market.evidence);
  compareNullableField(changes, "market", "subject-listing", "Subject listing", previous.market.subjectListingId, current.market.subjectListingId);
  compareChanged(
    changes,
    "market",
    "included-count",
    "Included market evidence count",
    String(previous.market.includedCount),
    String(current.market.includedCount),
  );
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

function compareEvidenceState(
  changes: ReportSnapshotChange[],
  previousItems: ReportSnapshot["market"]["evidence"],
  currentItems: ReportSnapshot["market"]["evidence"],
) {
  const previous = new Map(previousItems.map((item) => [item.id, item]));
  for (const current of currentItems) {
    const old = previous.get(current.id);
    if (!old) continue;
    if (old.confidence !== current.confidence) {
      changes.push({
        id: `market-confidence-${current.id}`,
        category: "market",
        type: "changed",
        label: "Evidence confidence changed",
        previousValue: old.confidence,
        currentValue: current.confidence,
      });
    }
    if (old.includeInSummary !== current.includeInSummary) {
      changes.push({
        id: `market-inclusion-${current.id}`,
        category: "market",
        type: "changed",
        label: "Evidence inclusion changed",
        previousValue: old.includeInSummary ? "Included" : "Excluded",
        currentValue: current.includeInSummary ? "Included" : "Excluded",
      });
    }
    if (old.listingRole !== current.listingRole) {
      changes.push({
        id: `market-role-${current.id}`,
        category: "market",
        type: "changed",
        label: "Evidence role changed",
        previousValue: old.listingRole,
        currentValue: current.listingRole,
      });
    }
  }
}

function coerceSnapshot(value: unknown): ReportSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.schemaVersion !== REPORT_SNAPSHOT_SCHEMA_VERSION) return null;
  const parcelId = safeString(raw.parcelId, 160);
  const reportGeneratedAt = safeString(raw.reportGeneratedAt, 80);
  const savedAt = safeString(raw.savedAt, 80);
  if (!parcelId || !reportGeneratedAt || !savedAt) return null;

  const identity = coerceIdentity(raw.identity, parcelId);
  const decision = coerceDecision(raw.decision);
  const market = coerceMarket(raw.market);
  const documents = coerceDocuments(raw.documents);
  const sitePotential = coerceSitePotentialSnapshot(raw.sitePotential);
  const strategy = coerceStrategySnapshot(raw.strategy);
  if (!identity || !decision || !market || !documents || !sitePotential || !strategy) {
    return null;
  }

  return {
    schemaVersion: REPORT_SNAPSHOT_SCHEMA_VERSION,
    parcelId,
    reportGeneratedAt,
    savedAt,
    identity,
    decision,
    market,
    documents,
    sitePotential,
    strategy,
  };
}

function coerceIdentity(value: unknown, parcelId: string): ReportSnapshot["identity"] | null {
  const raw = objectRecord(value);
  if (!raw) return null;
  if (safeString(raw.parcelId, 160) !== parcelId) return null;
  return {
    parcelId,
    erfNumber: safeNullableString(raw.erfNumber, 80),
    portion: safeNullableString(raw.portion, 80),
    lpi: safeNullableString(raw.lpi, 120),
    parcelKey: safeNullableString(raw.parcelKey, 160),
    municipality: safeNullableString(raw.municipality, 160),
    province: safeNullableString(raw.province, 160),
    marketAddressLine: safeNullableString(raw.marketAddressLine, 240),
    areaM2: safeNullableNumber(raw.areaM2),
  };
}

function coerceDecision(value: unknown): ReportSnapshot["decision"] | null {
  const raw = objectRecord(value);
  if (!raw) return null;
  const verdict = enumValue(raw.verdict, DECISION_VERDICTS);
  const confidencePercent = safeNumber(raw.confidencePercent);
  if (!verdict || confidencePercent == null || confidencePercent < 0 || confidencePercent > 100) {
    return null;
  }
  if (!Array.isArray(raw.categories) || !Array.isArray(raw.contradictions) || !Array.isArray(raw.risks) || !Array.isArray(raw.missingInformation)) {
    return null;
  }
  return {
    verdict,
    confidencePercent,
    categories: raw.categories.slice(0, 20).flatMap((item) => {
      const category = objectRecord(item);
      const id = safeString(category?.id, 80);
      const label = safeString(category?.label, 120);
      const score = safeNumber(category?.score);
      const state = enumValue(category?.state, READINESS_STATES);
      if (!id || !label || score == null || score < 0 || score > 100 || !state) return [];
      return [{ id, label, score, state }];
    }).sort(byId),
    contradictions: coerceSeverityItems(raw.contradictions),
    risks: coerceSeverityItems(raw.risks),
    missingInformation: raw.missingInformation
      .slice(0, 80)
      .flatMap((item) => {
        const text = safeString(item, 240);
        return text ? [text] : [];
      })
      .sort(),
  };
}

function coerceMarket(value: unknown): ReportSnapshot["market"] | null {
  const raw = objectRecord(value);
  if (!raw) return null;
  const evidenceCount = safeCount(raw.evidenceCount);
  const includedCount = safeCount(raw.includedCount);
  if (evidenceCount == null || includedCount == null) return null;
  if (!Array.isArray(raw.evidence) || !Array.isArray(raw.evidenceIds) || !Array.isArray(raw.evidenceConfidence) || !Array.isArray(raw.strongestComparableIds)) {
    return null;
  }
  const evidence = raw.evidence.slice(0, 200).flatMap((item) => {
    const entry = objectRecord(item);
    const id = safeString(entry?.id, 160);
    const confidence = enumValue(entry?.confidence, EVIDENCE_CONFIDENCES);
    const listingRole =
      entry?.listingRole == null ? null : enumValue(entry.listingRole, LISTING_ROLES);
    if (!id || !confidence || listingRole === undefined) return [];
    return [
      {
        id,
        confidence,
        includeInSummary: Boolean(entry?.includeInSummary),
        listingRole,
      },
    ];
  }).sort(byId);
  return {
    evidenceCount,
    includedCount,
    evidence,
    evidenceIds: raw.evidenceIds
      .slice(0, 200)
      .flatMap((item) => {
        const id = safeString(item, 160);
        return id ? [id] : [];
      })
      .sort(),
    evidenceConfidence: raw.evidenceConfidence.slice(0, 200).flatMap((item) => {
      const entry = objectRecord(item);
      const id = safeString(entry?.id, 160);
      const confidence = enumValue(entry?.confidence, EVIDENCE_CONFIDENCES);
      return id && confidence ? [{ id, confidence }] : [];
    }).sort(byId),
    subjectListingId: safeNullableString(raw.subjectListingId, 160),
    strongestComparableIds: raw.strongestComparableIds
      .slice(0, 20)
      .flatMap((item) => {
        const id = safeString(item, 160);
        return id ? [id] : [];
      })
      .sort(),
    indicativeMedianAskingPrice: safeNullableNumber(raw.indicativeMedianAskingPrice),
    latestMarketEvidenceAt: safeNullableString(raw.latestMarketEvidenceAt, 80),
  };
}

function coerceDocuments(value: unknown): ReportSnapshot["documents"] | null {
  const raw = objectRecord(value);
  if (!raw) return null;
  const assetCount = safeCount(raw.assetCount);
  const uploadedReportCount = safeCount(raw.uploadedReportCount);
  const sgDiagramCount = safeCount(raw.sgDiagramCount);
  if (assetCount == null || uploadedReportCount == null || sgDiagramCount == null || !Array.isArray(raw.assets)) {
    return null;
  }
  return {
    assetCount,
    uploadedReportCount,
    sgDiagramCount,
    assets: raw.assets.slice(0, 200).flatMap((item) => {
      const asset = objectRecord(item);
      const id = safeString(asset?.id, 160);
      const category = safeString(asset?.category, 120);
      return id && category ? [{ id, category }] : [];
    }).sort(byId),
  };
}

function coerceSitePotentialSnapshot(value: unknown): ReportSnapshot["sitePotential"] | null {
  const raw = objectRecord(value);
  if (!raw) return null;
  const conceptCount = safeCount(raw.conceptCount);
  if (conceptCount == null || typeof raw.skipped !== "boolean") return null;
  return {
    selectedConceptAssetId: safeNullableString(raw.selectedConceptAssetId, 160),
    conceptCount,
    skipped: raw.skipped,
  };
}

function coerceStrategySnapshot(value: unknown): ReportSnapshot["strategy"] | null {
  const raw = objectRecord(value);
  if (!raw) return null;
  const scenarioCount = safeCount(raw.scenarioCount);
  if (scenarioCount == null) return null;
  return {
    chosenScenarioId: safeNullableString(raw.chosenScenarioId, 160),
    scenarioCount,
  };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
}

function coerceSeverityItems(values: unknown[]): Array<{ id: string; severity: string }> {
  return values
    .slice(0, 80)
    .flatMap((item) => {
      const raw = objectRecord(item);
      const id = safeString(raw?.id, 160);
      const severity = enumValue(raw?.severity, SEVERITIES);
      return id && severity ? [{ id, severity }] : [];
    })
    .sort(byId);
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function safeString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = cleanText(value, max);
  return text ? text : null;
}

function safeNullableString(value: unknown, max: number): string | null {
  return value == null ? null : safeString(value, max);
}

function safeNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function safeNullableNumber(value: unknown): number | null {
  return value == null ? null : safeNumber(value);
}

function safeCount(value: unknown): number | null {
  const count = safeNumber(value);
  return count == null || count < 0 || !Number.isInteger(count) ? null : count;
}

function enumValue<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
): T[number] | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : undefined;
}

function defaultStorage(): SnapshotStorage | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

function byId<T extends { id: string }>(a: T, b: T) {
  return a.id.localeCompare(b.id);
}

function confidenceRank(confidence: MarketEvidenceConfidence) {
  return confidence === "high" ? 3 : confidence === "medium" ? 2 : confidence === "low" ? 1 : 0;
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
