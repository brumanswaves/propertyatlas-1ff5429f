/**
 * Reads and writes the zone code a user recorded for a parcel.
 *
 * Stored locally per parcel; it is user-supplied, never an official source.
 */
import {
  browserScopedParcelKey,
  type BrowserPersistenceUserId,
} from "@/lib/workbench/erfWorkspaceState";

const STORAGE_PREFIX = "easyerf.planningZone.";
export const PLANNING_ZONE_UPDATED_EVENT = "easyerf:planning-zone-updated";
type PlanningStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): PlanningStorage | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

export function planningZoneStorageKey(
  parcelId: string,
  userId: BrowserPersistenceUserId = null,
): string {
  return browserScopedParcelKey(STORAGE_PREFIX, parcelId, userId);
}

export function readStoredPlanningZone(
  parcelId: string,
  userId: BrowserPersistenceUserId = null,
  storage: PlanningStorage | undefined = defaultStorage(),
): string | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(planningZoneStorageKey(parcelId, userId));
    const trimmed = raw?.trim();
    return trimmed ? trimmed : null;
  } catch {
    return null;
  }
}

export function writeStoredPlanningZone(
  parcelId: string,
  zoneCode: string | null,
  userId: BrowserPersistenceUserId = null,
  storage: PlanningStorage | undefined = defaultStorage(),
): string | null {
  const next = zoneCode?.trim() || null;
  if (!storage) return next;
  try {
    if (next) storage.setItem(planningZoneStorageKey(parcelId, userId), next);
    else storage.removeItem(planningZoneStorageKey(parcelId, userId));
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(PLANNING_ZONE_UPDATED_EVENT, {
          detail: { parcelId, userId, zoneCode: next },
        }),
      );
    }
  } catch {
    /* storage is best-effort only */
  }
  return next;
}
