import { useEffect, useMemo, useRef, useState } from "react";
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

interface Props {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  filterFn?: (p: Property) => boolean;
  layers: MapLayers;
  mapStyle: MapStyleId;
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

function webglSupported(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function MapCanvas({ selectedId, onSelect, filterFn, layers, mapStyle }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const pulseMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const currentStyleRef = useRef<MapStyleId | null>(null);
  const [ready, setReady] = useState(false);
  const [styleVersion, setStyleVersion] = useState(0);
  const [mapError, setMapError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [layerMessages, setLayerMessages] = useState<{ csg?: string; kouga?: string }>({});

  const filtered = useMemo(
    () => (filterFn ? PROPERTIES.filter(filterFn) : PROPERTIES),
    [filterFn],
  );
  const filteredIds = useMemo(() => new Set(filtered.map((p) => p.id)), [filtered]);

  // Init map
  useEffect(() => {
    if (!TOKEN || !containerRef.current || mapRef.current) return;

    if (!webglSupported()) {
      console.error("[PropertyAtlas] WebGL is not available in this browser");
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
        zoom: 13.4,
        pitch: 0,
        attributionControl: false,
        cooperativeGestures: false,
      });
    } catch (err) {
      console.error("[PropertyAtlas] Map failed to initialize", err);
      setMapError("The map engine failed to start on this device. Tap Retry, or try reloading the page.");
      return;
    }

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true, showCompass: true }), "bottom-right");
    map.addControl(new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }), "bottom-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");
    map.on("load", () => {
      console.log("[PropertyAtlas] Map loaded");
      map.resize();
      setReady(true);
    });
    map.on("error", (e) => {
      console.error("[PropertyAtlas] Map error:", e.error?.message ?? e);
    });
    map.on("style.load", () => setStyleVersion((v) => v + 1));

    const canvas = map.getCanvas();
    const onContextLost = () => {
      console.warn("[PropertyAtlas] WebGL context lost — recreating map");
      setMapError("The map's graphics context was interrupted (this can happen on mobile). Tap Retry to reload it.");
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

  // Add sources + layers (re-run on every style load)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const ensureSetup = () => {
      // Guard on the LAYER (style switches can preserve sources but drop layers).
      if (map.getLayer("parcels-fill")) return;
      if (!map.getSource("parcels")) {
        map.addSource("parcels", { type: "geojson", data: propertiesToGeoJSON(PROPERTIES), promoteId: "id" });
      }
      if (!map.getSource("parcel-centroids")) {
        map.addSource("parcel-centroids", { type: "geojson", data: propertiesToCentroidGeoJSON(PROPERTIES), promoteId: "id" });
      }


      // ===== Parcel fill — zoom-reveal: subtle at low zoom, vivid at high zoom =====
      map.addLayer({
        id: "parcels-fill",
        type: "fill",
        source: "parcels",
        paint: {
          "fill-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false], C_GOLD,
            ["boolean", ["feature-state", "hover"], false], C_GOLD,
            ["boolean", ["feature-state", "filtered"], true], C_TEAL,
            "rgba(120,120,120,0.2)",
          ],
          "fill-opacity": [
            "interpolate", ["linear"], ["zoom"],
            11, [
              "case",
              ["boolean", ["feature-state", "selected"], false], 0.75,
              ["boolean", ["feature-state", "hover"], false], 0.55,
              ["boolean", ["feature-state", "filtered"], true], 0.25,
              0.1,
            ],
            15, [
              "case",
              ["boolean", ["feature-state", "selected"], false], 0.75,
              ["boolean", ["feature-state", "hover"], false], 0.55,
              ["boolean", ["feature-state", "filtered"], true], 0.42,
              0.1,
            ],
            17, [
              "case",
              ["boolean", ["feature-state", "selected"], false], 0.75,
              ["boolean", ["feature-state", "hover"], false], 0.55,
              ["boolean", ["feature-state", "filtered"], true], 0.52,
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
            ["boolean", ["feature-state", "selected"], false], C_GOLD,
            ["boolean", ["feature-state", "hover"], false], C_GOLD,
            "#ffffff",
          ],
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            11, [
              "case",
              ["boolean", ["feature-state", "selected"], false], 1.5,
              ["boolean", ["feature-state", "hover"], false], 1.2,
              0.3,
            ],
            15, [
              "case",
              ["boolean", ["feature-state", "selected"], false], 3,
              ["boolean", ["feature-state", "hover"], false], 2.4,
              1.4,
            ],
            17, [
              "case",
              ["boolean", ["feature-state", "selected"], false], 4.5,
              ["boolean", ["feature-state", "hover"], false], 3.5,
              2.2,
            ],
          ],
          "line-opacity": [
            "interpolate", ["linear"], ["zoom"],
            11, 0.35, 13, 0.6, 15, 0.9, 17, 1,
          ],
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
            ["boolean", ["feature-state", "hover"], false], 10,
            ["boolean", ["feature-state", "selected"], false], 14,
            0,
          ],
          "line-opacity": [
            "case",
            ["boolean", ["feature-state", "selected"], false], 0.35,
            ["boolean", ["feature-state", "hover"], false], 0.25,
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
            "match", ["get", "type"],
            "Residential", TYPE_COLOR.Residential,
            "Commercial", TYPE_COLOR.Commercial,
            "Industrial", TYPE_COLOR.Industrial,
            "Agricultural", TYPE_COLOR.Agricultural,
            "Vacant Land", TYPE_COLOR["Vacant Land"],
            "#9ca3af",
          ],
          "fill-opacity": 0.55,
        },
      });

      // ===== Official public data: CSG cadastral parcels (server-proxied) =====
      if (!map.getSource("csg-parcels")) {
        map.addSource("csg-parcels", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      }
      map.addLayer({
        id: "csg-parcels-fill",
        type: "fill",
        source: "csg-parcels",
        layout: { visibility: "none" },
        paint: { "fill-color": C_SEAGREEN, "fill-opacity": 0.05 },
      });
      map.addLayer({
        id: "csg-parcels-outline",
        type: "line",
        source: "csg-parcels",
        layout: { visibility: "none" },
        paint: { "line-color": C_SEAGREEN, "line-width": 1.4, "line-opacity": 0.9 },
      });

      // ===== Official public data: Kouga zoning polygons (server-proxied) =====
      if (!map.getSource("kouga-zoning")) {
        map.addSource("kouga-zoning", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      }
      map.addLayer({
        id: "kouga-zoning-fill",
        type: "fill",
        source: "kouga-zoning",
        layout: { visibility: "none" },
        paint: { "fill-color": "#a78bfa", "fill-opacity": 0.35 },
      });
      map.addLayer({
        id: "kouga-zoning-outline",
        type: "line",
        source: "kouga-zoning",
        layout: { visibility: "none" },
        paint: { "line-color": "#7c3aed", "line-width": 0.8, "line-opacity": 0.7 },
      });

      // ===== HEATMAPS — dramatic, palette-driven, story-telling =====
      const HEATS: { id: string; weightProp: string; weightRange: [number, number]; ramp: Array<[number, string]> }[] = [
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
        const colorExpr: any[] = ["interpolate", ["linear"], ["heatmap-density"]];
        for (const [stop, color] of h.ramp) {
          colorExpr.push(stop, color);
        }
        map.addLayer({
          id: h.id,
          type: "heatmap",
          source: "parcel-centroids",
          layout: { visibility: "none" },
          paint: {
            "heatmap-weight": [
              "interpolate", ["linear"], ["get", h.weightProp],
              h.weightRange[0], 0,
              h.weightRange[1], 1,
            ],
            "heatmap-intensity": [
              "interpolate", ["linear"], ["zoom"],
              11, 1, 16, 2.6,
            ],
            "heatmap-radius": [
              "interpolate", ["linear"], ["zoom"],
              11, 22, 14, 38, 16, 60,
            ],
            "heatmap-opacity": [
              "interpolate", ["linear"], ["zoom"],
              11, 0.75, 15, 0.7, 16.5, 0.45,
            ],
            "heatmap-color": colorExpr as any,
          },
        }, map.getLayer("parcels-fill") ? "parcels-fill" : undefined);
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
          popupRef.current = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 12, className: "pa-popup" });
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
    const set = (id: string, v: boolean) => map.getLayer(id) && map.setLayoutProperty(id, "visibility", v ? "visible" : "none");
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
    set("kouga-zoning-fill", layers.kougaZoning);
    set("kouga-zoning-outline", layers.kougaZoning);
  }, [layers, styleVersion, ready]);

  // Fetch CSG / Kouga GeoJSON via the server proxy when toggled or after pan/zoom.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (!layers.csgParcels && !layers.kougaZoning) {
      setLayerMessages({});
      return;
    }

    const CSG_MIN_ZOOM = 14.5;
    const KOUGA_MIN_ZOOM = 12;
    let cancelled = false;

    const load = async () => {
      const { fetchArcGisLayer } = await import("@/lib/providers/arcgis.functions");
      const b = map.getBounds();
      if (!b) return;
      const bbox: [number, number, number, number] = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
      const zoom = map.getZoom();
      const nextMsgs: { csg?: string; kouga?: string } = {};

      const requests: Promise<unknown>[] = [];
      if (layers.csgParcels) {
        if (zoom < CSG_MIN_ZOOM) {
          nextMsgs.csg = "Zoom in to load official parcel boundaries.";
          const src = map.getSource("csg-parcels") as mapboxgl.GeoJSONSource | undefined;
          if (src) src.setData({ type: "FeatureCollection", features: [] });
        } else {
          requests.push(
            fetchArcGisLayer({ data: { layer: "csg-parcels", bbox, limit: 400 } }).then((fc) => {
              if (cancelled) return;
              try { window.localStorage.setItem("pa.arcgis.csg.meta", JSON.stringify(fc.meta)); } catch {}
              console.info("[PropertyAtlas] CSG parcels", fc.meta);
              if (!fc.meta.upstreamReachable) {
                nextMsgs.csg = `CSG parcels could not load. Open official source. (${fc.meta.upstreamMessage ?? "upstream error"})`;
              } else if (fc.meta.count === 0) {
                nextMsgs.csg = "No CSG parcels in view.";
              }
              const src = map.getSource("csg-parcels") as mapboxgl.GeoJSONSource | undefined;
              if (src) src.setData({ type: "FeatureCollection", features: fc.features ?? [] });
              setLayerMessages((m) => ({ ...m, csg: nextMsgs.csg }));
            }).catch((err) => {
              console.error("[PropertyAtlas] CSG fetch failed", err);
              setLayerMessages((m) => ({ ...m, csg: "CSG parcels could not load. Open official source." }));
            }),
          );
        }
      }
      if (layers.kougaZoning) {
        if (zoom < KOUGA_MIN_ZOOM) {
          nextMsgs.kouga = "Zoom in to load Kouga zoning.";
          const src = map.getSource("kouga-zoning") as mapboxgl.GeoJSONSource | undefined;
          if (src) src.setData({ type: "FeatureCollection", features: [] });
        } else {
          requests.push(
            fetchArcGisLayer({ data: { layer: "kouga-zoning", bbox, limit: 400 } }).then((fc) => {
              if (cancelled) return;
              try { window.localStorage.setItem("pa.arcgis.kouga.meta", JSON.stringify(fc.meta)); } catch {}
              console.info("[PropertyAtlas] Kouga zoning", fc.meta);
              if (!fc.meta.upstreamReachable) {
                nextMsgs.kouga = `Kouga zoning could not load. Open official source. (${fc.meta.upstreamMessage ?? "upstream error"})`;
              } else if (fc.meta.count === 0) {
                nextMsgs.kouga = "No Kouga zoning polygons in view.";
              }
              const src = map.getSource("kouga-zoning") as mapboxgl.GeoJSONSource | undefined;
              if (src) src.setData({ type: "FeatureCollection", features: fc.features ?? [] });
              setLayerMessages((m) => ({ ...m, kouga: nextMsgs.kouga }));
            }).catch((err) => {
              console.error("[PropertyAtlas] Kouga fetch failed", err);
              setLayerMessages((m) => ({ ...m, kouga: "Kouga zoning could not load. Open official source." }));
            }),
          );
        }
      }
      setLayerMessages((m) => ({ csg: layers.csgParcels ? (nextMsgs.csg ?? m.csg) : undefined, kouga: layers.kougaZoning ? (nextMsgs.kouga ?? m.kouga) : undefined }));
      await Promise.all(requests);
    };

    void load();
    const onMove = () => { void load(); };
    map.on("moveend", onMove);

    // Click handlers for public-data layers — show a popup with official fields.
    const fmt = (v: unknown) => (v === null || v === undefined || v === "" ? "Not available from public source" : String(v));
    const num = (v: unknown) => (typeof v === "number" ? v.toFixed(6) : fmt(v));
    const onCsgClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = (f.properties ?? {}) as Record<string, unknown>;
      const html = `
        <div style="font-family:Inter,sans-serif;min-width:240px;max-width:280px">
          <div style="font-size:9px;font-weight:700;color:#3ea58f;text-transform:uppercase;letter-spacing:0.08em">Source: Chief Surveyor-General</div>
          <div style="font-weight:600;font-size:13px;color:#111827;margin-top:4px">Parcel ${fmt(p.PARCEL_NO)}</div>
          <table style="margin-top:6px;font-size:11px;color:#374151;width:100%">
            <tr><td style="color:#6b7280">Portion</td><td>${fmt(p.PORTION)}</td></tr>
            <tr><td style="color:#6b7280">LPI / ID</td><td>${fmt(p.PRCL_KEY ?? p.ID)}</td></tr>
            <tr><td style="color:#6b7280">Province</td><td>${fmt(p.PROVINCE)}</td></tr>
            <tr><td style="color:#6b7280">Major region</td><td>${fmt(p.MAJ_REGION)}</td></tr>
            <tr><td style="color:#6b7280">Minor region</td><td>${fmt(p.MIN_REGION)}</td></tr>
            <tr><td style="color:#6b7280">Geometry area</td><td>${fmt(p.GEOM_AREA ?? p.SHAPE_Area)} m²</td></tr>
            <tr><td style="color:#6b7280">Latitude</td><td>${num(e.lngLat.lat)}</td></tr>
            <tr><td style="color:#6b7280">Longitude</td><td>${num(e.lngLat.lng)}</td></tr>
          </table>
          <a href="https://csggis.drdlr.gov.za/psv/" target="_blank" rel="noopener noreferrer" style="margin-top:8px;display:inline-block;font-size:11px;font-weight:600;color:#1a3a52;text-decoration:underline">Open official source ↗</a>
        </div>`;
      new mapboxgl.Popup({ closeButton: true, offset: 8, maxWidth: "320px" }).setLngLat(e.lngLat).setHTML(html).addTo(map);
    };
    const onKougaClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = (f.properties ?? {}) as Record<string, unknown>;
      const html = `
        <div style="font-family:Inter,sans-serif;min-width:240px;max-width:280px">
          <div style="font-size:9px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:0.08em">Source: Kouga Municipality GIS</div>
          <div style="font-weight:600;font-size:13px;color:#111827;margin-top:4px">Zoning ${fmt(p.ZONING)}</div>
          <table style="margin-top:6px;font-size:11px;color:#374151;width:100%">
            <tr><td style="color:#6b7280">Type</td><td>${fmt(p.ZONING_TYP)}</td></tr>
            <tr><td style="color:#6b7280">Description</td><td>${fmt(p.ZONING_DES)}</td></tr>
            <tr><td style="color:#6b7280">Shape area</td><td>${fmt(p.Shape__Area)} m²</td></tr>
          </table>
          <p style="margin-top:8px;font-size:10px;color:#92400e;background:#fef3c7;padding:6px 8px;border-radius:6px">Zoning information must be verified with Kouga Municipality before relying on it.</p>
          <a href="https://mapping-kouga.hub.arcgis.com/" target="_blank" rel="noopener noreferrer" style="margin-top:6px;display:inline-block;font-size:11px;font-weight:600;color:#1a3a52;text-decoration:underline">Open official source ↗</a>
        </div>`;
      new mapboxgl.Popup({ closeButton: true, offset: 8, maxWidth: "320px" }).setLngLat(e.lngLat).setHTML(html).addTo(map);
    };
    const onCsgEnter = () => { map.getCanvas().style.cursor = "pointer"; };
    const onCsgLeave = () => { map.getCanvas().style.cursor = ""; };
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
  }, [layers.csgParcels, layers.kougaZoning, ready, styleVersion]);

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
  }, [selectedId, styleVersion, ready]);

  if (!TOKEN) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-gradient-ocean text-white">
        <div className="max-w-md rounded-2xl border border-white/10 bg-black/40 p-6 text-center backdrop-blur">
          <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-accent" />
          <div className="text-base font-semibold">Mapbox token missing</div>
          <p className="mt-1 text-sm text-white/70">
            Set <code className="rounded bg-white/10 px-1">VITE_MAPBOX_ACCESS_TOKEN</code> in your environment to load the map.
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
