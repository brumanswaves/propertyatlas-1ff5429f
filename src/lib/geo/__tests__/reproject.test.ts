import { describe, it, expect } from "vitest";
import {
  loToWgs84,
  wgs84ToLo,
  loCentralMeridianFromEpsg,
  loCentralMeridianFromZone,
  reprojectPolygonLoToWgs84,
  reprojectMultiPolygonLoToWgs84,
  shapeCentroid,
} from "@/lib/geo/reproject";

describe("Hartebeesthoek94 LO ↔ WGS84", () => {
  it("LO19 zone resolution", () => {
    expect(loCentralMeridianFromZone(19)).toBe(19);
    expect(loCentralMeridianFromEpsg(2048)).toBe(19);
    expect(() => loCentralMeridianFromZone(18)).toThrow();
    expect(() => loCentralMeridianFromEpsg(9999)).toThrow();
  });

  it("round-trips a Cape Town point (LO19) with sub-millimetre error", () => {
    const lng = 18.4241;
    const lat = -33.9249;
    const [y, x] = wgs84ToLo(lng, lat, { centralMeridian: 19 });
    const [lng2, lat2] = loToWgs84(y, x, { centralMeridian: 19 });
    expect(lng2).toBeCloseTo(lng, 9);
    expect(lat2).toBeCloseTo(lat, 9);
  });

  it("round-trips a St Francis Bay point (LO25) accurately", () => {
    const lng = 24.8395;
    const lat = -34.1737;
    const [y, x] = wgs84ToLo(lng, lat, { centralMeridian: 25 });
    expect(y).toBeGreaterThan(0); // southing positive
    const [lng2, lat2] = loToWgs84(y, x, { centralMeridian: 25 });
    expect(lng2).toBeCloseTo(lng, 9);
    expect(lat2).toBeCloseTo(lat, 9);
  });

  it("LO origin (y=0, x=0) reprojects to lat≈0 on central meridian", () => {
    const [lng, lat] = loToWgs84(0, 0, { centralMeridian: 19 });
    expect(lng).toBeCloseTo(19, 9);
    expect(lat).toBeCloseTo(0, 9);
  });

  it("reprojects a Polygon ring", () => {
    const opts = { centralMeridian: 25 };
    const corners: [number, number][] = [
      [18.4241, -33.9249],
      [18.4251, -33.9249],
      [18.4251, -33.9239],
      [18.4241, -33.9239],
    ];
    const loRing: [number, number][] = corners.map(([lng, lat]) =>
      wgs84ToLo(lng, lat, opts),
    );
    const poly = {
      type: "Polygon" as const,
      coordinates: [[...loRing, loRing[0]!]],
    };
    const out = reprojectPolygonLoToWgs84(poly, opts);
    expect(out.type).toBe("Polygon");
    for (let i = 0; i < corners.length; i++) {
      const [lng, lat] = out.coordinates[0]![i]!;
      expect(lng).toBeCloseTo(corners[i]![0], 5);
      expect(lat).toBeCloseTo(corners[i]![1], 5);
    }
  });

  it("reprojects a MultiPolygon and computes a centroid", () => {
    const opts = { centralMeridian: 19 };
    const ring: [number, number][] = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
      [0, 0],
    ];
    const mp = {
      type: "MultiPolygon" as const,
      coordinates: [[ring], [ring]],
    };
    const out = reprojectMultiPolygonLoToWgs84(mp, opts);
    expect(out.type).toBe("MultiPolygon");
    expect(out.coordinates).toHaveLength(2);
    const c = shapeCentroid(out);
    expect(c).not.toBeNull();
    expect(c![0]).toBeCloseTo(19, 2);
  });
});
