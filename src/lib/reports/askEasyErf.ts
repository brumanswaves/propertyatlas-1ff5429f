import { calculateMarketEvidenceSummary } from "@/features/marketEvidence/calculateMarketEvidenceSummary";
import type {
  MarketEvidenceConfidence,
  MarketEvidenceRelationship,
  MarketEvidenceSummary,
  SavedMarketEvidence,
} from "@/features/marketEvidence/types";
import type { DecisionIntelligence } from "./buildDecisionIntelligence";
import type { ReportViewModel, RiskItem } from "./buildReportViewModel";
import type { ReportDecisionMode } from "./reportDecisionMode";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";
import type { ErfStrategyScenario } from "@/lib/workbench/erfWorkspaceState";

export type AskEasyErfEvidenceSourceType =
  | "official"
  | "uploaded"
  | "market"
  | "user_confirmed"
  | "calculation"
  | "ai_interpretation"
  | "missing";

export type AskEasyErfConfidence = "high" | "medium" | "low";

export interface AskEasyErfEvidenceReference {
  label: string;
  sourceType: AskEasyErfEvidenceSourceType;
}

export interface AskEasyErfAnswer {
  answer: string;
  confidence: AskEasyErfConfidence;
  evidenceReferences: AskEasyErfEvidenceReference[];
  unknowns: string[];
  nextAction: string | null;
}

export interface AskEasyErfAssetSummary {
  id: string;
  parcelId: string;
  category: string;
  assetType: string;
  sourceLabel: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  createdAt: string;
  hasExtractedText: boolean;
  extractedText?: string;
  selectedSiteConcept?: boolean;
  conceptName?: string | null;
  conceptRationale?: string | null;
}

export interface AskEasyErfEvidencePayload {
  parcelId: string;
  generatedAt: string;
  identity: ReportViewModel["identity"];
  ownership: ReportViewModel["ownership"];
  planning: ReportViewModel["planning"];
  market: {
    evidenceCount: number;
    includedCount: number;
    canShowIndicativeValue: boolean;
    subjectListing: SavedMarketEvidence | null;
    strongest: SavedMarketEvidence[];
    summary: ReportViewModel["market"]["summary"];
  };
  risks: RiskItem[];
  recommendations: ReportViewModel["recommendations"];
  decision: {
    verdict: DecisionIntelligence["verdict"];
    confidencePercent: number;
    summary: string;
    confidenceCategories: DecisionIntelligence["confidenceCategories"];
    known: string[];
    stillNeeded: string[];
    contradictions: DecisionIntelligence["contradictions"];
    matrix: DecisionIntelligence["matrix"];
  };
  uploadedAssets: AskEasyErfAssetSummary[];
  sitePotential: {
    selectedConcept: AskEasyErfAssetSummary | null;
    conceptCount: number;
    skipped: boolean;
    hasBrief: boolean;
  };
  strategy: {
    chosen: ErfStrategyScenario | null;
    scenarios: ErfStrategyScenario[];
  };
  missingInformation: string[];
}

export interface BuildAskEasyErfPayloadInput {
  report: ReportViewModel;
  decision: DecisionIntelligence;
  assets: ErfAsset[];
  savedEvidence: SavedMarketEvidence[];
  strategyScenarios: ErfStrategyScenario[];
}

const MAX_TEXT = 800;
const MAX_ITEMS = 12;
const MAX_MARKET_EVIDENCE_ITEMS = 3;
const MAX_ASSET_SUMMARIES = 4;
const MAX_STRATEGY_SCENARIOS = 2;
const MAX_EXTRACTED_TEXT_PER_ASSET = 250;
const MAX_TOTAL_EXTRACTED_TEXT = 750;
const MAX_DECISION_ITEMS = 5;
const MAX_CONFIDENCE_CATEGORIES = 8;
const MAX_IMPORTED_LISTING_ITEMS = 2;
const MAX_RECORD_KEYS = 4;
const MAX_SCENARIO_SUMMARY_ITEMS = 3;
const SOURCE_TYPES: AskEasyErfEvidenceSourceType[] = [
  "official",
  "uploaded",
  "market",
  "user_confirmed",
  "calculation",
  "ai_interpretation",
  "missing",
];

export function buildAskEasyErfEvidencePayload(
  input: BuildAskEasyErfPayloadInput,
): AskEasyErfEvidencePayload {
  const parcelId = input.report.parcelId;
  const selectedDesignId = input.report.site.selectedDesign?.id ?? null;
  const currentAssets = input.assets
    .filter((asset) => asset.parcel_id === parcelId)
    .sort(
      (a, b) => assetRelevanceRank(a, selectedDesignId) - assetRelevanceRank(b, selectedDesignId),
    )
    .slice(0, MAX_ASSET_SUMMARIES);
  let remainingExtractedText = MAX_TOTAL_EXTRACTED_TEXT;
  const uploadedAssets = currentAssets.map((asset) => {
    const summary = summarizeAsset(asset, selectedDesignId === asset.id, remainingExtractedText);
    if (summary.extractedText) remainingExtractedText -= summary.extractedText.length;
    return summary;
  });
  const selectedConcept = selectedDesignId
    ? (uploadedAssets.find((asset) => asset.id === selectedDesignId) ?? null)
    : null;
  const currentPaidReports = currentAssets.filter(
    (asset) => asset.asset_category === "paid_report",
  );
  const stillNeeded = input.decision.stillNeeded
    .map((item) => cleanText(item))
    .slice(0, MAX_DECISION_ITEMS);
  const currentMarketEvidence = input.savedEvidence.filter(
    (evidence) => evidence.parcelId === parcelId,
  );
  const marketSummary = calculateMarketEvidenceSummary(currentMarketEvidence);
  const subjectListing =
    currentMarketEvidence.find((item) => item.listingRole === "subject_active_listing") ?? null;
  const strongest = currentMarketEvidence
    .filter(
      (item) =>
        item.includeInSummary &&
        item.listingRole !== "subject_active_listing" &&
        item.relationship !== "not_related" &&
        item.confidence !== "excluded",
    )
    .sort(compareMarketEvidence)
    .slice(0, MAX_MARKET_EVIDENCE_ITEMS)
    .map((item) => limitMarketEvidence(item, parcelId))
    .filter((item): item is SavedMarketEvidence => Boolean(item));
  const chosen =
    input.report.strategy.chosen?.parcelId === parcelId ? input.report.strategy.chosen : null;
  const scenarios = uniqueScenarios([chosen, ...input.strategyScenarios], parcelId).slice(
    0,
    MAX_STRATEGY_SCENARIOS,
  );

  const rawPayload: AskEasyErfEvidencePayload = {
    parcelId,
    generatedAt: input.report.generatedAt,
    identity: input.report.identity,
    ownership: {
      ...input.report.ownership,
      hasUploadedReport: currentPaidReports.length > 0,
      uploadedReportNames: currentPaidReports.map((asset) =>
        cleanText(asset.original_file_name, 160),
      ),
    },
    planning: input.report.planning,
    market: {
      evidenceCount: currentMarketEvidence.length,
      includedCount: marketSummary.includedEvidence,
      canShowIndicativeValue:
        marketSummary.includedEvidence >= 3 && marketSummary.hasUsablePriceData,
      subjectListing: limitMarketEvidence(subjectListing, parcelId),
      strongest,
      summary: marketSummary,
    },
    risks: input.report.risks.slice(0, MAX_DECISION_ITEMS),
    recommendations: input.report.recommendations.slice(0, MAX_DECISION_ITEMS),
    decision: {
      verdict: input.decision.verdict,
      confidencePercent: input.decision.confidencePercent,
      summary: cleanText(input.decision.summary),
      confidenceCategories: input.decision.confidenceCategories.slice(0, MAX_CONFIDENCE_CATEGORIES),
      known: input.decision.known.map((item) => cleanText(item)).slice(0, MAX_DECISION_ITEMS),
      stillNeeded,
      contradictions: input.decision.contradictions.slice(0, MAX_DECISION_ITEMS),
      matrix: input.decision.matrix.slice(0, MAX_DECISION_ITEMS),
    },
    uploadedAssets,
    sitePotential: {
      selectedConcept,
      conceptCount: currentAssets.filter((asset) => asset.asset_category === "generated_design")
        .length,
      skipped: input.report.site.skipped,
      hasBrief: Boolean(selectedConcept?.conceptRationale),
    },
    strategy: {
      chosen,
      scenarios,
    },
    missingInformation: stillNeeded,
  };
  return sanitizeAskEasyErfEvidencePayloadForTransport(rawPayload);
}

export function sanitizeAskEasyErfEvidencePayloadForTransport(
  payload: AskEasyErfEvidencePayload,
): AskEasyErfEvidencePayload {
  const sanitized = validateAskEasyErfEvidencePayload(payload);
  if (!sanitized) {
    throw new Error("Ask Easy Erf could not prepare a valid evidence payload.");
  }
  return sanitized;
}

export function suggestedAskEasyErfQuestions(
  payload: AskEasyErfEvidencePayload,
  mode: ReportDecisionMode = "standard",
): string[] {
  if (mode === "investor") {
    return unique([
      "What assumptions have the greatest effect on this investment case?",
      "What evidence is still needed before evaluating an offer?",
      "What could invalidate the chosen strategy?",
      "Which costs are still missing?",
      "What should I verify before making an offer?",
      "How strong is the market support for the exit assumption?",
    ]).slice(0, 5);
  }
  const questions: string[] = [];
  if (!payload.ownership.isVerified) questions.push("Why is ownership still unverified?");
  if (payload.missingInformation.length) {
    questions.push("What evidence would improve confidence most?");
  }
  if (payload.risks.length) questions.push("What are the biggest risks?");
  if (payload.market.includedCount < 3) questions.push("Is the Market evidence strong enough?");
  if (payload.planning.some((field) => !field.value)) {
    questions.push("What planning information is still missing?");
  }
  if (payload.sitePotential.selectedConcept) {
    questions.push("What does Easy Erf know about development potential?");
  }
  questions.push("What should I ask a town planner?");
  questions.push(`Why is the current verdict "${verdictLabel(payload.decision.verdict)}"?`);
  return unique(questions).slice(0, 5);
}

export function hasEnoughAskEasyErfEvidence(payload: AskEasyErfEvidencePayload): boolean {
  return askEasyErfEvidenceWeight(payload) >= 2;
}

export function askEasyErfEvidenceWeight(payload: AskEasyErfEvidencePayload): number {
  let weight = 0;
  if (payload.identity.erfNumber || payload.identity.lpi || payload.identity.parcelKey) weight += 1;
  if (payload.identity.marketAddressLine) weight += 1;
  if (payload.planning.some((field) => field.value)) weight += 1;
  if (payload.market.evidenceCount > 0) weight += 1;
  if (payload.uploadedAssets.length > 0) weight += 1;
  if (payload.risks.length > 0 || payload.decision.stillNeeded.length > 0) weight += 1;
  if (payload.strategy.chosen || payload.strategy.scenarios.length > 0) weight += 1;
  if (payload.sitePotential.selectedConcept || payload.sitePotential.skipped) weight += 1;
  return weight;
}

export function validateAskEasyErfAnswer(value: unknown): AskEasyErfAnswer | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Partial<AskEasyErfAnswer>;
  if (typeof raw.answer !== "string" || !raw.answer.trim()) return null;
  if (raw.confidence !== "high" && raw.confidence !== "medium" && raw.confidence !== "low") {
    return null;
  }
  if (!Array.isArray(raw.evidenceReferences) || raw.evidenceReferences.length === 0) return null;
  const evidenceReferences = raw.evidenceReferences
    .map((item) => normalizeReference(item))
    .filter((item): item is AskEasyErfEvidenceReference => Boolean(item))
    .slice(0, 10);
  if (!evidenceReferences.length) return null;
  if (!Array.isArray(raw.unknowns)) return null;
  if (raw.nextAction != null && typeof raw.nextAction !== "string") return null;
  return {
    answer: cleanText(raw.answer, 3000),
    confidence: raw.confidence,
    evidenceReferences,
    unknowns: raw.unknowns
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => cleanText(item, 500))
      .slice(0, 8),
    nextAction: raw.nextAction ? cleanText(raw.nextAction, 500) : null,
  };
}

export function validateAskEasyErfEvidencePayload(
  value: unknown,
): AskEasyErfEvidencePayload | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const parcelId = requireText(raw.parcelId, 160);
  const generatedAt = requireText(raw.generatedAt, 80);
  const identity = validateIdentity(raw.identity);
  const ownership = validateOwnership(raw.ownership);
  const planning = validateArray(raw.planning, validatePlanningField, MAX_ITEMS);
  const market = validateMarket(raw.market);
  const risks = validateArray(raw.risks, validateRisk, MAX_DECISION_ITEMS);
  const recommendations = validateArray(
    raw.recommendations,
    validateRecommendation,
    MAX_DECISION_ITEMS,
  );
  const decision = validateDecision(raw.decision);
  const uploadedAssets = validateArray(raw.uploadedAssets, validateAsset, MAX_ASSET_SUMMARIES);
  const sitePotential = validateSitePotential(raw.sitePotential);
  const strategy = validateStrategy(raw.strategy);
  const missingInformation = validateStringArray(raw.missingInformation, MAX_DECISION_ITEMS, 500);

  if (
    !parcelId ||
    !generatedAt ||
    !identity ||
    !ownership ||
    !planning ||
    !market ||
    !risks ||
    !recommendations ||
    !decision ||
    !uploadedAssets ||
    !sitePotential ||
    !strategy ||
    !missingInformation
  ) {
    return null;
  }

  return {
    parcelId,
    generatedAt,
    identity,
    ownership,
    planning,
    market,
    risks,
    recommendations,
    decision,
    uploadedAssets,
    sitePotential,
    strategy,
    missingInformation,
  };
}

function summarizeAsset(
  asset: ErfAsset,
  selectedSiteConcept: boolean,
  remainingExtractedText: number,
): AskEasyErfAssetSummary {
  const extractedText = extractedDocumentText(asset, remainingExtractedText);
  return {
    id: asset.id,
    parcelId: asset.parcel_id,
    category: asset.asset_category,
    assetType: asset.asset_type,
    sourceLabel: asset.source_label,
    fileName: asset.original_file_name,
    mimeType: asset.mime_type,
    sizeBytes: asset.size_bytes,
    status: asset.status,
    createdAt: asset.created_at,
    hasExtractedText: Boolean(extractedText),
    extractedText,
    selectedSiteConcept,
    conceptName: metadataString(asset.metadata, "conceptName"),
    conceptRationale: metadataString(asset.metadata, "conceptRationale"),
  };
}

function extractedDocumentText(
  asset: ErfAsset,
  remainingExtractedText: number,
): string | undefined {
  const extracted = metadataString(asset.metadata, "extractedText");
  const extractionStatus = metadataString(asset.metadata, "extractionStatus");
  const max = Math.min(MAX_EXTRACTED_TEXT_PER_ASSET, Math.max(0, remainingExtractedText));
  if (extracted && extractionStatus === "ready" && max > 0) return cleanText(extracted, max);
  return undefined;
}

function assetRelevanceRank(asset: ErfAsset, selectedDesignId: string | null) {
  if (selectedDesignId && asset.id === selectedDesignId) return 0;
  if (asset.asset_category === "paid_report" || asset.asset_category === "official_document") {
    return 1;
  }
  if (asset.asset_category === "sg_diagram") return 2;
  if (asset.asset_category === "generated_design") return 3;
  return 4;
}

function metadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? cleanText(value) : null;
}

function limitMarketEvidence(
  item: SavedMarketEvidence | null,
  parcelId: string,
): SavedMarketEvidence | null {
  if (!item) return null;
  if (item.parcelId !== parcelId) return null;
  return {
    ...item,
    notes: item.notes ? cleanText(item.notes, 500) : item.notes,
    importedListing: item.importedListing
      ? {
          ...item.importedListing,
          warnings: item.importedListing.warnings?.slice(0, MAX_IMPORTED_LISTING_ITEMS),
          missingFields: item.importedListing.missingFields?.slice(0, MAX_IMPORTED_LISTING_ITEMS),
          matchReasons: item.importedListing.matchReasons?.slice(0, MAX_IMPORTED_LISTING_ITEMS),
        }
      : item.importedListing,
  };
}

function compareMarketEvidence(a: SavedMarketEvidence, b: SavedMarketEvidence) {
  const confidence = confidenceRank(b.confidence) - confidenceRank(a.confidence);
  if (confidence !== 0) return confidence;
  const price = Number(Boolean(b.askingPrice)) - Number(Boolean(a.askingPrice));
  if (price !== 0) return price;
  return (b.updatedAt || b.savedAt).localeCompare(a.updatedAt || a.savedAt);
}

function confidenceRank(confidence: MarketEvidenceConfidence) {
  switch (confidence) {
    case "high":
      return 4;
    case "medium":
      return 3;
    case "low":
      return 2;
    default:
      return 1;
  }
}

function uniqueScenarios(
  scenarios: Array<ErfStrategyScenario | null | undefined>,
  parcelId: string,
): ErfStrategyScenario[] {
  const seen = new Set<string>();
  const current: ErfStrategyScenario[] = [];
  for (const scenario of scenarios) {
    if (!scenario || scenario.parcelId !== parcelId || seen.has(scenario.id)) continue;
    seen.add(scenario.id);
    current.push(scenario);
  }
  return current;
}

function validateIdentity(value: unknown): ReportViewModel["identity"] | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const displayName = requireText(raw.displayName, 240);
  const coordinates = raw.coordinates == null ? null : validateCoordinates(raw.coordinates);
  const areaM2 = nullableNumber(raw.areaM2, 0, 1_000_000_000);
  if (!displayName || coordinates === undefined || areaM2 === undefined) return null;
  return {
    displayName,
    officialLine: nullableText(raw.officialLine, 180),
    marketAddressLine: nullableText(raw.marketAddressLine, 180),
    addressAndOfficialMismatch:
      typeof raw.addressAndOfficialMismatch === "boolean" ? raw.addressAndOfficialMismatch : false,
    municipality: nullableText(raw.municipality, 120),
    province: nullableText(raw.province, 120),
    erfNumber: nullableText(raw.erfNumber, 80),
    portion: nullableText(raw.portion, 80),
    lpi: nullableText(raw.lpi, 120),
    parcelKey: nullableText(raw.parcelKey, 160),
    sourceLabel: nullableText(raw.sourceLabel, 160),
    coordinates,
    areaM2,
  };
}

function validateOwnership(value: unknown): ReportViewModel["ownership"] | null {
  const raw = asRecord(value);
  if (!raw || typeof raw.hasUploadedReport !== "boolean" || raw.isVerified !== false) return null;
  const uploadedReportNames = validateStringArray(raw.uploadedReportNames, MAX_ITEMS, 160);
  const message = requireText(raw.message, 500);
  if (!uploadedReportNames || !message) return null;
  return {
    hasUploadedReport: raw.hasUploadedReport,
    uploadedReportNames,
    isVerified: false,
    message,
  };
}

function validatePlanningField(value: unknown): ReportViewModel["planning"][number] | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const label = requireText(raw.label, 120);
  const badge = enumValue(raw.badge, [
    "official",
    "uploaded_report",
    "user_confirmed",
    "listing",
    "ai_interpretation",
    "assumption",
    "missing",
  ] as const);
  if (!label || !badge) return null;
  return {
    label,
    value: nullableText(raw.value, 180),
    badge,
  };
}

function validateMarket(value: unknown): AskEasyErfEvidencePayload["market"] | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const evidenceCount = wholeNumber(raw.evidenceCount, 0, 1_000);
  const includedCount = wholeNumber(raw.includedCount, 0, 1_000);
  const summary = validateMarketSummary(raw.summary);
  let subjectListing: SavedMarketEvidence | null = null;
  if (raw.subjectListing != null) {
    subjectListing = validateMarketEvidence(raw.subjectListing);
    if (!subjectListing) return null;
  }
  const strongest = validateArray(raw.strongest, validateMarketEvidence, MAX_MARKET_EVIDENCE_ITEMS);
  if (
    evidenceCount == null ||
    includedCount == null ||
    typeof raw.canShowIndicativeValue !== "boolean" ||
    !summary ||
    !strongest
  ) {
    return null;
  }
  return {
    evidenceCount,
    includedCount,
    canShowIndicativeValue: raw.canShowIndicativeValue,
    subjectListing,
    strongest,
    summary,
  };
}

function validateMarketSummary(value: unknown): MarketEvidenceSummary | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const totalEvidence = wholeNumber(raw.totalEvidence, 0, 1_000);
  const includedEvidence = wholeNumber(raw.includedEvidence, 0, 1_000);
  const priceRange = raw.priceRange == null ? undefined : validatePriceRange(raw.priceRange);
  const relationshipMix = validateNumberRecord(raw.relationshipMix);
  const confidenceMix = validateNumberRecord(raw.confidenceMix);
  if (
    totalEvidence == null ||
    includedEvidence == null ||
    priceRange === null ||
    !relationshipMix ||
    !confidenceMix ||
    typeof raw.hasUsablePriceData !== "boolean"
  ) {
    return null;
  }
  return {
    totalEvidence,
    includedEvidence,
    averageAskingPrice: optionalNumber(raw.averageAskingPrice, 0, 1_000_000_000),
    medianAskingPrice: optionalNumber(raw.medianAskingPrice, 0, 1_000_000_000),
    priceRange,
    averageLandPricePerM2: optionalNumber(raw.averageLandPricePerM2, 0, 10_000_000),
    medianLandPricePerM2: optionalNumber(raw.medianLandPricePerM2, 0, 10_000_000),
    averageBuildingPricePerM2: optionalNumber(raw.averageBuildingPricePerM2, 0, 10_000_000),
    medianBuildingPricePerM2: optionalNumber(raw.medianBuildingPricePerM2, 0, 10_000_000),
    relationshipMix,
    confidenceMix,
    lastUpdated: optionalText(raw.lastUpdated, 80),
    hasUsablePriceData: raw.hasUsablePriceData,
  };
}

function validateMarketEvidence(value: unknown): SavedMarketEvidence | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const id = requireText(raw.id, 80);
  const parcelId = requireText(raw.parcelId, 120);
  const sourceUrl = requireText(raw.sourceUrl, 360);
  const sourcePortal = requireText(raw.sourcePortal, 80);
  const title = requireText(raw.title, 160);
  const relationship = enumValue(raw.relationship, [
    "target_asset",
    "possible_target_asset",
    "same_street_comp",
    "same_node_comp",
    "same_suburb_comp",
    "vacant_land_comp",
    "broader_market_comp",
    "inverse_comp",
    "weak_comp",
    "not_related",
  ] as const satisfies readonly MarketEvidenceRelationship[]);
  const confidence = enumValue(raw.confidence, [
    "high",
    "medium",
    "low",
    "excluded",
  ] as const satisfies readonly MarketEvidenceConfidence[]);
  const savedAt = requireText(raw.savedAt, 80);
  const updatedAt = requireText(raw.updatedAt, 80);
  if (
    !id ||
    !parcelId ||
    !sourceUrl ||
    !sourcePortal ||
    !title ||
    !relationship ||
    !confidence ||
    typeof raw.includeInSummary !== "boolean" ||
    !savedAt ||
    !updatedAt
  ) {
    return null;
  }
  const importedListing = validateImportedListing(raw.importedListing);
  if (importedListing === false) return null;
  return {
    id,
    parcelId,
    sourceUrl,
    sourcePortal,
    title,
    askingPrice: optionalNumber(raw.askingPrice, 0, 1_000_000_000),
    propertyType: nullableText(raw.propertyType, 80),
    beds: optionalNumber(raw.beds, 0, 200),
    baths: optionalNumber(raw.baths, 0, 200),
    garages: optionalNumber(raw.garages, 0, 200),
    parkingSpaces: optionalNumber(raw.parkingSpaces, 0, 500),
    landSizeM2: optionalNumber(raw.landSizeM2, 0, 1_000_000_000),
    buildingSizeM2: optionalNumber(raw.buildingSizeM2, 0, 1_000_000_000),
    relationship,
    confidence,
    includeInSummary: raw.includeInSummary,
    listingRole: optionalEnumValue(raw.listingRole, [
      "subject_active_listing",
      "comparable_evidence",
      "market_note",
    ] as const),
    importedListing,
    notes: nullableText(raw.notes, 300),
    savedAt,
    updatedAt,
  };
}

function validateImportedListing(value: unknown): SavedMarketEvidence["importedListing"] | false {
  if (value == null) return null;
  const raw = asRecord(value);
  if (!raw) return false;
  const warnings = validateStringArray(raw.warnings ?? [], MAX_IMPORTED_LISTING_ITEMS, 120);
  const missingFields = validateStringArray(
    raw.missingFields ?? [],
    MAX_IMPORTED_LISTING_ITEMS,
    80,
  );
  const matchReasons = validateStringArray(raw.matchReasons ?? [], MAX_IMPORTED_LISTING_ITEMS, 120);
  if (!warnings || !missingFields || !matchReasons) return false;
  return {
    listingId: nullableText(raw.listingId, 120),
    canonicalUrl: nullableText(raw.canonicalUrl, 360),
    importedAt: nullableText(raw.importedAt, 80),
    fetchedAt: nullableText(raw.fetchedAt, 80),
    contentHash: nullableText(raw.contentHash, 160),
    listingDate: nullableText(raw.listingDate, 80),
    warnings,
    missingFields,
    matchStatus: nullableText(raw.matchStatus, 120),
    matchReasons,
    userConfirmedAttachment:
      typeof raw.userConfirmedAttachment === "boolean" ? raw.userConfirmedAttachment : undefined,
  };
}

function validateRisk(value: unknown): RiskItem | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const id = requireText(raw.id, 160);
  const title = requireText(raw.title, 240);
  const severity = enumValue(raw.severity, ["low", "medium", "high"] as const);
  const why = requireText(raw.why, 360);
  const evidence = requireText(raw.evidence, 360);
  const nextAction = requireText(raw.nextAction, 240);
  if (!id || !title || !severity || !why || !evidence || !nextAction) return null;
  return {
    id,
    title,
    severity,
    why,
    evidence,
    nextAction,
    actionTab: optionalText(raw.actionTab, 80),
  };
}

function validateRecommendation(value: unknown): ReportViewModel["recommendations"][number] | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const id = requireText(raw.id, 160);
  const order = wholeNumber(raw.order, 0, 1_000);
  const title = requireText(raw.title, 240);
  const detail = requireText(raw.detail, 360);
  const actionLabel = requireText(raw.actionLabel, 120);
  if (!id || order == null || !title || !detail || !actionLabel) return null;
  return {
    id,
    order,
    title,
    detail,
    actionLabel,
    actionTab: optionalText(raw.actionTab, 80),
  };
}

function validateDecision(value: unknown): AskEasyErfEvidencePayload["decision"] | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const verdict = enumValue(raw.verdict, [
    "proceed",
    "proceed_with_conditions",
    "investigate_further",
    "high_risk",
  ] as const);
  const confidencePercent = wholeNumber(raw.confidencePercent, 0, 100);
  const summary = requireText(raw.summary, 700);
  const confidenceCategories = validateArray(
    raw.confidenceCategories,
    validateConfidenceCategory,
    MAX_DECISION_ITEMS,
  );
  const known = validateStringArray(raw.known, MAX_DECISION_ITEMS, 280);
  const stillNeeded = validateStringArray(raw.stillNeeded, MAX_DECISION_ITEMS, 280);
  const contradictions = validateArray(
    raw.contradictions,
    validateContradiction,
    MAX_DECISION_ITEMS,
  );
  const matrix = validateArray(raw.matrix, validateMatrixRow, MAX_DECISION_ITEMS);
  if (
    !verdict ||
    confidencePercent == null ||
    !summary ||
    !confidenceCategories ||
    !known ||
    !stillNeeded ||
    !contradictions ||
    !matrix
  ) {
    return null;
  }
  return {
    verdict,
    confidencePercent,
    summary,
    confidenceCategories,
    known,
    stillNeeded,
    contradictions,
    matrix,
  };
}

function validateConfidenceCategory(
  value: unknown,
): AskEasyErfEvidencePayload["decision"]["confidenceCategories"][number] | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const id = enumValue(raw.id, [
    "identity",
    "planning",
    "ownership",
    "market",
    "risk",
    "strategy",
    "documents",
  ] as const);
  const label = requireText(raw.label, 160);
  const score = wholeNumber(raw.score, 0, 100);
  const state = enumValue(raw.state, ["confirmed", "partial", "missing", "not_reviewed"] as const);
  const explanation = requireText(raw.explanation, 260);
  if (!id || !label || score == null || !state || !explanation) return null;
  return { id, label, score, state, explanation };
}

function validateContradiction(
  value: unknown,
): AskEasyErfEvidencePayload["decision"]["contradictions"][number] | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const id = requireText(raw.id, 160);
  const title = requireText(raw.title, 240);
  const severity = enumValue(raw.severity, ["low", "medium", "high"] as const);
  const explanation = requireText(raw.explanation, 360);
  const evidence = validateStringArray(raw.evidence, MAX_DECISION_ITEMS, 180);
  const nextAction = requireText(raw.nextAction, 240);
  if (!id || !title || !severity || !explanation || !evidence || !nextAction) return null;
  return { id, title, severity, explanation, evidence, nextAction };
}

function validateMatrixRow(
  value: unknown,
): AskEasyErfEvidencePayload["decision"]["matrix"][number] | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const id = requireText(raw.id, 160);
  const question = requireText(raw.question, 220);
  const answer = enumValue(raw.answer, ["yes", "no", "conditional", "unknown"] as const);
  const explanation = requireText(raw.explanation, 260);
  if (!id || !question || !answer || !explanation) return null;
  return { id, question, answer, explanation };
}

function validateAsset(value: unknown): AskEasyErfAssetSummary | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const id = requireText(raw.id, 80);
  const parcelId = requireText(raw.parcelId, 120);
  const category = requireText(raw.category, 80);
  const assetType = requireText(raw.assetType, 80);
  const fileName = requireText(raw.fileName, 120);
  const mimeType = requireText(raw.mimeType, 80);
  const sizeBytes = wholeNumber(raw.sizeBytes, 0, 1_000_000_000);
  const status = requireText(raw.status, 80);
  const createdAt = requireText(raw.createdAt, 80);
  if (
    !id ||
    !parcelId ||
    !category ||
    !assetType ||
    !fileName ||
    !mimeType ||
    sizeBytes == null ||
    !status ||
    !createdAt ||
    typeof raw.hasExtractedText !== "boolean"
  ) {
    return null;
  }
  return {
    id,
    parcelId,
    category,
    assetType,
    sourceLabel: nullableText(raw.sourceLabel, 80),
    fileName,
    mimeType,
    sizeBytes,
    status,
    createdAt,
    hasExtractedText: raw.hasExtractedText,
    extractedText: optionalText(raw.extractedText, MAX_EXTRACTED_TEXT_PER_ASSET),
    selectedSiteConcept:
      typeof raw.selectedSiteConcept === "boolean" ? raw.selectedSiteConcept : undefined,
    conceptName: nullableText(raw.conceptName, 100),
    conceptRationale: nullableText(raw.conceptRationale, 180),
  };
}

function validateSitePotential(value: unknown): AskEasyErfEvidencePayload["sitePotential"] | null {
  const raw = asRecord(value);
  if (!raw) return null;
  let selectedConcept: AskEasyErfAssetSummary | null = null;
  if (raw.selectedConcept != null) {
    selectedConcept = validateAsset(raw.selectedConcept);
    if (!selectedConcept) return null;
  }
  const conceptCount = wholeNumber(raw.conceptCount, 0, 1_000);
  if (
    conceptCount == null ||
    typeof raw.skipped !== "boolean" ||
    typeof raw.hasBrief !== "boolean"
  ) {
    return null;
  }
  return {
    selectedConcept,
    conceptCount,
    skipped: raw.skipped,
    hasBrief: raw.hasBrief,
  };
}

function validateStrategy(value: unknown): AskEasyErfEvidencePayload["strategy"] | null {
  const raw = asRecord(value);
  if (!raw) return null;
  let chosen: ErfStrategyScenario | null = null;
  if (raw.chosen != null) {
    chosen = validateScenario(raw.chosen);
    if (!chosen) return null;
  }
  const scenarios = validateArray(raw.scenarios, validateScenario, MAX_STRATEGY_SCENARIOS);
  if (!scenarios) return null;
  return { chosen, scenarios };
}

function validateScenario(value: unknown): ErfStrategyScenario | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const id = requireText(raw.id, 80);
  const parcelId = requireText(raw.parcelId, 120);
  const label = requireText(raw.label, 120);
  const strategy = requireText(raw.strategy, 100);
  const inputs = validateStringRecord(raw.inputs);
  const summary = validateArray(
    raw.summary,
    validateScenarioSummaryItem,
    MAX_SCENARIO_SUMMARY_ITEMS,
  );
  const savedAt = requireText(raw.savedAt, 80);
  if (!id || !parcelId || !label || !strategy || !inputs || !summary || !savedAt) return null;
  return {
    id,
    parcelId,
    label,
    strategy,
    inputs,
    summary,
    selected: typeof raw.selected === "boolean" ? raw.selected : undefined,
    savedAt,
  };
}

function validateScenarioSummaryItem(
  value: unknown,
): ErfStrategyScenario["summary"][number] | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const label = requireText(raw.label, 100);
  const itemValue = requireText(raw.value, 140);
  if (!label || !itemValue) return null;
  return { label, value: itemValue };
}

function validateArray<T>(
  value: unknown,
  validator: (item: unknown) => T | null,
  max: number,
): T[] | null {
  if (!Array.isArray(value)) return null;
  const output: T[] = [];
  for (const item of value.slice(0, max)) {
    const valid = validator(item);
    if (!valid) return null;
    output.push(valid);
  }
  return output;
}

function validateStringArray(value: unknown, max: number, textMax: number): string[] | null {
  if (!Array.isArray(value)) return null;
  const output: string[] = [];
  for (const item of value.slice(0, max)) {
    if (typeof item !== "string") return null;
    const cleaned = cleanText(item, textMax);
    if (cleaned) output.push(cleaned);
  }
  return output;
}

function validateCoordinates(value: unknown): { lng: number; lat: number } | null | undefined {
  const raw = asRecord(value);
  if (!raw) return undefined;
  const lng = finiteNumber(raw.lng, -180, 180);
  const lat = finiteNumber(raw.lat, -90, 90);
  if (lng == null || lat == null) return undefined;
  return { lng, lat };
}

function validatePriceRange(value: unknown): { min: number; max: number } | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const min = finiteNumber(raw.min, 0, 1_000_000_000);
  const max = finiteNumber(raw.max, 0, 1_000_000_000);
  if (min == null || max == null || min > max) return null;
  return { min, max };
}

function validateNumberRecord(value: unknown): Record<string, number> | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const output: Record<string, number> = {};
  for (const [key, item] of Object.entries(raw).slice(0, MAX_RECORD_KEYS)) {
    const count = wholeNumber(item, 0, 1_000);
    if (count == null) return null;
    output[cleanText(key, 50)] = count;
  }
  return output;
}

function validateStringRecord(value: unknown): Record<string, string> | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const output: Record<string, string> = {};
  for (const [key, item] of Object.entries(raw).slice(0, MAX_RECORD_KEYS)) {
    if (typeof item !== "string") return null;
    output[cleanText(key, 50)] = cleanText(item, 120);
  }
  return output;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function requireText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = cleanText(value, max);
  return cleaned || null;
}

function nullableText(value: unknown, max: number): string | null {
  if (value == null) return null;
  return requireText(value, max);
}

function optionalText(value: unknown, max: number): string | undefined {
  if (value == null) return undefined;
  return requireText(value, max) ?? undefined;
}

function finiteNumber(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    return null;
  }
  return value;
}

function wholeNumber(value: unknown, min: number, max: number): number | null {
  const numberValue = finiteNumber(value, min, max);
  if (numberValue == null || !Number.isInteger(numberValue)) return null;
  return numberValue;
}

function nullableNumber(value: unknown, min: number, max: number): number | null | undefined {
  if (value == null) return null;
  return finiteNumber(value, min, max) ?? undefined;
}

function optionalNumber(value: unknown, min: number, max: number): number | undefined {
  if (value == null) return undefined;
  return finiteNumber(value, min, max) ?? undefined;
}

function enumValue<const T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

function optionalEnumValue<const T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | undefined {
  if (value == null) return undefined;
  return enumValue(value, allowed) ?? undefined;
}

function normalizeReference(value: unknown): AskEasyErfEvidenceReference | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Partial<AskEasyErfEvidenceReference>;
  if (typeof raw.label !== "string" || !raw.label.trim()) return null;
  if (!raw.sourceType || !SOURCE_TYPES.includes(raw.sourceType)) return null;
  return {
    label: cleanText(raw.label, 160),
    sourceType: raw.sourceType,
  };
}

function cleanText(value: string, max = MAX_TEXT) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function verdictLabel(verdict: DecisionIntelligence["verdict"]) {
  switch (verdict) {
    case "proceed":
      return "Proceed";
    case "proceed_with_conditions":
      return "Proceed with conditions";
    case "high_risk":
      return "High risk";
    default:
      return "Investigate further";
  }
}
