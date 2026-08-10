import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  localPolygonToWgs84,
  localToWgs84,
  polygonCentroid,
  type BuildEnvelopeResult,
} from "@/lib/sitePotential/buildEnvelope";
import { selectRoadLayerIds, type RoadLineInput } from "@/lib/sitePotential/streetFrontage";

import { BuildEnvelopeDiagram } from "./BuildEnvelopeDiagram";

/**
 * Satellite-backed parcel visual for Site Potential.
 *
 * Every overlay is a real georeferenced Mapbox layer built from the same
 * deterministic geometry as the printed diagram, converted back to WGS84 with
 * the exact inverse of the projection used to compute it. Nothing is drawn as
 * a floating SVG on top of the map, so the outlines cannot drift out of
 * alignment when the map is panned or zoomed.
 *
 * The map is also the source of road evidence for street-frontage detection:
 * rendered road lines near the parcel are handed back to the caller, which
 * scores them deterministically. The map never decides the frontage itself.
 *
 * Mapbox is imported client-side only. Missing token, missing geometry, a
 * failed style load or a thrown import all fall back to the clean
 * deterministic diagram rather than an empty dark block.
 */

export interface SatelliteParcelMapProps {
  ring: Array<[number, number]> | null;
  result: BuildEnvelopeResult;
  className?: string;
  /** Rendered road lines near the parcel, for street-frontage detection. */
  onRoadsDetected?: (roads: RoadLineInput[]) => void;
  /** When true, every parcel edge becomes clickable on the satellite map. */
  selectableEdges?: boolean;
  /** Edge currently highlighted while the user picks the street frontage. */
  highlightEdgeIndex?: number | null;
  onEdgeSelect?: (edgeIndex: number) => void;
}

const TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;

const SRC = {
  parcel: "site-potential-parcel",
  street: "site-potential-street",
  secondaryStreet: "site-potential-secondary-street",
  setback: "site-potential-setback",
  streetLine: "site-potential-street-building-line",
  coverage: "site-potential-coverage",
  coverageLabel: "site-potential-coverage-label",
  edges: "site-potential-edges",
} as const;

function ringBounds(ring: Array<[number, number]>) {
  const lngs = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const padLng = Math.max((maxLng - minLng) * 0.25, 0.00004);
  const padLat = Math.max((maxLat - minLat) * 0.25, 0.00004);
  return [
    [minLng - padLng, minLat - padLat],
    [maxLng + padLng, maxLat + padLat],
  ] as [[number, number], [number, number]];
}

function polygonFeature(coords: Array<[number, number]>) {
  const ring =
    coords.length && coords[0] !== coords[coords.length - 1] ? [...coords, coords[0]] : coords;
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: [ring] },
  };
}

function emptyCollection() {
  return { type: "FeatureCollection" as const, features: [] };
}

export function SatelliteParcelMap({
  ring,
  result,
  className,
  onRoadsDetected,
  selectableEdges = false,
  highlightEdgeIndex = null,
  onEdgeSelect,
}: SatelliteParcelMapProps) {
  const [mounted, setMounted] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("mapbox-gl").Map | null>(null);
  const roadsCallbackRef = useRef(onRoadsDetected);
  const edgeSelectRef = useRef(onEdgeSelect);
  roadsCallbackRef.current = onRoadsDetected;
  edgeSelectRef.current = onEdgeSelect;

  useEffect(() => {
    setMounted(true);
  }, []);

  const hasGeometry = Boolean(ring && ring.length >= 3);
  const bounds = useMemo(
    () => (hasGeometry ? ringBounds(ring as Array<[number, number]>) : null),
    [hasGeometry, ring],
  );

  /** Deterministic geometry converted back to real-world coordinates. */
  const geo = useMemo(() => {
    const projection = result.projection;
    if (!projection) return null;
    const parcel =
      result.parcelPolygon.length >= 3
        ? polygonFeature(localPolygonToWgs84(result.parcelPolygon, projection))
        : null;
    const setback =
      result.envelopePolygon && result.envelopePolygon.length >= 3
        ? polygonFeature(localPolygonToWgs84(result.envelopePolygon, projection))
        : null;
    const coverage =
      result.coverageFootprint && result.coverageFootprint.polygon.length >= 3
        ? polygonFeature(localPolygonToWgs84(result.coverageFootprint.polygon, projection))
        : null;
    const line = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: [localToWgs84(a, projection), localToWgs84(b, projection)],
      },
    });
    const street = result.streetEdge ? line(result.streetEdge.a, result.streetEdge.b) : null;
    const secondaryStreet = result.secondaryStreetEdge
      ? line(result.secondaryStreetEdge.a, result.secondaryStreetEdge.b)
      : null;
    const streetLine = result.streetEdge?.setbackLine
      ? line(result.streetEdge.setbackLine.a, result.streetEdge.setbackLine.b)
      : null;
    const coverageLabel =
      result.coverageFootprint && result.coverageFootprint.polygon.length >= 3
        ? {
            type: "Feature" as const,
            properties: {
              label: `MAX COVERAGE · ${result.coverageFootprint.areaM2} m²`,
            },
            geometry: {
              type: "Point" as const,
              coordinates: localToWgs84(
                polygonCentroid(result.coverageFootprint.polygon),
                projection,
              ),
            },
          }
        : null;
    const edges = {
      type: "FeatureCollection" as const,
      features: result.parcelPolygon.map((a, index) => {
        const b = result.parcelPolygon[(index + 1) % result.parcelPolygon.length];
        return {
          type: "Feature" as const,
          properties: { edgeIndex: index },
          geometry: {
            type: "LineString" as const,
            coordinates: [localToWgs84(a, projection), localToWgs84(b, projection)],
          },
        };
      }),
    };
    return { parcel, setback, coverage, street, secondaryStreet, streetLine, coverageLabel, edges };
  }, [result]);

  const fit = useCallback(() => {
    const map = mapRef.current;
    if (!map || !bounds) return;
    map.fitBounds(bounds, { padding: 24, animate: false });
  }, [bounds]);

  // Create the map once the container, token and geometry are all present.
  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    if (!TOKEN || !bounds || !containerRef.current) {
      setMapFailed(true);
      return;
    }

    let cancelled = false;
    let map: import("mapbox-gl").Map | null = null;

    void (async () => {
      try {
        const mapboxModule = await import("mapbox-gl");
        await import("mapbox-gl/dist/mapbox-gl.css");
        if (cancelled || !containerRef.current) return;
        const mapboxgl = mapboxModule.default;
        mapboxgl.accessToken = TOKEN;
        map = new mapboxgl.Map({
          container: containerRef.current,
          style: "mapbox://styles/mapbox/satellite-streets-v12",
          bounds,
          fitBoundsOptions: { padding: 24, animate: false },
          interactive: true,
          attributionControl: false,
        });
        map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

        map.on("style.load", () => {
          if (cancelled || !map) return;
          for (const id of Object.values(SRC)) {
            if (!map.getSource(id)) {
              map.addSource(id, { type: "geojson", data: emptyCollection() });
            }
          }
          // Setback envelope (light green) sits lowest, then the salmon
          // maximum-coverage polygon, then the building lines, then the street
          // frontage and the parcel boundary on top.
          map.addLayer({
            id: `${SRC.setback}-fill`,
            type: "fill",
            source: SRC.setback,
            paint: { "fill-color": "#4ADE80", "fill-opacity": 0.18 },
          });
          map.addLayer({
            id: `${SRC.coverage}-fill`,
            type: "fill",
            source: SRC.coverage,
            paint: { "fill-color": "#FB7185", "fill-opacity": 0.35 },
          });
          map.addLayer({
            id: `${SRC.coverage}-line`,
            type: "line",
            source: SRC.coverage,
            paint: {
              "line-color": "#EF4444",
              "line-width": 2,
              "line-dasharray": [2, 1.4],
            },
          });
          map.addLayer({
            id: `${SRC.setback}-line`,
            type: "line",
            source: SRC.setback,
            paint: {
              "line-color": "#22C55E",
              "line-width": 2,
              "line-dasharray": [2, 1.5],
            },
          });
          map.addLayer({
            id: `${SRC.streetLine}-line`,
            type: "line",
            source: SRC.streetLine,
            paint: {
              "line-color": "#38BDF8",
              "line-width": 3,
              "line-dasharray": [3, 1.6],
            },
          });
          map.addLayer({
            id: `${SRC.street}-line`,
            type: "line",
            source: SRC.street,
            paint: { "line-color": "#FF6A00", "line-width": 4 },
          });
          map.addLayer({
            id: `${SRC.secondaryStreet}-line`,
            type: "line",
            source: SRC.secondaryStreet,
            paint: { "line-color": "#F59E0B", "line-width": 4, "line-dasharray": [2, 1.5] },
          });
          map.addLayer({
            id: `${SRC.parcel}-line`,
            type: "line",
            source: SRC.parcel,
            paint: { "line-color": "#22D3EE", "line-width": 2.5 },
          });
          map.addLayer({
            id: `${SRC.coverageLabel}-symbol`,
            type: "symbol",
            source: SRC.coverageLabel,
            layout: {
              "text-field": ["get", "label"],
              "text-size": 12,
              "text-letter-spacing": 0.08,
              "text-allow-overlap": true,
            },
            paint: {
              "text-color": "#FFFFFF",
              "text-halo-color": "#7F1D1D",
              "text-halo-width": 1.4,
            },
          });
          // Clickable parcel edges for street-frontage confirmation. Hidden
          // (fully transparent, non-interactive) until the caller asks for it.
          map.addLayer({
            id: `${SRC.edges}-hit`,
            type: "line",
            source: SRC.edges,
            paint: { "line-color": "#FFFFFF", "line-opacity": 0, "line-width": 22 },
          });
          map.addLayer({
            id: `${SRC.edges}-line`,
            type: "line",
            source: SRC.edges,
            paint: {
              "line-color": [
                "case",
                ["==", ["get", "edgeIndex"], ["literal", -1]],
                "#FF6A00",
                "#FACC15",
              ],
              "line-opacity": 0,
              "line-width": 4,
              "line-dasharray": [2, 1.4],
            },
          });
          map.on("click", `${SRC.edges}-hit`, (event) => {
            const feature = event.features?.[0];
            const index = feature?.properties?.edgeIndex;
            if (typeof index === "number") edgeSelectRef.current?.(index);
          });
          map.on("mouseenter", `${SRC.edges}-hit`, () => {
            map!.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", `${SRC.edges}-hit`, () => {
            map!.getCanvas().style.cursor = "";
          });
          map.resize();
          setMapReady(true);
        });

        // Real road geometry near the parcel, handed to the deterministic
        // detector. The map is evidence, never the decision-maker.
        map.once("idle", () => {
          if (cancelled || !map || !roadsCallbackRef.current) return;
          try {
            const layerIds = selectRoadLayerIds(
              (map.getStyle()?.layers ?? []) as Array<{
                id: string;
                type: string;
                "source-layer"?: string;
              }>,
            ).filter((id) => map!.getLayer(id));
            if (!layerIds.length) {
              roadsCallbackRef.current([]);
              return;
            }
            const features = map.queryRenderedFeatures({ layers: layerIds });
            const roads: RoadLineInput[] = features
              .filter(
                (feature) =>
                  feature.geometry?.type === "LineString" ||
                  feature.geometry?.type === "MultiLineString",
              )
              .map((feature) => ({
                name:
                  (feature.properties?.name as string | undefined) ??
                  (feature.properties?.name_en as string | undefined) ??
                  null,
                layerId: feature.layer?.id ?? null,
                coordinates: (feature.geometry as GeoJSON.LineString | GeoJSON.MultiLineString)
                  .coordinates as RoadLineInput["coordinates"],
              }));
            roadsCallbackRef.current(roads);
          } catch {
            roadsCallbackRef.current([]);
          }
        });

        map.on("error", (event) => {
          // Style/tile/auth failures must degrade to the deterministic diagram
          // instead of leaving a blank canvas behind the overlay.
          const message = String((event as { error?: { message?: string } })?.error?.message ?? "");
          if (!cancelled && /token|unauthor|style|401|403|404/i.test(message)) {
            setMapFailed(true);
          }
        });

        mapRef.current = map;
      } catch {
        if (!cancelled) setMapFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      setMapReady(false);
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, bounds?.toString()]);

  // Keep the georeferenced overlays in sync with the deterministic result.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !geo) return;
    const set = (id: string, feature: GeoJSON.Feature | null) => {
      const source = map.getSource(id) as import("mapbox-gl").GeoJSONSource | undefined;
      if (!source) return;
      source.setData(
        feature ? { type: "FeatureCollection", features: [feature] } : emptyCollection(),
      );
    };
    set(SRC.parcel, geo.parcel);
    set(SRC.setback, geo.setback);
    set(SRC.coverage, geo.coverage);
    set(SRC.street, geo.street);
    set(SRC.secondaryStreet, geo.secondaryStreet);
    set(SRC.streetLine, geo.streetLine);
    set(SRC.coverageLabel, geo.coverageLabel);
    const edgeSource = map.getSource(SRC.edges) as import("mapbox-gl").GeoJSONSource | undefined;
    edgeSource?.setData(geo.edges);
  }, [geo, mapReady]);

  // Edge-picking mode: only visible and clickable while the caller asks for a
  // street-frontage confirmation.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (!map.getLayer(`${SRC.edges}-line`) || !map.getLayer(`${SRC.edges}-hit`)) return;
    map.setPaintProperty(`${SRC.edges}-line`, "line-opacity", selectableEdges ? 0.95 : 0);
    map.setPaintProperty(`${SRC.edges}-line`, "line-color", [
      "case",
      ["==", ["get", "edgeIndex"], highlightEdgeIndex ?? -1],
      "#FF6A00",
      "#FACC15",
    ]);
    map.setLayoutProperty(`${SRC.edges}-hit`, "visibility", selectableEdges ? "visible" : "none");
  }, [highlightEdgeIndex, mapReady, selectableEdges]);

  // The satellite canvas must always fill its frame, including after the
  // enclosing disclosure opens or the layout reflows.
  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      mapRef.current?.resize();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [mapReady]);

  const showFallback = !mounted || !TOKEN || !hasGeometry || mapFailed || !geo;

  if (showFallback) {
    return (
      <div className={cn("relative", className)}>
        <BuildEnvelopeDiagram result={result} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative h-[380px] overflow-hidden rounded-2xl border border-white/10 bg-[#06152A] sm:h-[520px]",
        className,
      )}
    >
      {/* The canvas fills the entire frame: no legend or footer inside it. */}
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />
      {!mapReady && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[#06152A]/60 text-xs text-white/70">
          Loading satellite imagery…
        </div>
      )}
      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2 text-[10px] font-semibold text-white">
        <LegendChip color="#22D3EE" label="Erf boundary" />
        <LegendChip color="#FF6A00" label="Street frontage" />
        {result.secondaryStreetEdge ? <LegendChip color="#F59E0B" label="Secondary frontage" /> : null}
        <LegendChip color="#38BDF8" label="Street building line" />
        <LegendChip color="#22C55E" label="Side / rear building line" />
        <LegendChip color="#FB7185" label="Max coverage" />
      </div>
      <button
        type="button"
        onClick={fit}
        className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-[#06152A]/80 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur hover:bg-[#06152A]"
      >
        <Maximize2 className="h-3.5 w-3.5" />
        Fit parcel
      </button>
    </div>
  );
}

function LegendChip({ color, label, faded }: { color: string; label: string; faded?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#06152A]/70 px-2 py-1 backdrop-blur">
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color, opacity: faded ? 0.5 : 1 }}
      />
      {label}
    </span>
  );
}
