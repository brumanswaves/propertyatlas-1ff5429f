// Kouga public GIS enrichment provider.
//
// Zoning endpoint is hardcoded (confirmed by the user).
// Properties (Surveyor-General) and Wards endpoints are configurable via env vars
// so they can be wired in once we discover them — we never fake matches.
//
//   VITE_KOUGA_PROPERTIES_SG_URL  (ArcGIS FeatureServer/MapServer .../query)
//   VITE_KOUGA_WARDS_URL          (ArcGIS FeatureServer/MapServer .../query)
//
// All three are queried by point (lng/lat) and return null when not configured
// or when no record is found.

export const KOUGA_ZONING_QUERY_URL =
  "https://services5.arcgis.com/DllnbBENKfts6TQD/ArcGIS/rest/services/Zoning/FeatureServer/1/query";

export const KOUGA_PROPERTIES_SG_URL =
  (import.meta.env.VITE_KOUGA_PROPERTIES_SG_URL as string | undefined) ?? null;

export const KOUGA_WARDS_URL =
  (import.meta.env.VITE_KOUGA_WARDS_URL as string | undefined) ?? null;

export interface KougaEnrichmentRecord {
  attributes: Record<string, unknown>;
  sourceUrl: string;
  fetchedAt: string;
}

export type KougaEnrichmentState =
  | { status: "ok"; record: KougaEnrichmentRecord }
  | { status: "not-found"; sourceUrl: string }
  | { status: "not-configured" }
  | { status: "error"; message: string; sourceUrl: string };

interface PointQueryOpts {
  endpoint: string;
  lng: number;
  lat: number;
  /** Buffer in metres around the point. Useful for layers whose features are polygons. */
  bufferMeters?: number;
}

function buildPointQueryUrl({ endpoint, lng, lat, bufferMeters = 0 }: PointQueryOpts): string {
  const geometry = JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } });
  const params = new URLSearchParams({
    where: "1=1",
    geometry,
    geometryType: "esriGeometryPoint",
    spatialRel: "esriSpatialRelIntersects",
    inSR: "4326",
    outSR: "4326",
    returnGeometry: "false",
    outFields: "*",
    resultRecordCount: "5",
    f: "json",
  });
  if (bufferMeters > 0) {
    params.set("distance", String(bufferMeters));
    params.set("units", "esriSRUnit_Meter");
  }
  return `${endpoint}?${params.toString()}`;
}

async function pointQuery(opts: PointQueryOpts): Promise<KougaEnrichmentState> {
  const url = buildPointQueryUrl(opts);
  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 6000);
    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal });
    } finally {
      window.clearTimeout(timeout);
    }
    if (!res.ok) return { status: "error", message: `HTTP ${res.status}`, sourceUrl: url };
    const json = (await res.json()) as { features?: Array<{ attributes?: Record<string, unknown> }>; error?: { message?: string } };
    if (json.error) return { status: "error", message: json.error.message ?? "Upstream error", sourceUrl: url };
    const feat = json.features?.[0];
    if (!feat?.attributes) return { status: "not-found", sourceUrl: url };
    return { status: "ok", record: { attributes: feat.attributes, sourceUrl: url, fetchedAt: new Date().toISOString() } };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "fetch failed", sourceUrl: url };
  }
}

export async function fetchKougaZoningAtPoint(lng: number, lat: number): Promise<KougaEnrichmentState> {
  return pointQuery({ endpoint: KOUGA_ZONING_QUERY_URL, lng, lat });
}

export async function fetchKougaPropertyAtPoint(lng: number, lat: number): Promise<KougaEnrichmentState> {
  if (!KOUGA_PROPERTIES_SG_URL) return { status: "not-configured" };
  return pointQuery({ endpoint: KOUGA_PROPERTIES_SG_URL, lng, lat });
}

export async function fetchKougaWardAtPoint(lng: number, lat: number): Promise<KougaEnrichmentState> {
  if (!KOUGA_WARDS_URL) return { status: "not-configured" };
  return pointQuery({ endpoint: KOUGA_WARDS_URL, lng, lat });
}

export interface KougaEnrichment {
  zoning: KougaEnrichmentState;
  property: KougaEnrichmentState;
  ward: KougaEnrichmentState;
}

export async function fetchKougaEnrichment(lng: number, lat: number): Promise<KougaEnrichment> {
  const [zoning, property, ward] = await Promise.all([
    fetchKougaZoningAtPoint(lng, lat),
    fetchKougaPropertyAtPoint(lng, lat),
    fetchKougaWardAtPoint(lng, lat),
  ]);
  return { zoning, property, ward };
}
