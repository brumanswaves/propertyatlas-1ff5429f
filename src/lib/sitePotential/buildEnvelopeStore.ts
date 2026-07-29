import type { BuildEnvelopeInputs } from "./buildEnvelope";

/** Persisted answers only. Geometry always comes from the live parcel layer. */
export type StoredBuildEnvelopeInputs = Omit<BuildEnvelopeInputs, "ring" | "parcelId">;

const KEY_PREFIX = "erfstoep.build-envelope.v1:";

function storageKey(parcelId: string) {
  return `${KEY_PREFIX}${parcelId}`;
}

export function readStoredBuildEnvelopeInputs(
  parcelId: string,
): StoredBuildEnvelopeInputs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(parcelId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredBuildEnvelopeInputs;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function writeStoredBuildEnvelopeInputs(
  parcelId: string,
  inputs: StoredBuildEnvelopeInputs,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(parcelId), JSON.stringify(inputs));
  } catch {
    /* storage unavailable — the session still works, it just will not persist */
  }
}

export function clearStoredBuildEnvelopeInputs(parcelId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(parcelId));
  } catch {
    /* ignore */
  }
}
