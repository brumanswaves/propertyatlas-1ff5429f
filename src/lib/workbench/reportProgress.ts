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
    "erfNumber" | "portion" | "lpi" | "parcelKey" | "knownFields" | "missingFields"
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

function identityDetail(input: ReportProgressInput) {
  const { parcel } = input;
  if (parcel.lpi) return `LPI available: ${parcel.lpi}`;
  if (parcel.parcelKey) return `Parcel key available: ${parcel.parcelKey}`;
  if (parcel.erfNumber != null) {
    const portion = parcel.portion != null ? `, portion ${parcel.portion}` : "";
    return `Erf ${parcel.erfNumber}${portion} from selected public parcel.`;
  }
  return "Official identifiers are still sparse.";
}

export function buildReportBuilderProgress(input: ReportProgressInput): ReportProgressRow[] {
  const { workspaceState, savedMarketEvidenceCount, attachedEvidenceCount = 0 } = input;
  const identityDone =
    workspaceState.identityStatus === "checked" ||
    workspaceState.identityStatus === "looks_correct";
  const identityUncertain = workspaceState.identityStatus === "uncertain";
  const openedCount = workspaceState.openedSourceIds.length;
  const reviewedCount = workspaceState.reviewedSourceIds.length;
  const sourceEvidenceCount = reviewedCount + attachedEvidenceCount;

  return [
    {
      id: "identity",
      label: "Identity",
      status: identityUncertain ? "Blocked" : identityDone ? "Done" : "Needs evidence",
      detail: identityUncertain
        ? "Identity is marked uncertain. Resolve official source details first."
        : identityDone
          ? "Identity decision recorded by user."
          : "Confirm this is the right erf before relying on research outputs.",
      evidence: identityDetail(input),
    },
    {
      id: "sources",
      label: "Sources",
      status: sourceEvidenceCount > 0 ? "Done" : openedCount > 0 ? "In progress" : "Needs evidence",
      detail:
        sourceEvidenceCount > 0
          ? `${sourceEvidenceCount} reviewed or attached source item${sourceEvidenceCount === 1 ? "" : "s"}.`
          : openedCount > 0
            ? `${openedCount} source${openedCount === 1 ? "" : "s"} opened; review before relying on them.`
            : "Open and review at least one official or municipal source.",
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
          ? `${savedMarketEvidenceCount} saved listing or comp evidence item${savedMarketEvidenceCount === 1 ? "" : "s"}.`
          : "Add listing URLs, comps, market address notes, or manual market evidence.",
      evidence: `${savedMarketEvidenceCount} saved comp${savedMarketEvidenceCount === 1 ? "" : "s"}`,
    },
    {
      id: "strategy",
      label: "Strategy",
      status: workspaceState.calculatorStarted ? "In progress" : "Not started",
      detail: workspaceState.calculatorStarted
        ? "Strategy Lab has been opened. Use your own assumptions for estimates."
        : "Run calculator scenarios after identity, sources, and market evidence are started.",
      evidence: workspaceState.calculatorStarted ? "Calculator started" : "No scenario started",
    },
    {
      id: "report",
      label: "Report",
      status: workspaceState.reportStarted ? "In progress" : "Not started",
      detail: workspaceState.reportStarted
        ? "Report Vault has been opened. Final report still depends on saved evidence."
        : "Create a report only from saved evidence, notes, and assumptions.",
      evidence: workspaceState.reportStarted ? "Report workflow started" : "No report started",
    },
  ];
}

export function buildReportActionCards(input: ReportProgressInput): ReportActionCardModel[] {
  const rows = buildReportBuilderProgress(input);
  const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
  const missingSources = byId.sources.status !== "Done";
  const missingMarket = byId.market.status === "Not started";
  const nextEvidenceTab: ErfWorkspaceTab = missingSources ? "research" : "listings";

  return [
    {
      id: "verify",
      title: "Verify the erf",
      body: byId.identity.detail,
      stat: byId.identity.status,
      action: "Check official identity",
      tab: "research",
      primary: byId.identity.status !== "Done",
    },
    {
      id: "evidence",
      title: "Add evidence",
      body: missingSources
        ? "Open and review official sources before leaning on the dossier."
        : "Add listings, comps, notes, or uploaded evidence to strengthen the file.",
      stat: missingSources ? byId.sources.status : byId.market.status,
      action: missingSources ? "Open Sources" : "Add market evidence",
      tab: nextEvidenceTab,
      primary: byId.identity.status === "Done" && (missingSources || missingMarket),
    },
    {
      id: "numbers",
      title: "Run numbers",
      body: "Use Strategy Lab to test build, flip, hold, and max-offer assumptions.",
      stat: byId.strategy.status,
      action: "Open calculator",
      tab: "calculators",
      primary: byId.market.status === "Done" && byId.strategy.status === "Not started",
    },
    {
      id: "report",
      title: "Create report",
      body: "Build a report from saved evidence, notes, and assumptions only.",
      stat: byId.report.status,
      action: "Build report",
      tab: "reports",
      primary: byId.strategy.status !== "Not started" && byId.report.status === "Not started",
    },
  ];
}
