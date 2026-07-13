export type ErfWorkspaceIdentityStatus = "none" | "checked" | "looks_correct" | "uncertain";

export type SitePotentialMode =
  | "vacant_land"
  | "renovation"
  | "other_building"
  | "unknown"
  | "skipped";

export type SitePotentialProgressState =
  | "not_started"
  | "inputs_added"
  | "ready_to_generate"
  | "generating"
  | "concepts_ready"
  | "design_selected"
  | "skipped"
  | "failed";

export interface SitePotentialSnapshot {
  mode: SitePotentialMode | null;
  skipped: boolean;
  photoCount: number;
  planCount: number;
  conceptCount: number;
  preferredConceptId: string | null;
  selectedDesignAssetId: string | null;
  imageRightsConfirmed: boolean;
  rightsConfirmedAt: string | null;
  progressState: SitePotentialProgressState;
  projectId: string | null;
}

export function createEmptySitePotentialSnapshot(): SitePotentialSnapshot {
  return {
    mode: null,
    skipped: false,
    photoCount: 0,
    planCount: 0,
    conceptCount: 0,
    preferredConceptId: null,
    selectedDesignAssetId: null,
    imageRightsConfirmed: false,
    rightsConfirmedAt: null,
    progressState: "not_started",
    projectId: null,
  };
}

export interface ErfWorkspaceState {
  saved: boolean;
  dirty: boolean;
  identityStatus: ErfWorkspaceIdentityStatus;
  openedSourceIds: string[];
  reviewedSourceIds: string[];
  sgDiagramAttachmentCount: number;
  marketEvidenceStarted: boolean;
  marketAddressSaved: boolean;
  calculatorStarted: boolean;
  strategyScenarioCount: number;
  chosenScenarioId: string | null;
  reportStarted: boolean;
  sitePotential: SitePotentialSnapshot;
  updatedAt: string;
}

export type ErfWorkspaceTab =
  | "research"
  | "site-potential"
  | "listings"
  | "reports"
  | "calculators"
  | "stoep-report";

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
  id: "identity" | "sources" | "site" | "market" | "strategy" | "report";
  label: string;
  status: StoepStepStatus;
  doneWhen: string;
}

export interface ErfStrategyScenario {
  id: string;
  parcelId: string;
  label: string;
  strategy: string;
  inputs: Record<string, string>;
  summary: Array<{ label: string; value: string }>;
  selected?: boolean;
  savedAt: string;
}

export function erfWorkspaceStateKey(parcelId: string) {
  return `erfstoep.workspace.${parcelId}`;
}

export function erfStrategyScenariosKey(parcelId: string) {
  return `erfstoep.strategyScenarios.${parcelId}`;
}

export function createEmptyErfWorkspaceState(): ErfWorkspaceState {
  return {
    saved: false,
    dirty: false,
    identityStatus: "none",
    openedSourceIds: [],
    reviewedSourceIds: [],
    sgDiagramAttachmentCount: 0,
    marketEvidenceStarted: false,
    marketAddressSaved: false,
    calculatorStarted: false,
    strategyScenarioCount: 0,
    chosenScenarioId: null,
    reportStarted: false,
    sitePotential: createEmptySitePotentialSnapshot(),
    updatedAt: new Date().toISOString(),
  };
}

function coerceSitePotential(value: unknown): SitePotentialSnapshot {
  const base = createEmptySitePotentialSnapshot();
  if (!value || typeof value !== "object") return base;
  const raw = value as Partial<SitePotentialSnapshot>;
  const legacyMode = raw.mode as string | null | undefined;
  const mode: SitePotentialMode | null =
    raw.mode === "vacant_land" ||
    raw.mode === "renovation" ||
    raw.mode === "other_building" ||
    raw.mode === "unknown" ||
    raw.mode === "skipped"
      ? raw.mode
      : legacyMode === "existing_house"
        ? "renovation"
        : legacyMode === "other"
          ? "other_building"
          : legacyMode === "unsure"
            ? "unknown"
            : null;
  const progressState =
    raw.progressState === "inputs_added" ||
    raw.progressState === "ready_to_generate" ||
    raw.progressState === "generating" ||
    raw.progressState === "concepts_ready" ||
    raw.progressState === "design_selected" ||
    raw.progressState === "skipped" ||
    raw.progressState === "failed"
      ? raw.progressState
      : raw.skipped
        ? "skipped"
        : raw.selectedDesignAssetId || raw.preferredConceptId
          ? "design_selected"
          : Number(raw.conceptCount) > 0
            ? "concepts_ready"
            : Number(raw.photoCount) > 0 || Number(raw.planCount) > 0 || mode
              ? "inputs_added"
              : "not_started";
  return {
    mode,
    skipped: Boolean(raw.skipped),
    photoCount: Number.isFinite(Number(raw.photoCount)) ? Math.max(0, Number(raw.photoCount)) : 0,
    planCount: Number.isFinite(Number(raw.planCount)) ? Math.max(0, Number(raw.planCount)) : 0,
    conceptCount: Number.isFinite(Number(raw.conceptCount))
      ? Math.max(0, Number(raw.conceptCount))
      : 0,
    preferredConceptId:
      typeof raw.preferredConceptId === "string" ? raw.preferredConceptId : null,
    selectedDesignAssetId:
      typeof raw.selectedDesignAssetId === "string"
        ? raw.selectedDesignAssetId
        : typeof raw.preferredConceptId === "string"
          ? raw.preferredConceptId
          : null,
    imageRightsConfirmed: Boolean(raw.imageRightsConfirmed),
    rightsConfirmedAt:
      typeof raw.rightsConfirmedAt === "string"
        ? raw.rightsConfirmedAt
        : Boolean(raw.imageRightsConfirmed)
          ? new Date().toISOString()
          : null,
    progressState,
    projectId: typeof raw.projectId === "string" ? raw.projectId : null,
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
    sgDiagramAttachmentCount: Number.isFinite(Number(raw.sgDiagramAttachmentCount))
      ? Math.max(0, Number(raw.sgDiagramAttachmentCount))
      : 0,
    marketEvidenceStarted: Boolean(raw.marketEvidenceStarted),
    marketAddressSaved: Boolean(raw.marketAddressSaved),
    calculatorStarted: Boolean(raw.calculatorStarted),
    strategyScenarioCount: Number.isFinite(Number(raw.strategyScenarioCount))
      ? Math.max(0, Number(raw.strategyScenarioCount))
      : 0,
    chosenScenarioId: typeof raw.chosenScenarioId === "string" ? raw.chosenScenarioId : null,
    reportStarted: Boolean(raw.reportStarted),
    sitePotential: coerceSitePotential(raw.sitePotential),
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
  if (typeof window !== "undefined") {
  window.dispatchEvent(new CustomEvent("erfstoep:workspace-updated", { detail: { parcelId } }));
  }
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

function coerceStrategyScenario(value: unknown, parcelId: string): ErfStrategyScenario | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<ErfStrategyScenario>;
  const inputs =
    raw.inputs && typeof raw.inputs === "object" && !Array.isArray(raw.inputs)
      ? Object.fromEntries(
          Object.entries(raw.inputs).map(([key, input]) => [key, String(input ?? "")]),
        )
      : {};
  const summary = Array.isArray(raw.summary)
    ? raw.summary
        .filter((item): item is { label: string; value: string } =>
          Boolean(item && typeof item === "object" && "label" in item && "value" in item),
        )
        .map((item) => ({ label: String(item.label), value: String(item.value) }))
    : [];
  return {
    id: typeof raw.id === "string" ? raw.id : crypto.randomUUID(),
    parcelId,
    label: typeof raw.label === "string" && raw.label.trim() ? raw.label : "Saved scenario",
    strategy: typeof raw.strategy === "string" ? raw.strategy : "strategy",
    inputs,
    summary,
    selected: Boolean(raw.selected),
    savedAt: typeof raw.savedAt === "string" ? raw.savedAt : new Date().toISOString(),
  };
}

export function readStrategyScenarios(
  parcelId: string,
  storage: Storage | undefined = typeof window !== "undefined" ? window.localStorage : undefined,
): ErfStrategyScenario[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(erfStrategyScenariosKey(parcelId));
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => coerceStrategyScenario(item, parcelId))
      .filter((item): item is ErfStrategyScenario => Boolean(item));
  } catch {
    return [];
  }
}

export function saveStrategyScenario(
  parcelId: string,
  scenario: Omit<ErfStrategyScenario, "id" | "parcelId" | "savedAt"> & { id?: string },
  storage: Storage | undefined = typeof window !== "undefined" ? window.localStorage : undefined,
) {
  const current = readStrategyScenarios(parcelId, storage);
  const saved: ErfStrategyScenario = {
    id: scenario.id ?? crypto.randomUUID(),
    parcelId,
    label: scenario.label,
    strategy: scenario.strategy,
    inputs: scenario.inputs,
    summary: scenario.summary,
    selected: true,
    savedAt: new Date().toISOString(),
  };
  const next = [
    saved,
    ...current
      .filter((item) => item.id !== saved.id)
      .map((item) => ({
        ...item,
        selected: false,
      })),
  ];
  if (storage) storage.setItem(erfStrategyScenariosKey(parcelId), JSON.stringify(next));
  updateErfWorkspaceState(
    parcelId,
    {
      calculatorStarted: true,
      strategyScenarioCount: next.length,
      chosenScenarioId: saved.id,
      dirty: true,
    },
    storage,
  );
  return { scenario: saved, scenarios: next };
}

export function getChosenStrategyScenario(
  parcelId: string,
  storage: Storage | undefined = typeof window !== "undefined" ? window.localStorage : undefined,
) {
  const scenarios = readStrategyScenarios(parcelId, storage);
  if (!scenarios.length) return null;
  const workspace = readErfWorkspaceState(parcelId, storage);
  return (
    scenarios.find((scenario) => scenario.id === workspace.chosenScenarioId) ??
    scenarios.find((scenario) => scenario.selected) ??
    scenarios[0]
  );
}

export function buildErfWorkspaceNextStep(
  state: Pick<
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
  >,
): ErfWorkspaceNextStep {
  const hasOpenedSource = state.openedSourceIds.length > 0;
  const hasReviewedSource =
    state.reviewedSourceIds.length > 0 || state.sgDiagramAttachmentCount > 0;
  const siteDone =
    state.sitePotential.skipped ||
    state.sitePotential.progressState === "skipped" ||
    state.sitePotential.progressState === "design_selected" ||
    Boolean(state.sitePotential.selectedDesignAssetId || state.sitePotential.preferredConceptId);
  const siteStarted =
    state.sitePotential.progressState !== "not_started" ||
    Boolean(state.sitePotential.mode) ||
    state.sitePotential.photoCount > 0 ||
    state.sitePotential.planCount > 0;
  const marketDone = state.marketEvidenceStarted || state.marketAddressSaved;
  const strategyDone = state.strategyScenarioCount > 0;

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

  if (!siteDone) {
    return {
      title: siteStarted ? "Finish or skip Site Potential" : "Explore Site Potential",
      body: siteStarted
        ? "Site Potential is optional. Select a concept when ready, or skip it so the workflow can continue."
        : "Decide whether this erf needs renovation or new-build concept visuals before you build the market case.",
      why: "Concept visuals can enrich the final report, but they should never block core due diligence.",
      doNow: "Upload permitted photos or supporting files, generate/select a concept if entitled, or mark Site Potential skipped.",
      doneWhen: "One generated design is selected, or Site Potential is skipped for this erf.",
      next: "Build Market Evidence.",
      action: siteStarted ? "Review Site Potential" : "Open Site Potential",
      tab: "site-potential",
    };
  }

  if (!marketDone) {
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

  if (!strategyDone) {
    return {
      title: "Run Strategy Lab calculators",
      body: "Test build, flip, hold and max-offer assumptions using your own numbers.",
      why: "The report becomes useful when the numbers are tied to your assumptions.",
      doNow: "Test build, flip, hold and max-offer assumptions.",
      doneWhen: "At least one strategy scenario is saved.",
      next: "Create Easy Erf Report.",
      action: "Run calculators",
      tab: "calculators",
    };
  }

  if (!state.reportStarted) {
    return {
      title: "Create Easy Erf Report",
      body: "Turn saved evidence and assumptions into one consultation-style report.",
      why: "A report keeps your evidence, notes, assumptions and next steps together.",
      doNow:
        "Open Easy Erf Report and assemble the current identity, sources, market evidence and saved strategy assumptions.",
      doneWhen: "Easy Erf Report has been opened and reviewed with the saved workflow state.",
      next: "Review and export your Easy Erf Report.",
      action: "Open Easy Erf Report",
      tab: "stoep-report",
    };
  }

  return {
    title: "Review and export your Easy Erf Report.",
    body: "Check the saved evidence, assumptions and next steps before sharing or exporting.",
    why: "Final review keeps the decision grounded in saved evidence rather than memory.",
    doNow: "Review evidence, assumptions, risk notes and next steps.",
    doneWhen: "You are comfortable sharing or exporting the report.",
    next: "Keep improving confidence as new evidence arrives.",
    action: "Review report",
    tab: "stoep-report",
  };
}

export function buildStoepStepProgress(state: ErfWorkspaceState): StoepStepProgress[] {
  const identityDone =
    state.identityStatus === "checked" || state.identityStatus === "looks_correct";
  const identityUncertain = state.identityStatus === "uncertain";
  const sourcesDone = state.reviewedSourceIds.length > 0 || state.sgDiagramAttachmentCount > 0;
  const sourcesStarted = state.openedSourceIds.length > 0;
  const siteDone =
    state.sitePotential.skipped ||
    state.sitePotential.progressState === "skipped" ||
    state.sitePotential.progressState === "design_selected" ||
    Boolean(state.sitePotential.selectedDesignAssetId || state.sitePotential.preferredConceptId);
  const siteStarted =
    state.sitePotential.progressState !== "not_started" ||
    Boolean(state.sitePotential.mode) ||
    state.sitePotential.photoCount > 0 ||
    state.sitePotential.planCount > 0;
  const marketDone = state.marketEvidenceStarted || state.marketAddressSaved;
  const strategyDone = state.strategyScenarioCount > 0;

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
      id: "site",
      label: "Site",
      status: siteDone
        ? "Done"
        : siteStarted
          ? "Current"
          : sourcesDone
            ? "Current"
            : "Not started",
      doneWhen: "Site Potential is skipped or one generated design is selected.",
    },
    {
      id: "market",
      label: "Market",
      status: identityUncertain
        ? "Blocked / uncertain"
        : marketDone
          ? "Done"
          : identityDone && siteDone
            ? "Current"
            : "Not started",
      doneWhen: "A listing, comp, note, report, or market evidence item is saved.",
    },
    {
      id: "strategy",
      label: "Strategy",
      status: strategyDone
        ? "Done"
        : marketDone && !identityUncertain
          ? "Current"
          : identityUncertain
            ? "Blocked / uncertain"
            : "Not started",
      doneWhen: "At least one Strategy Lab scenario is saved.",
    },
    {
      id: "report",
      label: "Report",
      status: state.reportStarted
        ? "Done"
        : strategyDone && !identityUncertain
          ? "Current"
          : identityUncertain
            ? "Blocked / uncertain"
            : "Not started",
      doneWhen: "A Easy Erf Report or Report Vault workflow is started.",
    },
  ];
}
