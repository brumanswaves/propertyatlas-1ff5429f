import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import type {
  ErfWorkspaceState,
  ErfWorkspaceTab,
  SitePotentialSnapshot,
} from "./erfWorkspaceState";

export type ReportProgressStatus =
  | "Done"
  | "In progress"
  | "Skipped"
  | "Needs evidence"
  | "Not started"
  | "Blocked";

export interface ReportProgressRow {
  id: "identity" | "sources" | "site" | "market" | "strategy" | "report";
  label: string;
  status: ReportProgressStatus;
  detail: string;
  evidence: string;
}

export interface ReportActionCardModel {
  id: "verify" | "evidence" | "numbers" | "report";
  title: string;
  body: string;
  stat: string;
  action: string;
  tab: ErfWorkspaceTab;
  primary: boolean;
}

export interface ReportProgressInput {
  parcel: Pick<
    NormalizedOfficialParcel,
    "erfNumber" | "lpi" | "parcelKey" | "knownFields" | "missingFields"
  >;
  workspaceState: Pick<
    ErfWorkspaceState,
    | "identityStatus"
    | "openedSourceIds"
    | "reviewedSourceIds"
    | "sgDiagramAttachmentCount"
    | "marketEvidenceStarted"
    | "marketAddressSaved"
    | "calculatorStarted"
    | "strategyScenarioCount"
    | "reportStarted"
    | "sitePotential"
  >;
  savedMarketEvidenceCount: number;
  attachedEvidenceCount?: number;
}

function plural(value: number, single: string, many = `${single}s`) {
  return `${value} ${value === 1 ? single : many}`;
}

function buildSiteRow(site: SitePotentialSnapshot): ReportProgressRow {
  const files = site.photoCount + site.planCount;
  const hasMode = site.mode !== null;
  const hasFiles = files > 0;
  const hasConcepts = site.conceptCount > 0;
  const selectedConcept = Boolean(site.selectedDesignAssetId || site.preferredConceptId);

  if (site.skipped) {
    return {
      id: "site",
      label: "Site",
      status: "Skipped",
      detail: "Site Potential is optional and has been skipped for this report.",
      evidence: "Skipped by user",
    };
  }
  if (selectedConcept) {
    return {
      id: "site",
      label: "Site",
      status: "Done",
      detail: "A preferred site concept has been selected for the Easy Erf Report.",
      evidence: `${site.conceptCount} concept${site.conceptCount === 1 ? "" : "s"} generated, 1 selected`,
    };
  }
  if (hasConcepts) {
    return {
      id: "site",
      label: "Site",
      status: "In progress",
      detail: "Concepts have been generated. Select one to feature in the report.",
      evidence: `${site.conceptCount} concept${site.conceptCount === 1 ? "" : "s"} generated`,
    };
  }
  if (hasFiles || hasMode) {
    return {
      id: "site",
      label: "Site",
      status: "In progress",
      detail: hasFiles
        ? "Photos or plans have been added. Generate concepts to move this step forward."
        : "Property state selected. Add photographs or plans next.",
      evidence: hasFiles
        ? `${files} file${files === 1 ? "" : "s"} in Erf File`
        : "No files added yet",
    };
  }
  return {
    id: "site",
    label: "Site",
    status: "Not started",
    detail: "Explore renovation or new-build possibilities for this erf, or skip if not relevant.",
    evidence: "Property state not set",
  };
}

export function buildReportBuilderProgress(input: ReportProgressInput): ReportProgressRow[] {
  const { parcel, workspaceState, savedMarketEvidenceCount, attachedEvidenceCount = 0 } = input;
  const reviewedCount = workspaceState.reviewedSourceIds.length;
  const openedCount = workspaceState.openedSourceIds.length;
  const sgAttachmentCount = workspaceState.sgDiagramAttachmentCount ?? 0;
  const identityHasOfficialFields = Boolean(parcel.lpi || parcel.parcelKey || parcel.erfNumber);
  const identityDone =
    workspaceState.identityStatus === "checked" ||
    workspaceState.identityStatus === "looks_correct";
  const identityUncertain = workspaceState.identityStatus === "uncertain";
  const evidenceCount = savedMarketEvidenceCount + attachedEvidenceCount + sgAttachmentCount;
  const sourcesDone = reviewedCount > 0 || sgAttachmentCount > 0;
  const marketDone = savedMarketEvidenceCount > 0 || workspaceState.marketAddressSaved;
  const strategyScenarioCount = workspaceState.strategyScenarioCount ?? 0;

  return [
    {
      id: "identity",
      label: "Identity",
      status: identityUncertain
        ? "Blocked"
        : identityDone
          ? "Done"
          : identityHasOfficialFields
            ? "Needs evidence"
            : "Not started",
      detail: identityUncertain
        ? "Identity is marked uncertain until official details are rechecked."
        : identityDone
          ? "Official identity has been checked by the user."
          : "Confirm erf, portion, LPI, parcel key or source fields before relying on the file.",
      evidence: identityDone
        ? "Identity checked"
        : identityHasOfficialFields
          ? plural(parcel.knownFields.length, "known field")
          : "No official identity field checked",
    },
    {
      id: "sources",
      label: "Sources",
      status: sourcesDone ? "Done" : openedCount > 0 ? "In progress" : "Needs evidence",
      detail: sourcesDone
        ? "At least one source has been reviewed or SG diagram evidence has been attached."
        : openedCount > 0
          ? "A source has been opened; mark reviewed after checking it."
          : "Open and review official sources before building the report.",
      evidence: `${openedCount} opened / ${reviewedCount} reviewed / ${sgAttachmentCount} SG file${sgAttachmentCount === 1 ? "" : "s"}`,
    },
    {
      id: "market",
      label: "Market",
      status: marketDone
        ? "Done"
        : workspaceState.marketEvidenceStarted
          ? "In progress"
          : "Not started",
      detail:
        savedMarketEvidenceCount > 0
          ? "Saved comps or listing evidence are attached to this erf."
          : workspaceState.marketAddressSaved
            ? "A market address has been saved for this erf."
            : "Add listing URLs, comps or market notes before relying on price assumptions.",
      evidence:
        savedMarketEvidenceCount > 0
          ? plural(savedMarketEvidenceCount, "saved comp")
          : workspaceState.marketAddressSaved
            ? "Market address saved"
            : "No saved market evidence",
    },
    {
      id: "strategy",
      label: "Strategy",
      status:
        strategyScenarioCount > 0
          ? "Done"
          : workspaceState.calculatorStarted
            ? "In progress"
            : "Not started",
      detail:
        strategyScenarioCount > 0
          ? "At least one Strategy Lab scenario has been saved."
          : workspaceState.calculatorStarted
            ? "Strategy Lab has been opened; save a scenario to move this step forward."
            : "Run numbers from your own assumptions; do not treat estimates as verified values.",
      evidence:
        strategyScenarioCount > 0
          ? plural(strategyScenarioCount, "saved scenario")
          : "No scenario saved",
    },
    buildSiteRow(workspaceState.sitePotential),
    {
      id: "report",
      label: "Report",
      status: workspaceState.reportStarted
        ? "In progress"
        : strategyScenarioCount > 0
          ? "Needs evidence"
          : "Not started",
      detail: workspaceState.reportStarted
        ? "Report workflow has been opened for this erf."
        : strategyScenarioCount > 0
          ? "Easy Erf Report can now assemble the saved workflow state, with missing evidence clearly labelled."
          : "Create a report after identity, sources, market evidence and numbers are underway.",
      evidence:
        evidenceCount > 0
          ? `${plural(evidenceCount, "evidence item")} attached`
          : "No report evidence attached",
    },
  ];
}

export function buildReportActionCards(input: ReportProgressInput): ReportActionCardModel[] {
  const rows = buildReportBuilderProgress(input);
  const byId = Object.fromEntries(rows.map((row) => [row.id, row])) as Record<
    ReportProgressRow["id"],
    ReportProgressRow
  >;
  const sourceMissing = byId.sources.status !== "Done";
  const marketMissing = byId.market.status !== "Done";
  const strategyMissing = byId.strategy.status !== "Done";
  const siteMissing = byId.site.status !== "Done" && byId.site.status !== "Skipped";

  return [
    {
      id: "verify",
      title: "Verify the erf",
      body: "Check official parcel identity and mark sources reviewed when you have compared them.",
      stat: byId.identity.status,
      action: "Check official identity",
      tab: "research",
      primary: byId.identity.status !== "Done" || sourceMissing,
    },
    {
      id: "evidence",
      title: "Add evidence",
      body: sourceMissing
        ? "Review an official source first, then add market evidence."
        : "Paste listing URLs, comps, notes or other evidence you have checked.",
      stat: byId.market.evidence,
      action: "Add market evidence",
      tab: "listings",
      primary: !sourceMissing && marketMissing,
    },
    {
      id: "numbers",
      title: "Run numbers",
      body: "Use Strategy Lab to test purchase, build, flip, hold and offer assumptions.",
      stat: byId.strategy.status,
      action: "Open calculator",
      tab: "calculators",
      primary: strategyMissing && !sourceMissing && !marketMissing,
    },
    {
      id: "report",
      title: "Create report",
      body: siteMissing
        ? "Explore Site Potential or skip it before assembling the Easy Erf Report."
        : "Combine saved evidence, reviewed sources, notes and assumptions into one Easy Erf Report.",
      stat: siteMissing ? byId.site.status : byId.report.status,
      action: siteMissing ? "Open Site Potential" : "Open Easy Erf Report",
      tab: siteMissing ? "site-potential" : "stoep-report",
      primary: !strategyMissing && (siteMissing || byId.report.status !== "In progress"),
    },
  ];
}
