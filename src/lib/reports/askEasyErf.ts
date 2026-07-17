import type { SavedMarketEvidence } from "@/features/marketEvidence/types";
import type { DecisionIntelligence } from "./buildDecisionIntelligence";
import type { ReportViewModel, RiskItem } from "./buildReportViewModel";
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
  const selectedDesignId = input.report.site.selectedDesign?.id ?? null;
  const uploadedAssets = input.assets.map((asset) =>
    summarizeAsset(asset, selectedDesignId === asset.id),
  );
  const selectedConcept = selectedDesignId
    ? uploadedAssets.find((asset) => asset.id === selectedDesignId) ?? null
    : null;
  const stillNeeded = input.decision.stillNeeded.slice(0, MAX_ITEMS);

  return {
    parcelId: input.report.parcelId,
    generatedAt: input.report.generatedAt,
    identity: input.report.identity,
    ownership: input.report.ownership,
    planning: input.report.planning,
    market: {
      evidenceCount: input.report.market.evidenceCount,
      includedCount: input.report.market.includedCount,
      canShowIndicativeValue: input.report.market.canShowIndicativeValue,
      subjectListing: limitMarketEvidence(input.report.market.subjectListing, input.report.parcelId),
      strongest: input.report.market.strongest
        .map((item) => limitMarketEvidence(item, input.report.parcelId))
        .filter((item): item is SavedMarketEvidence => Boolean(item)),
      summary: input.report.market.summary,
    },
    risks: input.report.risks.slice(0, MAX_ITEMS),
    recommendations: input.report.recommendations.slice(0, MAX_ITEMS),
    decision: {
      verdict: input.decision.verdict,
      confidencePercent: input.decision.confidencePercent,
      summary: cleanText(input.decision.summary),
      confidenceCategories: input.decision.confidenceCategories,
      known: input.decision.known.map((item) => cleanText(item)).slice(0, MAX_ITEMS),
      stillNeeded,
      contradictions: input.decision.contradictions.slice(0, MAX_ITEMS),
      matrix: input.decision.matrix,
    },
    uploadedAssets,
    sitePotential: {
      selectedConcept,
      conceptCount: input.report.site.conceptCount,
      skipped: input.report.site.skipped,
      hasBrief: input.report.site.hasBrief,
    },
    strategy: {
      chosen: input.report.strategy.chosen,
      scenarios: input.strategyScenarios.slice(0, MAX_ITEMS),
    },
    missingInformation: stillNeeded,
  };
}

export function suggestedAskEasyErfQuestions(payload: AskEasyErfEvidencePayload): string[] {
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

export function validateAskEasyErfEvidencePayload(value: unknown): AskEasyErfEvidencePayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Partial<AskEasyErfEvidencePayload>;
  if (typeof raw.parcelId !== "string" || !raw.parcelId.trim()) return null;
  if (!raw.identity || typeof raw.identity !== "object") return null;
  if (!raw.ownership || typeof raw.ownership !== "object") return null;
  if (!Array.isArray(raw.planning)) return null;
  if (!raw.market || typeof raw.market !== "object") return null;
  if (!raw.decision || typeof raw.decision !== "object") return null;
  return raw as AskEasyErfEvidencePayload;
}

function summarizeAsset(asset: ErfAsset, selectedSiteConcept: boolean): AskEasyErfAssetSummary {
  const extractedText = extractedDocumentText(asset);
  return {
    id: asset.id,
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

function extractedDocumentText(asset: ErfAsset): string | undefined {
  const extracted = metadataString(asset.metadata, "extractedText");
  const extractionStatus = metadataString(asset.metadata, "extractionStatus");
  if (extracted && extractionStatus === "ready") return cleanText(extracted, 2400);
  return undefined;
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
  };
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
