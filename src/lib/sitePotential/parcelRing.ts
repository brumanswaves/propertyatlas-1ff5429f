/**
 * Extracts the exterior ring of an official parcel geometry as [lng, lat]
 * pairs. For MultiPolygon geometry the largest ring is used, which is the
 * parcel body rather than an outbuilding sliver.
 */
export function isValidParcelRing(value: unknown): value is Array<[number, number]> {
  if (!Array.isArray(value) || value.length < 3 || value.length > 10000) return false;
  if (!value.every((p) => Array.isArray(p) && p.length === 2 &&
    p.every((n) => typeof n === "number" && Number.isFinite(n)) &&
    Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90)) return false;
  const points = value as Array<[number, number]>;
  if (new Set(points.map((p) => p.join(","))).size < 3) return false;
  const [x, y] = points[0];
  const area = points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length];
    return sum + (p[0] - x) * (q[1] - y) - (q[0] - x) * (p[1] - y);
  }, 0);
  return Math.abs(area) > 1e-14;
}

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

  const valid = candidates.filter((ring) => ring.length >= 4 && isValidParcelRing(ring));
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
