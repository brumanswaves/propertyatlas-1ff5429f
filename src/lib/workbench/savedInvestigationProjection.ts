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
