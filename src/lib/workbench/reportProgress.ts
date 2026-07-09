import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import type { ErfWorkspaceState, ErfWorkspaceTab } from "./erfWorkspaceState";

export type ReportProgressStatus =
  | "Done"
  | "In progress"
  | "Needs evidence"
  | "Not started"
  | "Blocked";

export interface ReportProgressRow {
  id: "identity" | "sources" | "market" | "strategy" | "report";
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
    | "marketEvidenceStarted"
    | "calculatorStarted"
    | "reportStarted"
  >;
  savedMarketEvidenceCount: number;
  attachedEvidenceCount?: number;
}

function plural(value: number, single: string, many = `${single}s`) {
  return `${value} ${value === 1 ? single : many}`;
}

export function buildReportBuilderProgress(input: ReportProgressInput): ReportProgressRow[] {
  const { parcel, workspaceState, savedMarketEvidenceCount, attachedEvidenceCount = 0 } = input;
  const reviewedCount = workspaceState.reviewedSourceIds.length;
  const openedCount = workspaceState.openedSourceIds.length;
  const identityHasOfficialFields = Boolean(parcel.lpi || parcel.parcelKey || parcel.erfNumber);
  const identityDone =
    workspaceState.identityStatus === "checked" ||
    workspaceState.identityStatus === "looks_correct";
  const identityUncertain = workspaceState.identityStatus === "uncertain";
  const evidenceCount = savedMarketEvidenceCount + attachedEvidenceCount;

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
      status: reviewedCount > 0 ? "Done" : openedCount > 0 ? "In progress" : "Needs evidence",
      detail:
        reviewedCount > 0
          ? "At least one source has been reviewed by the user."
          : openedCount > 0
            ? "A source has been opened; mark reviewed after checking it."
            : "Open and review official sources before building the report.",
      evidence: `${openedCount} opened / ${reviewedCount} reviewed`,
    },
    {
      id: "market",
      label: "Market",
      status:
        savedMarketEvidenceCount > 0
          ? "Done"
          : workspaceState.marketEvidenceStarted
            ? "In progress"
            : "Not started",
      detail:
        savedMarketEvidenceCount > 0
          ? "Saved comps or listing evidence are attached to this erf."
          : "Add listing URLs, comps or market notes before relying on price assumptions.",
      evidence:
        savedMarketEvidenceCount > 0
          ? plural(savedMarketEvidenceCount, "saved comp")
          : "No saved market evidence",
    },
    {
      id: "strategy",
      label: "Strategy",
      status: workspaceState.calculatorStarted ? "In progress" : "Not started",
      detail: workspaceState.calculatorStarted
        ? "Strategy Lab has been opened for this erf."
        : "Run numbers from your own assumptions; do not treat estimates as verified values.",
      evidence: workspaceState.calculatorStarted ? "Calculator started" : "No scenario started",
    },
    {
      id: "report",
      label: "Report",
      status: workspaceState.reportStarted ? "In progress" : "Not started",
      detail: workspaceState.reportStarted
        ? "Report workflow has been opened for this erf."
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
      stat: sourceMissing ? byId.sources.evidence : byId.market.evidence,
      action: sourceMissing ? "Review sources" : "Add market evidence",
      tab: sourceMissing ? "research" : "listings",
      primary: !sourceMissing && marketMissing,
    },
    {
      id: "numbers",
      title: "Run numbers",
      body: "Use Strategy Lab to test purchase, build, flip, hold and offer assumptions.",
      stat: byId.strategy.status,
      action: "Open calculator",
      tab: "calculators",
      primary: byId.strategy.status === "Not started" && !sourceMissing && !marketMissing,
    },
    {
      id: "report",
      title: "Create report",
      body: "Combine saved evidence, reviewed sources, notes and assumptions into one Stoep Report.",
      stat: byId.report.status,
      action: "Build report",
      tab: "reports",
      primary: byId.report.status === "Not started" && byId.strategy.status !== "Not started",
    },
  ];
}
