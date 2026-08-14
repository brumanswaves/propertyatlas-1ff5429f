import type { SitePotentialParcelContext } from "./parcelRuntimeContext";

export {
  describeSitePotentialParcelContext,
  sitePotentialParcelContextFromProject,
  type SitePotentialParcelContext,
} from "./parcelRuntimeContext";

export interface SitePotentialFrontageContext {
  primaryEdgeIndex: number | null;
  secondaryEdgeIndex: number | null;
  streetName: string | null;
}

interface NormalizedOfficialParcelLike {
  id: string;
  sourceLabel: string;
  erfNumber?: string | number | null;
  portion?: string | number | null;
  lpi?: string | null;
  parcelKey?: string | null;
  municipality?: string | null;
  province?: string | null;
  suburbOrArea?: string | null;
  town?: string | null;
  coordinates?: { lng: number; lat: number } | null;
  knownFields: Array<{ label: string; value: string; source: string }>;
  rawProperties?: Record<string, unknown>;
}

function primitiveSourceAttributes(raw: Record<string, unknown> | undefined) {
  const entries = Object.entries(raw ?? {})
    .filter(([, value]) => value === null || ["string", "number", "boolean"].includes(typeof value))
    .slice(0, 60);
  return Object.fromEntries(entries) as Record<string, string | number | boolean | null>;
}

export function buildSitePotentialParcelContext(
  parcel: NormalizedOfficialParcelLike,
  frontage: SitePotentialFrontageContext | null = null,
): SitePotentialParcelContext {
  return {
    parcelId: parcel.id,
    sourceLabel: parcel.sourceLabel,
    erfNumber: parcel.erfNumber ?? null,
    portion: parcel.portion ?? null,
    lpi: parcel.lpi ?? null,
    parcelKey: parcel.parcelKey ?? null,
    municipality: parcel.municipality ?? null,
    province: parcel.province ?? null,
    suburbOrArea: parcel.suburbOrArea ?? null,
    town: parcel.town ?? null,
    coordinates: parcel.coordinates ?? null,
    knownFields: parcel.knownFields.slice(0, 40),
    sourceAttributes: primitiveSourceAttributes(parcel.rawProperties),
    frontage:
      frontage?.primaryEdgeIndex != null || frontage?.secondaryEdgeIndex != null
        ? { ...frontage, source: "user_confirmed" }
        : null,
    capturedAt: new Date().toISOString(),
  };
}
