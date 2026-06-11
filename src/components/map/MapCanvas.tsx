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
  valueHeat: boolean;
  salesHeat: boolean;
  investorHeat: boolean;
  oceanView: boolean;
  development: boolean;
}

interface Props {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  filterFn?: (p: Property) => boolean;
  layers: MapLayers;
  mapStyle: MapStyleId;
}

const TYPE_COLOR: Record<string, string> = {
  Residential: "#60a5fa",
  Commercial: "#a78bfa",
  Industrial: "#fb923c",
  Agricultural: "#86efac",
  "Vacant Land": "#fde68a",
};

export function MapCanvas({ selectedId, onSelect, filterFn, layers, mapStyle }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const [ready, setReady] = useState(false);
  const [styleVersion, setStyleVersion] = useState(0);

  const filtered = useMemo(
    () => (filterFn ? PROPERTIES.filter(filterFn) : PROPERTIES),
    [filterFn],
  );
  const filteredIds = useMemo(() => new Set(filtered.map((p) => p.id)), [filtered]);

  // Init map
  useEffect(() => {
    if (!TOKEN || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: STYLE_URLS[mapStyle],
      center: ST_FRANCIS_CENTER,
      zoom: 13.2,
      pitch: 0,
      attributionControl: false,
      cooperativeGestures: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true, showCompass: true }), "bottom-right");
    map.addControl(new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }), "bottom-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");
    map.on("load", () => setReady(true));
    map.on("style.load", () => setStyleVersion((v) => v + 1));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch style
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(STYLE_URLS[mapStyle]);
  }, [mapStyle]);

  // Add sources + layers (re-run on every style load)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const ensureSetup = () => {
      if (map.getSource("parcels")) return;
      map.addSource("parcels", { type: "geojson", data: propertiesToGeoJSON(PROPERTIES), promoteId: "id" });
      map.addSource("parcel-centroids", { type: "geojson", data: propertiesToCentroidGeoJSON(PROPERTIES), promoteId: "id" });

      // Parcel fill
      map.addLayer({
        id: "parcels-fill",
        type: "fill",
        source: "parcels",
        paint: {
          "fill-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false], "#f59e0b",
            ["boolean", ["feature-state", "hover"], false], "#fbbf24",
            ["boolean", ["feature-state", "filtered"], true], "#3b82f6",
            "rgba(120,120,120,0.15)",
          ],
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "selected"], false], 0.65,
            ["boolean", ["feature-state", "filtered"], true], 0.35,
            0.1,
          ],
        },
      });
      // Parcel outline
      map.addLayer({
        id: "parcels-outline",
        type: "line",
        source: "parcels",
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false], "#f59e0b",
            "#ffffff",
          ],
          "line-width": [
            "case",
            ["boolean", ["feature-state", "selected"], false], 3,
            ["boolean", ["feature-state", "hover"], false], 2,
            0.8,
          ],
          "line-opacity": 0.9,
        },
      });

      // Zoning layer (colored by type)
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

      // Ocean view layer
      map.addLayer({
        id: "parcels-oceanview",
        type: "fill",
        source: "parcels",
        layout: { visibility: "none" },
        paint: {
          "fill-color": [
            "step", ["get", "oceanView"],
            "rgba(15,118,110,0.12)", 50,
            "#5eead4", 75,
            "#0ea5e9",
          ],
          "fill-opacity": 0.55,
        },
      });

      // Development opportunity layer
      map.addLayer({
        id: "parcels-development",
        type: "fill",
        source: "parcels",
        layout: { visibility: "none" },
        filter: ["any",
          ["==", ["get", "vacantLand"], true],
          [">=", ["get", "development"], 70],
          ["==", ["get", "largeErf"], true],
        ],
        paint: { "fill-color": "#a3e635", "fill-opacity": 0.55 },
      });

      // Heatmaps
      map.addLayer({
        id: "heat-value",
        type: "heatmap",
        source: "parcel-centroids",
        layout: { visibility: "none" },
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["get", "estimatedValue"], 0, 0, 15000000, 1],
          "heatmap-intensity": 1.2,
          "heatmap-radius": 38,
          "heatmap-opacity": 0.75,
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(0,0,0,0)",
            0.2, "#1e3a8a",
            0.5, "#0ea5e9",
            0.8, "#facc15",
            1, "#ef4444",
          ],
        },
      });
      map.addLayer({
        id: "heat-sales",
        type: "heatmap",
        source: "parcel-centroids",
        layout: { visibility: "none" },
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["get", "salesRecency"], 0, 1, 12, 0.05],
          "heatmap-intensity": 1,
          "heatmap-radius": 36,
          "heatmap-opacity": 0.7,
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(0,0,0,0)",
            0.4, "#7c3aed",
            0.8, "#ec4899",
            1, "#fde68a",
          ],
        },
      });
      map.addLayer({
        id: "heat-investor",
        type: "heatmap",
        source: "parcel-centroids",
        layout: { visibility: "none" },
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["get", "investor"], 40, 0, 100, 1],
          "heatmap-intensity": 1.4,
          "heatmap-radius": 40,
          "heatmap-opacity": 0.7,
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(0,0,0,0)",
            0.3, "#064e3b",
            0.6, "#10b981",
            0.9, "#fde047",
            1, "#f97316",
          ],
        },
      });

      // Interactivity
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
          <div style="font-family: Inter, sans-serif; min-width: 180px">
            <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em">${f.properties?.area}</div>
            <div style="font-weight: 600; font-size: 13px; color: #111827">${f.properties?.street}</div>
            <div style="font-size: 12px; color: #2563eb; font-weight: 600; margin-top: 2px">${formatZAR(Number(f.properties?.estimatedValue ?? 0))}</div>
          </div>`;
        if (!popupRef.current) {
          popupRef.current = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 8, className: "pa-popup" });
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
    set("parcels-zoning", layers.zoning);
    set("parcels-oceanview", layers.oceanView);
    set("parcels-development", layers.development);
    set("heat-value", layers.valueHeat);
    set("heat-sales", layers.salesHeat);
    set("heat-investor", layers.investorHeat);
  }, [layers, styleVersion, ready]);

  // Update filtered feature state
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("parcels")) return;
    for (const p of PROPERTIES) {
      map.setFeatureState({ source: "parcels", id: p.id }, { filtered: filteredIds.has(p.id) });
    }
  }, [filteredIds, styleVersion, ready]);

  // Update selection + fly to selected
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
      if (p) map.flyTo({ center: p.centroid, zoom: Math.max(map.getZoom(), 16), duration: 900, essential: true });
    }
    prevSelectedRef.current = selectedId;
  }, [selectedId, styleVersion, ready]);

  if (!TOKEN) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-slate-900 to-slate-700 text-white">
        <div className="max-w-md rounded-2xl border border-white/10 bg-black/40 p-6 text-center backdrop-blur">
          <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-amber-400" />
          <div className="text-base font-semibold">Mapbox token missing</div>
          <p className="mt-1 text-sm text-white/70">
            Set <code className="rounded bg-white/10 px-1">VITE_MAPBOX_ACCESS_TOKEN</code> in your environment to load the map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      aria-label="St Francis Bay property map"
    />
  );
}
