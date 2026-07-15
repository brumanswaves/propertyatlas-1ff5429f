import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadOfficialPublicLayer,
  testDirectFetch,
  PUBLIC_LAYER_CONFIG,
  type PublicBbox,
} from "../publicDataClient";

// Node test env lacks `window`; fetchWithTimeout uses window.set/clearTimeout.
(globalThis as unknown as { window: unknown }).window = globalThis;

const BBOX: PublicBbox = [24.83, -34.19, 24.84, -34.18];

const SAMPLE_FEATURE: GeoJSON.Feature = {
  type: "Feature",
  geometry: { type: "Polygon", coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]] },
  properties: { id: 1 },
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function edgeUrl() {
  const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, "");
  return `${base}/functions/v1/arcgis-public-proxy`;
}

function directGeojsonUrls(layer: keyof typeof PUBLIC_LAYER_CONFIG) {
  return PUBLIC_LAYER_CONFIG[layer].endpoints.map((e) => `${e}?`);
}

describe("loadOfficialPublicLayer edge-first ordering", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("returns edge proxy features without calling direct fetch", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        calls.push(url);
        if (url.startsWith(edgeUrl())) {
          return jsonResponse({
            type: "FeatureCollection",
            features: [SAMPLE_FEATURE],
            fetchedAt: "2026-01-01T00:00:00Z",
          });
        }
        throw new Error(`unexpected direct fetch: ${url}`);
      }),
    );

    const result = await loadOfficialPublicLayer("csg-parcels", BBOX);
    expect(result.features).toHaveLength(1);
    expect(result.fallbackUsed).toBe("edge");
    // No direct-fetch attempts occurred.
    expect(calls.filter((u) => u.startsWith("https://services"))).toHaveLength(0);
  });

  it("falls back to direct fetch when the edge proxy returns zero features", async () => {
    let directCalled = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.startsWith(edgeUrl())) {
          return jsonResponse({ type: "FeatureCollection", features: [] });
        }
        directCalled++;
        return jsonResponse({ type: "FeatureCollection", features: [SAMPLE_FEATURE] });
      }),
    );

    const result = await loadOfficialPublicLayer("csg-parcels", BBOX);
    expect(directCalled).toBeGreaterThan(0);
    expect(result.features).toHaveLength(1);
    expect(result.fallbackUsed).toBe("direct");
  });

  it("falls back to direct fetch when the edge proxy request fails", async () => {
    let directCalled = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.startsWith(edgeUrl())) {
          return new Response("boom", { status: 500 });
        }
        directCalled++;
        return jsonResponse({ type: "FeatureCollection", features: [SAMPLE_FEATURE] });
      }),
    );

    const result = await loadOfficialPublicLayer("csg-parcels", BBOX);
    expect(directCalled).toBeGreaterThan(0);
    expect(result.features).toHaveLength(1);
    // Attempts preserve execution order: edge first, then direct.
    expect(result.attempts[0].method).toBe("edge");
    expect(result.attempts.some((a) => a.method === "direct" && a.ok)).toBe(true);
  });
});

describe("testDirectFetch GeoJSON-first behavior", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("does not retry as JSON when GeoJSON is a valid zero-feature FeatureCollection", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        calls.push(url);
        return jsonResponse({ type: "FeatureCollection", features: [] });
      }),
    );

    const result = await testDirectFetch("kouga-zoning", BBOX);
    expect(result.features).toHaveLength(0);
    // Only one call per endpoint — no JSON retry.
    const endpoints = PUBLIC_LAYER_CONFIG["kouga-zoning"].endpoints.length;
    expect(calls).toHaveLength(endpoints);
    for (const url of calls) {
      expect(url).toContain("f=geojson");
      expect(url).not.toContain("f=json&");
    }
    // Every attempt is the geojson request; none are the json retry.
    for (const a of result.attempts) {
      expect(a.requestUrl).toContain("f=geojson");
    }
  });

  it("retries the same endpoint as JSON when GeoJSON is an ArcGIS error envelope", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        calls.push(url);
        if (url.includes("f=geojson")) {
          return jsonResponse({ error: { code: 400, message: "bad format" } });
        }
        // JSON retry succeeds with an Esri feature set.
        return jsonResponse({
          features: [
            {
              geometry: { rings: [[[0, 0], [0, 1], [1, 1], [0, 0]]] },
              attributes: { id: 1 },
            },
          ],
        });
      }),
    );

    const result = await testDirectFetch("kouga-zoning", BBOX);
    expect(result.features).toHaveLength(1);
    expect(calls.some((u) => u.includes("f=geojson"))).toBe(true);
    expect(calls.some((u) => u.includes("f=json"))).toBe(true);
  });
});
