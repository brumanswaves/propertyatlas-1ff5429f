export type PublicLayerId = "csg-parcels" | "kouga-zoning";
export type PublicBbox = [number, number, number, number];

export type PublicDataFallback = "edge" | "direct" | "static" | "test" | "official-link-only";

export interface PublicDataAttempt {
  method: PublicDataFallback;
  layer: PublicLayerId;
  requestUrl: string;
  ok: boolean;
  httpStatus?: number;
  featureCount?: number;
  errorMessage?: string;
  responsePreview?: string;
  fallbackUsed: PublicDataFallback;
}

export interface PublicDataResult {
  type: "FeatureCollection";
  features: GeoJSON.Feature[];
  layer: PublicLayerId;
  sourceLabel: string;
  official: boolean;
  fallbackUsed: PublicDataFallback;
  fetchedAt: string;
  attempts: PublicDataAttempt[];
  message?: string;
}

interface EndpointConfig {
  sourceLabel: string;
  officialSourceUrl: string;
  staticUrl?: string;
  testUrl: string;
  endpoints: string[];
}

export interface PublicParcelIdentitySearchInput {
  erfNumber?: string | number | null;
  portion?: string | number | null;
  lpi?: string | null;
  parcelKey?: string | null;
  areaText?: string | null;
  limit?: number;
}

export const PUBLIC_LAYER_CONFIG: Record<PublicLayerId, EndpointConfig> = {
  "csg-parcels": {
    sourceLabel: "Kouga SG Properties (Public Mapping Viewer)",
    officialSourceUrl:
      "https://experience.arcgis.com/experience/e498b2a5005a4d278eb7f32984676140/page/Main-Map",
    testUrl: "/data/test-csg-parcels.geojson",
    endpoints: [
      // PRIMARY: Kouga Public Mapping Viewer — SG Properties layer 32 (FeatureServer, CORS-enabled)
      "https://services6.arcgis.com/HrQQGPZkIr5BuMyY/arcgis/rest/services/Kouga_SG_Properties/FeatureServer/32/query",
      // Fallback: National CSG endpoints (frequently rate-limited / CORS-restricted from browser)
      "https://csggis.drdlr.gov.za/server/rest/services/CSGSearch/MapServer/2/query",
      "https://dffeportal.environment.gov.za/hosting/rest/services/CSG_Cadaster/CSG_Cadastral_Data/MapServer/2/query",
    ],
  },
  "kouga-zoning": {
    sourceLabel: "Kouga Municipality GIS",
    officialSourceUrl: "https://mapping-kouga.hub.arcgis.com/",
    testUrl: "/data/test-kouga-zoning.geojson",
    endpoints: [
      "https://services5.arcgis.com/DllnbBENKfts6TQD/ArcGIS/rest/services/Zoning/FeatureServer/1/query",
    ],
  },
};

function nowIso() {
  return new Date().toISOString();
}

function emptyResult(
  layer: PublicLayerId,
  attempts: PublicDataAttempt[],
  message: string,
): PublicDataResult {
  return {
    type: "FeatureCollection",
    features: [],
    layer,
    sourceLabel: PUBLIC_LAYER_CONFIG[layer].sourceLabel,
    official: false,
    fallbackUsed: "official-link-only",
    fetchedAt: nowIso(),
    attempts,
    message,
  };
}

function buildArcGisUrl(
  endpoint: string,
  bbox: PublicBbox,
  limit: number,
  format: "geojson" | "json",
) {
  const params = new URLSearchParams({
    where: "1=1",
    geometry: JSON.stringify({
      xmin: bbox[0],
      ymin: bbox[1],
      xmax: bbox[2],
      ymax: bbox[3],
      spatialReference: { wkid: 4326 },
    }),
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

function escapeSqlText(value: string) {
  return value.replace(/'/g, "''");
}

function cleanIdentityValue(value: string | number | null | undefined) {
  const text = String(value ?? "").trim();
  return text || null;
}

function numericIdentityValue(value: string | number | null | undefined) {
  const text = cleanIdentityValue(value);
  if (!text) return null;
  const digits = text.replace(/\D/g, "");
  return digits || null;
}

export function buildPublicParcelIdentityWhere(input: PublicParcelIdentitySearchInput) {
  const clauses: string[] = [];
  const erf = numericIdentityValue(input.erfNumber);
  const portion = numericIdentityValue(input.portion);
  const lpi = cleanIdentityValue(input.lpi);
  const parcelKey = cleanIdentityValue(input.parcelKey);

  if (lpi) clauses.push(`ID='${escapeSqlText(lpi)}'`);
  if (parcelKey) clauses.push(`PRCL_KEY='${escapeSqlText(parcelKey)}'`);
  if (erf) {
    const erfClauses = [`PARCEL_NO=${Number(erf)}`, `TAG_VALUE='${escapeSqlText(erf)}'`];
    clauses.push(`(${erfClauses.join(" OR ")})`);
  }
  if (portion) clauses.push(`(PORTION=${Number(portion)} OR PORTION='${escapeSqlText(portion)}')`);

  return clauses.length ? clauses.join(" AND ") : null;
}

function buildArcGisIdentitySearchUrl(
  endpoint: string,
  input: PublicParcelIdentitySearchInput,
  format: "geojson" | "json",
) {
  const where = buildPublicParcelIdentityWhere(input);
  if (!where) return null;
  const params = new URLSearchParams({
    where,
    outSR: "4326",
    returnGeometry: "true",
    outFields: "*",
    resultRecordCount: String(input.limit ?? 25),
    f: format,
  });
  return `${endpoint}?${params.toString()}`;
}

export function convertEsriFeatureSetToGeoJSON(esri: unknown): GeoJSON.FeatureCollection {
  const out: GeoJSON.Feature[] = [];
  const features =
    (
      esri as {
        features?: Array<{
          geometry?: Record<string, unknown>;
          attributes?: Record<string, unknown>;
        }>;
      }
    )?.features ?? [];
  for (const feature of features) {
    const g = feature.geometry ?? {};
    let geometry: GeoJSON.Geometry | null = null;
    if (Array.isArray((g as { rings?: unknown }).rings)) {
      geometry = { type: "Polygon", coordinates: (g as { rings: number[][][] }).rings };
    } else if (
      typeof (g as { x?: unknown }).x === "number" &&
      typeof (g as { y?: unknown }).y === "number"
    ) {
      geometry = { type: "Point", coordinates: [(g as { x: number }).x, (g as { y: number }).y] };
    } else if (Array.isArray((g as { paths?: unknown }).paths)) {
      geometry = { type: "MultiLineString", coordinates: (g as { paths: number[][][] }).paths };
    }
    if (geometry)
      out.push({
        type: "Feature",
        geometry,
        properties: (feature.attributes ?? {}) as GeoJSON.GeoJsonProperties,
      });
  }
  return { type: "FeatureCollection", features: out };
}

function normalizeFeatureCollection(
  value: unknown,
  format: "geojson" | "json",
): GeoJSON.FeatureCollection | null {
  if (format === "json") return convertEsriFeatureSetToGeoJSON(value);
  const fc = value as GeoJSON.FeatureCollection;
  if (fc?.type === "FeatureCollection" && Array.isArray(fc.features)) return fc;
  return null;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function parseGeoJsonResponse(res: Response, format: "geojson" | "json") {
  const text = await res.text();
  const preview = text.slice(0, 500);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Non-JSON response: ${err instanceof Error ? err.message : "parse failed"}`);
  }
  const upstreamError = (parsed as { error?: { code?: number; message?: string } })?.error;
  if (upstreamError)
    throw new Error(
      `Upstream error ${upstreamError.code ?? ""}: ${upstreamError.message ?? "unknown"}`.trim(),
    );
  const fc = normalizeFeatureCollection(parsed, format);
  if (!fc) throw new Error("Response was not a GeoJSON FeatureCollection");
  return { fc, preview };
}

export async function testEdgeProxy(
  layer: PublicLayerId,
  bbox: PublicBbox,
  limit = 400,
): Promise<PublicDataResult> {
  const attempts: PublicDataAttempt[] = [];
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;
  const requestUrl = base
    ? `${base.replace(/\/$/, "")}/functions/v1/arcgis-public-proxy`
    : "Supabase URL not configured";
  if (!base || !key) {
    attempts.push({
      method: "edge",
      layer,
      requestUrl,
      ok: false,
      errorMessage: "Backend function URL/key not configured",
      fallbackUsed: "edge",
    });
    return emptyResult(layer, attempts, "Backend function URL/key not configured.");
  }
  try {
    const res = await fetchWithTimeout(requestUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ layer, bbox, limit }),
    });
    const text = await res.text();
    const preview = text.slice(0, 500);
    if (!res.ok) {
      attempts.push({
        method: "edge",
        layer,
        requestUrl,
        ok: false,
        httpStatus: res.status,
        errorMessage: `HTTP ${res.status}`,
        responsePreview: preview,
        fallbackUsed: "edge",
      });
      return emptyResult(layer, attempts, `Backend proxy returned HTTP ${res.status}.`);
    }
    const parsed = JSON.parse(text) as PublicDataResult & {
      meta?: { attempts?: PublicDataAttempt[] };
    };
    const features = Array.isArray(parsed.features) ? parsed.features : [];
    attempts.push({
      method: "edge",
      layer,
      requestUrl,
      ok: true,
      httpStatus: res.status,
      featureCount: features.length,
      responsePreview: preview,
      fallbackUsed: "edge",
    });
    if (Array.isArray(parsed.attempts)) attempts.push(...parsed.attempts);
    return {
      type: "FeatureCollection",
      features,
      layer,
      sourceLabel: PUBLIC_LAYER_CONFIG[layer].sourceLabel,
      official: features.length > 0,
      fallbackUsed: "edge",
      fetchedAt: parsed.fetchedAt ?? nowIso(),
      attempts,
      message: parsed.message,
    };
  } catch (err) {
    attempts.push({
      method: "edge",
      layer,
      requestUrl,
      ok: false,
      errorMessage: err instanceof Error ? err.message : "fetch failed",
      fallbackUsed: "edge",
    });
    return emptyResult(
      layer,
      attempts,
      err instanceof Error ? err.message : "Backend proxy fetch failed.",
    );
  }
}

export async function testDirectFetch(
  layer: PublicLayerId,
  bbox: PublicBbox,
  limit = 400,
): Promise<PublicDataResult> {
  const attempts: PublicDataAttempt[] = [];
  for (const endpoint of PUBLIC_LAYER_CONFIG[layer].endpoints) {
    // Try GeoJSON first for this endpoint. Only fall through to the JSON retry
    // when the GeoJSON attempt fails, is non-JSON, or is an ArcGIS error — a
    // valid FeatureCollection with zero features skips the redundant retry.
    let retryAsJson = false;
    let validEmptyGeoJson = false;
    const geojsonUrl = buildArcGisUrl(endpoint, bbox, limit, "geojson");
    try {
      const res = await fetchWithTimeout(
        geojsonUrl,
        { headers: { Accept: "application/geo+json,application/json" } },
        9000,
      );
      if (!res.ok) {
        const preview = (await res.text().catch(() => "")).slice(0, 500);
        attempts.push({
          method: "direct",
          layer,
          requestUrl: geojsonUrl,
          ok: false,
          httpStatus: res.status,
          errorMessage: `HTTP ${res.status}`,
          responsePreview: preview,
          fallbackUsed: "direct",
        });
        retryAsJson = true;
      } else {
        try {
          const { fc, preview } = await parseGeoJsonResponse(res, "geojson");
          attempts.push({
            method: "direct",
            layer,
            requestUrl: geojsonUrl,
            ok: true,
            httpStatus: res.status,
            featureCount: fc.features.length,
            responsePreview: preview,
            fallbackUsed: "direct",
          });
          if (fc.features.length > 0) {
            return {
              type: "FeatureCollection",
              features: fc.features,
              layer,
              sourceLabel: PUBLIC_LAYER_CONFIG[layer].sourceLabel,
              official: true,
              fallbackUsed: "direct",
              fetchedAt: nowIso(),
              attempts,
            };
          }
          validEmptyGeoJson = true;
        } catch (parseErr) {
          // Non-JSON, malformed, or ArcGIS `error` envelope — worth retrying as JSON.
          attempts.push({
            method: "direct",
            layer,
            requestUrl: geojsonUrl,
            ok: false,
            httpStatus: res.status,
            errorMessage: parseErr instanceof Error ? parseErr.message : "parse failed",
            fallbackUsed: "direct",
          });
          retryAsJson = true;
        }
      }
    } catch (err) {
      attempts.push({
        method: "direct",
        layer,
        requestUrl: geojsonUrl,
        ok: false,
        errorMessage: err instanceof Error ? err.message : "fetch failed",
        fallbackUsed: "direct",
      });
      retryAsJson = true;
    }

    if (validEmptyGeoJson || !retryAsJson) continue;

    const jsonUrl = buildArcGisUrl(endpoint, bbox, limit, "json");
    try {
      const res = await fetchWithTimeout(
        jsonUrl,
        { headers: { Accept: "application/json" } },
        9000,
      );
      if (!res.ok) {
        const preview = (await res.text().catch(() => "")).slice(0, 500);
        attempts.push({
          method: "direct",
          layer,
          requestUrl: jsonUrl,
          ok: false,
          httpStatus: res.status,
          errorMessage: `HTTP ${res.status}`,
          responsePreview: preview,
          fallbackUsed: "direct",
        });
        continue;
      }
      const { fc, preview } = await parseGeoJsonResponse(res, "json");
      attempts.push({
        method: "direct",
        layer,
        requestUrl: jsonUrl,
        ok: true,
        httpStatus: res.status,
        featureCount: fc.features.length,
        responsePreview: preview,
        fallbackUsed: "direct",
      });
      if (fc.features.length > 0) {
        return {
          type: "FeatureCollection",
          features: fc.features,
          layer,
          sourceLabel: PUBLIC_LAYER_CONFIG[layer].sourceLabel,
          official: true,
          fallbackUsed: "direct",
          fetchedAt: nowIso(),
          attempts,
        };
      }
    } catch (err) {
      attempts.push({
        method: "direct",
        layer,
        requestUrl: jsonUrl,
        ok: false,
        errorMessage: err instanceof Error ? err.message : "fetch failed",
        fallbackUsed: "direct",
      });
    }
  }
  return emptyResult(
    layer,
    attempts,
    `${PUBLIC_LAYER_CONFIG[layer].sourceLabel} direct browser fetch failed or returned 0 features.`,
  );
}

export async function testStaticGeoJson(
  layer: PublicLayerId,
  test = false,
): Promise<PublicDataResult> {
  const cfg = PUBLIC_LAYER_CONFIG[layer];
  const requestUrl = test ? cfg.testUrl : cfg.staticUrl;
  const method: PublicDataFallback = test ? "test" : "static";
  const attempts: PublicDataAttempt[] = [];
  if (!requestUrl) {
    attempts.push({
      method,
      layer,
      requestUrl: "No imported official GeoJSON configured",
      ok: false,
      errorMessage: "No imported official GeoJSON configured.",
      fallbackUsed: method,
    });
    return emptyResult(layer, attempts, "No imported official GeoJSON configured.");
  }
  try {
    const res = await fetch(requestUrl, { cache: "no-cache" });
    const text = await res.text().catch(() => "");
    const preview = text.slice(0, 500);
    if (!res.ok) {
      attempts.push({
        method,
        layer,
        requestUrl,
        ok: false,
        httpStatus: res.status,
        errorMessage: test ? `HTTP ${res.status}` : "No imported public GeoJSON file found.",
        responsePreview: preview,
        fallbackUsed: method,
      });
      return emptyResult(
        layer,
        attempts,
        test
          ? `Test geometry file returned HTTP ${res.status}.`
          : "No imported public GeoJSON file found.",
      );
    }
    const parsed = JSON.parse(text) as GeoJSON.FeatureCollection;
    if (parsed?.type !== "FeatureCollection" || !Array.isArray(parsed.features))
      throw new Error("File is not a valid GeoJSON FeatureCollection");
    attempts.push({
      method,
      layer,
      requestUrl,
      ok: true,
      httpStatus: res.status,
      featureCount: parsed.features.length,
      responsePreview: preview,
      fallbackUsed: method,
    });
    return {
      type: "FeatureCollection",
      features: parsed.features,
      layer,
      sourceLabel: test ? "TEST GEOMETRY ONLY" : "Imported Official Public GeoJSON",
      official: !test && parsed.features.length > 0,
      fallbackUsed: method,
      fetchedAt: nowIso(),
      attempts,
      message: test ? "TEST GEOMETRY ONLY — not official data." : undefined,
    };
  } catch (err) {
    attempts.push({
      method,
      layer,
      requestUrl,
      ok: false,
      errorMessage: err instanceof Error ? err.message : "fetch failed",
      fallbackUsed: method,
    });
    return emptyResult(
      layer,
      attempts,
      test ? "Test geometry could not load." : "No imported public GeoJSON file found.",
    );
  }
}

export async function loadOfficialPublicLayer(
  layer: PublicLayerId,
  bbox: PublicBbox,
  limit = 400,
): Promise<PublicDataResult> {
  const attempts: PublicDataAttempt[] = [];

  // PRIMARY: edge proxy — server-side ArcGIS fetch avoids browser CORS,
  // upstream rate-limiting quirks, and ad/tracker blockers.
  const edge = await testEdgeProxy(layer, bbox, limit);
  attempts.push(...edge.attempts);
  if (edge.features.length > 0) return { ...edge, attempts, official: true };

  // SECONDARY: direct browser fetch (Kouga SG Properties layer 32 is CORS-enabled).
  const direct = await testDirectFetch(layer, bbox, limit);
  attempts.push(...direct.attempts);
  if (direct.features.length > 0) return { ...direct, attempts, official: true };

  // TERTIARY: imported static GeoJSON file
  const stat = await testStaticGeoJson(layer, false);
  attempts.push(...stat.attempts);
  if (stat.features.length > 0)
    return { ...stat, attempts, official: true, sourceLabel: "Imported Official Public GeoJSON" };

  const missingStatic = stat.attempts.some(
    (a) => a.errorMessage === "No imported public GeoJSON file found.",
  );
  return emptyResult(
    layer,
    attempts,
    missingStatic
      ? "Official parcel data is temporarily unavailable. Try again or open source maps."
      : "Official parcel data is temporarily unavailable. Try again or open source maps.",
  );
}

export async function searchOfficialPublicParcelsByIdentity(
  input: PublicParcelIdentitySearchInput,
): Promise<PublicDataResult> {
  const layer: PublicLayerId = "csg-parcels";
  const attempts: PublicDataAttempt[] = [];
  for (const endpoint of PUBLIC_LAYER_CONFIG[layer].endpoints) {
    for (const format of ["geojson", "json"] as const) {
      const requestUrl = buildArcGisIdentitySearchUrl(endpoint, input, format);
      if (!requestUrl) {
        return emptyResult(
          layer,
          attempts,
          "Enter an erf number, LPI, or parcel key to search official public data.",
        );
      }
      try {
        const res = await fetchWithTimeout(
          requestUrl,
          {
            headers: {
              Accept:
                format === "geojson" ? "application/geo+json,application/json" : "application/json",
            },
          },
          9000,
        );
        if (!res.ok) {
          const preview = (await res.text().catch(() => "")).slice(0, 500);
          attempts.push({
            method: "direct",
            layer,
            requestUrl,
            ok: false,
            httpStatus: res.status,
            errorMessage: `HTTP ${res.status}`,
            responsePreview: preview,
            fallbackUsed: "direct",
          });
          continue;
        }
        const { fc, preview } = await parseGeoJsonResponse(res, format);
        const features = fc.features;
        attempts.push({
          method: "direct",
          layer,
          requestUrl,
          ok: true,
          httpStatus: res.status,
          featureCount: features.length,
          responsePreview: preview,
          fallbackUsed: "direct",
        });
        if (features.length > 0) {
          return {
            type: "FeatureCollection",
            features,
            layer,
            sourceLabel: PUBLIC_LAYER_CONFIG[layer].sourceLabel,
            official: true,
            fallbackUsed: "direct",
            fetchedAt: nowIso(),
            attempts,
          };
        }
      } catch (err) {
        attempts.push({
          method: "direct",
          layer,
          requestUrl,
          ok: false,
          errorMessage: err instanceof Error ? err.message : "fetch failed",
          fallbackUsed: "direct",
        });
      }
    }
  }

  return emptyResult(
    layer,
    attempts,
    "No official match found from the available public layer yet. Try adding township/area, LPI, parcel key, or click the parcel outline.",
  );
}
