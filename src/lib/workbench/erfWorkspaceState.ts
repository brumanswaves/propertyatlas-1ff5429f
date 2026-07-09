export type ErfWorkspaceIdentityStatus = "none" | "checked" | "looks_correct" | "uncertain";

export interface ErfWorkspaceState {
  saved: boolean;
  dirty: boolean;
  identityStatus: ErfWorkspaceIdentityStatus;
  openedSourceIds: string[];
  reviewedSourceIds: string[];
  marketEvidenceStarted: boolean;
  calculatorStarted: boolean;
  reportStarted: boolean;
  updatedAt: string;
}

export type ErfWorkspaceTab = "research" | "listings" | "reports" | "calculators";

export interface ErfWorkspaceNextStep {
  title: string;
  body: string;
  why: string;
  doNow: string;
  doneWhen: string;
  next: string;
  action: string;
  tab: ErfWorkspaceTab;
}

export type StoepStepStatus =
  | "Current"
  | "Done"
  | "Needs evidence"
  | "Not started"
  | "Blocked / uncertain";

export interface StoepStepProgress {
  id: "identity" | "sources" | "market" | "strategy" | "report";
  label: string;
  status: StoepStepStatus;
  doneWhen: string;
}

export function erfWorkspaceStateKey(parcelId: string) {
  return `erfstoep.workspace.${parcelId}`;
}

export function createEmptyErfWorkspaceState(): ErfWorkspaceState {
  return {
    saved: false,
    dirty: false,
    identityStatus: "none",
    openedSourceIds: [],
    reviewedSourceIds: [],
    marketEvidenceStarted: false,
    calculatorStarted: false,
    reportStarted: false,
    updatedAt: new Date().toISOString(),
  };
}

function coerceWorkspaceState(value: unknown): ErfWorkspaceState {
  const base = createEmptyErfWorkspaceState();
  if (!value || typeof value !== "object") return base;
  const raw = value as Partial<ErfWorkspaceState>;
  const identityStatus =
    raw.identityStatus === "checked" ||
    raw.identityStatus === "looks_correct" ||
    raw.identityStatus === "uncertain"
      ? raw.identityStatus
      : "none";

  return {
    saved: Boolean(raw.saved),
    dirty: Boolean(raw.dirty),
    identityStatus,
    openedSourceIds: Array.isArray(raw.openedSourceIds)
      ? raw.openedSourceIds.filter((id): id is string => typeof id === "string")
      : [],
    reviewedSourceIds: Array.isArray(raw.reviewedSourceIds)
      ? raw.reviewedSourceIds.filter((id): id is string => typeof id === "string")
      : [],
    marketEvidenceStarted: Boolean(raw.marketEvidenceStarted),
    calculatorStarted: Boolean(raw.calculatorStarted),
    reportStarted: Boolean(raw.reportStarted),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : base.updatedAt,
  };
}

export function readErfWorkspaceState(
  parcelId: string,
  storage: Storage | undefined = typeof window !== "undefined" ? window.localStorage : undefined,
): ErfWorkspaceState {
  if (!storage) return createEmptyErfWorkspaceState();
  try {
    const raw = storage.getItem(erfWorkspaceStateKey(parcelId));
    return raw ? coerceWorkspaceState(JSON.parse(raw)) : createEmptyErfWorkspaceState();
  } catch {
    return createEmptyErfWorkspaceState();
  }
}

export function writeErfWorkspaceState(
  parcelId: string,
  state: ErfWorkspaceState,
  storage: Storage | undefined = typeof window !== "undefined" ? window.localStorage : undefined,
) {
  const next = { ...state, updatedAt: new Date().toISOString() };
  if (storage) storage.setItem(erfWorkspaceStateKey(parcelId), JSON.stringify(next));
  return next;
}

export function updateErfWorkspaceState(
  parcelId: string,
  patch: Partial<ErfWorkspaceState>,
  storage: Storage | undefined = typeof window !== "undefined" ? window.localStorage : undefined,
) {
  return writeErfWorkspaceState(
    parcelId,
    { ...readErfWorkspaceState(parcelId, storage), ...patch },
    storage,
  );
}

export function buildErfWorkspaceNextStep(
  state: Pick<
    ErfWorkspaceState,
    | "identityStatus"
    | "openedSourceIds"
    | "reviewedSourceIds"
    | "marketEvidenceStarted"
    | "calculatorStarted"
    | "reportStarted"
  >,
): ErfWorkspaceNextStep {
  const hasOpenedSource = state.openedSourceIds.length > 0;
  const hasReviewedSource = state.reviewedSourceIds.length > 0;

  if (state.identityStatus === "none") {
    if (hasOpenedSource && !hasReviewedSource) {
      return {
        title: "Review the official source",
        body: "You opened a source. Now compare the official fields before relying on this erf.",
        why: "Opening a source only starts the check. A review records that you compared the details yourself.",
        doNow: "Compare erf number, portion, area, size, LPI, parcel key and coordinates.",
        doneWhen: "Mark reviewed, or choose Identity looks correct / Identity uncertain.",
        next: "Once identity looks correct, build Market Evidence.",
        action: "Review official identity",
        tab: "research",
      };
    }
    return {
      title: "Verify the official parcel identity",
      body: "Start by checking that this Workbench is attached to the right public erf before using market or strategy tools.",
      why: "Every comp, calculator and report depends on researching the correct erf.",
      doNow:
        "Open an official source, compare the parcel details, then mark identity as correct or uncertain.",
      doneWhen:
        "Identity looks correct is selected, or source review is completed and identity is checked.",
      next: "Build Market Evidence.",
      action: "Check official identity",
      tab: "research",
    };
  }

  if (state.identityStatus === "uncertain") {
    return {
      title: "Resolve official parcel identity",
      body: "Keep the next step focused on CSG, SG or municipal source checks until the erf identity is comfortable.",
      why: "Market and strategy work should stay secondary while the selected erf is uncertain.",
      doNow:
        "Use official source details, coordinates, LPI, parcel key or SG document links to confirm the correct erf.",
      doneWhen: "Identity looks correct is selected after your source check.",
      next: "Build Market Evidence once the identity is comfortable.",
      action: "Review official identity",
      tab: "research",
    };
  }

  if (!hasReviewedSource) {
    return {
      title: hasOpenedSource ? "Review the opened source" : "Add or review sources",
      body: hasOpenedSource
        ? "You opened a source. Mark it reviewed after checking the official fields."
        : "Review at least one official source before relying on market or strategy work.",
      why: "A source review records that you compared the erf details yourself; opening a link alone is not verification.",
      doNow: hasOpenedSource
        ? "Compare erf number, portion, LPI, parcel key, coordinates and source notes, then mark reviewed."
        : "Open CSG, SG or municipal source links and compare the parcel details.",
      doneWhen: "At least one official source is marked reviewed by user.",
      next: "Build Market Evidence.",
      action: hasOpenedSource ? "Review official source" : "Add or review sources",
      tab: "research",
    };
  }

  if (!state.marketEvidenceStarted) {
    return {
      title: "Build Market Evidence",
      body: "Save listings, comps and notes before you rely on any price or strategy assumption.",
      why: "Strategy assumptions need source-backed comps, listing evidence or manual market notes.",
      doNow: "Add a market address, paste listing/comps URLs, or save market evidence.",
      doneWhen: "At least one listing, comp, note, report, or market evidence item is saved.",
      next: "Run Strategy Lab calculators.",
      action: "Build market evidence",
      tab: "listings",
    };
  }

  if (!state.calculatorStarted) {
    return {
      title: "Run Strategy Lab calculators",
      body: "Test build, flip, hold and max-offer assumptions using your own numbers.",
      why: "The report becomes useful when the numbers are tied to your assumptions.",
      doNow: "Test build, flip, hold and max-offer assumptions.",
      doneWhen: "At least one calculator or strategy scenario has been opened and started.",
      next: "Create Stoep Report.",
      action: "Run calculators",
      tab: "calculators",
    };
  }

  if (!state.reportStarted) {
    return {
      title: "Create Stoep Report",
      body: "Turn saved evidence and assumptions into one consultation-style report.",
      why: "A report keeps your evidence, notes, assumptions and next steps together.",
      doNow: "Use saved evidence, notes, reports and assumptions to generate one report.",
      doneWhen: "Report Vault or Stoep Report has been opened and started.",
      next: "Review and export your Stoep Report.",
      action: "Open reports",
      tab: "reports",
    };
  }

  return {
    title: "Review and export your Stoep Report.",
    body: "Check the saved evidence, assumptions and next steps before sharing or exporting.",
    why: "Final review keeps the decision grounded in saved evidence rather than memory.",
    doNow: "Review evidence, assumptions, risk notes and next steps.",
    doneWhen: "You are comfortable sharing or exporting the report.",
    next: "Keep improving confidence as new evidence arrives.",
    action: "Review report",
    tab: "reports",
  };
}

export function buildStoepStepProgress(state: ErfWorkspaceState): StoepStepProgress[] {
  const identityDone =
    state.identityStatus === "checked" || state.identityStatus === "looks_correct";
  const identityUncertain = state.identityStatus === "uncertain";
  const sourcesDone = state.reviewedSourceIds.length > 0;
  const sourcesStarted = state.openedSourceIds.length > 0;

  return [
    {
      id: "identity",
      label: "Identity",
      status: identityUncertain ? "Blocked / uncertain" : identityDone ? "Done" : "Current",
      doneWhen: "Identity looks correct or checked by user.",
    },
    {
      id: "sources",
      label: "Sources",
      status: sourcesDone
        ? "Done"
        : identityUncertain
          ? "Current"
          : sourcesStarted
            ? "Current"
            : "Needs evidence",
      doneWhen: "At least one official source is reviewed by user.",
    },
    {
      id: "market",
      label: "Market",
      status: identityUncertain
        ? "Blocked / uncertain"
        : state.marketEvidenceStarted
          ? "Done"
          : identityDone
            ? "Current"
            : "Not started",
      doneWhen: "A listing, comp, note, report, or market evidence item is saved.",
    },
    {
      id: "strategy",
      label: "Strategy",
      status: state.calculatorStarted
        ? "Done"
        : state.marketEvidenceStarted && !identityUncertain
          ? "Current"
          : identityUncertain
            ? "Blocked / uncertain"
            : "Not started",
      doneWhen: "A Strategy Lab calculator or scenario is started.",
    },
    {
      id: "report",
      label: "Report",
      status: state.reportStarted
        ? "Done"
        : state.calculatorStarted && !identityUncertain
          ? "Current"
          : identityUncertain
            ? "Blocked / uncertain"
            : "Not started",
      doneWhen: "A Stoep Report or Report Vault workflow is started.",
    },
  ];
}
