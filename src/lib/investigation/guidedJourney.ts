import type { ErfWorkspaceState, InvestigationSnapshot } from "@/lib/workbench/erfWorkspaceState";
import type { InvestigationFacts } from "./guidedTaskRegistry";

export type GuidedInvestigationStepId =
  | "confirm-property"
  | "add-address"
  | "sg-diagram"
  | "title"
  | "zoning"
  | "property-checks"
  | "market"
  | "strategy"
  | "site-potential"
  | "report";

export type GuidedInvestigationStepStatus =
  | "complete"
  | "current"
  | "available"
  | "blocked"
  | "skipped";

export const GUIDED_IDENTITY_CONFIRMATION_SUCCESS_MESSAGE =
  "Identity confirmed. Next step: Add address.";

export interface GuidedInvestigationStepDefinition {
  id: GuidedInvestigationStepId;
  label: string;
  shortLabel: string;
  description: string;
  prerequisites: GuidedInvestigationStepId[];
  masterPlanRowIds: string[];
  relatedTaskIds: string[];
  canSkip: boolean;
  isApplicable: (facts: InvestigationFacts) => boolean;
  isComplete: (facts: InvestigationFacts) => boolean;
}

export interface GuidedInvestigationStep {
  definition: GuidedInvestigationStepDefinition;
  id: GuidedInvestigationStepId;
  index: number;
  label: string;
  shortLabel: string;
  description: string;
  status: GuidedInvestigationStepStatus;
  complete: boolean;
  skipped: boolean;
  applicable: boolean;
  current: boolean;
}

export const GUIDED_INVESTIGATION_STEPS: GuidedInvestigationStepDefinition[] = [
  {
    id: "confirm-property",
    label: "Confirm property",
    shortLabel: "Confirm",
    description: "Confirm the official erf, portion, area and source match the property you want.",
    prerequisites: [],
    masterPlanRowIds: ["identity"],
    relatedTaskIds: ["confirm-property-identity"],
    canSkip: false,
    isApplicable: () => true,
    isComplete: (facts) => facts.identityConfirmed,
  },
  {
    id: "add-address",
    label: "Add address",
    shortLabel: "Address",
    description:
      "Save the working address used for maps and market searches. It stays separate from the official erf identity.",
    prerequisites: ["confirm-property"],
    masterPlanRowIds: ["identity"],
    relatedTaskIds: [],
    canSkip: true,
    isApplicable: () => true,
    isComplete: (facts) => facts.marketAddressSaved,
  },
  {
    id: "sg-diagram",
    label: "Add SG diagram",
    shortLabel: "SG",
    description: "Download, upload and verify readable cadastral evidence for the selected erf.",
    prerequisites: ["confirm-property"],
    masterPlanRowIds: ["sg-servitudes"],
    relatedTaskIds: ["add-sg-diagram"],
    canSkip: true,
    isApplicable: () => true,
    isComplete: (facts) => facts.sgDiagramSearchable,
  },
  {
    id: "title",
    label: "Check title",
    shortLabel: "Title",
    description:
      "Add a matched title deed or paid property report, then review the ownership and deeds evidence it contains.",
    prerequisites: ["confirm-property"],
    masterPlanRowIds: ["ownership", "sg-servitudes"],
    relatedTaskIds: ["add-lightstone-report"],
    canSkip: true,
    isApplicable: () => true,
    isComplete: (facts) => facts.titleDeedSearchable || facts.paidReportSearchable,
  },
  {
    id: "zoning",
    label: "Confirm zoning",
    shortLabel: "Zoning",
    description:
      "Confirm a working zoning conclusion, then strengthen it with an erf-specific municipal record when available.",
    prerequisites: ["confirm-property"],
    masterPlanRowIds: ["zoning"],
    relatedTaskIds: ["confirm-zoning"],
    canSkip: true,
    isApplicable: () => true,
    isComplete: (facts) => facts.zoningConfirmedByDocument || Boolean(facts.zoningUserConfirmed),
  },
  {
    id: "property-checks",
    label: "Property checks",
    shortLabel: "Checks",
    description: "Collect site, building-plan and property-condition evidence.",
    prerequisites: ["confirm-property"],
    masterPlanRowIds: ["buildings-plans", "site-conditions"],
    relatedTaskIds: ["add-approved-plans"],
    canSkip: true,
    isApplicable: () => true,
    isComplete: (facts) =>
      facts.approvedPlansOnFile ||
      facts.usableTopographySurveyCount > 0 ||
      facts.sitePhotoCount + facts.existingHousePhotoCount > 0,
  },
  {
    id: "market",
    label: "Market evidence",
    shortLabel: "Market",
    description: "Save comparable or subject-listing evidence for this erf.",
    prerequisites: ["confirm-property"],
    masterPlanRowIds: ["market"],
    relatedTaskIds: ["add-comparable-listing"],
    canSkip: true,
    isApplicable: () => true,
    isComplete: (facts) => facts.marketEvidenceCount > 0,
  },
  {
    id: "strategy",
    label: "Strategy & Calculators",
    shortLabel: "Strategy",
    description:
      "Turn the saved property evidence into a decision by testing and saving a financial scenario.",
    prerequisites: ["confirm-property"],
    masterPlanRowIds: ["strategy"],
    relatedTaskIds: ["choose-strategy"],
    canSkip: true,
    isApplicable: () => true,
    isComplete: (facts) => facts.hasChosenScenario || facts.scenarioCount > 0,
  },
  {
    id: "site-potential",
    label: "Site Potential",
    shortLabel: "Potential",
    description:
      "Confirm the parcel and street-facing boundaries, then review the build envelope on the map and from the street side.",
    prerequisites: ["confirm-property"],
    masterPlanRowIds: ["site-potential"],
    relatedTaskIds: ["review-site-potential"],
    canSkip: true,
    isApplicable: () => true,
    isComplete: (facts) => facts.siteDesignSelected || facts.siteSkipped,
  },
  {
    id: "report",
    label: "Review report",
    shortLabel: "Report",
    description: "Review the Easy Erf Report once the saved evidence is ready.",
    prerequisites: ["confirm-property"],
    masterPlanRowIds: ["report"],
    relatedTaskIds: ["review-report"],
    canSkip: false,
    isApplicable: () => true,
    isComplete: (facts) => facts.reportStarted,
  },
] as const;

export function isGuidedInvestigationStepId(value: unknown): value is GuidedInvestigationStepId {
  return (
    typeof value === "string" &&
    GUIDED_INVESTIGATION_STEPS.some((definition) => definition.id === value)
  );
}

function skippedSet(snapshot: InvestigationSnapshot) {
  return new Set(snapshot.skippedStepIds.filter(isGuidedInvestigationStepId));
}

function completedStepIds(facts: InvestigationFacts) {
  return new Set(
    GUIDED_INVESTIGATION_STEPS.filter((definition) => definition.isComplete(facts)).map(
      (definition) => definition.id,
    ),
  );
}

function prerequisitesMet(
  definition: GuidedInvestigationStepDefinition,
  completeIds: Set<GuidedInvestigationStepId>,
  skippedIds: Set<GuidedInvestigationStepId>,
) {
  return definition.prerequisites.every((id) => completeIds.has(id) || skippedIds.has(id));
}

export function selectGuidedInvestigationStep(
  facts: InvestigationFacts,
  snapshot: InvestigationSnapshot,
): GuidedInvestigationStepId {
  const completeIds = completedStepIds(facts);
  const skippedIds = skippedSet(snapshot);
  const currentStepId = isGuidedInvestigationStepId(snapshot.currentStepId)
    ? snapshot.currentStepId
    : null;
  const intentionallyVisited = new Set(
    snapshot.intentionallyVisitedStepIds.filter(isGuidedInvestigationStepId),
  );

  if (currentStepId && intentionallyVisited.has(currentStepId)) {
    const definition = GUIDED_INVESTIGATION_STEPS.find((step) => step.id === currentStepId);
    if (
      definition &&
      definition.isApplicable(facts) &&
      prerequisitesMet(definition, completeIds, skippedIds)
    ) {
      return currentStepId;
    }
  }

  const next = GUIDED_INVESTIGATION_STEPS.find(
    (definition) =>
      definition.isApplicable(facts) &&
      !definition.isComplete(facts) &&
      !skippedIds.has(definition.id) &&
      prerequisitesMet(definition, completeIds, skippedIds),
  );

  return next?.id ?? "report";
}

export function buildGuidedInvestigationJourney(
  facts: InvestigationFacts,
  workspaceState: ErfWorkspaceState,
) {
  const snapshot = workspaceState.investigation;
  const currentStepId = selectGuidedInvestigationStep(facts, snapshot);
  const completeIds = completedStepIds(facts);
  const skippedIds = skippedSet(snapshot);

  return GUIDED_INVESTIGATION_STEPS.map((definition, index): GuidedInvestigationStep => {
    const complete = completeIds.has(definition.id);
    const skipped = skippedIds.has(definition.id);
    const applicable = definition.isApplicable(facts);
    const available = applicable && prerequisitesMet(definition, completeIds, skippedIds);
    const current = definition.id === currentStepId;
    const status: GuidedInvestigationStepStatus = complete
      ? "complete"
      : skipped
        ? "skipped"
        : current
          ? "current"
          : available
            ? "available"
            : "blocked";

    return {
      definition,
      id: definition.id,
      index: index + 1,
      label: definition.label,
      shortLabel: definition.shortLabel,
      description: definition.description,
      status,
      complete,
      skipped,
      applicable,
      current,
    };
  });
}
