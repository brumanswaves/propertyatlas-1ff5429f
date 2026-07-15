type LayerId = "csg-parcels" | "kouga-zoning";
type Bbox = [number, number, number, number];
type JsonGeometry = { type: "Polygon" | "Point" | "MultiLineString"; coordinates: unknown };
type JsonFeature = { type: "Feature"; geometry: JsonGeometry; properties: Record<string, unknown> };
type JsonFeatureCollection = { type: "FeatureCollection"; features: JsonFeature[] };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const layers: Record<LayerId, { sourceLabel: string; endpoints: string[] }> = {
  "csg-parcels": {
    sourceLabel: "Kouga SG Properties (Public Mapping Viewer)",
    endpoints: [
      "https://services6.arcgis.com/HrQQGPZkIr5BuMyY/arcgis/rest/services/Kouga_SG_Properties/FeatureServer/32/query",
      "https://csggis.drdlr.gov.za/server/rest/services/CSGSearch/MapServer/2/query",
      "https://dffeportal.environment.gov.za/hosting/rest/services/CSG_Cadaster/CSG_Cadastral_Data/MapServer/2/query",
    ],
  },
  "kouga-zoning": {
    sourceLabel: "Kouga Municipality GIS",
    endpoints: ["https://services5.arcgis.com/DllnbBENKfts6TQD/ArcGIS/rest/services/Zoning/FeatureServer/1/query"],
  },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isLayer(value: unknown): value is LayerId {
  return value === "csg-parcels" || value === "kouga-zoning";
}

function isBbox(value: unknown): value is Bbox {
  return Array.isArray(value) && value.length === 4 && value.every((v) => typeof v === "number" && Number.isFinite(v));
}

function buildUrl(endpoint: string, bbox: Bbox, limit: number, format: "geojson" | "json") {
  const params = new URLSearchParams({
    where: "1=1",
    geometry: JSON.stringify({ xmin: bbox[0], ymin: bbox[1], xmax: bbox[2], ymax: bbox[3], spatialReference: { wkid: 4326 } }),
    geometryType: "esriGeometryEnvelope",
    spatialRel: "esriSpatialRelIntersects",
    inSR: "4326",
    outSR: "4326",
    returnGeometry: "true",
    outFields: "*",
    resultRecordCount: String(limit),
    f: format,
  });
  return `${endpoint}?${params.toString()}`;
}

function convertEsriToGeoJSON(esri: unknown): JsonFeatureCollection {
  const out: JsonFeature[] = [];
  const features = (esri as { features?: Array<{ geometry?: Record<string, unknown>; attributes?: Record<string, unknown> }> })?.features ?? [];
  for (const feature of features) {
    const g = feature.geometry ?? {};
    let geometry: JsonGeometry | null = null;
    if (Array.isArray((g as { rings?: unknown }).rings)) {
      geometry = { type: "Polygon", coordinates: (g as { rings: number[][][] }).rings };
    } else if (typeof (g as { x?: unknown }).x === "number" && typeof (g as { y?: unknown }).y === "number") {
      geometry = { type: "Point", coordinates: [(g as { x: number }).x, (g as { y: number }).y] };
    } else if (Array.isArray((g as { paths?: unknown }).paths)) {
      geometry = { type: "MultiLineString", coordinates: (g as { paths: number[][][] }).paths };
    }
    if (geometry) out.push({ type: "Feature", geometry, properties: (feature.attributes ?? {}) as Record<string, unknown> });
  }
  return { type: "FeatureCollection", features: out };
}

async function attempt(layer: LayerId, endpoint: string, bbox: Bbox, limit: number, format: "geojson" | "json") {
  const started = Date.now();
  const requestUrl = buildUrl(endpoint, bbox, limit, format);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    const res = await fetch(requestUrl, {
      signal: controller.signal,
      headers: { Accept: format === "geojson" ? "application/geo+json,application/json" : "application/json" },
    }).finally(() => clearTimeout(timeout));
    const text = await res.text();
    const responsePreview = text.slice(0, 500);
    if (!res.ok) {
      return { method: "edge", layer, requestUrl, ok: false, httpStatus: res.status, errorMessage: `HTTP ${res.status}`, responsePreview, fallbackUsed: "edge", durationMs: Date.now() - started };
    }
    const parsed = JSON.parse(text);
    const upstreamError = parsed?.error;
    if (upstreamError) {
      return { method: "edge", layer, requestUrl, ok: false, httpStatus: res.status, errorMessage: `Upstream error ${upstreamError.code ?? ""}: ${upstreamError.message ?? "unknown"}`.trim(), responsePreview, fallbackUsed: "edge", durationMs: Date.now() - started };
    }
    const fc = format === "json" ? convertEsriToGeoJSON(parsed) : parsed as JsonFeatureCollection;
    if (fc?.type !== "FeatureCollection" || !Array.isArray(fc.features)) {
      return { method: "edge", layer, requestUrl, ok: false, httpStatus: res.status, errorMessage: "Response was not a GeoJSON FeatureCollection", responsePreview, fallbackUsed: "edge", durationMs: Date.now() - started };
    }
    return { method: "edge", layer, requestUrl, ok: true, httpStatus: res.status, featureCount: fc.features.length, responsePreview, fallbackUsed: "edge", durationMs: Date.now() - started, features: fc.features };
  } catch (err) {
    return { method: "edge", layer, requestUrl, ok: false, errorMessage: err instanceof Error ? err.message : "fetch failed", fallbackUsed: "edge", durationMs: Date.now() - started };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { layer?: unknown; bbox?: unknown; limit?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!isLayer(body.layer)) return json({ error: "Invalid layer" }, 400);
  if (!isBbox(body.bbox)) return json({ error: "Invalid bbox" }, 400);
  const limit = Math.min(Math.max(typeof body.limit === "number" && Number.isFinite(body.limit) ? Math.floor(body.limit) : 400, 1), 1000);
  const cfg = layers[body.layer];
  const attempts = [];

  for (const endpoint of cfg.endpoints) {
    let geojsonOk = false;
    for (const format of ["geojson", "json"] as const) {
      if (format === "json" && geojsonOk) break;
      const result = await attempt(body.layer, endpoint, body.bbox, limit, format);
      const { features, ...diag } = result as typeof result & { features?: JsonFeature[] };
      attempts.push(diag);
      if (result.ok && features && features.length > 0) {
        return json({
          type: "FeatureCollection",
          features,
          layer: body.layer,
          sourceLabel: cfg.sourceLabel,
          official: true,
          fallbackUsed: "edge",
          fetchedAt: new Date().toISOString(),
          attempts,
        });
      }
      if (format === "geojson" && result.ok) geojsonOk = true;
    }
  }

  return json({
    type: "FeatureCollection",
    features: [],
    layer: body.layer,
    sourceLabel: cfg.sourceLabel,
    official: false,
    fallbackUsed: "edge",
    fetchedAt: new Date().toISOString(),
    attempts,
    message: attempts.some((a) => a.ok && a.featureCount === 0) ? `${cfg.sourceLabel} returned 0 features.` : `${cfg.sourceLabel} proxy fetch failed.`,
  });
});