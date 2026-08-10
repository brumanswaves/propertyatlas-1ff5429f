/**
 * Persistence for street-frontage detection metadata.
 *
 * The final, user-confirmed street edge lives with the other Site Potential
 * answers (`buildEnvelopeStore`). What is stored here is only the automatic
 * detection evidence, kept separately so a confirmed answer can never be
 * silently overwritten by a later detection, and so detection can be audited.
 */

import type { StreetFrontageMethod } from "./streetFrontage";
import {
  browserScopedParcelKey,
  type BrowserPersistenceUserId,
} from "@/lib/workbench/erfWorkspaceState";

export interface StoredStreetFrontageDetection {
  edgeIndex: number | null;
  roadName: string | null;
  confidence: number;
  method: StreetFrontageMethod;
  detectedAt: string;
}

const KEY_PREFIX = "erfstoep.street-frontage.v1:";
type StreetFrontageStorage = Pick<Storage, "getItem" | "setItem">;

export function streetFrontageStorageKey(
  parcelId: string,
  userId: BrowserPersistenceUserId = null,
) {
  return browserScopedParcelKey(KEY_PREFIX, parcelId, userId);
}

export function readStoredStreetFrontageDetection(
  parcelId: string,
  storage?: StreetFrontageStorage,
  userId: BrowserPersistenceUserId = null,
): StoredStreetFrontageDetection | null {
  const store = storage ?? (typeof window === "undefined" ? null : window.localStorage);
  if (!store) return null;
  try {
    const raw = store.getItem(streetFrontageStorageKey(parcelId, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredStreetFrontageDetection;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function writeStoredStreetFrontageDetection(
  parcelId: string,
  detection: Omit<StoredStreetFrontageDetection, "detectedAt"> & { detectedAt?: string },
  storage?: StreetFrontageStorage,
  userId: BrowserPersistenceUserId = null,
): StoredStreetFrontageDetection {
  const record: StoredStreetFrontageDetection = {
    edgeIndex: detection.edgeIndex,
    roadName: detection.roadName,
    confidence: detection.confidence,
    method: detection.method,
    detectedAt: detection.detectedAt ?? new Date().toISOString(),
  };
  const store = storage ?? (typeof window === "undefined" ? null : window.localStorage);
  if (store) {
    try {
      store.setItem(streetFrontageStorageKey(parcelId, userId), JSON.stringify(record));
    } catch {
      /* storage unavailable — detection still works for this session */
    }
  }
  return record;
}
