// Easy Erf v1.5 — Provider abstraction types.
// Normalized data model + compliance metadata so any provider (Demo, SG, Municipal GIS,
// WinDeed, Lightstone) can be swapped in without frontend changes.

export type ProviderId =
  | "demo"
  | "surveyor-general"
  | "municipal-gis"
  | "windeed"
  | "lightstone";

export type ProviderStatus = "active" | "not_connected" | "degraded" | "error";

export interface ProviderMeta {
  id: ProviderId;
  name: string;
  description: string;
  status: ProviderStatus;
  capabilities: {
    search: boolean;
    ownership: boolean;
    valuation: boolean;
    transfers: boolean;
    geometry: boolean;
    reports: boolean;
  };
}

// Field-level compliance. Some providers (Lightstone, WinDeed) restrict
// caching/storage of certain fields. Renderers can use this to gate display.
export interface FieldCompliance {
  displayAllowed: boolean;
  storageAllowed: boolean;
  cachingAllowed: boolean;
  source: ProviderId;
  lastUpdated?: string; // ISO
  note?: string;
}

// A value plus its compliance envelope. `null` means "Not Available".
export interface Field<T> {
  value: T | null;
  compliance: FieldCompliance;
}

export type NotAvailableLabel = "Not Available";
export const NOT_AVAILABLE: NotAvailableLabel = "Not Available";

export interface NormalizedOwnership {
  ownerLabel: Field<string>;
  ownershipType: Field<"Individual" | "Trust" | "Company">;
  since: Field<string>;
  idNumber?: Field<string>; // usually display:false on commercial providers
}

export interface NormalizedTransfer {
  date: string;
  price: number | null;
  buyer?: string | null;
  seller?: string | null;
  deedRef?: string | null;
}

export interface NormalizedValuation {
  marketEstimate: Field<number>;
  municipalValue: Field<number>;
  confidence: Field<number>; // 0..1
  asOf: Field<string>;
}

export type GeoJSONPolygon = {
  type: "Polygon";
  coordinates: [number, number][][];
};

export type GeoJSONMultiPolygon = {
  type: "MultiPolygon";
  coordinates: [number, number][][][];
};

export type GeoJSONShape = GeoJSONPolygon | GeoJSONMultiPolygon;

export interface NormalizedGeometry {
  /** Polygon or MultiPolygon in WGS84 (EPSG:4326), [lng, lat]. */
  polygon: GeoJSONShape | null;
  centroid: [number, number] | null;
  source: ProviderId;
  /** Original CRS the provider returned, before reprojection (e.g. "EPSG:2048" for SA LO19). */
  sourceCrs?: string;
}

export interface NormalizedProperty {
  id: string;
  erf: Field<string>;
  portion: Field<string>;
  streetAddress: Field<string>;
  suburb: Field<string>;
  town: Field<string>;
  municipality: Field<string>;
  province: Field<string>;
  coordinates: Field<[number, number]>;
  landSizeSqm: Field<number>;
  propertyType: Field<string>;
  zoning: Field<string>;
  municipalValuation: Field<number>;
  lastSaleDate: Field<string>;
  lastSalePrice: Field<number>;
  ownershipStatus: Field<string>;
  geometry: NormalizedGeometry;
  images: Field<string[]>;
  amenities: Field<string[]>;
  reportsAvailable: string[]; // report-type ids enabled for this property
  providerSources: Partial<Record<keyof Omit<NormalizedProperty, "id" | "geometry" | "providerSources" | "reportsAvailable">, ProviderId>>;
}

export interface ProviderHealth {
  status: ProviderStatus;
  latencyMs?: number;
  message?: string;
  checkedAt: string;
}

// Helper to build a Field<T> quickly.
export function field<T>(
  value: T | null | undefined,
  source: ProviderId,
  opts: Partial<Omit<FieldCompliance, "source">> = {},
): Field<T> {
  return {
    value: (value ?? null) as T | null,
    compliance: {
      displayAllowed: true,
      storageAllowed: true,
      cachingAllowed: true,
      source,
      ...opts,
    },
  };
}

export function naField<T>(source: ProviderId): Field<T> {
  return field<T>(null, source, { note: "Not available from this provider" });
}
