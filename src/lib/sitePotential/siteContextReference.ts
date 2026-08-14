import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { ImageEditReference } from "./generation";
import type { SitePotentialParcelContext } from "./parcelContext";
import { readServerEnv } from "./runtimeEnv";

const KOUGA_PARCEL_QUERY =
  "https://services6.arcgis.com/HrQQGPZkIr5BuMyY/arcgis/rest/services/Kouga_SG_Properties/FeatureServer/32/query";

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function propertyMatchesContext(
  properties: Record<string, unknown>,
  context: SitePotentialParcelContext,
) {
  const values = Object.values(properties).map(normalize).filter(Boolean);
  const exactCandidates = [context.lpi, context.parcelKey].map(normalize).filter(Boolean);
  if (exactCandidates.some((candidate) => values.includes(candidate))) return true;
  const erf = normalize(context.erfNumber);
  const portion = normalize(context.portion);
  return Boolean(erf && values.includes(erf) && (!portion || values.includes(portion)));
}

async function fetchParcelFeature(context: SitePotentialParcelContext) {
  if (!context.coordinates) return null;
  const delta = 0.0018;
  const { lng, lat } = context.coordinates;
  const params = new URLSearchParams({
    where: "1=1",
    geometry: JSON.stringify({
      xmin: lng - delta,
      ymin: lat - delta,
      xmax: lng + delta,
      ymax: lat + delta,
      spatialReference: { wkid: 4326 },
    }),
    geometryType: "esriGeometryEnvelope",
    spatialRel: "esriSpatialRelIntersects",
    inSR: "4326",
    outSR: "4326",
    returnGeometry: "true",
    outFields: "*",
    resultRecordCount: "40",
    f: "geojson",
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${KOUGA_PARCEL_QUERY}?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "application/geo+json,application/json" },
    });
    if (!response.ok) return null;
    const collection = (await response.json()) as FeatureCollection;
    const candidates = Array.isArray(collection.features) ? collection.features : [];
    return (
      candidates.find((feature) =>
        propertyMatchesContext((feature.properties ?? {}) as Record<string, unknown>, context),
      ) ??
      candidates[0] ??
      null
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function thinRing(ring: number[][], limit = 100) {
  if (ring.length <= limit) return ring;
  const step = Math.ceil(ring.length / limit);
  const thinned = ring.filter((_, index) => index % step === 0);
  const first = thinned[0];
  const last = thinned[thinned.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) thinned.push(first);
  return thinned;
}

function thinGeometry(geometry: Geometry): Geometry {
  if (geometry.type === "Polygon") {
    return { ...geometry, coordinates: geometry.coordinates.map((ring) => thinRing(ring)) };
  }
  if (geometry.type === "MultiPolygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((polygon) => polygon.map((ring) => thinRing(ring))),
    };
  }
  return geometry;
}

function styledParcelFeature(feature: Feature): Feature {
  return {
    type: "Feature",
    geometry: thinGeometry(feature.geometry),
    properties: {
      stroke: "#ff6a00",
      "stroke-width": 5,
      "stroke-opacity": 1,
      fill: "#ff6a00",
      "fill-opacity": 0.14,
    },
  };
}

function staticMapUrl(context: SitePotentialParcelContext, parcelFeature: Feature | null) {
  const token = readServerEnv("MAPBOX_ACCESS_TOKEN") || readServerEnv("VITE_MAPBOX_ACCESS_TOKEN");
  if (!token || !context.coordinates) return null;
  const { lng, lat } = context.coordinates;
  const pin = `pin-s+ff6a00(${lng},${lat})`;
  const overlays = [pin];
  if (parcelFeature?.geometry) {
    const overlay = `geojson(${encodeURIComponent(JSON.stringify(styledParcelFeature(parcelFeature)))})`;
    overlays.unshift(overlay);
  }
  let url = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${overlays.join(",")}/auto/1280x800?padding=90&logo=false&attribution=false&access_token=${encodeURIComponent(token)}`;
  if (url.length > 7800) {
    url = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${pin}/${lng},${lat},17,0/1280x800?logo=false&attribution=false&access_token=${encodeURIComponent(token)}`;
  }
  return url;
}

export async function buildAutomaticSiteContextReference(
  context: SitePotentialParcelContext | null,
): Promise<ImageEditReference | null> {
  if (!context?.coordinates) return null;
  const feature = await fetchParcelFeature(context);
  const url = staticMapUrl(context, feature);
  if (!url) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.byteLength) return null;
    return {
      bytes,
      mimeType: response.headers.get("content-type")?.split(";")[0] || "image/png",
      fileName: "easy-erf-official-site-map.png",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
