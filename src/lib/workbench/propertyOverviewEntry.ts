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

/**
 * Builds the first explicit investigation write from persisted journey state
 * while retaining canonical values that were hydrated for the zero-write
 * overview surface.
 */
export function prepareExplicitWorkspaceTransition(args: {
  persistedWorkspace: ErfWorkspaceState;
  displayWorkspace: ErfWorkspaceState;
  investigationPatch: Partial<InvestigationSnapshot>;
  now: string;
}): Partial<ErfWorkspaceState> {
  const { persistedWorkspace, displayWorkspace, investigationPatch, now } = args;
  const currentInvestigation = persistedWorkspace.investigation;

  return {
    identityStatus: displayWorkspace.identityStatus,
    strategyScenarioCount: displayWorkspace.strategyScenarioCount,
    investigation: {
      ...currentInvestigation,
      startedAt: currentInvestigation.startedAt ?? now,
      lastViewedAt: now,
      ...investigationPatch,
    },
  };
}

/**
 * Confirms identity and advances Guided in one persistence patch. Keeping both
 * changes together prevents a second transition from rebuilding stale identity
 * state after the user confirms the parcel.
 */
export function prepareGuidedIdentityConfirmationTransition(args: {
  persistedWorkspace: ErfWorkspaceState;
  displayWorkspace: ErfWorkspaceState;
  now: string;
}): Partial<ErfWorkspaceState> {
  const { persistedWorkspace, displayWorkspace, now } = args;
  const currentInvestigation = persistedWorkspace.investigation;

  return {
    identityStatus: "looks_correct",
    strategyScenarioCount: displayWorkspace.strategyScenarioCount,
    dirty: true,
    investigation: {
      ...currentInvestigation,
      startedAt: currentInvestigation.startedAt ?? now,
      lastViewedAt: now,
      currentStepId: "add-address",
      intentionallyVisitedStepIds: Array.from(
        new Set([...currentInvestigation.intentionallyVisitedStepIds, "add-address"]),
      ),
      expertWorkspaceOpen: false,
      lastMeaningfulActionAt: now,
    },
  };
}
