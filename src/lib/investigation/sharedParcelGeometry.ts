import {
  extractOfficialFeatureIdentity,
  officialFeatureMatchesSavedParcelId,
  type NormalizedOfficialParcel,
} from "@/lib/parcels/officialParcelId";
import {
  searchOfficialPublicParcelsByIdentity,
  type PublicDataResult,
} from "@/lib/providers/publicDataClient";
import { extractExteriorRing, isValidParcelRing } from "@/lib/sitePotential/parcelRing";
import type { OrderInvestigation } from "./sharedInvestigation";

export interface RecoveredParcelGeometry {
  parcelRing: Array<[number, number]>;
  normalizedParcel: NormalizedOfficialParcel;
}

export function exactGeometryQuery(parcelId: string) {
  const match = /^csg:(lpi|parcel-key):([a-z0-9_-]+)$/i.exec(parcelId);
  if (!match) return null;
  return match[1].toLowerCase() === "lpi"
    ? { lpi: match[2].toUpperCase(), limit: 2 }
    : { parcelKey: match[2].toUpperCase(), limit: 2 };
}

export function validateRecoveredGeometry(
  parcel: NormalizedOfficialParcel,
  result: PublicDataResult,
): RecoveredParcelGeometry | null {
  // Even a single matching member of an ambiguous response is insufficient.
  if (!result.official || result.layer !== "csg-parcels" || result.features.length !== 1)
    return null;
  const feature = result.features[0];
  if (!officialFeatureMatchesSavedParcelId(parcel.id, "csg-parcels", feature.properties))
    return null;
  const parcelRing = extractExteriorRing(feature.geometry);
  if (!parcelRing) return null;
  const identity = extractOfficialFeatureIdentity("csg-parcels", feature.properties);
  const normalizedParcel: NormalizedOfficialParcel = {
    ...parcel,
    id: parcel.id,
    source: "csg",
    sourceLabel: result.sourceLabel,
    layer: "csg-parcels",
    lpi: identity.lpi,
    parcelKey: identity.parcelKey,
    erfNumber: identity.erfNumber ?? parcel.erfNumber,
    portion: identity.portion ?? parcel.portion,
    // Keep existing planning context; public geometry does not verify zoning.
    municipality: parcel.municipality ?? identity.municipality,
    province: parcel.province ?? identity.province,
    knownFields: [
      ...parcel.knownFields,
      {
        label: "Parcel boundary",
        value: "Exact official identity match",
        source: result.sourceLabel,
      },
    ],
    missingFields: parcel.missingFields,
  };
  return { parcelRing, normalizedParcel };
}

export async function recoverSharedParcelGeometry(
  parcel: NormalizedOfficialParcel,
  signal: AbortSignal,
) {
  const query = exactGeometryQuery(parcel.id);
  if (!query || signal.aborted) return null;
  const result = await searchOfficialPublicParcelsByIdentity(query, {
    signal,
    singleAttempt: true,
  });
  return signal.aborted ? null : validateRecoveredGeometry(parcel, result);
}

export function assertSharedGeometryReadback(
  before: OrderInvestigation,
  after: OrderInvestigation,
  geometry: RecoveredParcelGeometry,
) {
  const actual = after.userData.normalizedParcel as NormalizedOfficialParcel | undefined;
  if (
    after.orderId !== before.orderId ||
    after.customerId !== before.customerId ||
    after.parcelId !== before.parcelId ||
    after.revision <= before.revision ||
    actual?.id !== before.parcelId ||
    actual.source !== "csg" ||
    actual.lpi !== geometry.normalizedParcel.lpi ||
    actual.parcelKey !== geometry.normalizedParcel.parcelKey ||
    !isValidParcelRing(after.userData.parcelRing) ||
    JSON.stringify(after.userData.parcelRing) !== JSON.stringify(geometry.parcelRing)
  ) {
    throw new Error(
      "The saved parcel boundary could not be confirmed for this investigation. Reload before proceeding.",
    );
  }
}
