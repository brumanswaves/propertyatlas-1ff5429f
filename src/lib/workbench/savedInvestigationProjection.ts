import type { ErfWorkspaceState } from "./erfWorkspaceState";

export const SAVED_INVESTIGATION_PROJECTION_KEY = "easyErfInvestigation" as const;
export const SAVED_INVESTIGATION_PROJECTION_VERSION = 1 as const;

export interface SavedInvestigationProjectionV1 {
  version: 1;
  parcelId: string;
  syncedAt: string;
  workspaceUpdatedAt: string;
  identityStatus: ErfWorkspaceState["identityStatus"];
  sgDiagramAttachmentCount: number;
  marketEvidenceStarted: boolean;
  strategyScenarioCount: number;
  chosenScenarioId: string | null;
  reportStarted: boolean;
  planning: {
    zoneCode: string | null;
    userConfirmedZoneCode: string | null;
    userConfirmedAt: string | null;
  };
  sitePotential: {
    skipped: boolean;
    conceptCount: number;
    selectedDesignAssetId: string | null;
    progressState: ErfWorkspaceState["sitePotential"]["progressState"];
  };
  investigation: {
    startedAt: string | null;
    lastViewedAt: string | null;
    currentStepId: string | null;
    skippedStepIds: string[];
    lastMeaningfulActionAt: string | null;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function timestamp(value: string | null | undefined) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function hasMaterialBrowserProgress(workspace: ErfWorkspaceState) {
  return (
    workspace.identityStatus !== "none" ||
    workspace.sgDiagramAttachmentCount > 0 ||
    workspace.marketEvidenceStarted ||
    workspace.strategyScenarioCount > 0 ||
    Boolean(workspace.chosenScenarioId) ||
    workspace.reportStarted ||
    Boolean(workspace.planning.zoneCode) ||
    Boolean(workspace.planning.userConfirmedZoneCode) ||
    workspace.sitePotential.progressState !== "not_started" ||
    workspace.sitePotential.conceptCount > 0 ||
    Boolean(workspace.sitePotential.selectedDesignAssetId) ||
    workspace.investigation.skippedStepIds.length > 0 ||
    Boolean(workspace.investigation.lastMeaningfulActionAt)
  );
}

export function buildSavedInvestigationProjection(
  parcelId: string,
  workspace: ErfWorkspaceState,
  syncedAt = new Date().toISOString(),
): SavedInvestigationProjectionV1 {
  return {
    version: SAVED_INVESTIGATION_PROJECTION_VERSION,
    parcelId,
    syncedAt,
    workspaceUpdatedAt: workspace.updatedAt,
    identityStatus: workspace.identityStatus,
    sgDiagramAttachmentCount: workspace.sgDiagramAttachmentCount,
    marketEvidenceStarted: workspace.marketEvidenceStarted,
    strategyScenarioCount: workspace.strategyScenarioCount,
    chosenScenarioId: workspace.chosenScenarioId,
    reportStarted: workspace.reportStarted,
    planning: {
      zoneCode: workspace.planning.zoneCode,
      userConfirmedZoneCode: workspace.planning.userConfirmedZoneCode,
      userConfirmedAt: workspace.planning.userConfirmedAt,
    },
    sitePotential: {
      skipped: workspace.sitePotential.skipped,
      conceptCount: workspace.sitePotential.conceptCount,
      selectedDesignAssetId: workspace.sitePotential.selectedDesignAssetId,
      progressState: workspace.sitePotential.progressState,
    },
    investigation: {
      startedAt: workspace.investigation.startedAt,
      lastViewedAt: workspace.investigation.lastViewedAt,
      currentStepId: workspace.investigation.currentStepId,
      skippedStepIds: [...workspace.investigation.skippedStepIds],
      lastMeaningfulActionAt: workspace.investigation.lastMeaningfulActionAt,
    },
  };
}

export function buildSavedInvestigationUserDataPatch(
  parcelId: string,
  workspace: ErfWorkspaceState,
  syncedAt = new Date().toISOString(),
) {
  return {
    [SAVED_INVESTIGATION_PROJECTION_KEY]: buildSavedInvestigationProjection(
      parcelId,
      workspace,
      syncedAt,
    ),
  };
}

export function readSavedInvestigationProjection(
  userData: unknown,
): SavedInvestigationProjectionV1 | null {
  if (!isRecord(userData)) return null;
  const raw = userData[SAVED_INVESTIGATION_PROJECTION_KEY];
  if (!isRecord(raw) || raw.version !== SAVED_INVESTIGATION_PROJECTION_VERSION) return null;
  const parcelId = nullableString(raw.parcelId);
  const syncedAt = nullableString(raw.syncedAt);
  const workspaceUpdatedAt = nullableString(raw.workspaceUpdatedAt);
  const investigation = isRecord(raw.investigation) ? raw.investigation : {};
  const planning = isRecord(raw.planning) ? raw.planning : {};
  const sitePotential = isRecord(raw.sitePotential) ? raw.sitePotential : {};
  if (!parcelId || !syncedAt || !workspaceUpdatedAt) return null;

  const identityStatus = raw.identityStatus;
  if (
    identityStatus !== "none" &&
    identityStatus !== "checked" &&
    identityStatus !== "looks_correct" &&
    identityStatus !== "uncertain"
  ) {
    return null;
  }

  const progressState = sitePotential.progressState;
  const validProgressStates = new Set([
    "not_started",
    "inputs_added",
    "ready_to_generate",
    "generating",
    "concepts_ready",
    "design_selected",
    "skipped",
    "failed",
  ]);
  if (typeof progressState !== "string" || !validProgressStates.has(progressState)) return null;

  return {
    version: 1,
    parcelId,
    syncedAt,
    workspaceUpdatedAt,
    identityStatus,
    sgDiagramAttachmentCount: Math.max(0, Number(raw.sgDiagramAttachmentCount) || 0),
    marketEvidenceStarted: Boolean(raw.marketEvidenceStarted),
    strategyScenarioCount: Math.max(0, Number(raw.strategyScenarioCount) || 0),
    chosenScenarioId: nullableString(raw.chosenScenarioId),
    reportStarted: Boolean(raw.reportStarted),
    planning: {
      zoneCode: nullableString(planning.zoneCode),
      userConfirmedZoneCode: nullableString(planning.userConfirmedZoneCode),
      userConfirmedAt: nullableString(planning.userConfirmedAt),
    },
    sitePotential: {
      skipped: Boolean(sitePotential.skipped),
      conceptCount: Math.max(0, Number(sitePotential.conceptCount) || 0),
      selectedDesignAssetId: nullableString(sitePotential.selectedDesignAssetId),
      progressState: progressState as SavedInvestigationProjectionV1["sitePotential"]["progressState"],
    },
    investigation: {
      startedAt: nullableString(investigation.startedAt),
      lastViewedAt: nullableString(investigation.lastViewedAt),
      currentStepId: nullableString(investigation.currentStepId),
      skippedStepIds: strings(investigation.skippedStepIds),
      lastMeaningfulActionAt: nullableString(investigation.lastMeaningfulActionAt),
    },
  };
}

/**
 * A saved investigation is the restore source when this browser has no scoped
 * workspace yet. If both copies exist, only replace material browser progress
 * when the saved projection is newer. Navigation-only browser writes do not
 * block restoration of durable progress.
 */
export function shouldHydrateSavedInvestigationProjection(args: {
  hasStoredBrowserWorkspace: boolean;
  browserWorkspace: ErfWorkspaceState;
  projection: SavedInvestigationProjectionV1;
}) {
  const { hasStoredBrowserWorkspace, browserWorkspace, projection } = args;
  if (!hasStoredBrowserWorkspace) return true;
  if (!hasMaterialBrowserProgress(browserWorkspace)) return true;

  const browserUpdatedAt = timestamp(browserWorkspace.updatedAt);
  const projectionUpdatedAt = timestamp(projection.workspaceUpdatedAt);
  if (projectionUpdatedAt === null) return false;
  if (browserUpdatedAt === null) return true;
  return projectionUpdatedAt > browserUpdatedAt;
}

/** Restore the durable projection into the existing workspace state model. */
export function mergeSavedInvestigationProjectionIntoWorkspace(
  parcelId: string,
  browserWorkspace: ErfWorkspaceState,
  projection: SavedInvestigationProjectionV1,
): ErfWorkspaceState {
  if (projection.parcelId !== parcelId) return browserWorkspace;

  return {
    ...browserWorkspace,
    saved: true,
    dirty: false,
    identityStatus: projection.identityStatus,
    sgDiagramAttachmentCount: projection.sgDiagramAttachmentCount,
    marketEvidenceStarted: projection.marketEvidenceStarted,
    strategyScenarioCount: projection.strategyScenarioCount,
    chosenScenarioId: projection.chosenScenarioId,
    reportStarted: projection.reportStarted,
    planning: {
      ...browserWorkspace.planning,
      zoneCode: projection.planning.zoneCode,
      userConfirmedZoneCode: projection.planning.userConfirmedZoneCode,
      userConfirmedAt: projection.planning.userConfirmedAt,
    },
    sitePotential: {
      ...browserWorkspace.sitePotential,
      skipped: projection.sitePotential.skipped,
      conceptCount: projection.sitePotential.conceptCount,
      selectedDesignAssetId: projection.sitePotential.selectedDesignAssetId,
      progressState: projection.sitePotential.progressState,
    },
    investigation: {
      ...browserWorkspace.investigation,
      startedAt: projection.investigation.startedAt,
      lastViewedAt: projection.investigation.lastViewedAt,
      currentStepId: projection.investigation.currentStepId,
      skippedStepIds: [...projection.investigation.skippedStepIds],
      lastMeaningfulActionAt: projection.investigation.lastMeaningfulActionAt,
    },
    updatedAt: projection.workspaceUpdatedAt,
  };
}
