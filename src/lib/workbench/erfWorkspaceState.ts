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
  action: string;
  tab: ErfWorkspaceTab;
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
  return writeErfWorkspaceState(parcelId, { ...readErfWorkspaceState(parcelId, storage), ...patch }, storage);
}

export function buildErfWorkspaceNextStep(state: Pick<
  ErfWorkspaceState,
  "identityStatus" | "marketEvidenceStarted" | "calculatorStarted" | "reportStarted"
>): ErfWorkspaceNextStep {
  if (state.identityStatus === "none") {
    return {
      title: "Verify the official parcel identity first.",
      body: "Start by checking that this Workbench is attached to the right public erf before using market or strategy tools.",
      action: "Check official identity",
      tab: "research",
    };
  }

  if (state.identityStatus === "uncertain") {
    return {
      title: "Resolve official parcel identity before using market or strategy tools.",
      body: "Keep the next step focused on CSG, SG or municipal source checks until the erf identity is comfortable.",
      action: "Review official identity",
      tab: "research",
    };
  }

  if (!state.marketEvidenceStarted) {
    return {
      title: "Build market evidence next.",
      body: "Save listings, comps and notes before you rely on any price or strategy assumption.",
      action: "Build market evidence",
      tab: "listings",
    };
  }

  if (!state.calculatorStarted) {
    return {
      title: "Run Strategy Lab calculators next.",
      body: "Test build, flip, hold and max-offer assumptions using your own numbers.",
      action: "Run calculators",
      tab: "calculators",
    };
  }

  if (!state.reportStarted) {
    return {
      title: "Create Stoep Report next.",
      body: "Turn saved evidence and assumptions into one consultation-style report.",
      action: "Open reports",
      tab: "reports",
    };
  }

  return {
    title: "Review and export your Stoep Report.",
    body: "Check the saved evidence, assumptions and next steps before sharing or exporting.",
    action: "Review report",
    tab: "reports",
  };
}
