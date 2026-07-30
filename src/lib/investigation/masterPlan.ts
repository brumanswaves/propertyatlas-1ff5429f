/**
 * The Master Easy Erf Investigation Plan.
 *
 * One canonical, deterministic roadmap of the whole due-diligence journey for
 * a selected erf. It does NOT hold evidence: every row is derived from the
 * facts the guided task registry already reads (workspace state, vault assets,
 * saved market evidence, planning assessment) plus contradictions recorded in
 * the PropertyEvidencePack.
 *
 * The report opening, the Investigation Plan and the Current Task all read the
 * same canonical next action, so they can never disagree.
 */
import {
  buildCanonicalNextAction,
  GUIDED_TASK_DEFINITIONS,
  type InvestigationFacts,
} from "./guidedTaskRegistry";
import {
  deriveInvestigationFacts,
  type BuildPropertyInvestigationInput,
  type InvestigationContradictionInput,
} from "./propertyInvestigation";
import type { InvestigationNextAction, InvestigationTab } from "./types";

export type PlanImportance = "required" | "recommended" | "optional";

export type PlanRowStatus =
  | "complete"
  | "partial"
  | "not_started"
  | "blocked"
  | "not_applicable";

export type PlanSiteState = "vacant_land" | "existing_building" | "unknown";

export interface InvestigationPlanConflict {
  id: string;
  title: string;
  values: string[];
  explanation: string;
}

export interface InvestigationPlanRow {
  id: string;
  title: string;
  importance: PlanImportance;
  status: PlanRowStatus;
  /** One short plain-language sentence. Never a paragraph. */
  summary: string;
  /** The single most important outstanding item, or null when nothing is missing. */
  missingItem: string | null;
  whyItMatters: string;
  completionCriteria: string;
  reportSections: string[];
  actionLabel: string;
  targetTab: InvestigationTab;
  targetAnchorId?: string;
  /** Guided task that completes this row, when one exists. */
  taskId: string | null;
  supportedEvidenceCount: number;
  requiredEvidenceCount: number;
  conflicts: InvestigationPlanConflict[];
}

export interface InvestigationPlanReadiness {
  percent: number;
  conclusion: string;
  requiredComplete: number;
  requiredTotal: number;
  materialOutstanding: number;
  /** Optional analysis never blocks a dependable Standard report. */
  dependableStandardReport: boolean;
}

export interface MasterInvestigationPlan {
  parcelId: string;
  siteState: PlanSiteState;
  rows: InvestigationPlanRow[];
  readiness: InvestigationPlanReadiness;
  nextAction: InvestigationNextAction | null;
  /** The row the canonical next action belongs to. */
  nextActionRowId: string | null;
  conflicts: InvestigationPlanConflict[];
}

/** Required carries the most weight; optional carries none. */
export const IMPORTANCE_WEIGHT: Record<PlanImportance, number> = {
  required: 3,
  recommended: 1,
  optional: 0,
};

const STATUS_CREDIT: Record<PlanRowStatus, number> = {
  complete: 1,
  partial: 0.5,
  not_started: 0,
  blocked: 0,
  not_applicable: 1,
};

export function resolvePlanSiteState(
  input: BuildPropertyInvestigationInput,
): PlanSiteState {
  const mode = input.workspaceState.sitePotential.mode;
  if (mode === "vacant_land") return "vacant_land";
  if (mode === "renovation" || mode === "other_building") return "existing_building";
  return "unknown";
}

function conflictsFrom(
  contradictions: InvestigationContradictionInput[],
  match: (c: InvestigationContradictionInput) => boolean,
): InvestigationPlanConflict[] {
  return contradictions.filter(match).map((c) => ({
    id: c.id,
    title: c.title,
    values: c.displayedValues ?? [],
    explanation: c.explanation,
  }));
}

function taskLabel(id: string, fallback: string) {
  return GUIDED_TASK_DEFINITIONS.find((task) => task.id === id)?.primaryActionLabel ?? fallback;
}

function areaConflictMatcher(c: InvestigationContradictionInput) {
  const haystack = `${c.id} ${c.title} ${c.explanation}`.toLowerCase();
  return haystack.includes("area") || haystack.includes("extent") || haystack.includes("m²");
}

export function buildMasterInvestigationPlan(
  input: BuildPropertyInvestigationInput,
): MasterInvestigationPlan {
  const facts: InvestigationFacts = deriveInvestigationFacts(input);
  const contradictions = input.contradictions ?? [];
  const siteState = resolvePlanSiteState(input);
  const nextAction = buildCanonicalNextAction(facts, input.skippedTaskIds ?? []);

  const allConflicts = contradictions.map((c) => ({
    id: c.id,
    title: c.title,
    values: c.displayedValues ?? [],
    explanation: c.explanation,
  }));
  const extentConflicts = conflictsFrom(contradictions, areaConflictMatcher);
  const otherConflicts = allConflicts.filter(
    (c) => !extentConflicts.some((extent) => extent.id === c.id),
  );

  const rows: InvestigationPlanRow[] = [];

  // 1. Property identity ----------------------------------------------------
  rows.push({
    id: "identity",
    title: "Property identity",
    importance: "required",
    status: facts.identityUncertain
      ? "blocked"
      : facts.identityConfirmed
        ? "complete"
        : facts.hasOfficialParcelKey
          ? "partial"
          : "not_started",
    summary: facts.identityUncertain
      ? "You flagged this erf as possibly the wrong parcel."
      : facts.identityConfirmed
        ? "You confirmed this erf against the official parcel record."
        : facts.hasOfficialParcelKey
          ? "Official parcel data is matched, but you have not confirmed it yet."
          : "No official cadastral key is available for this selection.",
    missingItem: facts.identityConfirmed ? null : "Your confirmation that this is the right erf",
    whyItMatters: "Every later conclusion depends on the parcel being correct.",
    completionCriteria: "You mark the parcel identity as correct in Property & Sources.",
    reportSections: ["Report opening", "Identity", "Ask Easy Erf"],
    actionLabel: facts.identityConfirmed ? "View evidence" : "Confirm identity",
    targetTab: "research",
    taskId: "confirm-property-identity",
    supportedEvidenceCount:
      (facts.hasOfficialParcelKey ? 1 : 0) + (facts.hasAreaEvidence ? 1 : 0),
    requiredEvidenceCount: 2,
    conflicts: otherConflicts,
  });

  // 2. Ownership & title ----------------------------------------------------
  const ownershipEvidence =
    (facts.titleDeedSearchable ? 1 : 0) + (facts.paidReportSearchable ? 1 : 0);
  rows.push({
    id: "ownership",
    title: "Ownership & title",
    importance: "required",
    status: facts.titleDeedSearchable
      ? "complete"
      : facts.paidReportSearchable
        ? "partial"
        : "not_started",
    summary: facts.titleDeedSearchable
      ? "A readable title deed is on file for this erf."
      : facts.paidReportSearchable
        ? "A paid property report supports ownership, but it is not a certified deed."
        : "No ownership document has been added for this erf.",
    missingItem: facts.titleDeedSearchable
      ? null
      : facts.paidReportSearchable
        ? "The registered title deed"
        : "A Lightstone, WinDeed or deeds-office document",
    whyItMatters: "Ownership and transfer history are not available from free public sources.",
    completionCriteria: "An identity-matched ownership document is readable in the Erf File Vault.",
    reportSections: ["Ownership & title", "Evidence appendix"],
    actionLabel: taskLabel("add-lightstone-report", "Add ownership evidence"),
    targetTab: "reports",
    taskId: "add-lightstone-report",
    supportedEvidenceCount: ownershipEvidence,
    requiredEvidenceCount: 1,
    conflicts: [],
  });

  // 3. Zoning & buildability -------------------------------------------------
  rows.push({
    id: "zoning",
    title: "Zoning & buildability",
    importance: "required",
    status: facts.zoningConfirmedByDocument
      ? "complete"
      : facts.zoningWorkingAssumption || facts.zoningRegistryPublished
        ? "partial"
        : "not_started",
    summary: facts.zoningConfirmedByDocument
      ? "The zone for this erf is supported by a document on file."
      : facts.zoningWorkingAssumption
        ? "A zone is selected as a working assumption only."
        : facts.zoningRegistryPublished
          ? "Published municipal rules exist, but this erf's zone is not confirmed."
          : "No dependable published planning rules are held for this municipality.",
    missingItem: facts.zoningConfirmedByDocument
      ? null
      : "A zoning certificate from the municipality",
    whyItMatters: "Coverage, height and building lines only apply once the zone is confirmed.",
    completionCriteria: "A zoning certificate or municipal confirmation is attached to this erf.",
    reportSections: ["Zoning & build", "Site Potential", "Strategy"],
    actionLabel: facts.zoningConfirmedByDocument ? "View zoning" : "Show me how",
    targetTab: "zoning-build",
    taskId: "confirm-zoning",
    supportedEvidenceCount: facts.zoningConfirmedByDocument ? 1 : 0,
    requiredEvidenceCount: 1,
    conflicts: [],
  });

  // 4. SG, title restrictions & servitudes ------------------------------------
  const sgAndTitleComplete = facts.sgDiagramSearchable && facts.titleDeedSearchable;
  const sgServitudesPartial =
    facts.sgDiagramSearchable ||
    facts.titleDeedSearchable ||
    facts.paidReportSearchable ||
    facts.sgDiagramParentLineageOnly;
  const sgServitudesEvidenceCount =
    (facts.sgDiagramSearchable ? 1 : 0) + (facts.titleDeedSearchable ? 1 : 0);
  rows.push({
    id: "sg-servitudes",
    title: "SG diagram & servitudes",
    importance: "required",
    status: sgAndTitleComplete ? "complete" : sgServitudesPartial ? "partial" : "not_started",
    summary: sgAndTitleComplete
      ? "A readable subject SG diagram and readable subject title deed support this row."
      : facts.sgDiagramSearchable
        ? "An identity-matched SG diagram is readable. Title conditions and servitudes still need deed confirmation."
        : facts.sgDiagramParentLineageOnly
          ? "The diagram on file belongs to the parent property, so it gives context only."
          : facts.paidReportSearchable
            ? "A paid report adds context, but it is not a certified title deed or SG diagram."
            : facts.titleDeedSearchable
              ? "A readable subject title deed is on file, but the subject SG diagram is still missing."
              : "No Surveyor-General diagram has been attached for this erf.",
    missingItem: sgAndTitleComplete
      ? null
      : facts.sgDiagramSearchable
        ? "Readable subject title deed confirming title conditions and servitudes"
        : facts.titleDeedSearchable
          ? "The Surveyor-General diagram for this erf"
          : "The Surveyor-General diagram and readable subject title deed for this erf",
    whyItMatters: "Boundaries, dimensions and registered servitudes come from these records.",
    completionCriteria:
      "An identity-matched SG diagram is readable and title conditions have been reviewed.",
    reportSections: ["SG & cadastral", "Legal restrictions", "Evidence appendix"],
    actionLabel: facts.sgDiagramSearchable ? "Review restrictions" : "Add SG diagram",
    targetTab: "research",
    targetAnchorId: "sg-diagram-evidence",
    taskId: "add-sg-diagram",
    supportedEvidenceCount: sgServitudesEvidenceCount,
    requiredEvidenceCount: 2,
    conflicts: extentConflicts,
  });

  // 5. Buildings & approved plans ---------------------------------------------
  const buildingsApplicable = siteState !== "vacant_land";
  rows.push({
    id: "buildings-plans",
    title: "Buildings & approved plans",
    importance: siteState === "existing_building" ? "required" : "recommended",
    status: !buildingsApplicable
      ? "not_applicable"
      : facts.approvedPlansOnFile
        ? "complete"
        : "not_started",
    summary: !buildingsApplicable
      ? "You recorded this erf as vacant land, so approved plans do not apply yet."
      : facts.approvedPlansOnFile
        ? "Approved building plans are on file for this erf."
        : "No approved building plans have been added for this erf.",
    missingItem:
      !buildingsApplicable || facts.approvedPlansOnFile
        ? null
        : "Municipally approved building plans",
    whyItMatters: "Approved plans are the only reliable record of what was legally built.",
    completionCriteria: "Approved plans for this erf are uploaded to the Erf File Vault.",
    reportSections: ["Buildings", "Zoning & build"],
    actionLabel: facts.approvedPlansOnFile ? "View plans" : "Request plans",
    targetTab: "reports",
    taskId: "add-approved-plans",
    supportedEvidenceCount: facts.approvedPlansOnFile ? 1 : 0,
    requiredEvidenceCount: buildingsApplicable ? 1 : 0,
    conflicts: [],
  });

  // 6. Site conditions ----------------------------------------------------------
  const sitePhotoContextCount = facts.sitePhotoCount + facts.existingHousePhotoCount;
  const siteConditionsComplete = facts.usableTopographySurveyCount > 0;
  const siteConditionsPartial = sitePhotoContextCount > 0;
  rows.push({
    id: "site-conditions",
    title: "Site conditions",
    importance: "recommended",
    status: siteConditionsComplete ? "complete" : siteConditionsPartial ? "partial" : "not_started",
    summary: siteConditionsComplete
      ? "A usable topographical survey is on file for this erf."
      : siteConditionsPartial
        ? "Site photos provide visual context, but slope, access, drainage and ground conditions are still unmeasured."
        : "Slope, access, drainage and ground conditions have not been recorded for this erf.",
    missingItem: siteConditionsComplete
      ? null
      : siteState === "vacant_land"
        ? "A topographical survey for the site"
        : "A site inspection or topographical survey",
    whyItMatters: "Slope and ground conditions change what is buildable and what it costs.",
    completionCriteria: "A survey or recorded site assessment is attached to this erf.",
    reportSections: ["Site conditions", "Site Potential"],
    actionLabel: "Open Site Potential",
    targetTab: "site-potential",
    taskId: null,
    supportedEvidenceCount: facts.usableTopographySurveyCount + sitePhotoContextCount,
    requiredEvidenceCount: 1,
    conflicts: [],
  });

  // 7. Market evidence -----------------------------------------------------------
  const marketTarget = 3;
  rows.push({
    id: "market",
    title: "Market evidence",
    importance: "recommended",
    status:
      facts.marketEvidenceCount >= marketTarget
        ? "complete"
        : facts.marketEvidenceCount > 0 || facts.marketAddressSaved
          ? "partial"
          : "not_started",
    summary:
      facts.marketEvidenceCount > 0
        ? `${facts.marketEvidenceCount} comparable ${facts.marketEvidenceCount === 1 ? "property" : "properties"} saved for this erf.`
        : facts.marketAddressSaved
          ? "A market address is saved, but no comparable properties yet."
          : "No comparable properties have been saved for this erf.",
    missingItem:
      facts.marketEvidenceCount >= marketTarget
        ? null
        : `Add ${marketTarget - facts.marketEvidenceCount} comparable ${
            marketTarget - facts.marketEvidenceCount === 1 ? "property" : "properties"
          }`,
    whyItMatters: "Easy Erf will not estimate value without saved comparable evidence.",
    completionCriteria: `${marketTarget} comparable listings are saved against this erf.`,
    reportSections: ["Market", "Strategy"],
    actionLabel: "Find comparables",
    targetTab: "listings",
    taskId: "add-comparable-listing",
    supportedEvidenceCount: facts.marketEvidenceCount,
    requiredEvidenceCount: marketTarget,
    conflicts: [],
  });

  // 8. Strategy -------------------------------------------------------------------
  rows.push({
    id: "strategy",
    title: "Investment strategy",
    importance: "optional",
    status: facts.hasChosenScenario
      ? "complete"
      : facts.scenarioCount > 0
        ? "partial"
        : "not_started",
    summary: facts.hasChosenScenario
      ? "A chosen scenario is saved. The figures are your assumptions."
      : facts.scenarioCount > 0
        ? "Scenarios are saved but none is chosen yet."
        : "No strategy scenario has been saved for this erf.",
    missingItem: facts.hasChosenScenario ? null : "One chosen scenario",
    whyItMatters: "The report explains the financial view using the scenario you chose.",
    completionCriteria: "A scenario is saved and marked as chosen.",
    reportSections: ["Strategy"],
    actionLabel: "Run numbers",
    targetTab: "calculators",
    taskId: "choose-strategy",
    supportedEvidenceCount: facts.scenarioCount,
    requiredEvidenceCount: 1,
    conflicts: [],
  });

  // 9. Site Potential ---------------------------------------------------------------
  rows.push({
    id: "site-potential",
    title: "Site Potential",
    importance: "optional",
    status: facts.siteSkipped
      ? "not_applicable"
      : facts.siteDesignSelected
        ? "complete"
        : facts.siteConceptCount > 0
          ? "partial"
          : "not_started",
    summary: facts.siteSkipped
      ? "You skipped Site Potential for this erf."
      : facts.siteDesignSelected
        ? "A concept is saved. It is conceptual, not an approved plan."
        : facts.siteConceptCount > 0
          ? "Concepts are generated but none is selected."
          : "No concept has been generated for this erf yet.",
    missingItem: facts.siteDesignSelected || facts.siteSkipped ? null : "A selected concept",
    whyItMatters: "A concept makes the build or renovation option concrete.",
    completionCriteria: "A concept is selected, or the step is skipped.",
    reportSections: ["Site Potential"],
    actionLabel: "Open Site Potential",
    targetTab: "site-potential",
    taskId: "review-site-potential",
    supportedEvidenceCount: facts.siteConceptCount,
    requiredEvidenceCount: 1,
    conflicts: [],
  });

  // 10. Local property team ------------------------------------------------------------
  rows.push({
    id: "local-team",
    title: "Local property team",
    importance: "optional",
    status: facts.vendorAssignmentCount > 0 ? "complete" : "not_started",
    summary:
      facts.vendorAssignmentCount > 0
        ? `${facts.vendorAssignmentCount} ${
            facts.vendorAssignmentCount === 1 ? "professional" : "professionals"
          } ${
            facts.vendorAssignmentCount === 1 ? "is" : "are"
          } assigned to this erf.`
        : "No professionals have been assigned to this erf yet.",
    missingItem:
      facts.vendorAssignmentCount > 0 ? null : "A conveyancer, surveyor or building professional",
    whyItMatters: "Some checks can only be closed out by a professional in the area.",
    completionCriteria: "At least one professional is saved against this erf.",
    reportSections: ["Local services"],
    actionLabel: "Find professionals",
    targetTab: "local-services",
    taskId: null,
    supportedEvidenceCount: facts.vendorAssignmentCount,
    requiredEvidenceCount: 1,
    conflicts: [],
  });

  // 11. Easy Erf Report ------------------------------------------------------------------
  rows.push({
    id: "report",
    title: "Easy Erf Report",
    importance: "optional",
    status: facts.reportStarted ? "complete" : "not_started",
    summary: facts.reportStarted
      ? "You have opened the assembled report for this erf."
      : "The report assembles from whatever evidence is saved and labels the gaps.",
    missingItem: facts.reportStarted ? null : "A read-through of the assembled report",
    whyItMatters: "The report is where evidence, gaps and next actions come together.",
    completionCriteria: "You open and review the Easy Erf Report.",
    reportSections: ["Whole report"],
    actionLabel: "Preview current report",
    targetTab: "stoep-report",
    taskId: "review-report",
    supportedEvidenceCount: 0,
    requiredEvidenceCount: 0,
    conflicts: [],
  });

  const readiness = calculatePlanReadiness(rows);
  const nextActionRowId =
    rows.find((row) => row.taskId && row.taskId === nextAction?.id)?.id ?? null;

  return {
    parcelId: input.parcel.id,
    siteState,
    rows,
    readiness,
    nextAction,
    nextActionRowId,
    conflicts: allConflicts,
  };
}

/**
 * Readiness is weighted: required rows dominate, recommended rows contribute
 * modestly, and optional rows carry no weight at all, so an untouched Strategy
 * or Site Potential can never block a dependable Standard report.
 */
export function calculatePlanReadiness(
  rows: InvestigationPlanRow[],
): InvestigationPlanReadiness {
  let earned = 0;
  let possible = 0;
  for (const row of rows) {
    const weight = IMPORTANCE_WEIGHT[row.importance];
    if (weight === 0) continue;
    possible += weight;
    earned += weight * STATUS_CREDIT[row.status];
  }
  const percent = possible === 0 ? 0 : Math.round((earned / possible) * 100);

  const requiredRows = rows.filter(
    (row) => row.importance === "required" && row.status !== "not_applicable",
  );
  const requiredComplete = requiredRows.filter((row) => row.status === "complete").length;
  const materialOutstanding = rows.filter(
    (row) =>
      (row.importance === "required" || row.importance === "recommended") &&
      (row.status === "not_started" || row.status === "partial" || row.status === "blocked"),
  ).length;
  const dependableStandardReport = requiredRows.every(
    (row) => row.status === "complete" || row.status === "partial",
  );

  const conclusion = !dependableStandardReport
    ? "Required checks are still outstanding, so treat this report as an early read."
    : requiredComplete === requiredRows.length
      ? "Every required check is supported for a Standard report. This is not legal certification."
      : "The required checks are underway but not all confirmed. The report is usable with named gaps.";

  return {
    percent,
    conclusion,
    requiredComplete,
    requiredTotal: requiredRows.length,
    materialOutstanding,
    dependableStandardReport,
  };
}

export const PLAN_IMPORTANCE_GROUPS: Array<{
  importance: PlanImportance;
  heading: string;
  description: string;
}> = [
  {
    importance: "required",
    heading: "Required for a dependable report",
    description: "These checks decide whether the report can be relied on.",
  },
  {
    importance: "recommended",
    heading: "Recommended confidence upgrades",
    description: "These raise confidence but do not block a Standard report.",
  },
  {
    importance: "optional",
    heading: "Optional analysis",
    description: "Useful extras. They never affect report readiness.",
  },
];
