// Kouga public GIS enrichment provider.
//
// Zoning endpoint is hardcoded (confirmed). Properties (Surveyor-General) and
// Wards endpoints are configurable via env vars and were discovered from the
// Kouga Public Mapping Viewer ArcGIS services. We never fake matches.
//
//   VITE_KOUGA_PROPERTIES_SG_URL  (ArcGIS FeatureServer .../query)
//   VITE_KOUGA_WARDS_URL          (ArcGIS FeatureServer .../query)
//
// Queries always use f=json (never f=pbf), returnGeometry=false, outFields=*,
// and never include objectIds. Property and ward queries fall back from a
// point query to a small envelope around the point when no feature is found.

export const KOUGA_ZONING_QUERY_URL =
  "https://services5.arcgis.com/DllnbBENKfts6TQD/ArcGIS/rest/services/Zoning/FeatureServer/1/query";

export const KOUGA_PROPERTIES_SG_URL =
  (import.meta.env.VITE_KOUGA_PROPERTIES_SG_URL as string | undefined) ?? null;

export const KOUGA_WARDS_URL =
  (import.meta.env.VITE_KOUGA_WARDS_URL as string | undefined) ?? null;

export type MatchMethod = "point" | "envelope";

export interface KougaEnrichmentRecord {
  attributes: Record<string, unknown>;
  sourceUrl: string;
  fetchedAt: string;
  matchMethod: MatchMethod;
  featureCount: number;
}

export type KougaEnrichmentState =
  | { status: "ok"; record: KougaEnrichmentRecord; attemptUrls: string[] }
  | { status: "not-found"; sourceUrl: string; attemptUrls: string[] }
  | { status: "not-configured" }
  | { status: "error"; message: string; sourceUrl: string; httpStatus?: number; attemptUrls: string[] };

interface PointOpts {
  endpoint: string;
  lng: number;
  lat: number;
}

function buildPointQueryUrl({ endpoint, lng, lat }: PointOpts): string {
  const geometry = `${lng},${lat}`;
  const params = new URLSearchParams({
    f: "json",
    where: "1=1",
    outFields: "*",
    returnGeometry: "false",
    spatialRel: "esriSpatialRelIntersects",
    geometryType: "esriGeometryPoint",
    geometry,
    inSR: "4326",
    outSR: "4326",
    resultRecordCount: "5",
  });
  return `${endpoint}?${params.toString()}`;
}

function buildEnvelopeQueryUrl({ endpoint, lng, lat }: PointOpts, halfDeg = 0.00025): string {
  // ~25 m envelope at SA latitudes — small enough to stay on the same parcel/ward.
  const env = {
    xmin: lng - halfDeg,
    ymin: lat - halfDeg,
    xmax: lng + halfDeg,
    ymax: lat + halfDeg,
    spatialReference: { wkid: 4326 },
  };
  const params = new URLSearchParams({
    f: "json",
    where: "1=1",
    outFields: "*",
    returnGeometry: "false",
    spatialRel: "esriSpatialRelIntersects",
    geometryType: "esriGeometryEnvelope",
    geometry: JSON.stringify(env),
    inSR: "4326",
    outSR: "4326",
    resultRecordCount: "5",
  });
  return `${endpoint}?${params.toString()}`;
}

interface FetchOutcome {
  url: string;
  ok: boolean;
  features: Array<{ attributes?: Record<string, unknown> }>;
  errorMessage?: string;
  httpStatus?: number;
}

async function runQuery(url: string): Promise<FetchOutcome> {
  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 6000);
    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal });
    } finally {
      window.clearTimeout(timeout);
    }
    if (!res.ok) {
      return { url, ok: false, features: [], errorMessage: `HTTP ${res.status}`, httpStatus: res.status };
    }
    const json = (await res.json()) as {
      features?: Array<{ attributes?: Record<string, unknown> }>;
      error?: { message?: string };
    };
    if (json.error) {
      return { url, ok: false, features: [], errorMessage: json.error.message ?? "Upstream error" };
    }
    return { url, ok: true, features: json.features ?? [] };
  } catch (err) {
    return { url, ok: false, features: [], errorMessage: err instanceof Error ? err.message : "fetch failed" };
  }
}

async function queryWithFallback(opts: PointOpts, allowEnvelope: boolean): Promise<KougaEnrichmentState> {
  const attemptUrls: string[] = [];
  const pointUrl = buildPointQueryUrl(opts);
  attemptUrls.push(pointUrl);
  const pointRes = await runQuery(pointUrl);
  if (pointRes.ok && pointRes.features.length > 0 && pointRes.features[0].attributes) {
    return {
      status: "ok",
      attemptUrls,
      record: {
        attributes: pointRes.features[0].attributes,
        sourceUrl: pointUrl,
        fetchedAt: new Date().toISOString(),
        matchMethod: "point",
        featureCount: pointRes.features.length,
      },
    };
  }
  if (!pointRes.ok && !allowEnvelope) {
    return { status: "error", message: pointRes.errorMessage ?? "fetch failed", sourceUrl: pointUrl, httpStatus: pointRes.httpStatus, attemptUrls };
  }

  if (allowEnvelope) {
    const envUrl = buildEnvelopeQueryUrl(opts);
    attemptUrls.push(envUrl);
    const envRes = await runQuery(envUrl);
    if (envRes.ok && envRes.features.length > 0 && envRes.features[0].attributes) {
      return {
        status: "ok",
        attemptUrls,
        record: {
          attributes: envRes.features[0].attributes,
          sourceUrl: envUrl,
          fetchedAt: new Date().toISOString(),
          matchMethod: "envelope",
          featureCount: envRes.features.length,
        },
      };
    }
    if (!envRes.ok && !pointRes.ok) {
      return { status: "error", message: envRes.errorMessage ?? pointRes.errorMessage ?? "fetch failed", sourceUrl: envUrl, httpStatus: envRes.httpStatus ?? pointRes.httpStatus, attemptUrls };
    }
  }

  if (!pointRes.ok) {
    return { status: "error", message: pointRes.errorMessage ?? "fetch failed", sourceUrl: pointUrl, httpStatus: pointRes.httpStatus, attemptUrls };
  }
  return { status: "not-found", sourceUrl: pointUrl, attemptUrls };
}

export async function fetchKougaZoningAtPoint(lng: number, lat: number): Promise<KougaEnrichmentState> {
  return queryWithFallback({ endpoint: KOUGA_ZONING_QUERY_URL, lng, lat }, false);
}

export async function fetchKougaPropertyAtPoint(lng: number, lat: number): Promise<KougaEnrichmentState> {
  if (!KOUGA_PROPERTIES_SG_URL) return { status: "not-configured" };
  return queryWithFallback({ endpoint: KOUGA_PROPERTIES_SG_URL, lng, lat }, true);
}

export async function fetchKougaWardAtPoint(lng: number, lat: number): Promise<KougaEnrichmentState> {
  if (!KOUGA_WARDS_URL) return { status: "not-configured" };
  return queryWithFallback({ endpoint: KOUGA_WARDS_URL, lng, lat }, true);
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

// Helpers for resilient field reads — pick first present attribute.
export function pickAttr(attrs: Record<string, unknown> | undefined, keys: string[]): unknown {
  if (!attrs) return undefined;
  for (const k of keys) {
    if (attrs[k] !== undefined && attrs[k] !== null && attrs[k] !== "") return attrs[k];
  }
  return undefined;
}
