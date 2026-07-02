import type { Feature, Geometry, Position } from "geojson";
import {
  buildOfficialParcelId,
  extractOfficialFeatureIdentity,
  type OfficialFeatureLayer,
} from "../parcels/officialParcelId.ts";

export type OfficialParcelFeature = {
  layer: OfficialFeatureLayer;
  feature: Feature;
};

export interface IndexedOfficialParcel {
  id: string;
  layer: OfficialFeatureLayer;
  sourceLabel: "Chief Surveyor-General" | "Kouga Municipality GIS";
  properties: Record<string, unknown>;
  geometry: Geometry | null;
  feature: Feature;
  erf?: string;
  portion?: string;
  lpi?: string;
  parcelKey?: string;
  objectId?: string;
  town?: string;
  municipality?: string;
  province?: string;
  centroid?: { lng: number; lat: number };
  displayAreaLabel: string;
}

const TOWN_KEYS = ["MIN_REGION", "MINOR_REGION", "TOWN", "SUBURB", "AREA", "PLACE_NAME"];
const MUNICIPALITY_KEYS = ["MUNICIPALITY", "MUNIC_NAME", "MAJ_REGION", "MAJOR_REGION"];
const PROVINCE_KEYS = ["PROVINCE", "PROV_NAME"];

function firstValue(properties: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = properties[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  const normalizedKeys = new Set(keys.map((key) => key.toLowerCase()));
  for (const [key, value] of Object.entries(properties)) {
    if (
      normalizedKeys.has(key.toLowerCase()) &&
      value !== null &&
      value !== undefined &&
      String(value).trim()
    ) {
      return String(value).trim();
    }
  }
  return undefined;
}

function collectPositions(geometry: Geometry | null | undefined): Position[] {
  if (!geometry) return [];
  if (geometry.type === "Point") return [geometry.coordinates];
  if (geometry.type === "MultiPoint" || geometry.type === "LineString") return geometry.coordinates;
  if (geometry.type === "MultiLineString" || geometry.type === "Polygon") {
    return geometry.coordinates.flat();
  }
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat(2);
  if (geometry.type === "GeometryCollection") {
    return geometry.geometries.flatMap((part) => collectPositions(part));
  }
  return [];
}

export function centroidForGeometry(
  geometry: Geometry | null | undefined,
): { lng: number; lat: number } | undefined {
  const positions = collectPositions(geometry);
  if (!positions.length) return undefined;
  const finite = positions.filter(
    (position) => Number.isFinite(position[0]) && Number.isFinite(position[1]),
  );
  if (!finite.length) return undefined;
  let minLng = finite[0][0];
  let maxLng = finite[0][0];
  let minLat = finite[0][1];
  let maxLat = finite[0][1];
  for (const [lng, lat] of finite) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  return { lng: (minLng + maxLng) / 2, lat: (minLat + maxLat) / 2 };
}

export function indexOfficialFeature(
  layer: OfficialFeatureLayer,
  feature: Feature,
): IndexedOfficialParcel {
  const properties = (feature.properties ?? {}) as Record<string, unknown>;
  const identity = extractOfficialFeatureIdentity(layer, properties);
  const town = firstValue(properties, TOWN_KEYS);
  const municipality = firstValue(properties, MUNICIPALITY_KEYS);
  const province = firstValue(properties, PROVINCE_KEYS);
  const centroid = centroidForGeometry(feature.geometry);
  const sourceLabel = layer === "csg-parcels" ? "Chief Surveyor-General" : "Kouga Municipality GIS";
  const id =
    layer === "csg-parcels"
      ? buildOfficialParcelId({
          source: "csg",
          lpi: identity.lpi,
          parcelKey: identity.parcelKey,
          erfNumber: identity.erfNumber,
          portion: identity.portion ?? "0",
          municipality: municipality ?? identity.municipality,
          province: province ?? identity.province,
          lng: centroid?.lng,
          lat: centroid?.lat,
        })
      : buildOfficialParcelId({
          source: "kouga",
          layer,
          objectId: identity.objectId,
          lng: centroid?.lng,
          lat: centroid?.lat,
        });

  return {
    id,
    layer,
    sourceLabel,
    properties,
    geometry: feature.geometry,
    feature,
    erf: identity.erfNumber ?? undefined,
    portion: identity.portion ?? undefined,
    lpi: identity.lpi ?? undefined,
    parcelKey: identity.parcelKey ?? undefined,
    objectId: identity.objectId ?? undefined,
    town,
    municipality,
    province,
    centroid,
    displayAreaLabel: [town, municipality, province].filter(Boolean).join(", ") || sourceLabel,
  };
}

export function buildOfficialParcelIndex(
  features: OfficialParcelFeature[],
): IndexedOfficialParcel[] {
  return features.map(({ layer, feature }) => indexOfficialFeature(layer, feature));
}
