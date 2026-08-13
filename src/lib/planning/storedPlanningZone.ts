/**
 * Reads and writes the zone code a user recorded for a parcel.
 *
 * Stored locally per parcel; it is user-supplied, never an official source.
 */
import {
  browserScopedParcelKey,
  readErfWorkspaceState,
  updateErfWorkspaceState,
  type BrowserStorage,
  type BrowserPersistenceUserId,
  type PlanningWorkspaceState,
} from "@/lib/workbench/erfWorkspaceState";

const STORAGE_PREFIX = "easyerf.planningZone.";
export const PLANNING_ZONE_UPDATED_EVENT = "easyerf:planning-zone-updated";
type PlanningStorage = BrowserStorage;

function defaultStorage(): PlanningStorage | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

export function planningZoneStorageKey(
  parcelId: string,
  userId: BrowserPersistenceUserId = null,
): string {
  return browserScopedParcelKey(STORAGE_PREFIX, parcelId, userId);
}

function readLegacyStoredZone(
  parcelId: string,
  userId: BrowserPersistenceUserId,
  storage: PlanningStorage | undefined,
): string | null {
  if (!storage) return null;
  try {
    const trimmed = storage.getItem(planningZoneStorageKey(parcelId, userId))?.trim();
    return trimmed ? trimmed : null;
  } catch {
    return null;
  }
}

function dispatchPlanningZoneUpdated(
  parcelId: string,
  userId: BrowserPersistenceUserId,
  zoneCode: string | null,
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PLANNING_ZONE_UPDATED_EVENT, {
      detail: { parcelId, userId: userId ?? null, zoneCode },
    }),
  );
}

/**
 * The workspace is the canonical planning decision record. This legacy scoped
 * key remains a one-way read path for selections stored before planning joined
 * the workspace; it is never silently confirmed.
 */
export function readStoredPlanningZoneState(
  parcelId: string,
  userId: BrowserPersistenceUserId = null,
  storage: PlanningStorage | undefined = defaultStorage(),
): PlanningWorkspaceState {
  const workspace = readErfWorkspaceState(parcelId, storage, userId);
  if (workspace.planning.zoneCode) return workspace.planning;
  const legacyZoneCode = readLegacyStoredZone(parcelId, userId, storage);
  return legacyZoneCode
    ? { zoneCode: legacyZoneCode, userConfirmedZoneCode: null, userConfirmedAt: null }
    : workspace.planning;
}

export function readStoredPlanningZone(
  parcelId: string,
  userId: BrowserPersistenceUserId = null,
  storage: PlanningStorage | undefined = defaultStorage(),
): string | null {
  return readStoredPlanningZoneState(parcelId, userId, storage).zoneCode;
}

export function writeStoredPlanningZone(
  parcelId: string,
  zoneCode: string | null,
  userId: BrowserPersistenceUserId = null,
  storage: PlanningStorage | undefined = defaultStorage(),
): PlanningWorkspaceState {
  const next = zoneCode?.trim() || null;
  const current = readStoredPlanningZoneState(parcelId, userId, storage);
  const confirmationRemainsValid = current.userConfirmedZoneCode === next;
  const workspace = updateErfWorkspaceState(
    parcelId,
    {
      planning: {
        zoneCode: next,
        userConfirmedZoneCode: confirmationRemainsValid ? current.userConfirmedZoneCode : null,
        userConfirmedAt: confirmationRemainsValid ? current.userConfirmedAt : null,
      },
    },
    storage,
    userId,
  );
  try {
    storage?.removeItem(planningZoneStorageKey(parcelId, userId));
  } catch {
    /* storage is best-effort only */
  }
  dispatchPlanningZoneUpdated(parcelId, userId, next);
  return workspace.planning;
}

export function confirmStoredPlanningZone(
  parcelId: string,
  userId: BrowserPersistenceUserId = null,
  storage: PlanningStorage | undefined = defaultStorage(),
): PlanningWorkspaceState {
  const current = readStoredPlanningZoneState(parcelId, userId, storage);
  const next: PlanningWorkspaceState = current.zoneCode
    ? {
        zoneCode: current.zoneCode,
        userConfirmedZoneCode: current.zoneCode,
        userConfirmedAt: new Date().toISOString(),
      }
    : current;
  updateErfWorkspaceState(parcelId, { planning: next }, storage, userId);
  dispatchPlanningZoneUpdated(parcelId, userId, next.zoneCode);
  return next;
}
