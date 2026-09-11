import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPin } from "lucide-react";

const TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;

type Coordinate = [number, number];

function validCoordinate(value: unknown): value is Coordinate {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1])
  );
}

function closeRing(ring: Coordinate[]) {
  if (!ring.length) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
}

function boundsFor(ring: Coordinate[]) {
  const bounds = new mapboxgl.LngLatBounds();
  ring.forEach(([lng, lat]) => bounds.extend([lng, lat]));
  return bounds;
}

export function ReportParcelSatelliteMap({
  ring,
  center,
  label,
}: {
  ring: Coordinate[] | null;
  center?: { lng: number; lat: number } | null;
  label?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [failed, setFailed] = useState(false);

  const usableRing = useMemo(
    () => (ring && ring.length >= 3 && ring.every(validCoordinate) ? closeRing(ring) : null),
    [ring],
  );
  const usableCenter =
    center && Number.isFinite(center.lng) && Number.isFinite(center.lat)
      ? ([center.lng, center.lat] as Coordinate)
      : usableRing?.[0] ?? null;

  useEffect(() => {
    if (!TOKEN || !containerRef.current || !usableCenter) {
      setFailed(true);
      return;
    }

    setFailed(false);
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: usableCenter,
      zoom: usableRing ? 16.5 : 18,
      attributionControl: true,
      interactive: true,
    });
    mapRef.current = map;

    map.on("load", () => {
      if (usableRing) {
        map.addSource("report-parcel", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [usableRing] },
          },
        });
        map.addLayer({
          id: "report-parcel-fill",
          type: "fill",
          source: "report-parcel",
          paint: { "fill-color": "#FF6A00", "fill-opacity": 0.12 },
        });
        map.addLayer({
          id: "report-parcel-outline",
          type: "line",
          source: "report-parcel",
          paint: { "line-color": "#FF6A00", "line-width": 3 },
        });
        map.fitBounds(boundsFor(usableRing), { padding: 54, maxZoom: 19, duration: 0 });
      } else {
        new mapboxgl.Marker({ color: "#FF6A00" }).setLngLat(usableCenter).addTo(map);
      }
    });

    map.on("error", () => setFailed(true));

    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, [usableCenter?.[0], usableCenter?.[1], usableRing]);

  if (failed || !TOKEN || !usableCenter) {
    return (
      <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 bg-[#0D1B2A] p-8 text-center text-white/70">
        <MapPin className="h-6 w-6 text-[#FF6A00]" />
        <p className="text-sm font-semibold text-white">{label ?? "Selected erf"}</p>
        <p className="max-w-sm text-xs leading-5 text-white/60">
          Satellite context is unavailable for this saved property location. Easy Erf will not substitute generated imagery.
        </p>
      </div>
    );
  }

  return (
    <div className="relative min-h-[260px] w-full overflow-hidden bg-[#0D1B2A]" data-report-satellite-map>
      <div ref={containerRef} className="absolute inset-0 min-h-[260px] w-full" aria-label={`Satellite context for ${label ?? "selected erf"}`} />
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-[#0D1B2A]/82 px-3 py-1.5 text-[10px] font-semibold text-white shadow">
        {usableRing ? "Satellite context · recorded parcel boundary" : "Satellite context · recorded property location"}
      </div>
    </div>
  );
}
