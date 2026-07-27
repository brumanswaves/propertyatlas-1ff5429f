import { AREA_UNAVAILABLE_LABEL, formatAreaM2WithUnit } from "@/lib/evidence/parcelArea";
import type {
  ReadinessCategory,
  ReportViewModel,
  RiskItem,
} from "./buildReportViewModel";
import type {
  EvidenceClaim,
  EvidenceTimelineEvent,
  PropertyEvidencePack,
} from "@/lib/evidence/propertyEvidenceTypes";

export type DecisionVerdict =
  | "proceed"
  | "proceed_with_conditions"
  | "investigate_further"
  | "high_risk";

export interface ConfidenceCategory {
  id: ReadinessCategory["id"];
  label: string;
  score: number;
  state: ReadinessCategory["state"];
  explanation: string;
}

export interface ContradictionItem {
  id: string;
  title: string;
  severity: "low" | "medium" | "high";
  explanation: string;
  evidence: string[];
  nextAction: string;
}

export interface DecisionMatrixRow {
  id: string;
  question: string;
  answer: "yes" | "no" | "conditional" | "unknown";
  explanation: string;
}

export interface EvidenceTimelineItem {
  id: string;
  occurredAt: string;
  label: string;
  detail: string;
  source: "official" | "market" | "workspace" | "report";
}

export interface DecisionIntelligence {
  verdict: DecisionVerdict;
  verdictLabel: string;
  confidencePercent: number;
  summary: string;
  confidenceCategories: ConfidenceCategory[];
  known: string[];
  stillNeeded: string[];
  contradictions: ContradictionItem[];
  immediateActions: Array<{ label: string; tab?: string }>;
  matrix: DecisionMatrixRow[];
  timeline: EvidenceTimelineItem[];
}

const READINESS_SCORE: Record<ReadinessCategory["state"], number> = {
  confirmed: 100,
  partial: 60,
  not_reviewed: 25,
  missing: 0,
};

const RISK_WEIGHT: Record<RiskItem["severity"], number> = {
  high: 24,
  medium: 12,
  low: 5,
};

export function buildDecisionIntelligence(report: ReportViewModel): DecisionIntelligence {
  const confidenceCategories = report.brief.categories.map((category) => ({
    id: category.id,
    label: category.label,
    state: category.state,
    explanation: category.explanation,
    score: READINESS_SCORE[category.state],
  }));

  const confidencePercent = calculateConfidence(confidenceCategories, report.risks);
  const contradictions = report.evidencePack
    ? buildContradictionsFromPack(report.evidencePack)
    : buildContradictions(report);
  const verdict = determineVerdict(report, confidencePercent, contradictions);
  const known = report.evidencePack ? buildKnownFromPack(report.evidencePack) : buildKnown(report);
  const stillNeeded = report.evidencePack
    ? buildStillNeededFromPack(report.evidencePack)
    : buildStillNeeded(report, confidenceCategories);
  const immediateActions = report.recommendations.slice(0, 5).map((item) => ({
    label: item.title,
    tab: item.actionTab,
  }));

  return {
    verdict,
    verdictLabel: verdictLabel(verdict),
    confidencePercent,
    summary: buildSummary(report, verdict, confidencePercent),
    confidenceCategories,
    known,
    stillNeeded,
    contradictions,
    immediateActions,
    matrix: buildDecisionMatrix(report, verdict),
    timeline: report.evidencePack ? buildTimelineFromPack(report.evidencePack) : buildTimeline(report),
  };
}

function calculateConfidence(
  categories: ConfidenceCategory[],
  risks: RiskItem[],
): number {
  const categoryAverage =
    categories.reduce((sum, category) => sum + category.score, 0) /
    Math.max(categories.length, 1);
  const riskPenalty = risks.reduce(
    (sum, risk) => sum + RISK_WEIGHT[risk.severity],
    0,
  );
  return clamp(Math.round(categoryAverage - riskPenalty / 4), 0, 100);
}

function determineVerdict(
  report: ReportViewModel,
  confidencePercent: number,
  contradictions: ContradictionItem[],
): DecisionVerdict {
  const highRisks = report.risks.filter((risk) => risk.severity === "high").length;
  const highContradictions = contradictions.filter(
    (item) => item.severity === "high",
  ).length;

  if (highRisks >= 2 || highContradictions > 0) return "high_risk";
  if (confidencePercent < 45) return "investigate_further";
  if (report.risks.length > 0 || confidencePercent < 80) {
    return "proceed_with_conditions";
  }
  return "proceed";
}

function buildSummary(
  report: ReportViewModel,
  verdict: DecisionVerdict,
  confidencePercent: number,
): string {
  const positives = report.brief.positives.slice(0, 2);
  const risks = report.risks.slice(0, 2).map((risk) => risk.title);

  const opening =
    verdict === "proceed"
      ? "The current evidence supports proceeding with the property review."
      : verdict === "proceed_with_conditions"
        ? "The property may justify further action, but important conditions remain unresolved."
        : verdict === "high_risk"
          ? "Material evidence gaps or conflicts should be resolved before relying on this report."
          : "The current evidence is not yet strong enough for a confident property decision.";

  const positiveText = positives.length
    ? ` Strongest current signals: ${positives.join("; ")}.`
    : " No material positive conclusion is supported yet.";
  const riskText = risks.length
    ? ` Main concerns: ${risks.join("; ")}.`
    : " No material evidence-backed risks are currently recorded.";

  return `${opening}${positiveText}${riskText} Decision confidence is ${confidencePercent}%, based on evidence completeness and recorded risks rather than a valuation opinion.`;
}

function buildKnown(report: ReportViewModel): string[] {
  const known = new Set<string>();
  const identity = report.identity;

  if (identity.erfNumber) known.add(`Official erf number: ${identity.erfNumber}`);
  if (identity.lpi) known.add(`Official LPI: ${identity.lpi}`);
  if (identity.areaM2 != null) {
    const areaLabel = formatAreaM2WithUnit(identity.areaM2);
    if (areaLabel) known.add(`Mapped erf area: ${areaLabel}`);
  }
  if (identity.marketAddressLine) {
    known.add(`Confirmed Market address: ${identity.marketAddressLine}`);
  }
  if (report.planning.some((field) => field.label === "Zoning" && field.value)) {
    const zoning = report.planning.find((field) => field.label === "Zoning")?.value;
    if (zoning) known.add(`Official zoning attribute: ${zoning}`);
  }
  if (report.market.includedCount > 0) {
    known.add(`${report.market.includedCount} included market evidence item(s)`);
  }
  if (report.site.selectedDesign) known.add("A Site Potential concept has been selected");
  if (report.strategy.chosen) known.add("A Strategy Lab scenario has been chosen");
  if (report.documents.assetCount > 0) {
    known.add(`${report.documents.assetCount} saved document or image asset(s)`);
  }

  return Array.from(known).slice(0, 10);
}

function buildKnownFromPack(pack: PropertyEvidencePack): string[] {
  const preferred = [
    "erfNumber",
    "lpi",
    "parcelKey",
    "areaM2",
    "zoning",
    "confirmedAddress",
    "askingPrice",
    "chosenScenario",
    "selectedConcept",
  ];
  const claims = pack.claims
    .filter((claim) => claim.parcelId === pack.parcelId && claim.status === "supported" && !claim.excluded)
    .sort((a, b) => {
      const aIndex = preferred.indexOf(a.key);
      const bIndex = preferred.indexOf(b.key);
      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex) || a.id.localeCompare(b.id);
    });
  return claims.slice(0, 10).map((claim) => `${claim.label}: ${displayEvidenceValue(claim)}`);
}

function buildStillNeeded(
  report: ReportViewModel,
  categories: ConfidenceCategory[],
): string[] {
  const needed = new Set<string>();

  for (const category of categories) {
    if (category.state === "confirmed") continue;
    switch (category.id) {
      case "identity":
        needed.add("Confirm the official parcel identity against the intended property");
        break;
      case "ownership":
        needed.add("Upload or obtain a title deed, WinDeed, or Lightstone ownership report");
        break;
      case "planning":
        needed.add("Verify zoning, coverage, FAR, height, setbacks, and permitted uses");
        break;
      case "market":
        needed.add("Save at least three relevant comparable properties");
        break;
      case "risk":
        needed.add("Review the official sources and resolve the highest-priority risks");
        break;
      case "strategy":
        needed.add("Choose a Strategy Lab scenario with confirmed assumptions");
        break;
      case "documents":
        needed.add("Add the critical property documents and supporting evidence");
        break;
    }
  }

  if (!report.identity.marketAddressLine) {
    needed.add("Confirm the property address in Market");
  }

  return Array.from(needed).slice(0, 8);
}

function buildStillNeededFromPack(pack: PropertyEvidencePack): string[] {
  return pack.gaps
    .slice()
    .sort((a, b) => importanceRank(b.importance) - importanceRank(a.importance) || a.id.localeCompare(b.id))
    .slice(0, 8)
    .map((gap) => gap.nextAction);
}

function buildContradictionsFromPack(pack: PropertyEvidencePack): ContradictionItem[] {
  return pack.contradictions.map((item) => ({
    id: item.id,
    title: item.title,
    severity: item.severity,
    explanation: item.explanation,
    evidence: item.displayedValues,
    nextAction: item.nextAction,
  }));
}

function buildContradictions(report: ReportViewModel): ContradictionItem[] {
  const items: ContradictionItem[] = [];

  if (report.identity.addressAndOfficialMismatch) {
    items.push({
      id: "address-official-mismatch",
      title: "Market address and official parcel identity may conflict",
      severity: "high",
      explanation:
        "The confirmed Market address does not align with the official parcel municipality. Downstream market and provider searches may reference the wrong property.",
      evidence: [
        report.identity.marketAddressLine ?? "No Market address",
        report.identity.officialLine ?? "No official identity line",
      ],
      nextAction: "Reconfirm the address in Market and the parcel identity in Sources.",
    });
  }

  const areaPlanning = report.planning.find(
    (field) => field.label === "Erf size (m²)",
  )?.value;
  if (
    report.identity.areaM2 != null &&
    areaPlanning &&
    Number(areaPlanning.replace(/,/g, "")) !== Math.round(report.identity.areaM2)
  ) {
    items.push({
      id: "area-mismatch",
      title: "Erf area values disagree",
      severity: "medium",
      explanation:
        "The parcel identity area and planning area do not match. Confirm the area using the SG diagram or official survey record.",
      evidence: [
        `Parcel identity: ${formatAreaM2WithUnit(report.identity.areaM2) ?? AREA_UNAVAILABLE_LABEL}`,
        `Planning field: ${areaPlanning} m²`,
      ],
      nextAction: "Open the SG diagram and verify the registered area.",
    });
  }

  if (report.market.canShowIndicativeValue && report.market.includedCount < 3) {
    items.push({
      id: "market-summary-thin-evidence",
      title: "Indicative market range is supported by too little evidence",
      severity: "high",
      explanation:
        "The report is attempting to surface an indicative market view without the minimum three included comparables.",
      evidence: [`Included comparables: ${report.market.includedCount}`],
      nextAction: "Save more comparable evidence before relying on the market range.",
    });
  }

  return items;
}

function buildDecisionMatrix(
  report: ReportViewModel,
  verdict: DecisionVerdict,
): DecisionMatrixRow[] {
  const category = (id: ReadinessCategory["id"]) =>
    report.brief.categories.find((item) => item.id === id)?.state ?? "missing";

  return [
    {
      id: "identity-reliable",
      question: "Is the property identity reliable?",
      answer: category("identity") === "confirmed" ? "yes" : "conditional",
      explanation: "Based on the saved official identity review state.",
    },
    {
      id: "ownership-verified",
      question: "Is ownership verified?",
      answer: report.ownership.isVerified ? "yes" : "no",
      explanation: report.ownership.message,
    },
    {
      id: "planning-supported",
      question: "Is development potential supported?",
      answer:
        category("planning") === "confirmed"
          ? "yes"
          : category("planning") === "partial"
            ? "conditional"
            : "unknown",
      explanation: "Depends on verified zoning and development controls.",
    },
    {
      id: "market-supported",
      question: "Is the market view adequately supported?",
      answer: report.market.includedCount >= 3 ? "yes" : "conditional",
      explanation: `${report.market.includedCount} included comparable item(s).`,
    },
    {
      id: "critical-documents",
      question: "Are critical documents still missing?",
      answer: report.documents.completenessPercent < 80 ? "yes" : "no",
      explanation: `Document completeness is ${report.documents.completenessPercent}%.`,
    },
    {
      id: "overall-decision",
      question: "Would Easy Erf proceed on current evidence?",
      answer:
        verdict === "proceed"
          ? "yes"
          : verdict === "proceed_with_conditions"
            ? "conditional"
            : "no",
      explanation: verdictLabel(verdict),
    },
  ];
}

function buildTimeline(report: ReportViewModel): EvidenceTimelineItem[] {
  const items: EvidenceTimelineItem[] = [];

  if (report.market.latestUpdatedAt) {
    items.push({
      id: "market-updated",
      occurredAt: report.market.latestUpdatedAt,
      label: "Market evidence updated",
      detail: `${report.market.evidenceCount} market evidence item(s) saved.`,
      source: "market",
    });
  }

  if (report.site.selectedDesign?.created_at) {
    items.push({
      id: "site-concept-selected",
      occurredAt: report.site.selectedDesign.created_at,
      label: "Site Potential concept available",
      detail: report.site.selectedDesign.original_file_name,
      source: "workspace",
    });
  }

  items.push({
    id: "report-generated",
    occurredAt: report.generatedAt,
    label: "Easy Erf Report generated",
    detail: "The living report was assembled from the current saved evidence.",
    source: "report",
  });

  return items
    .filter((item) => !Number.isNaN(new Date(item.occurredAt).getTime()))
    .sort(
      (a, b) =>
        new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
    );
}

function buildTimelineFromPack(pack: PropertyEvidencePack): EvidenceTimelineItem[] {
  return pack.timeline
    .map((item) => ({
      id: item.id,
      occurredAt: item.occurredAt,
      label: item.label,
      detail: item.detail,
      source: timelineSource(item),
    }))
    .sort(
      (a, b) =>
        new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime() ||
        a.id.localeCompare(b.id),
    );
}

function timelineSource(item: EvidenceTimelineEvent): EvidenceTimelineItem["source"] {
  if (item.domain === "market") return "market";
  if (item.domain === "documents" && item.id === "evidence-pack-built") return "report";
  if (item.sourceIds.some((id) => id.includes("official") || id.includes("research-source"))) return "official";
  return "workspace";
}

function displayEvidenceValue(claim: EvidenceClaim): string {
  const value = claim.value == null || claim.value === "" ? "Missing" : String(claim.value);
  return claim.unit ? `${value} ${claim.unit}` : value;
}

function importanceRank(value: "low" | "medium" | "high") {
  return value === "high" ? 3 : value === "medium" ? 2 : 1;
}

function verdictLabel(verdict: DecisionVerdict): string {
  switch (verdict) {
    case "proceed":
      return "Proceed";
    case "proceed_with_conditions":
      return "Proceed with conditions";
    case "investigate_further":
      return "Investigate further";
    case "high_risk":
      return "High risk — resolve critical issues first";
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
