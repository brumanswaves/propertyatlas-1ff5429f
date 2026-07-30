import { useEffect, useRef, useState } from "react";
import { Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BuildEnvelopeResult } from "@/lib/sitePotential/buildEnvelope";
import { BuildEnvelopeDiagram } from "./BuildEnvelopeDiagram";

/**
 * Satellite-backed parcel visual for Site Potential.
 *
 * Reuses the same Mapbox stack/token already used by Easy Erf (see
 * `src/components/map/MapCanvas.tsx`). The satellite imagery renders
 * BENEATH the deterministic parcel/setback/envelope overlay produced by
 * `BuildEnvelopeDiagram`; nothing here generates or infers geometry.
 *
 * Map libraries are loaded client-side only (dynamic import), so SSR never
 * touches `mapbox-gl`. If imagery cannot load — no token, no network, no
 * geometry — this falls back to the clean parcel-outline SVG rather than an
 * empty dark block.
 */

export interface SatelliteParcelMapProps {
  ring: Array<[number, number]> | null;
  result: BuildEnvelopeResult;
  className?: string;
}

const TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;

function ringBounds(ring: Array<[number, number]>) {
  const lngs = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const lngSpan = Math.max(maxLng - minLng, 0.00003);
  const latSpan = Math.max(maxLat - minLat, 0.00003);
  const padLng = lngSpan * 0.18;
  const padLat = latSpan * 0.18;
  const latMid = (minLat + maxLat) / 2;
  const cos = Math.max(Math.cos((latMid * Math.PI) / 180), 0.15);
  const paddedLngSpan = lngSpan + padLng * 2;
  const paddedLatSpan = latSpan + padLat * 2;
  // Aspect matches the equirectangular projection used by the deterministic
  // diagram, so the overlay lines up with the imagery beneath it.
  const aspect = (paddedLngSpan * cos) / paddedLatSpan;
  return {
    bounds: [
      [minLng - padLng, minLat - padLat],
      [maxLng + padLng, maxLat + padLat],
    ] as [[number, number], [number, number]],
    aspect: Number.isFinite(aspect) && aspect > 0 ? aspect : 1,
  };
}

export function SatelliteParcelMap({ ring, result, className }: SatelliteParcelMapProps) {
  const [mounted, setMounted] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("mapbox-gl").Map | null>(null);
  const fitRef = useRef<() => void>(() => {});

  useEffect(() => {
    setMounted(true);
  }, []);

  const hasGeometry = Boolean(ring && ring.length >= 3);
  const bounds = hasGeometry ? ringBounds(ring as Array<[number, number]>) : null;

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
          interactive: true,
          attributionControl: false,
        });
        map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
        const fit = () => {
          if (!map) return;
          map.fitBounds(bounds.bounds, { padding: 0, animate: false });
        };
        fitRef.current = fit;
        map.on("load", () => {
          if (cancelled) return;
          fit();
          setMapReady(true);
        });
        map.on("error", () => {
          if (!cancelled) setMapFailed(true);
        });
        mapRef.current = map;
      } catch {
        if (!cancelled) setMapFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, TOKEN, bounds?.bounds.toString()]);

  const showFallback = !mounted || !TOKEN || !hasGeometry || mapFailed;

  if (showFallback) {
    return (
      <div className={cn("relative", className)}>
        <BuildEnvelopeDiagram result={result} />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-white/10 bg-[#06152A]", className)}>
      <div
        className="relative w-full"
        style={{ aspectRatio: bounds ? `${bounds.aspect} / 1` : "1 / 1" }}
      >
        <div ref={containerRef} className="absolute inset-0" aria-hidden="true" />
        {/* Deterministic overlay drawn on top of the satellite imagery. */}
        <div className="pointer-events-none absolute inset-0">
          <BuildEnvelopeDiagram
            result={result}
            className="h-full border-none bg-transparent"
            transparentBackground
          />
        </div>
        {!mapReady && (
          <div className="absolute inset-0 grid place-items-center bg-[#06152A]/60 text-xs text-white/70">
            Loading satellite imagery…
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => fitRef.current()}
        className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-[#06152A]/80 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur hover:bg-[#06152A]"
      >
        <Maximize2 className="h-3.5 w-3.5" />
        Fit parcel
      </button>
      {/* Static outline kept for print output; the map canvas does not print. */}
      <div className="hidden print:block">
        <BuildEnvelopeDiagram result={result} />
      </div>
    </div>
  );
}
