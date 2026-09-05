import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  PROPERTIES,
  ST_FRANCIS_CENTER,
  propertiesToCentroidGeoJSON,
  propertiesToGeoJSON,
  formatZAR,
  type Property,
} from "@/data/properties";
import { AlertTriangle } from "lucide-react";
import {
  extractOfficialFeatureIdentity,
  isOfficialPointParcelId,
  officialFeatureMatchesSavedParcelId,
  type OfficialFeatureLayer,
  type OfficialParcelReopenRequest,
} from "@/lib/parcels/officialParcelId";
import {
  loadOfficialPublicLayer,
  testStaticGeoJson,
  type PublicDataResult,
} from "@/lib/providers/publicDataClient";
import type { OfficialParcelFeature } from "@/lib/search/officialParcelIndex";

const TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;

export type MapStyleId = "satellite" | "streets" | "terrain" | "dark";

export const STYLE_URLS: Record<MapStyleId, string> = {
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  streets: "mapbox://styles/mapbox/streets-v12",
  terrain: "mapbox://styles/mapbox/outdoors-v12",
  dark: "mapbox://styles/mapbox/dark-v11",
};

export interface MapLayers {
  parcels: boolean;
  zoning: boolean;
  csgParcels: boolean;
  kougaZoning: boolean;
  investorHeat: boolean;
  developmentHeat: boolean;
  oceanViewHeat: boolean;
  appreciationHeat: boolean;
  rentalHeat: boolean;
  longHeldHeat: boolean;
  sellerHeat: boolean;
}

export interface OfficialFeatureSelection {
  source: "Chief Surveyor-General" | "Kouga Municipality GIS";
  layer: "csg-parcels" | "kouga-zoning";
  properties: Record<string, unknown>;
  /** Official parcel geometry, when the feature carried one. */
  geometry?: GeoJSON.Geometry | null;
  lngLat: [number, number];
}


export interface OfficialLayerStatus {
  csg: {
    state: "off" | "loading" | "loaded" | "empty" | "imported" | "test" | "failed";
    count: number;
    message?: string;
    source?: string;
  };
  kouga: {
    state: "off" | "loading" | "loaded" | "empty" | "imported" | "test" | "failed";
    count: number;
    message?: string;
    source?: string;
  };
}

export interface OfficialReopenTarget {
  lng: number;
  lat: number;
  zoom: number;
}

export type OfficialReopenResolutionStatus = "idle" | "searching" | "resolved" | "not-found";

export interface AddressSearchTarget {
  address: string;
  lng: number;
  lat: number;
}

export interface SearchHighlightOfficialParcel {
  id: string;
  title: string;
  confidence?: "exact_official_match" | "address_inside_official_parcel" | "likely_nearby_parcel" | "address_only" | "no_match";
  layer: OfficialFeatureLayer;
  properties: Record<string, unknown>;
  lngLat: [number, number];
  bounds?: [number, number, number, number];
  lpi?: string;
  parcelKey?: string;
  erf?: string;
  portion?: string;
  town?: string;
  municipality?: string;
  province?: string;
}

export type SearchHighlightStatus = "idle" | "searching" | "highlighted" | "fallback";

export interface MapDebugStatus {
  mapLoaded: boolean;
  csgSourceExists: boolean;
  csgLayerExists: boolean;
  kougaSourceExists: boolean;
  kougaLayerExists: boolean;
}

interface Props {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  filterFn?: (p: Property) => boolean;
  layers: MapLayers;
  mapStyle: MapStyleId;
  showTestGeometry?: boolean;
  onSelectOfficial?: (sel: OfficialFeatureSelection | null) => void;
  onOfficialStatus?: (s: OfficialLayerStatus) => void;
  officialReopenTarget?: OfficialReopenTarget | null;
  officialReopenRequest?: OfficialParcelReopenRequest | null;
  onOfficialReopenStatus?: (status: OfficialReopenResolutionStatus) => void;
  onDebugStatus?: (status: MapDebugStatus) => void;
  locateRequestId?: number;
  onLocateResult?: (message: string | null) => void;
  onOfficialFeaturesChange?: (features: OfficialParcelFeature[]) => void;
  addressSearchTarget?: AddressSearchTarget | null;
  searchHighlightOfficialParcel?: SearchHighlightOfficialParcel | null;
  onSearchHighlightStatus?: (status: SearchHighlightStatus) => void;
}

const TYPE_COLOR: Record<string, string> = {
  Residential: "#5cbdb9",
  Commercial: "#a78bfa",
  Industrial: "#fb923c",
  Agricultural: "#86efac",
  "Vacant Land": "#fde68a",
};

// Brand palette (mirrors styles.css Sunrise Sand)
const C_OCEAN = "#1a3a52";
const C_TEAL = "#5cbdb9";
const C_GOLD = "#d4842a";
const C_SAND = "#faf5ec";
const C_SEAGREEN = "#3ea58f";
const C_CORAL = "#e08562";

const OFFICIAL_REOPEN_FILL_LAYERS: Record<OfficialFeatureLayer, string> = {
  "csg-parcels": "csg-parcels-fill",
  "kouga-zoning": "kouga-zoning-fill",
};

function officialLayerSource(layer: OfficialFeatureLayer): OfficialFeatureSelection["source"] {
  return layer === "csg-parcels" ? "Chief Surveyor-General" : "Kouga Municipality GIS";
}

function layersForOfficialReopenRequest(
  request: OfficialParcelReopenRequest,
): OfficialFeatureLayer[] {
  const id = request.id.trim().toLowerCase();
  if (id.startsWith("csg:")) return ["csg-parcels"];
  if (id.startsWith("kouga:")) return ["kouga-zoning"];
  return ["csg-parcels", "kouga-zoning"];
}

function officialReopenLayersReady(
  map: mapboxgl.Map,
  request: OfficialParcelReopenRequest,
): boolean {
  return layersForOfficialReopenRequest(request).some((layer) => {
    const renderedLayerId = OFFICIAL_REOPEN_FILL_LAYERS[layer];
    return (
      Boolean(map.getSource(layer)) &&
      Boolean(map.getLayer(renderedLayerId)) &&
      map.getLayoutProperty(renderedLayerId, "visibility") !== "none"
    );
  });
}

function featureSelectionPoint(
  feature: mapboxgl.MapboxGeoJSONFeature,
  request: OfficialParcelReopenRequest,
  map: mapboxgl.Map,
): [number, number] {
  if (request.lng !== undefined && request.lat !== undefined) return [request.lng, request.lat];
  const center = map.getCenter();
  const geometry = feature.geometry;
  if (!geometry || geometry.type === "GeometryCollection") return [center.lng, center.lat];

  const coordinates: [number, number][] = [];
  const collect = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (
      value.length >= 2 &&
      typeof value[0] === "number" &&
      typeof value[1] === "number" &&
      Number.isFinite(value[0]) &&
      Number.isFinite(value[1])
    ) {
      coordinates.push([value[0], value[1]]);
      return;
    }
    for (const item of value) collect(item);
  };
  collect((geometry as { coordinates?: unknown }).coordinates);
  if (coordinates.length === 0) return [center.lng, center.lat];

  let west = coordinates[0][0];
  let east = coordinates[0][0];
  let south = coordinates[0][1];
  let north = coordinates[0][1];
  for (const [lng, lat] of coordinates) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return [(west + east) / 2, (south + north) / 2];
}

function dedupeRenderedFeatures(
  features: mapboxgl.MapboxGeoJSONFeature[],
): mapboxgl.MapboxGeoJSONFeature[] {
  const seen = new Set<string>();
  return features.filter((feature, index) => {
    const layer = feature.layer?.id ?? "unknown";
    const id = feature.id ?? feature.properties?.OBJECTID ?? feature.properties?.ID ?? index;
    const key = `${layer}:${String(id)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function queryOfficialReopenFeatures(
  map: mapboxgl.Map,
  request: OfficialParcelReopenRequest,
): Array<{ feature: mapboxgl.MapboxGeoJSONFeature; layer: OfficialFeatureLayer }> {
  const candidateLayers = layersForOfficialReopenRequest(request).filter((layer) =>
    map.getLayer(OFFICIAL_REOPEN_FILL_LAYERS[layer]),
  );
  if (candidateLayers.length === 0) return [];

  const renderedLayerIds = candidateLayers.map((layer) => OFFICIAL_REOPEN_FILL_LAYERS[layer]);
  const mapFeature = (feature: mapboxgl.MapboxGeoJSONFeature) => {
    const matchedLayer = candidateLayers.find(
      (layer) => OFFICIAL_REOPEN_FILL_LAYERS[layer] === feature.layer?.id,
    );
    return matchedLayer ? { feature, layer: matchedLayer } : null;
  };
  const toLayeredFeatures = (features: mapboxgl.MapboxGeoJSONFeature[]) =>
    dedupeRenderedFeatures(features)
      .map(mapFeature)
      .filter(
        (item): item is { feature: mapboxgl.MapboxGeoJSONFeature; layer: OfficialFeatureLayer } =>
          Boolean(item),
      );

  const pointFeatures: Array<{
    feature: mapboxgl.MapboxGeoJSONFeature;
    layer: OfficialFeatureLayer;
  }> = [];

  if (request.lng !== undefined && request.lat !== undefined) {
    const point = map.project([request.lng, request.lat]);
    const radii = isOfficialPointParcelId(request.id) ? [6, 14] : [8, 24, 64, 120];
    for (const radius of radii) {
      const box: [mapboxgl.PointLike, mapboxgl.PointLike] = [
        [point.x - radius, point.y - radius],
        [point.x + radius, point.y + radius],
      ];
      const features = toLayeredFeatures(
        map.queryRenderedFeatures(box, { layers: renderedLayerIds }),
      );
      if (features.length > 0) {
        pointFeatures.push(...features);
        break;
      }
    }
  }

  if (isOfficialPointParcelId(request.id)) return pointFeatures;

  const viewportFeatures = toLayeredFeatures(
    map.queryRenderedFeatures({ layers: renderedLayerIds }),
  );
  const seen = new Set<string>();
  return [...pointFeatures, ...viewportFeatures].filter(({ feature, layer }, index) => {
    const id = feature.id ?? feature.properties?.OBJECTID ?? feature.properties?.ID ?? index;
    const key = `${layer}:${String(id)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findMatchingOfficialReopenFeature(
  map: mapboxgl.Map,
  request: OfficialParcelReopenRequest,
): { feature: mapboxgl.MapboxGeoJSONFeature; layer: OfficialFeatureLayer } | null {
  const candidates = queryOfficialReopenFeatures(map, request);
  if (isOfficialPointParcelId(request.id)) return candidates[0] ?? null;
  return (
    candidates.find(({ feature, layer }) =>
      officialFeatureMatchesSavedParcelId(
        request.id,
        layer,
        (feature.properties ?? {}) as Record<string, unknown>,
      ),
    ) ?? null
  );
}

function findMatchingSearchHighlightFeature(
  map: mapboxgl.Map,
  request: SearchHighlightOfficialParcel,
): { feature: mapboxgl.MapboxGeoJSONFeature; layer: OfficialFeatureLayer } | null {
  const reopenLikeRequest: OfficialParcelReopenRequest = {
    id: request.id,
    fromSaved: false,
    lng: request.lngLat[0],
    lat: request.lngLat[1],
    zoom: 18,
  };
  const idMatch = findMatchingOfficialReopenFeature(map, reopenLikeRequest);
  if (idMatch) return idMatch;

  const candidates = queryOfficialReopenFeatures(map, reopenLikeRequest);
  return (
    candidates.find(({ feature, layer }) => {
      const identity = extractOfficialFeatureIdentity(
        layer,
        (feature.properties ?? {}) as Record<string, unknown>,
      );
      if (request.lpi && identity.lpi === request.lpi) return true;
      if (request.parcelKey && identity.parcelKey === request.parcelKey) return true;
      if (!request.erf || identity.erfNumber !== request.erf) return false;
      if ((identity.portion ?? "0") !== (request.portion ?? "0")) return false;

      const context = [
        identity.municipality,
        identity.province,
        feature.properties?.MIN_REGION,
        feature.properties?.MINOR_REGION,
        feature.properties?.MAJ_REGION,
        feature.properties?.MAJOR_REGION,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const requestedContext = [request.town, request.municipality, request.province]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return Boolean(
        requestedContext &&
        context &&
        requestedContext.split(/\s+/).some((term) => context.includes(term)),
      );
    }) ?? null
  );
}

function webglSupported(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function MapCanvas({
  selectedId,
  onSelect,
  filterFn,
  layers,
  mapStyle,
  showTestGeometry = false,
  onSelectOfficial,
  onOfficialStatus,
  officialReopenTarget,
  officialReopenRequest,
  onOfficialReopenStatus,
  onDebugStatus,
  locateRequestId = 0,
  onLocateResult,
  onOfficialFeaturesChange,
  addressSearchTarget,
  searchHighlightOfficialParcel,
  onSearchHighlightStatus,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const pulseMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const userLocationMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const addressSearchMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const searchHighlightMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const selectedOfficialFeatureRef = useRef<{
    source: OfficialFeatureLayer;
    id: string | number;
  } | null>(null);
  const officialFeaturesRef = useRef<Record<OfficialFeatureLayer, OfficialParcelFeature[]>>({
    "csg-parcels": [],
    "kouga-zoning": [],
  });
  const currentStyleRef = useRef<MapStyleId | null>(null);
  const [ready, setReady] = useState(false);
  const [styleVersion, setStyleVersion] = useState(0);
  const [mapError, setMapError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [layerMessages, setLayerMessages] = useState<{ csg?: string; kouga?: string }>({});
  const [officialDataVersion, setOfficialDataVersion] = useState(0);

  const filtered = useMemo(() => (filterFn ? PROPERTIES.filter(filterFn) : PROPERTIES), [filterFn]);
  const filteredIds = useMemo(() => new Set(filtered.map((p) => p.id)), [filtered]);
  const publishOfficialFeatures = useCallback(() => {
    onOfficialFeaturesChange?.([
      ...officialFeaturesRef.current["csg-parcels"],
      ...officialFeaturesRef.current["kouga-zoning"],
    ]);
  }, [onOfficialFeaturesChange]);

  useEffect(() => {
    if (!onDebugStatus) return;
    const map = mapRef.current;
    onDebugStatus({
      mapLoaded: Boolean(map && ready),
      csgSourceExists: Boolean(map?.getSource("csg-parcels")),
      csgLayerExists: Boolean(map?.getLayer("csg-parcels-fill")),
      kougaSourceExists: Boolean(map?.getSource("kouga-zoning")),
      kougaLayerExists: Boolean(map?.getLayer("kouga-zoning-fill")),
    });
  }, [onDebugStatus, ready, styleVersion, officialDataVersion, layers]);

  const clearOfficialSelectedFeature = useCallback((map: mapboxgl.Map) => {
    const selected = selectedOfficialFeatureRef.current;
    if (selected && map.getSource(selected.source)) {
      map.setFeatureState({ source: selected.source, id: selected.id }, { selected: false });
    }
    selectedOfficialFeatureRef.current = null;
  }, []);

  const selectOfficialFeature = useCallback(
    (
      map: mapboxgl.Map,
      feature: mapboxgl.MapboxGeoJSONFeature,
      layer: OfficialFeatureLayer,
      lngLat: [number, number],
    ) => {
      if (!onSelectOfficial) return;
      clearOfficialSelectedFeature(map);
      if (feature.id !== undefined && feature.id !== null && map.getSource(layer)) {
        map.setFeatureState({ source: layer, id: feature.id }, { selected: true });
        selectedOfficialFeatureRef.current = { source: layer, id: feature.id };
      }
      onSelect(null);
      onSelectOfficial({
        source: officialLayerSource(layer),
        layer,
        properties: (feature.properties ?? {}) as Record<string, unknown>,
        geometry: (feature.geometry ?? null) as GeoJSON.Geometry | null,
        lngLat,
      });

    },
    [clearOfficialSelectedFeature, onSelect, onSelectOfficial],
  );

  // Init map
  useEffect(() => {
    if (!TOKEN || !containerRef.current || mapRef.current) return;

    if (!webglSupported()) {
      console.error("[ErfStoep] WebGL is not available in this browser");
      setMapError(
        "Your browser blocked WebGL, which the map needs to render. If you're using Lockdown Mode or Low Power Mode on iPhone, disable it for this site, then tap Retry.",
      );
      return;
    }

    mapboxgl.accessToken = TOKEN;
    let map: mapboxgl.Map;
    try {
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: STYLE_URLS[mapStyle],
        center: ST_FRANCIS_CENTER,
        zoom: 14,
        pitch: 0,
        attributionControl: false,
        cooperativeGestures: false,
      });
    } catch (err) {
      console.error("[ErfStoep] Map failed to initialize", err);
      setMapError(
        "The map engine failed to start on this device. Tap Retry, or try reloading the page.",
      );
      return;
    }

    map.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true, showCompass: true }),
      "bottom-right",
    );
    map.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      "bottom-right",
    );
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");
    map.on("load", () => {
      console.log("[ErfStoep] Map loaded");
      map.resize();
      setReady(true);
    });
    map.on("error", (e) => {
      console.error("[ErfStoep] Map error:", e.error?.message ?? e);
    });
    map.on("style.load", () => setStyleVersion((v) => v + 1));

    const canvas = map.getCanvas();
    const onContextLost = () => {
      console.warn("[ErfStoep] WebGL context lost — recreating map");
      setMapError(
        "The map's graphics context was interrupted (this can happen on mobile). Tap Retry to reload it.",
      );
    };
    canvas.addEventListener("webglcontextlost", onContextLost);

    const t1 = window.setTimeout(() => map.resize(), 400);
    const t2 = window.setTimeout(() => map.resize(), 1500);

    mapRef.current = map;
    currentStyleRef.current = mapStyle;
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      pulseMarkerRef.current?.remove();
      pulseMarkerRef.current = null;
      userLocationMarkerRef.current?.remove();
      userLocationMarkerRef.current = null;
      addressSearchMarkerRef.current?.remove();
      addressSearchMarkerRef.current = null;
      searchHighlightMarkerRef.current?.remove();
      searchHighlightMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey]);

  // Switch style
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (currentStyleRef.current === mapStyle) return;
    currentStyleRef.current = mapStyle;
    map.setStyle(STYLE_URLS[mapStyle]);
  }, [mapStyle]);

  useEffect(() => {
    if (!locateRequestId) return;
    const map = mapRef.current;
    if (!map || !ready) return;

    const unavailableMessage =
      "Location permission was not granted. You can still search by address, suburb, erf number, LPI, or parcel key.";
    if (!("geolocation" in navigator)) {
      onLocateResult?.(unavailableMessage);
      return;
    }

    onLocateResult?.("Locating you...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lngLat: [number, number] = [position.coords.longitude, position.coords.latitude];
        const accuracy = position.coords.accuracy;
        const hasAccuracy = Number.isFinite(accuracy) && accuracy > 0;
        const targetZoom =
          hasAccuracy && accuracy > 150 ? 16 : hasAccuracy && accuracy > 60 ? 17 : 18;
        map.flyTo({
          center: lngLat,
          zoom: targetZoom,
          duration: 1100,
          essential: true,
          curve: 1.35,
        });

        userLocationMarkerRef.current?.remove();
        const el = document.createElement("div");
        el.className =
          "h-5 w-5 rounded-full border-2 border-white bg-[#FF6A00] shadow-[0_0_0_8px_rgba(255,106,0,0.18),0_0_0_18px_rgba(255,106,0,0.08),0_10px_24px_rgba(13,27,42,0.28)]";
        userLocationMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat(lngLat)
          .addTo(map);

        if (hasAccuracy) {
          const roundedAccuracy = Math.max(1, Math.round(accuracy));
          const suffix =
            accuracy > 100
              ? " Approximate location. Search or click a parcel for official erf research."
              : " Search or click a parcel for official erf research.";
          onLocateResult?.(`Location accuracy: about ${roundedAccuracy} meters.${suffix}`);
        } else {
          onLocateResult?.(
            "Map centered on your approximate location. Search or click a parcel for official erf research.",
          );
        }
      },
      () => onLocateResult?.(unavailableMessage),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, [locateRequestId, onLocateResult, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !addressSearchTarget) return;

    const lngLat: [number, number] = [addressSearchTarget.lng, addressSearchTarget.lat];
    map.flyTo({
      center: lngLat,
      zoom: Math.max(map.getZoom(), 17.5),
      duration: 1000,
      essential: true,
      curve: 1.35,
    });

    addressSearchMarkerRef.current?.remove();
    const el = document.createElement("div");
    el.className =
      "h-6 w-6 rounded-full border-2 border-white bg-[#0D1B2A] shadow-[0_0_0_8px_rgba(255,106,0,0.18),0_10px_24px_rgba(13,27,42,0.28)]";
    el.title = addressSearchTarget.address;
    addressSearchMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
      .setLngLat(lngLat)
      .addTo(map);
  }, [addressSearchTarget, ready]);

  // Add sources + layers (re-run on every style load)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const ensureSetup = () => {
      // Guard on the LAYER (style switches can preserve sources but drop layers).
      if (map.getLayer("parcels-fill")) return;
      if (!map.getSource("parcels")) {
        map.addSource("parcels", {
          type: "geojson",
          data: propertiesToGeoJSON(PROPERTIES),
          promoteId: "id",
        });
      }
      if (!map.getSource("parcel-centroids")) {
        map.addSource("parcel-centroids", {
          type: "geojson",
          data: propertiesToCentroidGeoJSON(PROPERTIES),
          promoteId: "id",
        });
      }

      // ===== Parcel fill — zoom-reveal: subtle at low zoom, vivid at high zoom =====
      map.addLayer({
        id: "parcels-fill",
        type: "fill",
        source: "parcels",
        paint: {
          "fill-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            C_GOLD,
            ["boolean", ["feature-state", "hover"], false],
            C_GOLD,
            ["boolean", ["feature-state", "filtered"], true],
            C_TEAL,
            "rgba(120,120,120,0.2)",
          ],
          "fill-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            11,
            [
              "case",
              ["boolean", ["feature-state", "selected"], false],
              0.75,
              ["boolean", ["feature-state", "hover"], false],
              0.55,
              ["boolean", ["feature-state", "filtered"], true],
              0.25,
              0.1,
            ],
            15,
            [
              "case",
              ["boolean", ["feature-state", "selected"], false],
              0.75,
              ["boolean", ["feature-state", "hover"], false],
              0.55,
              ["boolean", ["feature-state", "filtered"], true],
              0.42,
              0.1,
            ],
            17,
            [
              "case",
              ["boolean", ["feature-state", "selected"], false],
              0.75,
              ["boolean", ["feature-state", "hover"], false],
              0.55,
              ["boolean", ["feature-state", "filtered"], true],
              0.52,
              0.1,
            ],
          ],
        },
      });

      // ===== Parcel outline — always visible, demo-plot style =====
      map.addLayer({
        id: "parcels-outline",
        type: "line",
        source: "parcels",
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            C_GOLD,
            ["boolean", ["feature-state", "hover"], false],
            C_GOLD,
            "#ffffff",
          ],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            11,
            [
              "case",
              ["boolean", ["feature-state", "selected"], false],
              1.5,
              ["boolean", ["feature-state", "hover"], false],
              1.2,
              0.3,
            ],
            15,
            [
              "case",
              ["boolean", ["feature-state", "selected"], false],
              3,
              ["boolean", ["feature-state", "hover"], false],
              2.4,
              1.4,
            ],
            17,
            [
              "case",
              ["boolean", ["feature-state", "selected"], false],
              4.5,
              ["boolean", ["feature-state", "hover"], false],
              3.5,
              2.2,
            ],
          ],
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 11, 0.35, 13, 0.6, 15, 0.9, 17, 1],
        },
      });

      // Hover-glow halo (wide soft line, only visible when hovered)
      map.addLayer({
        id: "parcels-hover-glow",
        type: "line",
        source: "parcels",
        paint: {
          "line-color": C_GOLD,
          "line-width": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            10,
            ["boolean", ["feature-state", "selected"], false],
            14,
            0,
          ],
          "line-opacity": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            0.35,
            ["boolean", ["feature-state", "hover"], false],
            0.25,
            0,
          ],
          "line-blur": 6,
        },
      });

      // ===== Zoning (colored by type) =====
      map.addLayer({
        id: "parcels-zoning",
        type: "fill",
        source: "parcels",
        layout: { visibility: "none" },
        paint: {
          "fill-color": [
            "match",
            ["get", "type"],
            "Residential",
            TYPE_COLOR.Residential,
            "Commercial",
            TYPE_COLOR.Commercial,
            "Industrial",
            TYPE_COLOR.Industrial,
            "Agricultural",
            TYPE_COLOR.Agricultural,
            "Vacant Land",
            TYPE_COLOR["Vacant Land"],
            "#9ca3af",
          ],
          "fill-opacity": 0.55,
        },
      });

      // ===== Official public data: CSG cadastral parcels (server-proxied) =====
      if (!map.getSource("csg-parcels")) {
        map.addSource("csg-parcels", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
          generateId: true,
        });
      }
      map.addLayer({
        id: "csg-parcels-fill",
        type: "fill",
        source: "csg-parcels",
        layout: { visibility: "none" },
        paint: {
          "fill-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            C_GOLD,
            C_SEAGREEN,
          ],
          "fill-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 0.38, 0.12],
        },
      });
      map.addLayer({
        id: "csg-parcels-outline",
        type: "line",
        source: "csg-parcels",
        layout: { visibility: "none" },
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            C_GOLD,
            "#ffffff",
          ],
          "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 4, 1.6],
          "line-opacity": 0.95,
        },
      });
      map.addLayer({
        id: "csg-parcels-outline-glow",
        type: "line",
        source: "csg-parcels",
        layout: { visibility: "none" },
        paint: {
          "line-color": C_SEAGREEN,
          "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 7, 3.5],
          "line-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 0.75, 0.45],
          "line-blur": 2,
        },
      });

      // ===== Official public data: Kouga zoning polygons (server-proxied) =====
      if (!map.getSource("kouga-zoning")) {
        map.addSource("kouga-zoning", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
          generateId: true,
        });
      }
      map.addLayer({
        id: "kouga-zoning-fill",
        type: "fill",
        source: "kouga-zoning",
        layout: { visibility: "none" },
        paint: {
          "fill-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            C_GOLD,
            "#a78bfa",
          ],
          "fill-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 0.48, 0.35],
        },
      });
      map.addLayer({
        id: "kouga-zoning-outline",
        type: "line",
        source: "kouga-zoning",
        layout: { visibility: "none" },
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            C_GOLD,
            "#7c3aed",
          ],
          "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 3.5, 0.8],
          "line-opacity": 0.7,
        },
      });

      // ===== HEATMAPS — dramatic, palette-driven, story-telling =====
      const HEATS: {
        id: string;
        weightProp: string;
        weightRange: [number, number];
        ramp: Array<[number, string]>;
      }[] = [
        {
          id: "heat-investor",
          weightProp: "investor",
          weightRange: [40, 100],
          ramp: [
            [0, "rgba(0,0,0,0)"],
            [0.25, "#1a3a52"],
            [0.55, "#3ea58f"],
            [0.8, "#d4842a"],
            [1, "#e08562"],
          ],
        },
        {
          id: "heat-development",
          weightProp: "development",
          weightRange: [40, 100],
          ramp: [
            [0, "rgba(0,0,0,0)"],
            [0.3, "#1a3a52"],
            [0.6, "#5cbdb9"],
            [0.85, "#a3e635"],
            [1, "#d4842a"],
          ],
        },
        {
          id: "heat-oceanview",
          weightProp: "oceanView",
          weightRange: [30, 100],
          ramp: [
            [0, "rgba(0,0,0,0)"],
            [0.3, "#0c2340"],
            [0.55, "#1a3a52"],
            [0.8, "#5cbdb9"],
            [1, "#c0f0ee"],
          ],
        },
        {
          id: "heat-appreciation",
          weightProp: "appreciation",
          weightRange: [40, 100],
          ramp: [
            [0, "rgba(0,0,0,0)"],
            [0.3, "#1a3a52"],
            [0.6, "#3ea58f"],
            [0.85, "#d4842a"],
            [1, "#f4a261"],
          ],
        },
        {
          id: "heat-rental",
          weightProp: "rental",
          weightRange: [40, 100],
          ramp: [
            [0, "rgba(0,0,0,0)"],
            [0.3, "#1a3a52"],
            [0.6, "#5cbdb9"],
            [0.85, "#3ea58f"],
            [1, "#d4842a"],
          ],
        },
        {
          id: "heat-longheld",
          weightProp: "heldYears",
          weightRange: [3, 18],
          ramp: [
            [0, "rgba(0,0,0,0)"],
            [0.3, "#1a3a52"],
            [0.6, "#5b3a8a"],
            [0.85, "#d4842a"],
            [1, "#e08562"],
          ],
        },
        {
          id: "heat-seller",
          weightProp: "sellerProbability",
          weightRange: [30, 95],
          ramp: [
            [0, "rgba(0,0,0,0)"],
            [0.3, "#1a3a52"],
            [0.6, "#3ea58f"],
            [0.85, "#d4842a"],
            [1, "#c0392b"],
          ],
        },
      ];

      for (const h of HEATS) {
        const colorExpr: mapboxgl.Expression = ["interpolate", ["linear"], ["heatmap-density"]];
        for (const [stop, color] of h.ramp) {
          colorExpr.push(stop, color);
        }
        map.addLayer(
          {
            id: h.id,
            type: "heatmap",
            source: "parcel-centroids",
            layout: { visibility: "none" },
            paint: {
              "heatmap-weight": [
                "interpolate",
                ["linear"],
                ["get", h.weightProp],
                h.weightRange[0],
                0,
                h.weightRange[1],
                1,
              ],
              "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 11, 1, 16, 2.6],
              "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 11, 22, 14, 38, 16, 60],
              "heatmap-opacity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                11,
                0.75,
                15,
                0.7,
                16.5,
                0.45,
              ],
              "heatmap-color": colorExpr,
            },
          },
          map.getLayer("parcels-fill") ? "parcels-fill" : undefined,
        );
      }

      // ===== Interactivity =====
      let hoveredId: string | null = null;

      map.on("mousemove", "parcels-fill", (e) => {
        if (!e.features?.length) return;
        map.getCanvas().style.cursor = "pointer";
        const f = e.features[0];
        const id = f.properties?.id as string;
        if (hoveredId && hoveredId !== id) {
          map.setFeatureState({ source: "parcels", id: hoveredId }, { hover: false });
        }
        hoveredId = id;
        map.setFeatureState({ source: "parcels", id }, { hover: true });

        const html = `
          <div style="font-family: Inter, sans-serif; min-width: 200px">
            <div style="font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.08em; font-weight:600">${f.properties?.area} · Erf ${f.properties?.erf}</div>
            <div style="font-weight: 600; font-size: 13px; color: #111827; margin-top: 2px">${f.properties?.street}</div>
            <div style="font-size: 14px; color: ${C_OCEAN}; font-weight: 700; margin-top: 4px; letter-spacing: -0.01em">${formatZAR(Number(f.properties?.estimatedValue ?? 0))}</div>
            <div style="margin-top:6px; display:flex; gap:6px; font-size:10px; font-weight:600">
              <span style="background:${C_OCEAN}1a; color:${C_OCEAN}; padding:2px 6px; border-radius:999px">Investor ${f.properties?.investor}</span>
              <span style="background:${C_GOLD}1a; color:${C_GOLD}; padding:2px 6px; border-radius:999px">Dev ${f.properties?.development}</span>
            </div>
          </div>`;
        if (!popupRef.current) {
          popupRef.current = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 12,
            className: "pa-popup",
          });
        }
        popupRef.current.setLngLat(e.lngLat).setHTML(html).addTo(map);
      });

      map.on("mouseleave", "parcels-fill", () => {
        map.getCanvas().style.cursor = "";
        if (hoveredId) map.setFeatureState({ source: "parcels", id: hoveredId }, { hover: false });
        hoveredId = null;
        popupRef.current?.remove();
      });

      map.on("click", "parcels-fill", (e) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id) onSelect(id);
      });

      map.on("dblclick", "parcels-fill", (e) => {
        e.preventDefault();
        const f = e.features?.[0];
        if (!f) return;
        const coords = (f.geometry as GeoJSON.Polygon).coordinates[0];
        const bounds = coords.reduce(
          (b, c) => b.extend(c as [number, number]),
          new mapboxgl.LngLatBounds(coords[0] as [number, number], coords[0] as [number, number]),
        );
        map.fitBounds(bounds, { padding: 120, duration: 900, maxZoom: 18 });
      });
    };

    if (map.isStyleLoaded()) ensureSetup();
    else map.once("style.load", ensureSetup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, styleVersion]);

  // Layer visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer || !map.getLayer("parcels-fill")) return;
    const set = (id: string, v: boolean) =>
      map.getLayer(id) && map.setLayoutProperty(id, "visibility", v ? "visible" : "none");
    set("parcels-fill", layers.parcels);
    set("parcels-outline", layers.parcels);
    set("parcels-hover-glow", layers.parcels);
    set("parcels-zoning", layers.zoning);
    set("heat-investor", layers.investorHeat);
    set("heat-development", layers.developmentHeat);
    set("heat-oceanview", layers.oceanViewHeat);
    set("heat-appreciation", layers.appreciationHeat);
    set("heat-rental", layers.rentalHeat);
    set("heat-longheld", layers.longHeldHeat);
    set("heat-seller", layers.sellerHeat);
    set("csg-parcels-fill", layers.csgParcels);
    set("csg-parcels-outline", layers.csgParcels);
    set("csg-parcels-outline-glow", layers.csgParcels);
    set("kouga-zoning-fill", layers.kougaZoning);
    set("kouga-zoning-outline", layers.kougaZoning);
  }, [layers, styleVersion, ready]);

  // Fetch CSG / Kouga GeoJSON through the public-data fallback chain when toggled or after pan/zoom.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const activeMap = map;
    if (!layers.csgParcels && !layers.kougaZoning) {
      setLayerMessages({});
      onOfficialStatus?.({
        csg: { state: "off", count: 0 },
        kouga: { state: "off", count: 0 },
      });
      return;
    }

    const CSG_MIN_ZOOM = 13.5;
    const KOUGA_MIN_ZOOM = 11.5;
    let cancelled = false;
    let viewportRequest = 0;

    function setOfficialSource(
      id: "csg-parcels" | "kouga-zoning",
      result: PublicDataResult,
      testOnly = false,
    ) {
      const src = activeMap.getSource(id) as mapboxgl.GeoJSONSource | undefined;
      if (!src) return false;
      const features = result.features.map((feature) => ({
        ...feature,
        properties: {
          ...(feature.properties ?? {}),
          propertyatlas_source: testOnly ? "TEST GEOMETRY ONLY" : result.sourceLabel,
          propertyatlas_fallback: result.fallbackUsed,
          propertyatlas_fetched_at: result.fetchedAt,
          propertyatlas_test_geometry: testOnly,
        },
      }));
      src.setData({
        type: "FeatureCollection",
        features,
      });
      officialFeaturesRef.current[id] = features.map((feature) => ({ layer: id, feature }));
      publishOfficialFeatures();
      setOfficialDataVersion((version) => version + 1);
      return true;
    }

    function clearOfficialSource(id: "csg-parcels" | "kouga-zoning") {
      const src = activeMap.getSource(id) as mapboxgl.GeoJSONSource | undefined;
      if (src) {
        src.setData({ type: "FeatureCollection", features: [] });
        officialFeaturesRef.current[id] = [];
        publishOfficialFeatures();
        setOfficialDataVersion((version) => version + 1);
      }
    }

    function publishStatus(status: OfficialLayerStatus) {
      onOfficialStatus?.({ csg: { ...status.csg }, kouga: { ...status.kouga } });
    }

    async function loadLayer(
      layer: "csg-parcels" | "kouga-zoning",
      bbox: [number, number, number, number],
      request: number,
    ) {
      const label = layer === "csg-parcels" ? "CSG" : "Kouga";
      const result = await loadOfficialPublicLayer(layer, bbox, 400);
      // A late response for a previous viewport must not replace the current one.
      if (cancelled || request !== viewportRequest) {
        return { status: null, message: undefined as string | undefined };
      }
      const storageKey = layer === "csg-parcels" ? "pa.arcgis.csg.meta" : "pa.arcgis.kouga.meta";
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(result));
      } catch {
        // Ignore storage failures; layer status still updates from the live result.
      }
      if (cancelled) return { status: null, message: undefined as string | undefined };

      if (result.features.length > 0) {
        const sourceUpdated = setOfficialSource(layer, result, false);
        try {
          window.localStorage.setItem(`${storageKey}.sourceUpdated`, String(sourceUpdated));
        } catch {
          // Ignore storage failures; source update state is only diagnostic.
        }
        if (result.fallbackUsed === "static") {
          return {
            status: {
              state: "imported" as const,
              count: result.features.length,
              source: result.sourceLabel,
              message: `Imported ${label} GeoJSON loaded: ${result.features.length}`,
            },
            message: `Imported ${label} GeoJSON loaded: ${result.features.length}`,
          };
        }
        return {
          status: {
            state: "loaded" as const,
            count: result.features.length,
            source: result.sourceLabel,
            message: `${label}${layer === "csg-parcels" ? " parcels" : " zoning"} loaded: ${result.features.length}`,
          },
          message: undefined,
        };
      }

      const anySuccessfulZero = result.attempts.some((a) => a.ok && (a.featureCount ?? 0) === 0);
      if (showTestGeometry) {
        const test = await testStaticGeoJson(layer, true);
        if (!cancelled && request === viewportRequest && test.features.length > 0) {
          const sourceUpdated = setOfficialSource(layer, test, true);
          try {
            window.localStorage.setItem(`${storageKey}.sourceUpdated`, String(sourceUpdated));
          } catch {
            // Ignore storage failures; source update state is only diagnostic.
          }
          return {
            status: {
              state: "test" as const,
              count: test.features.length,
              source: "TEST GEOMETRY ONLY",
              message: "Test geometry loaded, not official data",
            },
            message: "Test geometry loaded, not official data",
          };
        }
      }

      if (cancelled || request !== viewportRequest) {
        return { status: null, message: undefined as string | undefined };
      }
      clearOfficialSource(layer);
      if (anySuccessfulZero) {
        const msg =
          layer === "csg-parcels"
            ? "No CSG parcels in this view"
            : "Kouga zoning unavailable for this view";
        return { status: { state: "empty" as const, count: 0, message: msg }, message: msg };
      }
      const msg = layer === "csg-parcels" ? "CSG unavailable" : "Kouga unavailable";
      return {
        status: { state: "failed" as const, count: 0, message: result.message ?? msg },
        message: msg,
      };
    }

    const load = async () => {
      const b = map.getBounds();
      if (!b) return;
      const request = ++viewportRequest;
      const bbox: [number, number, number, number] = [
        b.getWest(),
        b.getSouth(),
        b.getEast(),
        b.getNorth(),
      ];
      const zoom = map.getZoom();
      const nextMsgs: { csg?: string; kouga?: string } = {};
      const status: OfficialLayerStatus = {
        csg: { state: layers.csgParcels ? "loading" : "off", count: 0 },
        kouga: { state: layers.kougaZoning ? "loading" : "off", count: 0 },
      };

      const requests: Promise<unknown>[] = [];
      if (layers.csgParcels) {
        if (zoom < CSG_MIN_ZOOM) {
          nextMsgs.csg = "Zoom in to load official parcel boundaries.";
          status.csg = { state: "empty", count: 0, message: nextMsgs.csg };
          clearOfficialSource("csg-parcels");
        } else {
          requests.push(
            loadLayer("csg-parcels", bbox, request)
              .then((r) => {
                if (!r.status) return;
                status.csg = r.status;
                nextMsgs.csg = r.message;
                setLayerMessages((m) => ({ ...m, csg: r.message }));
                publishStatus(status);
              })
              .catch(() => {
                if (cancelled || request !== viewportRequest) return;
                const msg = "CSG unavailable";
                clearOfficialSource("csg-parcels");
                status.csg = { state: "failed", count: 0, message: msg };
                nextMsgs.csg = msg;
                setLayerMessages((m) => ({ ...m, csg: msg }));
                publishStatus(status);
              }),
          );
        }
      }
      if (layers.kougaZoning) {
        if (zoom < KOUGA_MIN_ZOOM) {
          nextMsgs.kouga = "Zoom in to load Kouga zoning.";
          status.kouga = { state: "empty", count: 0, message: nextMsgs.kouga };
          clearOfficialSource("kouga-zoning");
        } else {
          requests.push(
            loadLayer("kouga-zoning", bbox, request)
              .then((r) => {
                if (!r.status) return;
                status.kouga = r.status;
                nextMsgs.kouga = r.message;
                setLayerMessages((m) => ({ ...m, kouga: r.message }));
                publishStatus(status);
              })
              .catch(() => {
                if (cancelled || request !== viewportRequest) return;
                const msg = "Kouga unavailable";
                clearOfficialSource("kouga-zoning");
                status.kouga = { state: "failed", count: 0, message: msg };
                nextMsgs.kouga = msg;
                setLayerMessages((m) => ({ ...m, kouga: msg }));
                publishStatus(status);
              }),
          );
        }
      }
      setLayerMessages((m) => ({
        csg: layers.csgParcels ? (nextMsgs.csg ?? m.csg) : undefined,
        kouga: layers.kougaZoning ? (nextMsgs.kouga ?? m.kouga) : undefined,
      }));
      publishStatus(status);
      await Promise.all(requests);
      if (!cancelled && request === viewportRequest) publishStatus(status);
    };

    void load();
    const onMove = () => {
      void load();
    };
    map.on("moveend", onMove);

    // Click handlers for public-data layers — surface the official feature in the panel.
    const onCsgClick = (
      e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] },
    ) => {
      const f = e.features?.[0];
      if (!f) return;
      selectOfficialFeature(map, f, "csg-parcels", [e.lngLat.lng, e.lngLat.lat]);
    };
    const onKougaClick = (
      e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] },
    ) => {
      const f = e.features?.[0];
      if (!f) return;
      selectOfficialFeature(map, f, "kouga-zoning", [e.lngLat.lng, e.lngLat.lat]);
    };
    const onCsgEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const onCsgLeave = () => {
      map.getCanvas().style.cursor = "";
    };
    map.on("click", "csg-parcels-fill", onCsgClick);
    map.on("click", "kouga-zoning-fill", onKougaClick);
    map.on("mouseenter", "csg-parcels-fill", onCsgEnter);
    map.on("mouseleave", "csg-parcels-fill", onCsgLeave);
    map.on("mouseenter", "kouga-zoning-fill", onCsgEnter);
    map.on("mouseleave", "kouga-zoning-fill", onCsgLeave);

    return () => {
      cancelled = true;
      map.off("moveend", onMove);
      map.off("click", "csg-parcels-fill", onCsgClick);
      map.off("click", "kouga-zoning-fill", onKougaClick);
      map.off("mouseenter", "csg-parcels-fill", onCsgEnter);
      map.off("mouseleave", "csg-parcels-fill", onCsgLeave);
      map.off("mouseenter", "kouga-zoning-fill", onCsgEnter);
      map.off("mouseleave", "kouga-zoning-fill", onCsgLeave);
    };
  }, [
    layers.csgParcels,
    layers.kougaZoning,
    ready,
    styleVersion,
    showTestGeometry,
    onOfficialStatus,
    publishOfficialFeatures,
    selectOfficialFeature,
  ]);

  // Update filtered feature state
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("parcels")) return;
    for (const p of PROPERTIES) {
      map.setFeatureState({ source: "parcels", id: p.id }, { filtered: filteredIds.has(p.id) });
    }
  }, [filteredIds, styleVersion, ready]);

  // Update selection + fly to selected + pulse marker
  const prevSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("parcels")) return;
    if (prevSelectedRef.current && prevSelectedRef.current !== selectedId) {
      map.setFeatureState({ source: "parcels", id: prevSelectedRef.current }, { selected: false });
    }
    if (selectedId) {
      clearOfficialSelectedFeature(map);
      map.setFeatureState({ source: "parcels", id: selectedId }, { selected: true });
      const p = PROPERTIES.find((x) => x.id === selectedId);
      if (p) {
        map.flyTo({
          center: p.centroid,
          zoom: Math.max(map.getZoom(), 16.2),
          duration: 1100,
          essential: true,
          curve: 1.4,
        });
        // Place pulsing marker
        pulseMarkerRef.current?.remove();
        const el = document.createElement("div");
        el.className = "pa-pulse-marker";
        pulseMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat(p.centroid)
          .addTo(map);
      }
    } else {
      pulseMarkerRef.current?.remove();
      pulseMarkerRef.current = null;
    }
    prevSelectedRef.current = selectedId;
  }, [selectedId, styleVersion, ready, clearOfficialSelectedFeature]);

  const prevOfficialReopenTargetRef = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !officialReopenTarget) return;
    const key = `${officialReopenTarget.lng}:${officialReopenTarget.lat}:${officialReopenTarget.zoom}`;
    if (prevOfficialReopenTargetRef.current === key) return;
    prevOfficialReopenTargetRef.current = key;
    map.flyTo({
      center: [officialReopenTarget.lng, officialReopenTarget.lat],
      zoom: officialReopenTarget.zoom,
      duration: 1100,
      essential: true,
      curve: 1.35,
    });
  }, [officialReopenTarget, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !searchHighlightOfficialParcel) {
      if (!searchHighlightOfficialParcel) {
        if (map) {
          clearOfficialSelectedFeature(map);
          searchHighlightMarkerRef.current?.remove();
          searchHighlightMarkerRef.current = null;
        }
        onSearchHighlightStatus?.("idle");
      }
      return;
    }

    let cancelled = false;
    let timer: number | null = null;
    let idleHandler: (() => void) | null = null;
    let attempts = 0;
    const maxAttempts = 14;

    clearOfficialSelectedFeature(map);
    onSearchHighlightStatus?.("searching");
    if (searchHighlightOfficialParcel.bounds) {
      map.fitBounds(searchHighlightOfficialParcel.bounds, {
        padding: 96,
        maxZoom: 18.5,
        duration: 1000,
        essential: true,
      });
    } else {
      map.flyTo({
        center: searchHighlightOfficialParcel.lngLat,
        zoom: Math.max(map.getZoom(), 18),
        duration: 1000,
        essential: true,
        curve: 1.35,
      });
    }

    searchHighlightMarkerRef.current?.remove();
    const el = document.createElement("div");
    el.className = "pa-pulse-marker";
    el.title = `${searchHighlightOfficialParcel.title} search result`;
    searchHighlightMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
      .setLngLat(searchHighlightOfficialParcel.lngLat)
      .addTo(map);

    const schedule = (delay: number) => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(resolve, delay);
    };

    const waitForIdle = () => {
      if (idleHandler) map.off("idle", idleHandler);
      idleHandler = () => {
        idleHandler = null;
        resolve();
      };
      map.once("idle", idleHandler);
    };

    const resolve = () => {
      if (cancelled) return;
      attempts += 1;

      if (
        !map.isStyleLoaded() ||
        !officialReopenLayersReady(map, {
          id: searchHighlightOfficialParcel.id,
          fromSaved: false,
        })
      ) {
        if (attempts < maxAttempts) schedule(300);
        return;
      }

      if (map.isMoving()) {
        if (attempts < maxAttempts) waitForIdle();
        return;
      }

      const match = findMatchingSearchHighlightFeature(map, searchHighlightOfficialParcel);
      if (
        match?.feature.id !== undefined &&
        match.feature.id !== null &&
        map.getSource(match.layer)
      ) {
        clearOfficialSelectedFeature(map);
        map.setFeatureState({ source: match.layer, id: match.feature.id }, { selected: true });
        selectedOfficialFeatureRef.current = { source: match.layer, id: match.feature.id };
        searchHighlightMarkerRef.current?.remove();
        searchHighlightMarkerRef.current = null;
        onSelect(null);
        onSearchHighlightStatus?.("highlighted");
        return;
      }

      if (attempts < maxAttempts) {
        schedule(attempts < 4 ? 300 : 550);
        return;
      }

      onSearchHighlightStatus?.("fallback");
    };

    schedule(300);

    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      if (idleHandler) map.off("idle", idleHandler);
    };
  }, [
    clearOfficialSelectedFeature,
    onSearchHighlightStatus,
    onSelect,
    ready,
    searchHighlightOfficialParcel,
    styleVersion,
    officialDataVersion,
    layers.csgParcels,
    layers.kougaZoning,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !officialReopenRequest || !onSelectOfficial) {
      if (!officialReopenRequest) onOfficialReopenStatus?.("idle");
      return;
    }

    let cancelled = false;
    let timer: number | null = null;
    let idleHandler: (() => void) | null = null;
    let attempts = 0;
    const maxAttempts = 24;
    const requestKey = [
      officialReopenRequest.id,
      officialReopenRequest.lng ?? "",
      officialReopenRequest.lat ?? "",
      officialReopenRequest.zoom ?? "",
    ].join(":");

    onOfficialReopenStatus?.("searching");

    const schedule = (delay: number) => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(resolve, delay);
    };

    const waitForIdle = () => {
      if (idleHandler) map.off("idle", idleHandler);
      idleHandler = () => {
        idleHandler = null;
        resolve();
      };
      map.once("idle", idleHandler);
    };

    const resolve = () => {
      if (cancelled) return;
      attempts += 1;

      if (!map.isStyleLoaded() || !officialReopenLayersReady(map, officialReopenRequest)) {
        if (attempts < maxAttempts) schedule(450);
        else onOfficialReopenStatus?.("not-found");
        return;
      }

      if (map.isMoving()) {
        if (attempts < maxAttempts) waitForIdle();
        else onOfficialReopenStatus?.("not-found");
        return;
      }

      const match = findMatchingOfficialReopenFeature(map, officialReopenRequest);
      if (match) {
        const lngLat = featureSelectionPoint(match.feature, officialReopenRequest, map);
        selectOfficialFeature(map, match.feature, match.layer, lngLat);
        onOfficialReopenStatus?.("resolved");
        return;
      }

      if (attempts < maxAttempts) {
        schedule(attempts < 4 ? 350 : 650);
        return;
      }

      console.info("[ErfStoep] Saved official parcel could not be auto-resolved", {
        request: requestKey,
        attempts,
      });
      onOfficialReopenStatus?.("not-found");
    };

    schedule(350);

    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      if (idleHandler) map.off("idle", idleHandler);
    };
  }, [
    officialReopenRequest,
    ready,
    styleVersion,
    officialDataVersion,
    layers.csgParcels,
    layers.kougaZoning,
    onOfficialReopenStatus,
    onSelectOfficial,
    selectOfficialFeature,
  ]);

  if (!TOKEN) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-gradient-ocean text-white">
        <div className="max-w-md rounded-2xl border border-white/10 bg-black/40 p-6 text-center backdrop-blur">
          <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-accent" />
          <div className="text-base font-semibold">Mapbox token missing</div>
          <p className="mt-1 text-sm text-white/70">
            Set <code className="rounded bg-white/10 px-1">VITE_MAPBOX_ACCESS_TOKEN</code> in your
            environment to load the map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        aria-label="St Francis Bay property map"
      />
      {/* Layer status messages are surfaced via OfficialPill / LayerSwitcher and /admin/public-data-debug. */}
      {mapError && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-gradient-ocean p-4 text-white">
          <div className="max-w-md rounded-2xl border border-white/10 bg-black/40 p-6 text-center backdrop-blur">
            <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-accent" />
            <div className="text-base font-semibold">Map couldn't render</div>
            <p className="mt-1 text-sm text-white/70">{mapError}</p>
            <button
              type="button"
              onClick={() => {
                setMapError(null);
                setRetryKey((k) => k + 1);
              }}
              className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-semibold text-foreground transition hover:bg-white/90"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </>
  );
}
