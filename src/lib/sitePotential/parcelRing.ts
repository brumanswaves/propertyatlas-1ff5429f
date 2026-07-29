/**
 * Extracts the exterior ring of an official parcel geometry as [lng, lat]
 * pairs. For MultiPolygon geometry the largest ring is used, which is the
 * parcel body rather than an outbuilding sliver.
 */
export function extractExteriorRing(
  geometry: GeoJSON.Geometry | null | undefined,
): Array<[number, number]> | null {
  if (!geometry) return null;

  const candidates: Array<Array<[number, number]>> = [];

  if (geometry.type === "Polygon") {
    const ring = geometry.coordinates?.[0];
    if (Array.isArray(ring)) candidates.push(ring as Array<[number, number]>);
  } else if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates ?? []) {
      const ring = polygon?.[0];
      if (Array.isArray(ring)) candidates.push(ring as Array<[number, number]>);
    }
  }

  const valid = candidates.filter((ring) => ring.length >= 4);
  if (!valid.length) return null;

  let best = valid[0];
  let bestSpan = -1;
  for (const ring of valid) {
    const xs = ring.map((p) => p[0]);
    const ys = ring.map((p) => p[1]);
    const span = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
    if (span > bestSpan) {
      bestSpan = span;
      best = ring;
    }
  }
  return best;
}
