/**
 * Easy Erf report composer.
 *
 * Takes the canonical PropertyEvidencePack, the existing report view model and
 * the findings/actions layer and returns one stable, typed document model for
 * rendering. It contains no evidence logic of its own — it only selects,
 * orders and labels what the evidence layer already established.
 */
import type { PropertyEvidencePack } from "@/lib/evidence/propertyEvidenceTypes";
import type { ReportViewModel, ReportSectionMeta } from "@/lib/reports/buildReportViewModel";
import { REPORT_SECTIONS } from "@/lib/reports/buildReportViewModel";
import {
  buildReportActions,
  buildReportFindings,
  claimNumericValue,
  deedExtentClaim,
  isPositiveFindingStatus,
  linkFindingActions,
  nextBestAction,
  officialAreaClaim,
  type ReportAction,
  type ReportFinding,
} from "@/lib/reports/reportFindings";

/** Future-safe. Milestone 1 composes one report and defaults to home_buyer. */
export type ReportPerspective = "home_buyer" | "investor" | "developer";

export type RiskStripStatus =
  | "verified"
  | "supported"
  | "check_needed"
  | "unknown"
  | "possible_issue"
  | "confirmed_issue";

export interface ReportHeaderModel {
  title: string;
  addressLine: string | null;
  officialLine: string | null;
  erfNumber: string | null;
  municipality: string | null;
  province: string | null;
  propertyType: string | null;
  generatedAtLabel: string;
  evidenceStatusLabel: string;
}

export interface ReportAskContext {
  parcelId: string;
  evidenceFingerprint: string;
  suggestedQuestions: string[];
  printExplanation: string;
}

export interface DecisionSnapshotModel {
  verdict: string;
  verdictDetail: string;
  positives: string[];
  biggestConcern: string | null;
  bestOpportunity: string | null;
  confidence: "high" | "medium" | "low" | "unverified";
  confidenceReason: string;
}

export interface GlanceItem {
  id: string;
  label: string;
  value: string;
  provenance: string;
}

export interface PrimaryMetric {
  id: string;
  label: string;
  value: string;
  provenance: string;
  denominator?: string;
}

export interface RiskStripItem {
  id: string;
  label: string;
  status: RiskStripStatus;
  explanation: string;
  findingIds: string[];
}

export interface EasyErfReportDocument {
  parcelId: string;
  perspective: ReportPerspective;
  generatedAt: string;
  evidenceFingerprint: string;
  /** True only when a canonical evidence pack backed this composition. */
  hasCanonicalEvidence: boolean;
  header: ReportHeaderModel;
  ask: ReportAskContext;
  decisionSnapshot: DecisionSnapshotModel;
  atAGlance: GlanceItem[];
  primaryMetrics: PrimaryMetric[];
  riskStrip: RiskStripItem[];
  nextBestAction: ReportAction | null;
  findings: ReportFinding[];
  actions: ReportAction[];
  sections: ReportSectionMeta[];
  print: { documentTitle: string; footerNote: string };
}

export interface ComposeEasyErfReportInput {
  report: ReportViewModel;
  pack?: PropertyEvidencePack;
  findings?: ReportFinding[];
  actions?: ReportAction[];
  perspective?: ReportPerspective;
  /** Existing report mode kept as a compatibility input only. */
  decisionMode?: string;
  generatedAt?: string;
  /**
   * Canonical next action supplied by the investigation orchestrator. When
   * present it wins, so the report opening and the investigation panel can
   * never show two different "next things to do".
   */
  canonicalNextAction?: ReportAction | null;
}

const RISK_STATUS_LABEL: Record<RiskStripStatus, string> = {
  verified: "Verified",
  supported: "Supported",
  check_needed: "Check needed",
  unknown: "Unknown",
  possible_issue: "Possible issue",
  confirmed_issue: "Confirmed issue",
};

export function riskStatusLabel(status: RiskStripStatus): string {
  return RISK_STATUS_LABEL[status];
}

const MAX_PRIMARY_METRICS = 4;

function rand(value: number): string {
  return `R ${Math.round(value).toLocaleString("en-ZA")}`;
}

function statusToRisk(finding: ReportFinding | undefined): RiskStripStatus {
  if (!finding) return "unknown";
  switch (finding.status) {
    case "verified":
      return "verified";
    case "supported":
    case "no_issue_visible":
      return "supported";
    case "conflicting":
    case "confirmed_issue":
      return "confirmed_issue";
    case "possible_issue":
      return "possible_issue";
    case "not_checked":
      return "check_needed";
    default:
      return "unknown";
  }
}

export function composeEasyErfReport(input: ComposeEasyErfReportInput): EasyErfReportDocument {
  const report = input.report;
  const pack = input.pack ?? report.evidencePack;
  const perspective = input.perspective ?? "home_buyer";
  const generatedAt = input.generatedAt ?? report.generatedAt;

  const baseFindings = input.findings ?? (pack ? buildReportFindings(pack) : []);
  const actions = input.actions ?? (pack ? buildReportActions(pack, baseFindings) : []);
  const findings = linkFindingActions(baseFindings, actions);
  const findingById = (id: string) => findings.find((finding) => finding.id === id);

  const subject = report.market.subjectListing;
  const officialArea = pack ? claimNumericValue(officialAreaClaim(pack)) : report.identity.areaM2;
  const deedExtent = pack ? claimNumericValue(deedExtentClaim(pack)) : null;
  const deedExtentIsDistinct =
    officialArea != null && deedExtent != null
      ? Math.abs(officialArea - deedExtent) / Math.max(officialArea, deedExtent) > 0.005
      : deedExtent != null;

  // ---- header -------------------------------------------------------------
  const header: ReportHeaderModel = {
    title: "Easy Erf Report",
    addressLine: report.identity.marketAddressLine ?? null,
    officialLine: report.identity.officialLine,
    erfNumber: report.identity.erfNumber,
    municipality: report.identity.municipality,
    province: report.identity.province,
    propertyType: subject?.propertyType ?? null,
    generatedAtLabel: generatedAt,
    evidenceStatusLabel: evidenceStatusLabel(findings),
  };

  // ---- ask context --------------------------------------------------------
  const ask: ReportAskContext = {
    parcelId: report.parcelId,
    evidenceFingerprint: pack?.fingerprint ?? "",
    suggestedQuestions: suggestedQuestions(findings),
    printExplanation:
      "Ask Easy Erf is an interactive feature of the live report. It answers only from the evidence recorded for this erf and is unavailable in a printed copy.",
  };

  // ---- decision snapshot --------------------------------------------------
  const decisionSnapshot = buildDecisionSnapshot(findings, Boolean(pack));

  // ---- property at a glance ----------------------------------------------
  const atAGlance: GlanceItem[] = [];
  const glance = (id: string, label: string, value: string | null | undefined, provenance: string) => {
    if (value == null) return;
    const text = String(value).trim();
    if (!text || text === "0") return;
    atAGlance.push({ id, label, value: text, provenance });
  };
  if (subject) {
    glance("property-type", "Property type", subject.propertyType, "Subject listing");
    if (subject.beds) glance("beds", "Bedrooms", String(subject.beds), "Subject listing");
    if (subject.baths) glance("baths", "Bathrooms", String(subject.baths), "Subject listing");
    if (subject.buildingSizeM2)
      glance("building-size", "Building size", `${subject.buildingSizeM2.toLocaleString("en-ZA")} m²`, "Subject listing");
    if (subject.importedListing?.listingDate)
      glance("listing-age", "Listed", subject.importedListing.listingDate, "Subject listing");
  }
  if (officialArea) {
    glance("erf-size", "Erf size", `${officialArea.toLocaleString("en-ZA")} m²`, "Official cadastral record");
  }
  const municipalValuation = pack?.claims.find(
    (claim) => claim.domain === "valuation" && claim.status === "supported" && !claim.excluded,
  );
  if (municipalValuation) {
    glance(
      "municipal-valuation",
      "Municipal valuation",
      String(municipalValuation.value ?? ""),
      municipalValuation.label,
    );
  }
  const transferClaim = pack?.claims.find(
    (claim) => claim.domain === "transfers" && claim.status === "supported" && !claim.excluded,
  );
  if (transferClaim) {
    glance("last-transfer", "Last transfer", String(transferClaim.value ?? ""), transferClaim.label);
  }

  // ---- primary metrics ----------------------------------------------------
  const metrics: PrimaryMetric[] = [];
  if (subject?.askingPrice) {
    metrics.push({
      id: "asking-price",
      label: "Asking price",
      value: rand(subject.askingPrice),
      provenance: "Subject listing — asking price, not a valuation",
    });
  }
  if (report.market.canShowIndicativeValue && report.market.summary.priceRange) {
    metrics.push({
      id: "asking-range",
      label: "Comparable asking range",
      value: `${rand(report.market.summary.priceRange.min)} – ${rand(report.market.summary.priceRange.max)}`,
      provenance: "Saved comparable asking prices — not a formal valuation",
    });
  }
  if (officialArea) {
    metrics.push({
      id: "official-area",
      label: "Official erf size",
      value: `${officialArea.toLocaleString("en-ZA")} m²`,
      provenance: "Official cadastral record",
    });
  }
  if (deedExtent && deedExtentIsDistinct) {
    metrics.push({
      id: "registered-extent",
      label: "Registered extent",
      value: `${deedExtent.toLocaleString("en-ZA")} m²`,
      provenance:
        officialArea != null
          ? "Uploaded deed/diagram — differs from the cadastral area"
          : "Uploaded deed/diagram — no official cadastral area is recorded for comparison",
    });
  }
  if (subject?.askingPrice && officialArea) {
    metrics.push({
      id: "price-per-m2",
      label: "Asking price per m²",
      value: rand(subject.askingPrice / officialArea),
      provenance: "Asking price divided by official cadastral area",
      denominator: "Official CSG cadastral area (m²)",
    });
  }
  if (municipalValuation && typeof municipalValuation.value === "number") {
    metrics.push({
      id: "municipal-valuation",
      label: "Municipal valuation",
      value: rand(municipalValuation.value),
      provenance: municipalValuation.label,
    });
  }
  const strategyResult = report.strategy.chosen?.summary?.[0];
  if (strategyResult) {
    metrics.push({
      id: "strategy-result",
      label: strategyResult.label,
      value: strategyResult.value,
      provenance: "Your saved strategy assumption — not a valuation",
    });
  }
  const primaryMetrics = metrics.slice(0, MAX_PRIMARY_METRICS);

  // ---- critical risk strip ------------------------------------------------
  const environmentFindings = findings.filter((finding) => finding.category === "environment");
  const riskCandidates: Array<RiskStripItem | null> = [
    riskItem("identity", "Identity", [findingById("finding-address-conflict"), findingById("finding-identity-parcel")]),
    riskItem("title", "Title & Deed", [findingById("finding-title-deed"), findingById("finding-ownership")]),
    riskItem("sg", "Servitudes / SG", [
      findingById("finding-servitudes-sg"),
      findingById("finding-sg-parent-lineage"),
    ]),
    riskItem("buildings", "Buildings & Plans", [findingById("finding-buildings-plans")]),
    riskItem("zoning", "Zoning & Use", [findingById("finding-planning-completeness")]),
    environmentFindings.length ? riskItem("environment", "Environment", environmentFindings) : null,
  ];
  const riskStrip = riskCandidates.filter((item): item is RiskStripItem => item !== null).slice(0, 5);

  return {
    parcelId: report.parcelId,
    perspective,
    generatedAt,
    evidenceFingerprint: pack?.fingerprint ?? "",
    hasCanonicalEvidence: Boolean(pack) && findings.length > 0,
    header,
    ask,
    decisionSnapshot,
    atAGlance,
    primaryMetrics,
    riskStrip,
    nextBestAction: input.canonicalNextAction ?? nextBestAction(actions),
    findings,
    actions,
    sections: REPORT_SECTIONS,
    print: {
      documentTitle: `Easy Erf Report — ${report.identity.displayName}`,
      footerNote:
        "Easy Erf assembles recorded evidence. It does not certify ownership, valuation, buildability or legal compliance.",
    },
  };
}

function riskItem(
  id: string,
  label: string,
  candidates: Array<ReportFinding | undefined>,
): RiskStripItem {
  const present = candidates.filter((finding): finding is ReportFinding => Boolean(finding));
  if (!present.length) {
    return {
      id: `risk-${id}`,
      label,
      status: "unknown",
      explanation: "No evidence has been recorded for this category, so nothing can be concluded.",
      findingIds: [],
    };
  }
  const order: RiskStripStatus[] = [
    "confirmed_issue",
    "possible_issue",
    "unknown",
    "check_needed",
    "supported",
    "verified",
  ];
  let worst: RiskStripStatus = "verified";
  let worstFinding = present[0];
  for (const finding of present) {
    const status = statusToRisk(finding);
    if (order.indexOf(status) < order.indexOf(worst)) {
      worst = status;
      worstFinding = finding;
    }
  }
  return {
    id: `risk-${id}`,
    label,
    status: worst,
    explanation: worstFinding.whatItMeans,
    findingIds: present.map((finding) => finding.id),
  };
}

function evidenceStatusLabel(findings: ReportFinding[]): string {
  const blocking = findings.filter((finding) => finding.severity === "high" && !isPositiveFindingStatus(finding.status));
  if (blocking.length) return `Evidence incomplete — ${blocking.length} material item(s) outstanding`;
  const open = findings.filter((finding) => !isPositiveFindingStatus(finding.status));
  if (open.length) return `Evidence in progress — ${open.length} check(s) outstanding`;
  return "Evidence recorded for every tracked category";
}

function suggestedQuestions(findings: ReportFinding[]): string[] {
  const questions: string[] = [];
  for (const finding of findings) {
    if (isPositiveFindingStatus(finding.status) && finding.severity === "information") {
      questions.push(`What does the evidence say about ${finding.headline.toLowerCase()}?`);
    } else if (finding.severity === "high" || finding.severity === "medium") {
      questions.push(`Why is "${finding.headline}" a concern for this erf?`);
    }
    if (questions.length >= 4) break;
  }
  return questions.slice(0, 4);
}

function buildDecisionSnapshot(
  findings: ReportFinding[],
  hasPack: boolean,
): DecisionSnapshotModel {
  const hasEvidence = hasPack && findings.length > 0;
  const positivesFindings = findings.filter(
    (finding) => isPositiveFindingStatus(finding.status) && finding.severity === "information",
  );
  const concerns = findings
    .filter((finding) => !isPositiveFindingStatus(finding.status))
    .sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity));
  const conflicting = findings.filter(
    (finding) => finding.status === "conflicting" || finding.status === "confirmed_issue",
  );
  const highOpen = concerns.filter((finding) => finding.severity === "high");

  let verdict = "Worth investigating, subject to checks";
  let verdictDetail =
    "Enough evidence exists to keep going, but material checks are still outstanding for this erf.";
  if (!hasEvidence) {
    verdict = "Decision not ready — evidence unavailable";
    verdictDetail =
      "No canonical evidence has been recorded for this erf yet, so nothing can be concluded either way.";
  } else if (conflicting.length) {
    verdict = "Decision not ready — conflicting evidence";
    verdictDetail = "Recorded evidence disagrees with itself. Resolve the conflict before making any decision.";
  } else if (highOpen.length >= 2) {
    verdict = "Evidence incomplete";
    verdictDetail = "Several material facts about this erf have not been established yet.";
  } else if (!positivesFindings.length) {
    verdict = "Decision not ready";
    verdictDetail = "No supported evidence has been recorded for this erf yet.";
  }

  const supportedRatio = findings.length ? positivesFindings.length / findings.length : 0;
  const confidence: DecisionSnapshotModel["confidence"] = !hasEvidence
    ? "unverified"
    : conflicting.length
      ? "unverified"
      : supportedRatio >= 0.7
        ? "medium"
        : supportedRatio >= 0.35
          ? "low"
          : "unverified";

  // An opportunity may only come from evidence that is actually supported.
  // Missing, unchecked, conflicting or user-assumption findings never qualify.
  const opportunity = findings.find(
    (finding) =>
      OPPORTUNITY_CATEGORIES.includes(finding.category) &&
      (finding.status === "supported" || finding.status === "verified") &&
      finding.claimIds.length > 0,
  );

  const biggestConcern = concerns[0]
    ? concerns[0].headline
    : hasEvidence
      ? "No outstanding concern was derived from recorded evidence."
      : "No concern can be determined yet because the evidence for this erf is incomplete.";

  return {
    verdict,
    verdictDetail,
    positives: positivesFindings.slice(0, 3).map((finding) => finding.headline),
    biggestConcern,
    bestOpportunity: opportunity ? opportunity.headline : null,
    confidence,
    confidenceReason: !hasEvidence
      ? "No canonical evidence pack is available for this erf yet."
      : conflicting.length
        ? "Evidence for this erf currently contradicts itself."
        : `${positivesFindings.length} of ${findings.length} tracked categories are supported by recorded evidence.`,
  };
}

const OPPORTUNITY_CATEGORIES: ReportFinding["category"][] = [
  "strategy",
  "market",
  "buildings",
  "planning",
];

function severityWeight(severity: ReportFinding["severity"]): number {
  return severity === "high" ? 3 : severity === "medium" ? 2 : severity === "low" ? 1 : 0;
}
