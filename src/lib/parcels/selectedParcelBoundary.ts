import type { Geometry } from "geojson";
import type { OfficialFeatureSelection } from "@/components/map/MapCanvas";
import { loadOfficialPublicLayer } from "@/lib/providers/publicDataClient";
import { buildSelectedOfficialParcelId, officialFeatureMatchesSavedParcelId } from "./officialParcelId";

export function hasParcelBoundary(geometry: Geometry | null | undefined): boolean {
  if (!geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")) return false;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.length > 0 && polygons.every((polygon) => polygon.length > 0 &&
    polygon.every((ring) => ring.length >= 4 &&
      ring.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]) &&
        Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90) &&
      ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]));
}

/** Public geometry only. Never substitute a nearby parcel or overwrite dossier properties. */
export async function loadSelectedParcelBoundary(
  selection: OfficialFeatureSelection,
  loadLayer = loadOfficialPublicLayer,
): Promise<Geometry | null> {
  if (hasParcelBoundary(selection.geometry)) return selection.geometry ?? null;
  if (selection.layer !== "csg-parcels") return null;
  const id = buildSelectedOfficialParcelId(selection);
  if (!id.startsWith("csg:lpi:") && !id.startsWith("csg:parcel-key:")) return null;
  const [lng, lat] = selection.lngLat;
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90) return null;
  try {
    const result = await loadLayer("csg-parcels", [lng - 0.002, lat - 0.002, lng + 0.002, lat + 0.002], 400);
    if (!result.official || result.fallbackUsed === "test") return null;
    const matches = result.features.filter((feature) =>
      officialFeatureMatchesSavedParcelId(id, "csg-parcels", feature.properties) &&
      hasParcelBoundary(feature.geometry));
    // Duplicate identical rows are harmless; competing outlines are not.
    const geometries = new Map(matches.map((feature) => [JSON.stringify(feature.geometry), feature.geometry]));
    return geometries.size === 1 ? [...geometries.values()][0] : null;
  } catch {
    return null;
  }
}
