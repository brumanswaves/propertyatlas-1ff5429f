import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Feature, Polygon } from "geojson";
import { buildOfficialParcelId } from "../src/lib/parcels/officialParcelId.ts";
import { centroidForGeometry } from "../src/lib/search/officialParcelIndex.ts";

const SOURCE_URL =
  "https://services6.arcgis.com/HrQQGPZkIr5BuMyY/arcgis/rest/services/Kouga_SG_Properties/FeatureServer/32/query";
const OUTPUT_PATH = resolve("public/data/kouga-st-francis-pilot-parcels.json");
const SOURCE_LABEL = "Pilot parcel registry / CSG public parcel layer";
const WHERE =
  "MIN_REGION IN ('SEA VISTA','CAPE ST FRANCIS','ST FRANCIS BAY','SANTAREME','ST FRANCIS ON SEA','PORT ST FRANCIS')";
const PAGE_SIZE = 1000;

interface EsriFeature {
  attributes?: Record<string, unknown>;
  geometry?: { rings?: number[][][] };
}

interface EsriFeatureSet {
  features?: EsriFeature[];
  exceededTransferLimit?: boolean;
  error?: { message?: string; details?: string[] };
}

function clean(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function numberValue(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function normalizePart(value: unknown): string | undefined {
  return clean(value)
    ?.toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function esriToFeature(feature: EsriFeature): Feature<Polygon> | null {
  const rings = feature.geometry?.rings;
  if (!rings?.length) return null;
  return {
    type: "Feature",
    properties: feature.attributes ?? {},
    geometry: { type: "Polygon", coordinates: rings },
  };
}

function boundsForGeometry(
  feature: Feature<Polygon>,
): [number, number, number, number] | undefined {
  const coords = feature.geometry.coordinates.flat();
  if (!coords.length) return undefined;
  let west = coords[0][0];
  let south = coords[0][1];
  let east = coords[0][0];
  let north = coords[0][1];
  for (const [lng, lat] of coords) {
    west = Math.min(west, lng);
    south = Math.min(south, lat);
    east = Math.max(east, lng);
    north = Math.max(north, lat);
  }
  return [west, south, east, north];
}

function recordKey(attrs: Record<string, unknown>, id: string) {
  return (
    normalizePart(attrs.ID) ??
    normalizePart(attrs.PRCL_KEY) ??
    `${normalizePart(attrs.PARCEL_NO) ?? "unknown"}:${normalizePart(attrs.PORTION) ?? "0"}:${normalizePart(attrs.MIN_REGION) ?? "unknown"}:${id}`
  );
}

function buildQueryUrl(offset: number) {
  const params = new URLSearchParams({
    f: "json",
    where: WHERE,
    outFields: "*",
    returnGeometry: "true",
    outSR: "4326",
    resultRecordCount: String(PAGE_SIZE),
    resultOffset: String(offset),
    orderByFields: "OBJECTID",
  });
  return `${SOURCE_URL}?${params.toString()}`;
}

async function fetchPage(offset: number): Promise<EsriFeatureSet> {
  const response = await fetch(buildQueryUrl(offset), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} from Kouga SG Properties`);
  const json = (await response.json()) as EsriFeatureSet;
  if (json.error) {
    throw new Error(
      `ArcGIS error: ${json.error.message ?? "unknown"} ${(json.error.details ?? []).join(" ")}`,
    );
  }
  return json;
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const records = new Map<string, Record<string, unknown>>();
  let offset = 0;
  let pages = 0;

  while (true) {
    const page = await fetchPage(offset);
    const features = page.features ?? [];
    pages += 1;
    for (const sourceFeature of features) {
      const feature = esriToFeature(sourceFeature);
      const attrs = sourceFeature.attributes ?? {};
      const centroid =
        numberValue(attrs.TAG_X) !== undefined && numberValue(attrs.TAG_Y) !== undefined
          ? { lng: numberValue(attrs.TAG_X)!, lat: numberValue(attrs.TAG_Y)! }
          : centroidForGeometry(feature?.geometry);
      if (!centroid) continue;

      const erf = clean(attrs.PARCEL_NO ?? attrs.TAG_VALUE);
      if (!erf) continue;
      const portion = clean(attrs.PORTION) ?? "0";
      const township = clean(attrs.MIN_REGION);
      const municipality = "Kouga";
      const province = clean(attrs.PROVINCE) ?? "EASTERN CAPE";
      const lpi = clean(attrs.ID);
      const parcelKey = clean(attrs.PRCL_KEY);
      const id = buildOfficialParcelId({
        source: "csg",
        lpi,
        parcelKey,
        erfNumber: erf,
        portion,
        municipality,
        province,
        lng: centroid.lng,
        lat: centroid.lat,
      });

      records.set(recordKey(attrs, id), {
        id,
        erf,
        portion,
        township,
        municipality,
        province,
        lpi,
        parcelKey,
        lat: centroid.lat,
        lng: centroid.lng,
        areaSqm: numberValue(attrs.GEOM_AREA ?? attrs.Shape__Area),
        sourceLayer: "csg-parcels",
        sourceLabel: SOURCE_LABEL,
        confidence: "source-backed",
        sourceQuality: "official_public_layer",
        properties: attrs,
        bounds: feature ? boundsForGeometry(feature) : undefined,
      });
    }

    offset += PAGE_SIZE;
    if (features.length < PAGE_SIZE && !page.exceededTransferLimit) break;
  }

  const payload = {
    metadata: {
      name: "Kouga / St Francis pilot parcel registry",
      pilotArea: "Kouga / St Francis pilot only",
      sourceUrl: SOURCE_URL,
      sourceLabel: SOURCE_LABEL,
      fetchedAt,
      recordCount: records.size,
      note: "Generated from the official Kouga SG Properties FeatureServer layer 32. This is not national erf search.",
    },
    records: Array.from(records.values()).sort((a, b) =>
      String(a.erf).localeCompare(String(b.erf), undefined, { numeric: true }),
    ),
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(payload)}\n`, "utf8");
  console.log(`Wrote ${payload.records.length} pilot parcel records to ${OUTPUT_PATH}`);
  console.log(`Pages fetched: ${pages}`);
  console.log(`Source: ${SOURCE_URL}`);
}

await main();
