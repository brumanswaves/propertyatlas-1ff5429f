/**
 * Reads and writes the zone code a user recorded for a parcel.
 *
 * Stored locally per parcel; it is user-supplied, never an official source.
 */
const STORAGE_PREFIX = "easyerf.planningZone.";
export const PLANNING_ZONE_UPDATED_EVENT = "easyerf:planning-zone-updated";

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

export function writeStoredPlanningZone(parcelId: string, zoneCode: string | null): string | null {
  const next = zoneCode?.trim() || null;
  if (typeof window === "undefined") return next;
  try {
    if (next) window.localStorage.setItem(planningZoneStorageKey(parcelId), next);
    else window.localStorage.removeItem(planningZoneStorageKey(parcelId));
    window.dispatchEvent(
      new CustomEvent(PLANNING_ZONE_UPDATED_EVENT, {
        detail: { parcelId, zoneCode: next },
      }),
    );
  } catch {
    /* storage is best-effort only */
  }
  return next;
}
