import type { BuildEnvelopeInputs } from "./buildEnvelope";

/** Persisted answers only. Geometry always comes from the live parcel layer. */
export type StoredBuildEnvelopeInputs = Omit<BuildEnvelopeInputs, "ring" | "parcelId">;

/**
 * Only fields the user actually touched are persisted. Absent keys and null
 * values mean "no override", so a stale blank can never overwrite a planning
 * prefill that becomes available later.
 */
export type StoredBuildEnvelopeOverrides = Partial<StoredBuildEnvelopeInputs>;

const KEY_PREFIX = "erfstoep.build-envelope.v1:";

function storageKey(parcelId: string) {
  return `${KEY_PREFIX}${parcelId}`;
}

/** Drops null/blank legacy entries so old stored values migrate safely. */
function stripEmpty(value: StoredBuildEnvelopeOverrides): StoredBuildEnvelopeOverrides {
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry == null) continue;
    if (typeof entry === "string" && entry.trim() === "") continue;
    if (typeof entry === "number" && !Number.isFinite(entry)) continue;
    out[key] = entry;
  }
  return out as StoredBuildEnvelopeOverrides;
}

export function readStoredBuildEnvelopeInputs(
  parcelId: string,
): StoredBuildEnvelopeOverrides | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(parcelId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredBuildEnvelopeOverrides;
    return parsed && typeof parsed === "object" ? stripEmpty(parsed) : null;
  } catch {
    return null;
  }
}

export function writeStoredBuildEnvelopeInputs(
  parcelId: string,
  inputs: StoredBuildEnvelopeOverrides,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(parcelId), JSON.stringify(stripEmpty(inputs)));
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
