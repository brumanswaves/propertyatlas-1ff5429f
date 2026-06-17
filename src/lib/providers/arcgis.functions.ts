// Server-side proxy for ArcGIS REST endpoints (CSG Cadastral + Kouga Municipal GIS).
//
// Why server-side?
//   1) Browsers hit CORS errors on most ArcGIS endpoints; the worker doesn't.
//   2) We can apply an allow-list so an attacker can't proxy arbitrary URLs (SSRF).
//   3) We can swap to a licensed/permissioned source later without changing the client.
//
// We never store provider data — every call goes upstream live. The handler walks an
// ordered list of attempts (https primary → http primary → https fallback → http fallback;
// then f=geojson → f=json with ESRI conversion) and returns full per-attempt diagnostics
// so /admin/public-data-debug can show the real failure cause, not just "fetch failed".

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Allow-list of upstream hosts. Any host not listed here is rejected.
const ALLOWED_HOSTS = new Set<string>([
  "csggis.drdlr.gov.za",                  // Chief Surveyor-General (primary)
  "dffeportal.environment.gov.za",        // DFFE CSG Cadastre mirror (fallback)
  "services.arcgis.com",                  // ArcGIS Online (Kouga Hub feature services)
  "services1.arcgis.com",
  "services2.arcgis.com",
  "services3.arcgis.com",
  "services5.arcgis.com",
  "services6.arcgis.com",
  "services7.arcgis.com",
  "services8.arcgis.com",
  "services9.arcgis.com",
]);

// Plain HTTP is only permitted for these specific government hosts, as a deliberate
// fallback because they sometimes mis-serve TLS from cloud runtimes.
const HTTP_ALLOWED = new Set<string>([
  "csggis.drdlr.gov.za",
  "dffeportal.environment.gov.za",
]);

// Pilot-area bbox guard — Kouga / St Francis Bay region only.
const PILOT_BBOX = { xmin: 24.5, ymin: -34.4, xmax: 25.4, ymax: -33.9 };

const BboxInput = z.object({
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  layer: z.enum(["csg-parcels", "kouga-zoning"]),
  limit: z.number().int().min(1).max(1000).optional().default(400),
});

type ArcGisQuery = z.infer<typeof BboxInput>;

interface EndpointConfig {
  url: string;
  role: "primary" | "fallback";
}

interface UpstreamConfig {
  source: string;
  attribution: string;
  endpoints: EndpointConfig[]; // Tried in order
  outFields: string;
}

// Each layer can have several upstream URLs; the handler walks them in order.
// For CSG we try the live DRDLR service first (https then http) then the DFFE mirror.
const UPSTREAMS: Record<ArcGisQuery["layer"], UpstreamConfig> = {
  "csg-parcels": {
    source: "Chief Surveyor-General",
    attribution: "© Chief Surveyor-General, DRDLR (South Africa). Public viewer.",
    outFields: "*",
    endpoints: [
      { url: "https://csggis.drdlr.gov.za/server/rest/services/CSGSearch/MapServer/2/query", role: "primary" },
      { url: "http://csggis.drdlr.gov.za/server/rest/services/CSGSearch/MapServer/2/query", role: "primary" },
      { url: "https://dffeportal.environment.gov.za/hosting/rest/services/CSG_Cadaster/CSG_Cadastral_Data/MapServer/2/query", role: "fallback" },
      { url: "http://dffeportal.environment.gov.za/hosting/rest/services/CSG_Cadaster/CSG_Cadastral_Data/MapServer/2/query", role: "fallback" },
    ],
  },
  "kouga-zoning": {
    source: "Kouga Municipality GIS",
    attribution: "© Kouga Local Municipality, Mapping Portal.",
    outFields: "*",
    endpoints: [
      { url: "https://services5.arcgis.com/DllnbBENKfts6TQD/ArcGIS/rest/services/Zoning/FeatureServer/1/query", role: "primary" },
    ],
  },
};

function resolveUpstream(layer: ArcGisQuery["layer"]): UpstreamConfig {
  const cfg = UPSTREAMS[layer];
  if (layer === "kouga-zoning") {
    const envUrl = process.env.KOUGA_ZONING_SERVICE_URL?.trim();
    if (envUrl) return { ...cfg, endpoints: [{ url: envUrl, role: "primary" }, ...cfg.endpoints.slice(1)] };
  }
  return cfg;
}

export interface AttemptDiagnostic {
  endpoint: "primary" | "fallback";
  url: string;
  format: "geojson" | "json";
  ok: boolean;
  httpStatus?: number;
  count?: number;
  bodyPreview?: string;
  errorName?: string;
  errorMessage?: string;
  errorCauseCode?: string;
  errorCauseMessage?: string;
  durationMs: number;
}

export interface ArcGisFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSON.Feature[];
  meta: {
    source: string;
    attribution: string;
    fetchedAt: string;
    upstreamReachable: boolean;
    upstreamMessage?: string;
    count: number;
    activeSource?: "primary" | "fallback";
    activeUrl?: string;
    activeFormat?: "geojson" | "json";
    primaryStatus?: { reachable: boolean; count: number; message?: string };
    fallbackStatus?: { reachable: boolean; count: number; message?: string };
    upstreamUrl?: string;
    attempts: AttemptDiagnostic[];
    bboxUsed: [number, number, number, number];
    runtime: string;
  };
}

function clipToPilot(bbox: [number, number, number, number]): [number, number, number, number] {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return [
    Math.max(minLng, PILOT_BBOX.xmin),
    Math.max(minLat, PILOT_BBOX.ymin),
    Math.min(maxLng, PILOT_BBOX.xmax),
    Math.min(maxLat, PILOT_BBOX.ymax),
  ];
}

function bboxArea(b: [number, number, number, number]): number {
  return Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
}

function hostAllowed(u: URL): boolean {
  if (u.protocol === "https:") return ALLOWED_HOSTS.has(u.hostname);
  if (u.protocol === "http:") return HTTP_ALLOWED.has(u.hostname);
  return false;
}

function captureError(err: unknown): Pick<AttemptDiagnostic, "errorName" | "errorMessage" | "errorCauseCode" | "errorCauseMessage"> {
  const e = err as Error & { cause?: unknown };
  const cause = e?.cause as { code?: unknown; message?: unknown } | undefined;
  return {
    errorName: e?.name ?? "Error",
    errorMessage: e?.message ?? String(err),
    errorCauseCode: typeof cause?.code === "string" ? cause.code : cause?.code != null ? String(cause.code) : undefined,
    errorCauseMessage: typeof cause?.message === "string" ? cause.message : undefined,
  };
}

// Convert ESRI JSON FeatureSet to a GeoJSON FeatureCollection. Handles Polygon (rings),
// Point (x/y), and Polyline (paths). Holes/orientation are not normalized — Mapbox
// renders rings as polygon coordinates which is correct for visualization.
export function convertEsriFeatureSetToGeoJSON(esri: unknown): GeoJSON.FeatureCollection {
  const out: GeoJSON.Feature[] = [];
  const fs = (esri as { features?: Array<{ geometry?: Record<string, unknown>; attributes?: Record<string, unknown> }> })?.features ?? [];
  for (const f of fs) {
    const g = f.geometry ?? {};
    let geom: GeoJSON.Geometry | null = null;
    if (Array.isArray((g as { rings?: unknown }).rings)) {
      geom = { type: "Polygon", coordinates: (g as { rings: number[][][] }).rings };
    } else if (typeof (g as { x?: unknown }).x === "number" && typeof (g as { y?: unknown }).y === "number") {
      geom = { type: "Point", coordinates: [(g as { x: number }).x, (g as { y: number }).y] };
    } else if (Array.isArray((g as { paths?: unknown }).paths)) {
      geom = { type: "MultiLineString", coordinates: (g as { paths: number[][][] }).paths };
    }
    if (!geom) continue;
    out.push({ type: "Feature", geometry: geom, properties: (f.attributes ?? {}) as GeoJSON.GeoJsonProperties });
  }
  return { type: "FeatureCollection", features: out };
}

function buildQueryParams(bbox: [number, number, number, number], limit: number, outFields: string, format: "geojson" | "json"): URLSearchParams {
  return new URLSearchParams({
    where: "1=1",
    geometry: JSON.stringify({
      xmin: bbox[0], ymin: bbox[1], xmax: bbox[2], ymax: bbox[3],
      spatialReference: { wkid: 4326 },
    }),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    outSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields,
    resultRecordCount: String(limit),
    returnGeometry: "true",
    f: format,
  });
}

async function attemptFetch(
  endpoint: EndpointConfig,
  bbox: [number, number, number, number],
  limit: number,
  outFields: string,
  format: "geojson" | "json",
): Promise<{ diag: AttemptDiagnostic; features: GeoJSON.Feature[] }> {
  const started = Date.now();
  const diag: AttemptDiagnostic = {
    endpoint: endpoint.role,
    url: endpoint.url,
    format,
    ok: false,
    durationMs: 0,
  };

  let url: URL;
  try {
    url = new URL(endpoint.url);
  } catch {
    diag.errorMessage = "Invalid upstream URL";
    diag.durationMs = Date.now() - started;
    return { diag, features: [] };
  }
  if (!hostAllowed(url)) {
    diag.errorMessage = "Upstream host/protocol not in allow-list";
    diag.durationMs = Date.now() - started;
    return { diag, features: [] };
  }

  const target = `${endpoint.url}?${buildQueryParams(bbox, limit, outFields, format).toString()}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(target, {
      signal: controller.signal,
      headers: { Accept: format === "geojson" ? "application/geo+json,application/json" : "application/json" },
    });
    diag.httpStatus = res.status;
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      diag.bodyPreview = body.slice(0, 300);
      diag.errorMessage = `HTTP ${res.status}`;
      diag.durationMs = Date.now() - started;
      return { diag, features: [] };
    }
    const text = await res.text();
    diag.bodyPreview = text.slice(0, 300);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      Object.assign(diag, captureError(err));
      diag.errorMessage = `Non-JSON response: ${diag.errorMessage}`;
      diag.durationMs = Date.now() - started;
      return { diag, features: [] };
    }
    // ArcGIS sometimes returns 200 with {error:{code,message}}
    const maybeErr = (parsed as { error?: { code?: number; message?: string } }).error;
    if (maybeErr) {
      diag.errorMessage = `Upstream error ${maybeErr.code ?? ""}: ${maybeErr.message ?? "unknown"}`.trim();
      diag.durationMs = Date.now() - started;
      return { diag, features: [] };
    }
    let features: GeoJSON.Feature[] = [];
    if (format === "geojson") {
      const fc = parsed as GeoJSON.FeatureCollection;
      if (fc?.type !== "FeatureCollection") {
        diag.errorMessage = "Response was not a GeoJSON FeatureCollection";
        diag.durationMs = Date.now() - started;
        return { diag, features: [] };
      }
      features = fc.features ?? [];
    } else {
      features = convertEsriFeatureSetToGeoJSON(parsed).features;
    }
    diag.ok = true;
    diag.count = features.length;
    diag.durationMs = Date.now() - started;
    return { diag, features };
  } catch (err) {
    Object.assign(diag, captureError(err));
    diag.durationMs = Date.now() - started;
    return { diag, features: [] };
  } finally {
    clearTimeout(timeout);
  }
}

export const fetchArcGisLayer = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => BboxInput.parse(data))
  .handler(async ({ data }): Promise<ArcGisFeatureCollection> => {
    const cfg = resolveUpstream(data.layer);
    const clipped = clipToPilot(data.bbox);
    const runtime = typeof process !== "undefined" && process.env?.CF_PAGES ? "cloudflare-worker" : (typeof navigator !== "undefined" ? "node-or-worker" : "server");

    if (bboxArea(clipped) <= 0) {
      return {
        type: "FeatureCollection",
        features: [],
        meta: {
          source: cfg.source,
          attribution: cfg.attribution,
          fetchedAt: new Date().toISOString(),
          upstreamReachable: false,
          upstreamMessage: "Bbox outside pilot area (Kouga / St Francis).",
          count: 0,
          attempts: [],
          bboxUsed: clipped,
          runtime,
        },
      };
    }

    const attempts: AttemptDiagnostic[] = [];
    let chosen: { diag: AttemptDiagnostic; features: GeoJSON.Feature[] } | null = null;

    // Walk every endpoint, trying geojson then json. Stop on first success with ≥1 feature.
    for (const endpoint of cfg.endpoints) {
      for (const format of ["geojson", "json"] as const) {
        const result = await attemptFetch(endpoint, clipped, data.limit, cfg.outFields, format);
        attempts.push(result.diag);
        if (result.diag.ok && result.features.length > 0) {
          chosen = result;
          break;
        }
      }
      if (chosen) break;
    }

    // Build per-role summary status for the debug page.
    const primaryAttempts = attempts.filter((a) => a.endpoint === "primary");
    const fallbackAttempts = attempts.filter((a) => a.endpoint === "fallback");
    const summarize = (list: AttemptDiagnostic[]) => {
      if (list.length === 0) return undefined;
      const success = list.find((a) => a.ok && (a.count ?? 0) > 0);
      const last = list[list.length - 1];
      return {
        reachable: list.some((a) => a.httpStatus != null && a.httpStatus < 500),
        count: success?.count ?? 0,
        message: success ? undefined : (last.errorMessage ?? (last.httpStatus ? `HTTP ${last.httpStatus}` : "no features")),
      };
    };

    if (chosen) {
      return {
        type: "FeatureCollection",
        features: chosen.features,
        meta: {
          source: cfg.source,
          attribution: cfg.attribution,
          fetchedAt: new Date().toISOString(),
          upstreamReachable: true,
          count: chosen.features.length,
          activeSource: chosen.diag.endpoint,
          activeUrl: chosen.diag.url,
          activeFormat: chosen.diag.format,
          upstreamUrl: chosen.diag.url,
          primaryStatus: summarize(primaryAttempts),
          fallbackStatus: summarize(fallbackAttempts),
          attempts,
          bboxUsed: clipped,
          runtime,
        },
      };
    }

    const lastMsg = attempts[attempts.length - 1]?.errorMessage ?? "Upstream fetch failed";
    return {
      type: "FeatureCollection",
      features: [],
      meta: {
        source: cfg.source,
        attribution: cfg.attribution,
        fetchedAt: new Date().toISOString(),
        upstreamReachable: false,
        upstreamMessage: lastMsg,
        count: 0,
        primaryStatus: summarize(primaryAttempts),
        fallbackStatus: summarize(fallbackAttempts),
        attempts,
        bboxUsed: clipped,
        runtime,
      },
    };
  });

// Lightweight health probe used by /admin. HEAD on the MapServer root.
export const probeUpstream = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ layer: z.enum(["csg-parcels", "kouga-zoning"]) }).parse(data),
  )
  .handler(async ({ data }) => {
    const cfg = resolveUpstream(data.layer);
    const endpoint = cfg.endpoints[0];
    if (!endpoint) return { ok: false, reachable: false, message: "Endpoint not configured" };
    try {
      const url = new URL(endpoint.url);
      url.search = "f=json";
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(url.toString(), { signal: ctrl.signal });
      clearTimeout(t);
      return { ok: res.ok, reachable: true, status: res.status };
    } catch (err) {
      const cap = captureError(err);
      return { ok: false, reachable: false, message: cap.errorMessage, causeCode: cap.errorCauseCode };
    }
  });
