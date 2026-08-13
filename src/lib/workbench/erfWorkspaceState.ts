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

/**
 * The user's recorded planning conclusion for this erf.
 *
 * It deliberately records a user confirmation separately from documentary or
 * official planning support. A confirmed working conclusion is still not an
 * official municipal finding.
 */
export interface PlanningWorkspaceState {
  zoneCode: string | null;
  userConfirmedZoneCode: string | null;
  userConfirmedAt: string | null;
}

export function createEmptyPlanningWorkspaceState(): PlanningWorkspaceState {
  return {
    zoneCode: null,
    userConfirmedZoneCode: null,
    userConfirmedAt: null,
  };
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

/**
 * Versioned investigation snapshot.
 *
 * Only holds state that cannot be re-derived from evidence: when the
 * investigation started, when it was last viewed, and which guided tasks the
 * user deliberately skipped or acknowledged. Completion is always derived
 * from real evidence, never persisted here.
 */
export interface InvestigationSnapshot {
  version: 2;
  startedAt: string | null;
  lastViewedAt: string | null;
  skippedTaskIds: string[];
  acknowledgedTaskIds: string[];
  currentStepId: string | null;
  intentionallyVisitedStepIds: string[];
  skippedStepIds: string[];
  lastMeaningfulActionAt: string | null;
  expertWorkspaceOpen: boolean;
  lastExpertView: string | null;
  guidedReturnStepId: "strategy" | "site-potential" | null;
}

export function createEmptyInvestigationSnapshot(): InvestigationSnapshot {
  return {
    version: 2,
    startedAt: null,
    lastViewedAt: null,
    skippedTaskIds: [],
    acknowledgedTaskIds: [],
    currentStepId: null,
    intentionallyVisitedStepIds: [],
    skippedStepIds: [],
    lastMeaningfulActionAt: null,
    expertWorkspaceOpen: false,
    lastExpertView: null,
    guidedReturnStepId: null,
  };
}

function coerceInvestigation(value: unknown): InvestigationSnapshot {
  const base = createEmptyInvestigationSnapshot();
  if (!value || typeof value !== "object") return base;
  const raw = value as Partial<InvestigationSnapshot>;
  const ids = (list: unknown) =>
    Array.isArray(list) ? list.filter((id): id is string => typeof id === "string") : [];
  return {
    version: 2,
    startedAt: typeof raw.startedAt === "string" ? raw.startedAt : null,
    lastViewedAt: typeof raw.lastViewedAt === "string" ? raw.lastViewedAt : null,
    skippedTaskIds: ids(raw.skippedTaskIds),
    acknowledgedTaskIds: ids(raw.acknowledgedTaskIds),
    currentStepId: typeof raw.currentStepId === "string" ? raw.currentStepId : null,
    intentionallyVisitedStepIds: ids(raw.intentionallyVisitedStepIds),
    skippedStepIds: ids(raw.skippedStepIds),
    lastMeaningfulActionAt:
      typeof raw.lastMeaningfulActionAt === "string" ? raw.lastMeaningfulActionAt : null,
    expertWorkspaceOpen: Boolean(raw.expertWorkspaceOpen),
    lastExpertView: typeof raw.lastExpertView === "string" ? raw.lastExpertView : null,
    guidedReturnStepId:
      raw.guidedReturnStepId === "strategy" || raw.guidedReturnStepId === "site-potential"
        ? raw.guidedReturnStepId
        : null,
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
  planning: PlanningWorkspaceState;
  sitePotential: SitePotentialSnapshot;
  investigation: InvestigationSnapshot;
  updatedAt: string;

}

export type ErfWorkspaceTab =
  | "research"
  | "zoning-build"
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
  updatedAt?: string;
}

export interface ErfStrategyWorkspace {
  schemaVersion: 1;
  parcelId: string;
  activeStrategy: string;
  draftInputs: Record<string, string>;
  draftUpdatedAt: string | null;
  scenarios: ErfStrategyScenario[];
  chosenScenarioId: string | null;
  chosenScenarioUpdatedAt: string | null;
  migratedFromLegacy: boolean;
}

export type BrowserPersistenceUserId = string | null | undefined;

export type BrowserStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function browserScopedParcelKey(
  stateType: string,
  parcelId: string,
  userId: BrowserPersistenceUserId = null,
) {
  const namespace = userId?.trim()
    ? `easyerf.user.${encodeURIComponent(userId)}`
    : "easyerf.anonymous";
  return `${namespace}.${stateType}.${encodeURIComponent(parcelId)}`;
}

export function erfWorkspaceStateKey(parcelId: string, userId: BrowserPersistenceUserId = null) {
  return browserScopedParcelKey("workspace", parcelId, userId);
}

export function erfStrategyScenariosKey(
  parcelId: string,
  userId: BrowserPersistenceUserId = null,
) {
  return browserScopedParcelKey("strategy-scenarios", parcelId, userId);
}

export function erfStrategyWorkspaceKey(
  parcelId: string,
  userId: BrowserPersistenceUserId = null,
) {
  return browserScopedParcelKey("strategy-workspace.v1", parcelId, userId);
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
    planning: createEmptyPlanningWorkspaceState(),
    sitePotential: createEmptySitePotentialSnapshot(),
    investigation: createEmptyInvestigationSnapshot(),
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
        : raw.imageRightsConfirmed
          ? new Date().toISOString()
          : null,
    progressState,
    projectId: typeof raw.projectId === "string" ? raw.projectId : null,
  };
}

function coercePlanningWorkspace(value: unknown): PlanningWorkspaceState {
  const base = createEmptyPlanningWorkspaceState();
  if (!value || typeof value !== "object") return base;
  const raw = value as Partial<PlanningWorkspaceState>;
  const zoneCode = typeof raw.zoneCode === "string" && raw.zoneCode.trim() ? raw.zoneCode : null;
  const userConfirmedZoneCode =
    typeof raw.userConfirmedZoneCode === "string" &&
    raw.userConfirmedZoneCode.trim() &&
    raw.userConfirmedZoneCode === zoneCode
      ? raw.userConfirmedZoneCode
      : null;
  return {
    zoneCode,
    userConfirmedZoneCode,
    userConfirmedAt:
      userConfirmedZoneCode && typeof raw.userConfirmedAt === "string"
        ? raw.userConfirmedAt
        : null,
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
    planning: coercePlanningWorkspace(raw.planning),
    sitePotential: coerceSitePotential(raw.sitePotential),
    investigation: coerceInvestigation(raw.investigation),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : base.updatedAt,
  };
}

export function readErfWorkspaceState(
  parcelId: string,
  storage: BrowserStorage | undefined =
    typeof window !== "undefined" ? window.localStorage : undefined,
  userId: BrowserPersistenceUserId = null,
): ErfWorkspaceState {
  if (!storage) return createEmptyErfWorkspaceState();
  try {
    const raw = storage.getItem(erfWorkspaceStateKey(parcelId, userId));
    return raw ? coerceWorkspaceState(JSON.parse(raw)) : createEmptyErfWorkspaceState();
  } catch {
    return createEmptyErfWorkspaceState();
  }
}

export function writeErfWorkspaceState(
  parcelId: string,
  state: ErfWorkspaceState,
  storage: BrowserStorage | undefined =
    typeof window !== "undefined" ? window.localStorage : undefined,
  userId: BrowserPersistenceUserId = null,
) {
  const next = { ...state, updatedAt: new Date().toISOString() };
  if (storage) storage.setItem(erfWorkspaceStateKey(parcelId, userId), JSON.stringify(next));
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("erfstoep:workspace-updated", { detail: { parcelId, userId } }),
    );
  }
  return next;
}

export function updateErfWorkspaceState(
  parcelId: string,
  patch: Partial<ErfWorkspaceState>,
  storage: BrowserStorage | undefined =
    typeof window !== "undefined" ? window.localStorage : undefined,
  userId: BrowserPersistenceUserId = null,
) {
  return writeErfWorkspaceState(
    parcelId,
    { ...readErfWorkspaceState(parcelId, storage, userId), ...patch },
    storage,
    userId,
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
    updatedAt:
      typeof raw.updatedAt === "string"
        ? raw.updatedAt
        : typeof raw.savedAt === "string"
          ? raw.savedAt
          : new Date().toISOString(),
  };
}

function coerceStrategyInputs(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, input]) => [
      key,
      String(input ?? ""),
    ]),
  );
}

export function validTimestampMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function newestIso(a: string | null | undefined, b: string | null | undefined) {
  const aMs = validTimestampMs(a);
  const bMs = validTimestampMs(b);
  if (aMs == null) return bMs == null ? null : (b ?? null);
  if (bMs == null) return a ?? null;
  return aMs >= bMs ? (a ?? null) : (b ?? null);
}

export function nextMonotonicIso(previous: string | null | undefined, now = new Date()) {
  const previousMs = validTimestampMs(previous);
  const currentMs = now.getTime();
  const nextMs = previousMs != null && currentMs <= previousMs ? previousMs + 1 : currentMs;
  return new Date(nextMs).toISOString();
}

function coerceStrategyWorkspace(value: unknown, parcelId: string): ErfStrategyWorkspace | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Partial<ErfStrategyWorkspace>;
  const scenarios = Array.isArray(raw.scenarios)
    ? raw.scenarios
        .map((item) => coerceStrategyScenario(item, parcelId))
        .filter((item): item is ErfStrategyScenario => Boolean(item))
    : [];
  const chosenScenarioId =
    typeof raw.chosenScenarioId === "string" &&
    scenarios.some((scenario) => scenario.id === raw.chosenScenarioId)
      ? raw.chosenScenarioId
      : scenarios.find((scenario) => scenario.selected)?.id ?? null;
  const selectedScenario = scenarios.find((scenario) => scenario.id === chosenScenarioId);
  const activeStrategy =
    typeof raw.activeStrategy === "string" && raw.activeStrategy.trim()
      ? raw.activeStrategy
      : scenarios.find((scenario) => scenario.id === chosenScenarioId)?.strategy ??
        scenarios[0]?.strategy ??
        "buy_hold";

  return {
    schemaVersion: 1,
    parcelId,
    activeStrategy,
    draftInputs: coerceStrategyInputs(raw.draftInputs),
    draftUpdatedAt: typeof raw.draftUpdatedAt === "string" ? raw.draftUpdatedAt : null,
    scenarios: scenarios.map((scenario) => ({
      ...scenario,
      selected: scenario.id === chosenScenarioId,
    })),
    chosenScenarioId,
    chosenScenarioUpdatedAt:
      typeof raw.chosenScenarioUpdatedAt === "string"
        ? raw.chosenScenarioUpdatedAt
        : selectedScenario?.updatedAt ?? selectedScenario?.savedAt ?? null,
    migratedFromLegacy: Boolean(raw.migratedFromLegacy),
  };
}

export function createEmptyStrategyWorkspace(parcelId: string): ErfStrategyWorkspace {
  return {
    schemaVersion: 1,
    parcelId,
    activeStrategy: "buy_hold",
    draftInputs: {},
    draftUpdatedAt: null,
    scenarios: [],
    chosenScenarioId: null,
    chosenScenarioUpdatedAt: null,
    migratedFromLegacy: false,
  };
}

export function strategyWorkspaceFromLegacy(
  parcelId: string,
  storage: Storage | undefined = typeof window !== "undefined" ? window.localStorage : undefined,
): ErfStrategyWorkspace {
  const scenarios = readStrategyScenarios(parcelId, storage);
  const workspace = readErfWorkspaceState(parcelId, storage);
  const chosenScenarioId =
    scenarios.find((scenario) => scenario.id === workspace.chosenScenarioId)?.id ??
    scenarios.find((scenario) => scenario.selected)?.id ??
    scenarios[0]?.id ??
    null;
  const chosen = scenarios.find((scenario) => scenario.id === chosenScenarioId) ?? null;
  return {
    schemaVersion: 1,
    parcelId,
    activeStrategy: chosen?.strategy ?? scenarios[0]?.strategy ?? "buy_hold",
    draftInputs: chosen?.inputs ?? {},
    draftUpdatedAt: chosen?.savedAt ?? null,
    scenarios: scenarios.map((scenario) => ({
      ...scenario,
      selected: scenario.id === chosenScenarioId,
    })),
    chosenScenarioId,
    chosenScenarioUpdatedAt: chosen?.updatedAt ?? chosen?.savedAt ?? null,
    migratedFromLegacy: scenarios.length > 0,
  };
}

export function readStrategyWorkspace(
  parcelId: string,
  storage: Storage | undefined = typeof window !== "undefined" ? window.localStorage : undefined,
  userId: BrowserPersistenceUserId = null,
): ErfStrategyWorkspace {
  if (!storage) return createEmptyStrategyWorkspace(parcelId);
  try {
    const parsed = JSON.parse(storage.getItem(erfStrategyWorkspaceKey(parcelId, userId)) ?? "null");
    const workspace = coerceStrategyWorkspace(parsed, parcelId);
    if (workspace) return workspace;
  } catch {
    // A malformed scoped record is treated as empty rather than reading unscoped legacy data.
  }
  return createEmptyStrategyWorkspace(parcelId);
}

export function writeStrategyWorkspace(
  parcelId: string,
  workspace: ErfStrategyWorkspace,
  storage: Storage | undefined = typeof window !== "undefined" ? window.localStorage : undefined,
  userId: BrowserPersistenceUserId = null,
) {
  const next = coerceStrategyWorkspace(workspace, parcelId) ?? createEmptyStrategyWorkspace(parcelId);
  if (storage) {
    storage.setItem(erfStrategyWorkspaceKey(parcelId, userId), JSON.stringify(next));
    storage.setItem(erfStrategyScenariosKey(parcelId, userId), JSON.stringify(next.scenarios));
  }
  updateErfWorkspaceState(
    parcelId,
    {
      calculatorStarted: Boolean(next.draftUpdatedAt || next.scenarios.length > 0),
      strategyScenarioCount: next.scenarios.length,
      chosenScenarioId: next.chosenScenarioId,
      dirty: true,
    },
    storage,
    userId,
  );
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("easyerf:strategy-workspace-updated", { detail: { parcelId, userId } }),
    );
  }
  return next;
}

export function saveStrategyDraft(
  parcelId: string,
  draft: { activeStrategy: string; draftInputs: Record<string, string>; updatedAt?: string },
  storage: Storage | undefined = typeof window !== "undefined" ? window.localStorage : undefined,
  userId: BrowserPersistenceUserId = null,
) {
  const current = readStrategyWorkspace(parcelId, storage, userId);
  const draftUpdatedAt = draft.updatedAt ?? nextMonotonicIso(current.draftUpdatedAt);
  return writeStrategyWorkspace(
    parcelId,
    {
      ...current,
      activeStrategy: draft.activeStrategy,
      draftInputs: coerceStrategyInputs(draft.draftInputs),
      draftUpdatedAt,
    },
    storage,
    userId,
  );
}

export function mergeStrategyWorkspaces(
  parcelId: string,
  local: ErfStrategyWorkspace,
  remote: ErfStrategyWorkspace | null,
): ErfStrategyWorkspace {
  if (!remote) return local;
  const scenariosById = new Map<string, ErfStrategyScenario>();
  for (const scenario of [...local.scenarios, ...remote.scenarios]) {
    const existing = scenariosById.get(scenario.id);
    const scenarioMs =
      validTimestampMs(scenario.updatedAt) ?? validTimestampMs(scenario.savedAt) ?? 0;
    const existingMs =
      validTimestampMs(existing?.updatedAt) ?? validTimestampMs(existing?.savedAt) ?? -1;
    if (!existing || scenarioMs >= existingMs) {
      scenariosById.set(scenario.id, { ...scenario, parcelId });
    }
  }
  const scenarios = Array.from(scenariosById.values()).sort(
    (a, b) =>
      (validTimestampMs(b.updatedAt) ?? validTimestampMs(b.savedAt) ?? 0) -
      (validTimestampMs(a.updatedAt) ?? validTimestampMs(a.savedAt) ?? 0),
  );
  const localDraftMs = validTimestampMs(local.draftUpdatedAt);
  const remoteDraftMs = validTimestampMs(remote.draftUpdatedAt);
  const draftFromRemote = remoteDraftMs != null && (localDraftMs == null || remoteDraftMs > localDraftMs);
  const localChosenMs = validTimestampMs(local.chosenScenarioUpdatedAt);
  const remoteChosenMs = validTimestampMs(remote.chosenScenarioUpdatedAt);
  const chosenFromRemote =
    remoteChosenMs != null && (localChosenMs == null || remoteChosenMs > localChosenMs);
  const preferredChosenId = chosenFromRemote ? remote.chosenScenarioId : local.chosenScenarioId;
  const fallbackChosenId = chosenFromRemote ? local.chosenScenarioId : remote.chosenScenarioId;
  const chosenScenarioId =
    (preferredChosenId && scenarios.some((scenario) => scenario.id === preferredChosenId)
      ? preferredChosenId
      : null) ??
    (fallbackChosenId && scenarios.some((scenario) => scenario.id === fallbackChosenId)
      ? fallbackChosenId
      : null) ??
    scenarios.find((scenario) => scenario.selected)?.id ??
    null;
  return {
    schemaVersion: 1,
    parcelId,
    activeStrategy: draftFromRemote ? remote.activeStrategy : local.activeStrategy,
    draftInputs: draftFromRemote ? remote.draftInputs : local.draftInputs,
    draftUpdatedAt: newestIso(local.draftUpdatedAt, remote.draftUpdatedAt),
    scenarios: scenarios.map((scenario) => ({
      ...scenario,
      selected: scenario.id === chosenScenarioId,
    })),
    chosenScenarioId,
    chosenScenarioUpdatedAt: newestIso(local.chosenScenarioUpdatedAt, remote.chosenScenarioUpdatedAt),
    migratedFromLegacy: local.migratedFromLegacy || remote.migratedFromLegacy,
  };
}

export function strategyWorkspaceFromUserData(
  parcelId: string,
  userData: unknown,
): ErfStrategyWorkspace | null {
  if (!userData || typeof userData !== "object" || Array.isArray(userData)) return null;
  return coerceStrategyWorkspace(
    (userData as Record<string, unknown>).strategyWorkspace,
    parcelId,
  );
}

export function readStrategyScenarios(
  parcelId: string,
  storage: Storage | undefined = typeof window !== "undefined" ? window.localStorage : undefined,
  userId: BrowserPersistenceUserId = null,
): ErfStrategyScenario[] {
  if (storage) {
    try {
      const workspace = coerceStrategyWorkspace(
        JSON.parse(storage.getItem(erfStrategyWorkspaceKey(parcelId, userId)) ?? "null"),
        parcelId,
      );
      if (workspace) return workspace.scenarios;
    } catch {
      // A malformed scoped record is treated as empty rather than reading unscoped legacy data.
    }
  }
  return [];
}

export function saveStrategyScenario(
  parcelId: string,
  scenario: Omit<ErfStrategyScenario, "id" | "parcelId" | "savedAt" | "updatedAt"> & {
    id?: string;
  },
  optionsOrStorage: { asNew?: boolean; userId?: BrowserPersistenceUserId } | Storage = {},
  storageArg?: Storage,
) {
  const options =
    "getItem" in optionsOrStorage && "setItem" in optionsOrStorage ? {} : optionsOrStorage;
  const storage =
    "getItem" in optionsOrStorage && "setItem" in optionsOrStorage
      ? optionsOrStorage
      : storageArg ?? (typeof window !== "undefined" ? window.localStorage : undefined);
  const userId = "getItem" in optionsOrStorage ? null : options.userId ?? null;
  const currentWorkspace = readStrategyWorkspace(parcelId, storage, userId);
  const current = currentWorkspace.scenarios;
  const existingChosen =
    !options.asNew && currentWorkspace.chosenScenarioId
      ? current.find((item) => item.id === currentWorkspace.chosenScenarioId)
      : null;
  const now = nextMonotonicIso(
    newestIso(currentWorkspace.draftUpdatedAt, currentWorkspace.chosenScenarioUpdatedAt),
  );
  const scenarioId = options.asNew
    ? scenario.id ?? crypto.randomUUID()
    : existingChosen?.id ?? scenario.id ?? crypto.randomUUID();
  const saved: ErfStrategyScenario = {
    id: scenarioId,
    parcelId,
    label: scenario.label,
    strategy: scenario.strategy,
    inputs: scenario.inputs,
    summary: scenario.summary,
    selected: true,
    savedAt: existingChosen?.savedAt ?? now,
    updatedAt: now,
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
  const workspace = writeStrategyWorkspace(
    parcelId,
    {
      ...currentWorkspace,
      activeStrategy: saved.strategy,
      draftInputs: saved.inputs,
      draftUpdatedAt: now,
      scenarios: next,
      chosenScenarioId: saved.id,
      chosenScenarioUpdatedAt: now,
    },
    storage,
    userId,
  );
  return { scenario: saved, scenarios: workspace.scenarios, workspace };
}

export function getChosenStrategyScenario(
  parcelId: string,
  storage: Storage | undefined = typeof window !== "undefined" ? window.localStorage : undefined,
  userId: BrowserPersistenceUserId = null,
) {
  const scenarios = readStrategyScenarios(parcelId, storage, userId);
  if (!scenarios.length) return null;
  const workspace = readErfWorkspaceState(parcelId, storage, userId);
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
      next: "Explore Site Potential or skip it.",
      action: "Run calculators",
      tab: "calculators",
    };
  }

  if (!siteDone) {
    return {
      title: siteStarted ? "Finish or skip Site Potential" : "Explore Site Potential",
      body: siteStarted
        ? "Select one generated concept when ready, or skip Site Potential so the report can continue."
        : "Add optional renovation or new-build concept visuals after the strategy numbers are saved.",
      why: "Concept visuals can enrich the final report, but they should never block core due diligence.",
      doNow: "Upload permitted photos or supporting files, generate/select a concept if entitled, or mark Site Potential skipped.",
      doneWhen: "One generated design is selected, or Site Potential is skipped for this erf.",
      next: "Create Easy Erf Report.",
      action: siteStarted ? "Review Site Potential" : "Open Site Potential",
      tab: "site-potential",
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
      id: "market",
      label: "Market",
      status: identityUncertain
        ? "Blocked / uncertain"
        : marketDone
          ? "Done"
          : sourcesDone
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
      id: "site",
      label: "Site",
      status: siteDone
        ? "Done"
        : strategyDone && !identityUncertain
          ? "Current"
          : siteStarted
            ? "Current"
            : identityUncertain
              ? "Blocked / uncertain"
              : "Not started",
      doneWhen: "Site Potential is skipped or one generated design is selected.",
    },
    {
      id: "report",
      label: "Report",
      status: state.reportStarted
        ? "Done"
        : siteDone && !identityUncertain
          ? "Current"
          : identityUncertain
            ? "Blocked / uncertain"
            : "Not started",
      doneWhen: "A Easy Erf Report or Report Vault workflow is started.",
    },
  ];
}
