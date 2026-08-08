import type {
  ErfWorkspaceIdentityStatus,
  ErfWorkspaceState,
  InvestigationSnapshot,
} from "./erfWorkspaceState";

export type PropertyEntryTab =
  | "overview"
  | "investigation"
  | "research"
  | "zoning-build"
  | "site-potential"
  | "listings"
  | "reports"
  | "notes"
  | "calculators"
  | "stoep-report"
  | "local-services";

export function resolvePropertyEntryTab(search: string): PropertyEntryTab {
  const value = new URLSearchParams(search).get("tab");
  if (value === "overview" || value === "property") return "overview";
  if (value === "investigation" || value === "guided") return "investigation";
  if (value === "calc" || value === "calculators") return "calculators";
  if (value === "site" || value === "site-potential") return "site-potential";
  if (value === "zoning" || value === "zoning-build") return "zoning-build";
  if (value === "research" || value === "sources") return "research";
  if (value === "listings" || value === "market") return "listings";
  if (value === "reports" || value === "documents") return "reports";
  if (value === "notes") return "notes";
  if (value === "local-services") return "local-services";
  if (value === "stoep-report" || value === "report") return "stoep-report";
  return "overview";
}

/**
 * Builds panel entry state without writing it. The first-read overview is a
 * zero-commit surface; explicit Guided or expert entry may record a visit.
 */
export function prepareWorkspaceEntry(args: {
  workspace: ErfWorkspaceState;
  mergedIdentityStatus: ErfWorkspaceIdentityStatus;
  savedScenarioCount: number;
  initialTab: PropertyEntryTab;
  now: string;
}): {
  displayWorkspace: ErfWorkspaceState;
  persistencePatch: Partial<ErfWorkspaceState> | null;
} {
  const { workspace, mergedIdentityStatus, savedScenarioCount, initialTab, now } = args;
  const displayWorkspace: ErfWorkspaceState = {
    ...workspace,
    identityStatus: mergedIdentityStatus,
    strategyScenarioCount: savedScenarioCount,
  };

  if (initialTab === "overview") {
    return { displayWorkspace, persistencePatch: null };
  }

  const expertFromUrl = initialTab !== "investigation";
  const investigation: InvestigationSnapshot = {
    ...displayWorkspace.investigation,
    startedAt: displayWorkspace.investigation.startedAt ?? now,
    lastViewedAt: now,
    expertWorkspaceOpen: expertFromUrl,
    lastExpertView: expertFromUrl
      ? initialTab
      : displayWorkspace.investigation.lastExpertView,
  };

  return {
    displayWorkspace: { ...displayWorkspace, investigation },
    persistencePatch: {
      identityStatus: mergedIdentityStatus,
      strategyScenarioCount: savedScenarioCount,
      investigation,
    },
  };
}
