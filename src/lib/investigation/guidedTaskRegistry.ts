import type {
  GuidedEvidenceTask,
  InvestigationNextAction,
  InvestigationConfidence,
  InvestigationStageId,
  InvestigationTab,
} from "./types";

/**
 * Facts the guided task registry is allowed to reason about.
 *
 * Every field is derived from state Easy Erf actually recorded (workspace
 * state, vault assets, saved market evidence, planning assessment). Nothing
 * here may be inferred from the absence of a file.
 */
export interface InvestigationFacts {
  parcelId: string;
  identityConfirmed: boolean;
  identityUncertain: boolean;
  identityChecked: boolean;
  hasOfficialParcelKey: boolean;
  hasAreaEvidence: boolean;
  sgDiagramSearchable: boolean;
  sgDiagramParentLineageOnly: boolean;
  sgDiagramCount: number;
  usableSubjectSgDiagramCount: number;
  zoningConfirmedByDocument: boolean;
  zoningUserConfirmed?: boolean;
  zoningRegistryPublished: boolean;
  zoningWorkingAssumption: boolean;
  approvedPlansOnFile: boolean;
  titleDeedSearchable: boolean;
  paidReportSearchable: boolean;
  paidReportCount: number;
  marketEvidenceCount: number;
  marketAddressSaved: boolean;
  scenarioCount: number;
  hasChosenScenario: boolean;
  siteConceptCount: number;
  siteDesignSelected: boolean;
  usableTopographySurveyCount: number;
  sitePhotoCount: number;
  existingHousePhotoCount: number;
  vendorAssignmentCount: number;
  siteSkipped: boolean;
  reportStarted: boolean;
}

export interface GuidedTaskDefinition {
  id: string;
  stageId: InvestigationStageId;
  priority: number;
  title: string;
  shortExplanation: string;
  whyItMatters: string;
  improves: string[];
  estimatedMinutes: number;
  primaryActionLabel: string;
  targetTab: InvestigationTab;
  targetAnchorId?: string;
  /** Public source the user can open for this task. Never fetched by Easy Erf. */
  sourceUrl?: string;
  sourceLabel?: string;
  extraSources?: Array<{ label: string; url: string }>;
  /** Deterministic template text the user can copy and send. */
  requestTemplate?: string;
  steps: string[];
  afterCompletion: string;
  canSkip: boolean;
  confidenceAfterLabel: string;
  limitations?: string;
  isComplete: (facts: InvestigationFacts) => boolean;
  /** Blocked tasks are never offered as the next task. */
  isBlocked?: (facts: InvestigationFacts) => boolean;
  confidenceBefore: (facts: InvestigationFacts) => InvestigationConfidence;
}

export const GUIDED_TASK_DEFINITIONS: GuidedTaskDefinition[] = [
  {
    id: "confirm-property-identity",
    stageId: "identify",
    priority: 10,
    title: "Confirm this is the right erf",
    shortExplanation:
      "Check the official parcel details against what you believe you are looking at.",
    whyItMatters:
      "Every later conclusion — planning, market, strategy and the report — is only as reliable as the parcel identity behind it.",
    improves: ["Identity", "Report", "Ask Easy Erf"],
    estimatedMinutes: 2,
    primaryActionLabel: "Open Sources and confirm identity",
    targetTab: "research",
    steps: [
      "Open the Sources tab.",
      "Compare the erf number, portion and municipality with the property you are researching.",
      "Open the official CSG or municipal source link to cross-check the parcel.",
      "Mark the identity as looks correct, or flag it as uncertain.",
    ],
    afterCompletion:
      "Easy Erf unlocks the downstream evidence tasks and stops treating the parcel identity as unconfirmed.",
    canSkip: false,
    confidenceAfterLabel: "Identity user-confirmed against official parcel data",
    isComplete: (facts) => facts.identityConfirmed,
    confidenceBefore: (facts) => (facts.hasOfficialParcelKey ? "indicative" : "unconfirmed"),
  },
  {
    id: "add-sg-diagram",
    stageId: "identify",
    priority: 20,
    title: "Attach the Surveyor-General diagram",
    shortExplanation:
      "Add the SG diagram for this erf so its dimensions and cadastral context become searchable evidence.",
    whyItMatters:
      "The SG diagram is the primary cadastral record of erf shape, dimensions and parent lineage. Without it the boundary and area stay approximate.",
    improves: ["Identity", "Zoning & Build", "Site Potential", "Report"],
    estimatedMinutes: 5,
    primaryActionLabel: "Open Sources and add the SG diagram",
    targetTab: "research",
    targetAnchorId: "sg-diagram-evidence",
    sourceUrl: "https://csg.esri-southafrica.com/",
    sourceLabel: "Chief Surveyor-General document viewer",
    steps: [
      "Open the Sources tab and scroll to the SG diagram section.",
      "Use the SG document link to download the diagram for this erf.",
      "Upload the file to the Erf File Vault.",
      "Wait for Easy Erf to read the diagram so it becomes searchable evidence.",
    ],
    afterCompletion:
      "Easy Erf records readable cadastral evidence. A parent General Plan remains contextual evidence, and the individual subject SG diagram remains a confidence upgrade.",
    canSkip: true,
    confidenceAfterLabel: "Readable cadastral evidence attached; obtain the subject SG diagram to strengthen property-specific confidence.",
    isComplete: (facts) => facts.sgDiagramSearchable || facts.sgDiagramParentLineageOnly,
    isBlocked: (facts) => facts.identityUncertain,
    confidenceBefore: (facts) => (facts.sgDiagramParentLineageOnly ? "indicative" : "unconfirmed"),
  },
  {
    id: "confirm-zoning",
    stageId: "planning",
    priority: 30,
    title: "Confirm the zoning for this erf",
    shortExplanation:
      "Attach a zoning certificate, or confirm your working zone, so build rules can be assessed.",
    whyItMatters:
      "Published municipal rules only become erf-specific once the zone is confirmed. Until then no coverage, height or building-line figure applies to this property.",
    improves: ["Zoning & Build", "Site Potential", "Strategy", "Report"],
    estimatedMinutes: 10,
    primaryActionLabel: "Open Zoning & Build",
    targetTab: "zoning-build",
    sourceUrl: "https://www.kouga.gov.za/",
    sourceLabel: "Municipal planning department",
    steps: [
      "Open the Zoning & Build tab.",
      "Select the zone you believe applies, then confirm it as your working conclusion or request a zoning certificate from the municipality.",
      "Upload the zoning certificate to the Erf File Vault when you receive it.",
      "Re-check the build envelope once the zone is document-supported.",
    ],
    afterCompletion:
      "Easy Erf records your confirmed working conclusion and shows what is still unverified for this erf.",
    canSkip: true,
    confidenceAfterLabel:
      "Zoning is document-supported or recorded as a user-confirmed working conclusion",
    limitations:
      "A zoning certificate does not confirm title conditions, servitudes, departures or approved plans.",
    isComplete: (facts) => facts.zoningConfirmedByDocument || Boolean(facts.zoningUserConfirmed),
    isBlocked: (facts) => facts.identityUncertain,
    confidenceBefore: (facts) =>
      facts.zoningWorkingAssumption
        ? "indicative"
        : facts.zoningRegistryPublished
          ? "indicative"
          : "unconfirmed",
  },
  {
    id: "add-approved-plans",
    stageId: "constraints",
    priority: 40,
    title: "Add approved building plans",
    shortExplanation:
      "Attach the municipally approved plans so existing buildings and coverage can be checked.",
    whyItMatters:
      "Approved plans are the only reliable record of what was legally built. Without them, existing structures cannot be treated as compliant.",
    improves: ["Constraints", "Zoning & Build", "Report"],
    estimatedMinutes: 15,
    primaryActionLabel: "Open Documents",
    targetTab: "reports",
    requestTemplate:
      "Good day,\n\nI am requesting copies of the approved building plans on record for the property described below.\n\nErf / property: [erf and portion]\nTown / suburb: [town]\nMunicipality: [municipality]\n\nPlease advise the applicable fee and the process to collect or receive the plans electronically.\n\nThank you,\n[your name and contact number]",
    steps: [
      "Open the Documents tab.",
      "Request the approved building plans from the municipal building-control office if you do not have them.",
      "Upload each plan set to the Erf File Vault.",
      "Confirm the plans reference this erf number and portion.",
    ],
    afterCompletion:
      "Easy Erf records the approved-plan evidence and stops treating existing buildings as unverified.",
    canSkip: true,
    confidenceAfterLabel: "Existing buildings supported by approved plan documents",
    isComplete: (facts) => facts.approvedPlansOnFile,
    isBlocked: (facts) => facts.identityUncertain,
    confidenceBefore: () => "unconfirmed",
  },
  {
    id: "add-comparable-listing",
    stageId: "market",
    priority: 50,
    title: "Add a comparable listing",
    shortExplanation:
      "Paste a listing URL for a comparable property so the market view has real evidence behind it.",
    whyItMatters:
      "Easy Erf does not estimate value without evidence. Saved comparables are what make the market section meaningful.",
    improves: ["Market", "Strategy", "Report"],
    estimatedMinutes: 5,
    primaryActionLabel: "Open Market",
    targetTab: "listings",
    sourceUrl: "https://www.property24.com/",
    sourceLabel: "Property24",
    extraSources: [{ label: "Private Property", url: "https://www.privateproperty.co.za/" }],
    steps: [
      "Open the Market tab.",
      "Paste a listing URL into the listing importer.",
      "Review the imported fields and correct anything that is wrong.",
      "Save the listing as comparable evidence for this erf.",
    ],
    afterCompletion:
      "Easy Erf saves the listing as parcel-scoped market evidence and includes it in the report and in Ask Easy Erf.",
    canSkip: true,
    confidenceAfterLabel: "Market view supported by saved comparable evidence",
    limitations: "Asking prices are not sold prices, and a comparable is not a valuation.",
    isComplete: (facts) => facts.marketEvidenceCount > 0,
    confidenceBefore: () => "unconfirmed",
  },
  {
    id: "add-lightstone-report",
    stageId: "constraints",
    priority: 60,
    title: "Add a paid property report",
    shortExplanation:
      "A Lightstone or WinDeed report can add ownership, transfer history and deeds-level context.",
    whyItMatters:
      "Ownership and transfer history are not available from free public sources. A paid report is currently the highest-value unresolved evidence source for this erf.",
    improves: ["Ownership", "Constraints", "Market", "Report"],
    estimatedMinutes: 10,
    primaryActionLabel: "Open Documents",
    targetTab: "reports",
    steps: [
      "Open the Documents tab.",
      "Buy a Lightstone or WinDeed report, or upload one you already purchased.",
      "Upload the PDF to the Erf File Vault.",
      "Wait for Easy Erf to read it and confirm it matches this erf.",
    ],
    afterCompletion:
      "Easy Erf reads the report, checks it against this erf's identity, and uses only the matched values.",
    canSkip: true,
    confidenceAfterLabel: "Ownership and transfer context supported by an identity-matched report",
    limitations:
      "A paid report may improve ownership, transfer and valuation context. It does not verify zoning rights, servitudes, approved plans or the physical condition of the property.",
    isComplete: (facts) => facts.paidReportSearchable,
    isBlocked: (facts) => facts.identityUncertain,
    confidenceBefore: () => "unconfirmed",
  },
  {
    id: "review-site-potential",
    stageId: "site_potential",
    priority: 80,
    title: "Review the Site Potential concepts",
    shortExplanation:
      "Generate or review a visual concept for this erf, or skip the step if it is not relevant.",
    whyItMatters:
      "A concept makes the build or renovation option concrete once planning context is known. It is optional and never blocks the report.",
    improves: ["Site Potential", "Report"],
    estimatedMinutes: 8,
    primaryActionLabel: "Open Site Potential",
    targetTab: "site-potential",
    steps: [
      "Open the Site Potential tab.",
      "Choose whether this is vacant land, a renovation, or another building type.",
      "Add photos or plans if you have them, then generate concepts.",
      "Select a preferred concept, or skip the step.",
    ],
    afterCompletion:
      "Easy Erf saves the selected concept to this erf and shows it in the report as a concept, not a plan.",
    canSkip: true,
    confidenceAfterLabel: "Concept saved and clearly labelled as conceptual",
    limitations:
      "Concepts are visual interpretations. They are not architectural plans, not approved, and not a build envelope.",
    isComplete: (facts) => facts.siteDesignSelected || facts.siteSkipped,
    confidenceBefore: () => "unconfirmed",
  },
  {
    id: "choose-strategy",
    stageId: "strategy",
    priority: 70,
    title: "Choose a strategy scenario",
    shortExplanation:
      "Run the numbers for the option you are considering and save it as the chosen scenario.",
    whyItMatters:
      "The report needs one chosen scenario to explain the financial view behind the decision.",
    improves: ["Strategy", "Report"],
    estimatedMinutes: 10,
    primaryActionLabel: "Open Strategy",
    targetTab: "calculators",
    steps: [
      "Open the Strategy tab.",
      "Choose the strategy you are testing, such as buy-and-hold, flip or develop.",
      "Enter your assumptions.",
      "Save the scenario and mark it as the chosen scenario.",
    ],
    afterCompletion:
      "Easy Erf carries the chosen scenario into the report as your assumptions, clearly labelled as estimates.",
    canSkip: true,
    confidenceAfterLabel: "Financial view based on assumptions you recorded",
    limitations: "Calculator outputs are estimates from your inputs, not valuations or advice.",
    isComplete: (facts) => facts.hasChosenScenario || facts.scenarioCount > 0,
    confidenceBefore: () => "unconfirmed",
  },
  {
    id: "review-report",
    stageId: "report",
    priority: 90,
    title: "Review the Easy Erf Report",
    shortExplanation: "Read the assembled report and check what Easy Erf still lists as missing.",
    whyItMatters:
      "The report is where the evidence, gaps and next actions come together in one place.",
    improves: ["Report"],
    estimatedMinutes: 6,
    primaryActionLabel: "Open Easy Erf Report",
    targetTab: "stoep-report",
    steps: [
      "Open the Easy Erf Report tab.",
      "Read the opening summary and the critical checks.",
      "Follow any remaining evidence gaps back into the relevant tab.",
      "Print or save the report when you are satisfied.",
    ],
    afterCompletion: "You have a current, evidence-limited read of this erf.",
    canSkip: true,
    confidenceAfterLabel: "Report reviewed against the current evidence",
    isComplete: (facts) => facts.reportStarted,
    isBlocked: (facts) => !facts.identityConfirmed,
    confidenceBefore: () => "indicative",
  },
];

export function selectNextGuidedTask(
  facts: InvestigationFacts,
  skippedTaskIds: string[] = [],
): GuidedTaskDefinition | null {
  const skipped = new Set(skippedTaskIds);
  const candidates = GUIDED_TASK_DEFINITIONS.filter(
    (task) => !task.isComplete(facts) && !task.isBlocked?.(facts),
  );
  const unskipped = candidates.filter((task) => !skipped.has(task.id));
  const pool = unskipped.length ? unskipped : candidates.filter((task) => !task.canSkip);
  if (!pool.length) return null;
  return [...pool].sort((a, b) => a.priority - b.priority)[0];
}

export function toGuidedEvidenceTask(
  definition: GuidedTaskDefinition,
  facts: InvestigationFacts,
): GuidedEvidenceTask {
  return {
    id: definition.id,
    stageId: definition.stageId,
    title: definition.title,
    shortExplanation: definition.shortExplanation,
    whyItMatters: definition.whyItMatters,
    improves: definition.improves,
    estimatedMinutes: definition.estimatedMinutes,
    status: definition.isComplete(facts)
      ? "completed"
      : definition.isBlocked?.(facts)
        ? "blocked"
        : "ready",
    primaryActionLabel: definition.primaryActionLabel,
    targetTab: definition.targetTab,
    targetAnchorId: definition.targetAnchorId,
    steps: definition.steps,
    afterCompletion: definition.afterCompletion,
    canSkip: definition.canSkip,
    sourceUrl: definition.sourceUrl,
    sourceLabel: definition.sourceLabel,
    extraSources: definition.extraSources,
    requestTemplate: definition.requestTemplate,
    confidenceBefore: definition.confidenceBefore(facts),
    confidenceAfterLabel: definition.confidenceAfterLabel,
    limitations: definition.limitations,
  };
}

/**
 * The single canonical next action for a parcel.
 *
 * Both the investigation panel and the report opening read this, so the
 * "one obvious next thing" can never disagree between the two surfaces.
 * Completed actions are never returned.
 */
export function buildCanonicalNextAction(
  facts: InvestigationFacts,
  skippedTaskIds: string[] = [],
): InvestigationNextAction | null {
  const definition = selectNextGuidedTask(facts, skippedTaskIds);
  if (!definition) return null;
  return {
    id: definition.id,
    label: definition.primaryActionLabel,
    targetTab: definition.targetTab,
    targetAnchorId: definition.targetAnchorId,
    stageId: definition.stageId,
  };
}
