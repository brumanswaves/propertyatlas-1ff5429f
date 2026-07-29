/**
 * Reads the zone code a user manually recorded for a parcel.
 *
 * Stored locally per parcel; it is user-supplied, never an official source.
 */
const STORAGE_PREFIX = "easyerf.planningZone.";

export function planningZoneStorageKey(parcelId: string): string {
  return `${STORAGE_PREFIX}${parcelId}`;
}

export function readStoredPlanningZone(parcelId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(planningZoneStorageKey(parcelId));
    const trimmed = raw?.trim();
    return trimmed ? trimmed : null;
  } catch {
    return null;
  }
}
