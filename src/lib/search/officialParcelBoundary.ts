import type { Geometry } from "geojson";
import type { PublicParcelIdentitySearchInput } from "@/lib/providers/publicDataClient";
import type { IndexedOfficialParcel } from "@/lib/search/officialParcelIndex";

export type OfficialParcelBoundaryLookup = (
  input: PublicParcelIdentitySearchInput,
) => Promise<IndexedOfficialParcel[]>;

function normalizedIdentity(value: string | number | null | undefined) {
  const text = String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
  return text || null;
}

function polygonHasRing(geometry: Geometry) {
  if (geometry.type === "Polygon") {
    return geometry.coordinates.some((ring) => ring.length >= 4);
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon) => polygon.some((ring) => ring.length >= 4));
  }
  return false;
}

export function hasOfficialParcelBoundary(
  parcel: Pick<IndexedOfficialParcel, "geometry"> | null | undefined,
) {
  return Boolean(parcel?.geometry && polygonHasRing(parcel.geometry));
}

/**
 * Parcel enrichment must be based on a strong cadastral identifier. An erf
 * number by itself is intentionally insufficient because the same number can
 * exist in many towns, schemes and municipalities.
 */
export function sharesStrongOfficialParcelIdentity(
  target: IndexedOfficialParcel,
  candidate: IndexedOfficialParcel,
) {
  if (target.layer !== candidate.layer) return false;

  const targetLpi = normalizedIdentity(target.lpi);
  const candidateLpi = normalizedIdentity(candidate.lpi);
  if (targetLpi && candidateLpi && targetLpi === candidateLpi) return true;

  const targetParcelKey = normalizedIdentity(target.parcelKey);
  const candidateParcelKey = normalizedIdentity(candidate.parcelKey);
  if (
    targetParcelKey &&
    candidateParcelKey &&
    targetParcelKey === candidateParcelKey
  ) {
    return true;
  }

  const targetObjectId = normalizedIdentity(target.objectId);
  const candidateObjectId = normalizedIdentity(candidate.objectId);
  if (targetObjectId && candidateObjectId && targetObjectId === candidateObjectId) return true;

  const targetId = normalizedIdentity(target.id);
  const candidateId = normalizedIdentity(candidate.id);
  return Boolean(targetId && candidateId && targetId === candidateId);
}

export function findOfficialParcelBoundary(
  target: IndexedOfficialParcel,
  candidates: readonly IndexedOfficialParcel[],
) {
  if (hasOfficialParcelBoundary(target)) return target;
  return (
    candidates.find(
      (candidate) =>
        hasOfficialParcelBoundary(candidate) &&
        sharesStrongOfficialParcelIdentity(target, candidate),
    ) ?? null
  );
}

/**
 * Remote boundary lookup is attempted only when an exact CSG identifier is
 * available. Point-only records without an LPI or parcel key remain honest
 * point context rather than triggering a weak erf-number lookup.
 */
export function officialParcelBoundaryLookupInput(
  parcel: IndexedOfficialParcel,
): PublicParcelIdentitySearchInput | null {
  const lpi = normalizedIdentity(parcel.lpi);
  const parcelKey = normalizedIdentity(parcel.parcelKey);
  if (!lpi && !parcelKey) return null;
  return {
    lpi,
    parcelKey,
    limit: 25,
  };
}

export async function resolveOfficialParcelBoundary(input: {
  target: IndexedOfficialParcel;
  loadedParcels: readonly IndexedOfficialParcel[];
  lookup: OfficialParcelBoundaryLookup;
}) {
  const loadedBoundary = findOfficialParcelBoundary(input.target, input.loadedParcels);
  if (loadedBoundary) return loadedBoundary;

  const lookupInput = officialParcelBoundaryLookupInput(input.target);
  if (!lookupInput) return null;

  try {
    const remoteParcels = await input.lookup(lookupInput);
    return findOfficialParcelBoundary(input.target, remoteParcels);
  } catch {
    return null;
  }
}
