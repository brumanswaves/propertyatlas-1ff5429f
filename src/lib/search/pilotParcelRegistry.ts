import type { Feature, Geometry } from "geojson";
import {
  buildOfficialParcelIndex,
  type IndexedOfficialParcel,
} from "@/lib/search/officialParcelIndex";
import {
  parsePropertyQuery,
  searchOfficialParcels,
  type PropertySearchResult,
} from "@/lib/search/propertySearch";

export const PILOT_PARCEL_REGISTRY_URL = "/data/kouga-st-francis-pilot-parcels.json";
export const PILOT_PARCEL_REGISTRY_SOURCE_LABEL = "Pilot parcel registry / CSG public parcel layer";

export interface PilotParcelRegistryRecord {
  id: string;
  erf: string;
  portion?: string;
  township?: string;
  municipality?: string;
  province?: string;
  lpi?: string;
  parcelKey?: string;
  lat: number;
  lng: number;
  areaSqm?: number;
  sourceLayer: "csg-parcels";
  sourceLabel: string;
  confidence: "source-backed";
  sourceQuality: "official_public_layer";
  properties: Record<string, unknown>;
  bounds?: [number, number, number, number];
}

export interface PilotParcelRegistryPayload {
  metadata: {
    name: string;
    pilotArea: string;
    sourceUrl: string;
    sourceLabel: string;
    fetchedAt: string;
    recordCount: number;
    note: string;
  };
  records: PilotParcelRegistryRecord[];
}

export interface PilotParcelRegistry {
  metadata: PilotParcelRegistryPayload["metadata"];
  parcels: IndexedOfficialParcel[];
}

function clean(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function registryRecordToFeature(record: PilotParcelRegistryRecord): Feature {
  const properties = {
    ...record.properties,
    PARCEL_NO: record.properties.PARCEL_NO ?? record.erf,
    TAG_VALUE: record.properties.TAG_VALUE ?? record.erf,
    PORTION: record.properties.PORTION ?? record.portion ?? "0",
    ID: record.properties.ID ?? record.lpi,
    PRCL_KEY: record.properties.PRCL_KEY ?? record.parcelKey,
    MIN_REGION: record.properties.MIN_REGION ?? record.township,
    MAJ_REGION: record.properties.MAJ_REGION ?? record.municipality,
    MUNICIPALITY: record.properties.MUNICIPALITY ?? record.municipality,
    PROVINCE: record.properties.PROVINCE ?? record.province,
    TAG_X: record.properties.TAG_X ?? record.lng,
    TAG_Y: record.properties.TAG_Y ?? record.lat,
    GEOM_AREA: record.properties.GEOM_AREA ?? record.areaSqm,
    propertyatlas_source: record.sourceLabel,
    erfstoep_registry_source: "kouga-st-francis-pilot",
    erfstoep_point_context: "Pilot registry coordinate from official public layer",
  };

  return {
    type: "Feature",
    properties,
    geometry: { type: "Point", coordinates: [record.lng, record.lat] },
  };

}

export function normalizePilotParcelRegistry(
  payload: PilotParcelRegistryPayload,
): PilotParcelRegistry {
  const validRecords = payload.records.filter(
    (record) => Number.isFinite(record.lng) && Number.isFinite(record.lat),
  );
  const features = validRecords.map((record) => ({
    layer: record.sourceLayer,
    feature: registryRecordToFeature(record),
  }));
  const parcels = buildOfficialParcelIndex(features).map((parcel, index) => {
    const record = validRecords[index];
    return {
      ...parcel,
      id: record.id || parcel.id,
      sourceLabel: record.sourceLabel || PILOT_PARCEL_REGISTRY_SOURCE_LABEL,
      geometry: null as Geometry | null,
      centroid: { lng: record.lng, lat: record.lat },
      displayAreaLabel:
        [record.township, record.municipality, record.province].filter(Boolean).join(", ") ||
        parcel.displayAreaLabel,
      erf: clean(record.erf) ?? parcel.erf,
      portion: clean(record.portion) ?? parcel.portion,
      lpi: clean(record.lpi)?.toLowerCase() ?? parcel.lpi,
      parcelKey: clean(record.parcelKey)?.toLowerCase() ?? parcel.parcelKey,
      town: clean(record.township) ?? parcel.town,
      municipality: clean(record.municipality) ?? parcel.municipality,
      province: clean(record.province) ?? parcel.province,
    };
  });

  return { metadata: payload.metadata, parcels };
}

export async function loadPilotParcelRegistry(
  url = PILOT_PARCEL_REGISTRY_URL,
): Promise<PilotParcelRegistry> {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Pilot parcel registry unavailable: HTTP ${response.status}`);
  }
  const payload = (await response.json()) as PilotParcelRegistryPayload;
  return normalizePilotParcelRegistry(payload);
}

export function searchPilotParcelRegistry(
  query: string,
  parcels: IndexedOfficialParcel[],
): PropertySearchResult[] {
  const parsed = parsePropertyQuery(query);
  const loadedAreaTerms = parsed.areaText
    ? parsed.areaText
        .split(/\s+/)
        .map((term) => term.toLowerCase())
        .filter((term) => term.length > 2)
    : [];
  return searchOfficialParcels(query, parcels, { loadedAreaTerms }).map((result) => ({
    ...result,
    sourceLabel: PILOT_PARCEL_REGISTRY_SOURCE_LABEL,
    matchReason:
      result.confidence === "exact_official_match"
        ? result.matchReason
        : `${result.matchReason} from Kouga / St Francis pilot registry`,
  }));
}
