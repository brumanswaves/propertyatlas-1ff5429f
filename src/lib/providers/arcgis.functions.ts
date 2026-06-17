// Server-side proxy for ArcGIS REST endpoints (CSG Cadastral + Kouga Municipal GIS).
//
// Why server-side? Three reasons:
//   1) Browsers hit CORS errors on most ArcGIS endpoints; the worker doesn't.
//   2) We can apply an allow-list so an attacker can't proxy arbitrary URLs (SSRF).
//   3) We can swap to a licensed/permissioned source later without changing the client.
//
// We never store provider data — every call goes upstream live, with a short
// in-memory soft-cap on the bbox to keep payloads sane.

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

// Pilot-area bbox guard — Kouga / St Francis Bay region only.
const PILOT_BBOX = { xmin: 24.5, ymin: -34.4, xmax: 25.4, ymax: -33.9 };

const BboxInput = z.object({
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  layer: z.enum(["csg-parcels", "kouga-zoning"]),
  limit: z.number().int().min(1).max(1000).optional().default(400),
});

type ArcGisQuery = z.infer<typeof BboxInput>;

interface UpstreamConfig {
  url: string;
  attribution: string;
  source: string;
  outFields?: string;
}

const UPSTREAMS: Record<ArcGisQuery["layer"], UpstreamConfig> = {
  "csg-parcels": {
    url: "https://csggis.drdlr.gov.za/server/rest/services/CSGSearch/MapServer/2/query",
    source: "Chief Surveyor-General",
    attribution: "© Chief Surveyor-General, DRDLR (South Africa). Public viewer.",
    outFields: "*",
  },
  "kouga-zoning": {
    url: "https://services5.arcgis.com/DllnbBENKfts6TQD/ArcGIS/rest/services/Zoning/FeatureServer/1/query",
    source: "Kouga Municipality GIS",
    attribution: "© Kouga Local Municipality, Mapping Portal.",
    outFields: "*",
  },
};

// Fallback endpoints attempted when the primary fails or returns 0 features.
const FALLBACKS: Partial<Record<ArcGisQuery["layer"], UpstreamConfig>> = {
  "csg-parcels": {
    url: "https://dffeportal.environment.gov.za/hosting/rest/services/CSG_Cadaster/CSG_Cadastral_Data/MapServer/2/query",
    source: "DFFE CSG Cadastre Mirror",
    attribution: "© DFFE CSG Cadastre Mirror (public).",
    outFields: "*",
  },
};

function resolveUpstream(layer: ArcGisQuery["layer"]): UpstreamConfig {
  const cfg = UPSTREAMS[layer];
  if (layer === "kouga-zoning") {
    const envUrl = process.env.KOUGA_ZONING_SERVICE_URL?.trim();
    if (envUrl) return { ...cfg, url: envUrl };
  }
  return cfg;
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
    primaryStatus?: { reachable: boolean; count: number; message?: string };
    fallbackStatus?: { reachable: boolean; count: number; message?: string };
    upstreamUrl?: string;
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

function emptyCollection(cfg: UpstreamConfig, message: string): ArcGisFeatureCollection {
  return {
    type: "FeatureCollection",
    features: [],
    meta: {
      source: cfg.source,
      attribution: cfg.attribution,
      fetchedAt: new Date().toISOString(),
      upstreamReachable: false,
      upstreamMessage: message,
      count: 0,
    },
  };
}

async function fetchArcGis(cfg: UpstreamConfig, bbox: [number, number, number, number], limit: number): Promise<ArcGisFeatureCollection> {
  if (!cfg.url) return emptyCollection(cfg, "Upstream endpoint not yet configured.");

  let upstream: URL;
  try {
    upstream = new URL(cfg.url);
  } catch {
    return emptyCollection(cfg, "Invalid upstream URL configured.");
  }
  if (upstream.protocol !== "https:" || !ALLOWED_HOSTS.has(upstream.hostname)) {
    return emptyCollection(cfg, "Upstream host not in allow-list.");
  }

  const params = new URLSearchParams({
    where: "1=1",
    geometry: JSON.stringify({
      xmin: bbox[0], ymin: bbox[1], xmax: bbox[2], ymax: bbox[3],
      spatialReference: { wkid: 4326 },
    }),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    outSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: cfg.outFields ?? "*",
    resultRecordCount: String(limit),
    returnGeometry: "true",
    f: "geojson",
  });

  const target = `${upstream.toString()}?${params.toString()}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(target, {
      signal: controller.signal,
      headers: { Accept: "application/geo+json,application/json" },
    });
    if (!res.ok) return emptyCollection(cfg, `Upstream HTTP ${res.status}`);
    const json: unknown = await res.json();
    if (!json || typeof json !== "object" || (json as { type?: string }).type !== "FeatureCollection") {
      return emptyCollection(cfg, "Upstream returned non-GeoJSON.");
    }
    const fc = json as GeoJSON.FeatureCollection;
    return {
      type: "FeatureCollection",
      features: fc.features ?? [],
      meta: {
        source: cfg.source,
        attribution: cfg.attribution,
        fetchedAt: new Date().toISOString(),
        upstreamReachable: true,
        count: (fc.features ?? []).length,
        upstreamUrl: cfg.url,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upstream fetch failed";
    return emptyCollection(cfg, msg);
  } finally {
    clearTimeout(timeout);
  }
}

export const fetchArcGisLayer = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => BboxInput.parse(data))
  .handler(async ({ data }): Promise<ArcGisFeatureCollection> => {
    const cfg = resolveUpstream(data.layer);
    const clipped = clipToPilot(data.bbox);
    if (bboxArea(clipped) <= 0) {
      return emptyCollection(cfg, "Bbox outside pilot area (Kouga / St Francis).");
    }
    const primary = await fetchArcGis(cfg, clipped, data.limit);
    const primaryStatus = {
      reachable: primary.meta.upstreamReachable,
      count: primary.meta.count,
      message: primary.meta.upstreamMessage,
    };
    if (primary.meta.upstreamReachable && primary.meta.count > 0) {
      return { ...primary, meta: { ...primary.meta, activeSource: "primary", primaryStatus } };
    }
    const fb = FALLBACKS[data.layer];
    if (!fb) {
      return { ...primary, meta: { ...primary.meta, activeSource: "primary", primaryStatus } };
    }
    const fallback = await fetchArcGis(fb, clipped, data.limit);
    const fallbackStatus = {
      reachable: fallback.meta.upstreamReachable,
      count: fallback.meta.count,
      message: fallback.meta.upstreamMessage,
    };
    if (fallback.meta.upstreamReachable && fallback.meta.count > 0) {
      return { ...fallback, meta: { ...fallback.meta, activeSource: "fallback", primaryStatus, fallbackStatus } };
    }
    // Both failed/empty — return whichever has more diagnostic info (prefer primary's message).
    return { ...primary, meta: { ...primary.meta, activeSource: "primary", primaryStatus, fallbackStatus } };
  });

// Lightweight health probe used by /admin. HEAD on the MapServer root.
export const probeUpstream = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ layer: z.enum(["csg-parcels", "kouga-zoning"]) }).parse(data),
  )
  .handler(async ({ data }) => {
    const cfg = resolveUpstream(data.layer);
    if (!cfg.url) {
      return { ok: false, reachable: false, message: "Endpoint not configured" };
    }
    try {
      const url = new URL(cfg.url);
      url.search = "f=json";
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(url.toString(), { signal: ctrl.signal });
      clearTimeout(t);
      return { ok: res.ok, reachable: true, status: res.status };
    } catch (err) {
      return { ok: false, reachable: false, message: err instanceof Error ? err.message : "probe failed" };
    }
  });
