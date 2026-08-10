import type { BuildEnvelopeInputs } from "./buildEnvelope";
import {
  browserScopedParcelKey,
  type BrowserPersistenceUserId,
} from "@/lib/workbench/erfWorkspaceState";

/** Persisted answers only. Geometry always comes from the live parcel layer. */
export type StoredBuildEnvelopeInputs = Omit<BuildEnvelopeInputs, "ring" | "parcelId">;

/**
 * Only fields the user actually touched are persisted. Absent keys and null
 * values mean "no override", so a stale blank can never overwrite a planning
 * prefill that becomes available later.
 */
export type StoredBuildEnvelopeOverrides = Partial<StoredBuildEnvelopeInputs>;
type BuildEnvelopeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const KEY_PREFIX = "erfstoep.build-envelope.v1:";

export function buildEnvelopeStorageKey(
  parcelId: string,
  userId: BrowserPersistenceUserId = null,
) {
  return browserScopedParcelKey(KEY_PREFIX, parcelId, userId);
}

function defaultStorage(): BuildEnvelopeStorage | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
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
  userId: BrowserPersistenceUserId = null,
  storage: BuildEnvelopeStorage | undefined = defaultStorage(),
): StoredBuildEnvelopeOverrides | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(buildEnvelopeStorageKey(parcelId, userId));
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
  userId: BrowserPersistenceUserId = null,
  storage: BuildEnvelopeStorage | undefined = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(
      buildEnvelopeStorageKey(parcelId, userId),
      JSON.stringify(stripEmpty(inputs)),
    );
  } catch {
    /* storage unavailable — the session still works, it just will not persist */
  }
}

export function clearStoredBuildEnvelopeInputs(
  parcelId: string,
  userId: BrowserPersistenceUserId = null,
  storage: BuildEnvelopeStorage | undefined = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(buildEnvelopeStorageKey(parcelId, userId));
  } catch {
    /* ignore */
  }
}
