import type { ErfWorkspaceState } from "./erfWorkspaceState";

export type WorkbenchProgressTab =
  | "overview"
  | "investigation"
  | "research"
  | "zoning-build"
  | "site-potential"
  | "listings"
  | "local-services"
  | "reports"
  | "calculators"
  | "notes"
  | "stoep-report";

export function workspaceProgressPatchForStartedTab(
  tab: WorkbenchProgressTab,
): Partial<ErfWorkspaceState> | null {
  switch (tab) {
    case "listings":
      return { marketEvidenceStarted: true, dirty: true };
    case "calculators":
      return { calculatorStarted: true, dirty: true };
    case "stoep-report":
      return { reportStarted: true, dirty: true };
    default:
      return null;
  }
}

export function workflowFeedbackForStartedTab(tab: WorkbenchProgressTab): string | null {
  switch (tab) {
    case "listings":
      return "Market step started. Save a listing, comp, address or note to move toward Strategy.";
    case "calculators":
      return "Strategy Lab started. Calculator outputs are estimates from your assumptions.";
    case "reports":
      return "Paid Reports opened. These are optional confidence upgrades, not required to continue.";
    case "stoep-report":
      return "Easy Erf Report opened. It assembles saved evidence and assumptions without fake data.";
    default:
      return null;
  }
}
