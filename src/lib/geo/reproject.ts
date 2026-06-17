// Hartebeesthoek94 / South African LO (Gauss Conformal) ↔ WGS84.
//
// The South African cadastral system (Surveyor General) returns coordinates in
// the LOxx system: a Transverse Mercator projection on the Hartebeesthoek94
// datum, with **southings positive** (Y axis points south) and **westings
// positive** (X axis points west, measured from a central meridian which is an
// odd-numbered longitude: 15, 17, 19, 21, 23, 25, 27, 29, 31, 33).
//
// HBK94 is defined on the WGS84 ellipsoid (a = 6378137, 1/f = 298.257223563),
// so no datum shift is required to interoperate with WGS84 lng/lat.
//
// References: SA Land Surveying Manual; EPSG codes 2046..2055.

import type {
  GeoJSONMultiPolygon,
  GeoJSONPolygon,
  GeoJSONShape,
} from "../providers/types";

// WGS84 ellipsoid parameters
const A = 6378137.0;
const F = 1 / 298.257223563;
const E2 = F * (2 - F);

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/** Resolve central meridian (degrees) from an LO zone (odd longitude). */
export function loCentralMeridianFromZone(zone: number): number {
  if (!Number.isInteger(zone) || zone < 13 || zone > 35 || zone % 2 === 0) {
    throw new Error(`Invalid LO zone: ${zone}. Must be an odd integer 13..35.`);
  }
  return zone;
}

/** Resolve LO central meridian from an EPSG code in the 2046..2055 range. */
export function loCentralMeridianFromEpsg(epsg: number): number {
  // EPSG 2046 = LO15, 2047 = LO17, ... 2055 = LO33
  const map: Record<number, number> = {
    2046: 15, 2047: 17, 2048: 19, 2049: 21, 2050: 23,
    2051: 25, 2052: 27, 2053: 29, 2054: 31, 2055: 33,
  };
  const lon = map[epsg];
  if (!lon) throw new Error(`Unsupported EPSG for SA LO: ${epsg}`);
  return lon;
}

// ---- Meridional arc helpers (Snyder 3-1) ----
function meridionalArc(phi: number): number {
  const e2 = E2;
  const e4 = e2 * e2;
  const e6 = e4 * e2;
  return (
    A *
    ((1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * phi -
      ((3 * e2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * phi) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * phi) -
      ((35 * e6) / 3072) * Math.sin(6 * phi))
  );
}

function footpointLatitude(M: number): number {
  const e2 = E2;
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const mu = M / (A * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 ** 3) / 256));
  return (
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu)
  );
}

export interface LoToWgs84Options {
  /** Central meridian, degrees (odd: 15, 17, 19, ...). */
  centralMeridian: number;
  /** Scale factor at the central meridian. SA Gauss Conformal uses 1.0. */
  k0?: number;
  /** False easting / northing. SA LO uses 0/0. */
  falseEasting?: number;
  falseNorthing?: number;
}

/**
 * Convert a single LO coordinate (southings, westings — both positive in metres
 * from the central meridian) to WGS84 [lng, lat] in degrees.
 *
 * @param y southing (metres south of the equator; **positive going south**)
 * @param x westing  (metres west of the central meridian; **positive going west**)
 */
export function loToWgs84(
  y: number,
  x: number,
  opts: LoToWgs84Options,
): [number, number] {
  const { centralMeridian, k0 = 1, falseEasting = 0, falseNorthing = 0 } = opts;

  // SA convention: southing positive → standard TM northing is negative south of equator.
  const N = -(y - falseNorthing); // standard TM northing
  const E = -(x - falseEasting);  // standard TM easting (east-positive)

  const M = N / k0;
  const phi1 = footpointLatitude(M);

  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const tanPhi1 = Math.tan(phi1);

  const eP2 = E2 / (1 - E2);
  const C1 = eP2 * cosPhi1 ** 2;
  const T1 = tanPhi1 ** 2;
  const N1 = A / Math.sqrt(1 - E2 * sinPhi1 ** 2);
  const R1 = (A * (1 - E2)) / Math.pow(1 - E2 * sinPhi1 ** 2, 1.5);
  const D = E / (N1 * k0);

  const phi =
    phi1 -
    ((N1 * tanPhi1) / R1) *
      ((D * D) / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * eP2) * D ** 4) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * eP2 - 3 * C1 * C1) *
          D ** 6) /
          720);

  const lam =
    centralMeridian * DEG +
    (D -
      ((1 + 2 * T1 + C1) * D ** 3) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * eP2 + 24 * T1 * T1) * D ** 5) /
        120) /
      cosPhi1;

  return [lam * RAD, phi * RAD];
}

/**
 * Convert WGS84 [lng, lat] degrees to LO (southings, westings) metres.
 * Returned as [y_south, x_west] so it round-trips with loToWgs84(y, x).
 */
export function wgs84ToLo(
  lng: number,
  lat: number,
  opts: LoToWgs84Options,
): [number, number] {
  const { centralMeridian, k0 = 1, falseEasting = 0, falseNorthing = 0 } = opts;
  const phi = lat * DEG;
  const lam = lng * DEG;
  const lam0 = centralMeridian * DEG;

  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const tanPhi = Math.tan(phi);

  const eP2 = E2 / (1 - E2);
  const N = A / Math.sqrt(1 - E2 * sinPhi ** 2);
  const T = tanPhi ** 2;
  const C = eP2 * cosPhi ** 2;
  const A_ = (lam - lam0) * cosPhi;
  const M = meridionalArc(phi);

  const easting =
    k0 *
      N *
      (A_ +
        ((1 - T + C) * A_ ** 3) / 6 +
        ((5 - 18 * T + T * T + 72 * C - 58 * eP2) * A_ ** 5) / 120) +
    falseEasting;

  const northing =
    k0 *
      (M +
        N *
          tanPhi *
          ((A_ * A_) / 2 +
            ((5 - T + 9 * C + 4 * C * C) * A_ ** 4) / 24 +
            ((61 - 58 * T + T * T + 600 * C - 330 * eP2) * A_ ** 6) / 720)) +
    falseNorthing;

  // SA: southing positive, westing positive.
  return [-northing, -easting];
}

// ---- GeoJSON helpers ----

function reprojectRing(
  ring: [number, number][],
  opts: LoToWgs84Options,
): [number, number][] {
  return ring.map(([y, x]) => loToWgs84(y, x, opts));
}

export function reprojectPolygonLoToWgs84(
  poly: GeoJSONPolygon,
  opts: LoToWgs84Options,
): GeoJSONPolygon {
  return {
    type: "Polygon",
    coordinates: poly.coordinates.map((r) => reprojectRing(r, opts)),
  };
}

export function reprojectMultiPolygonLoToWgs84(
  poly: GeoJSONMultiPolygon,
  opts: LoToWgs84Options,
): GeoJSONMultiPolygon {
  return {
    type: "MultiPolygon",
    coordinates: poly.coordinates.map((p) =>
      p.map((r) => reprojectRing(r, opts)),
    ),
  };
}

export function reprojectShapeLoToWgs84(
  shape: GeoJSONShape,
  opts: LoToWgs84Options,
): GeoJSONShape {
  return shape.type === "Polygon"
    ? reprojectPolygonLoToWgs84(shape, opts)
    : reprojectMultiPolygonLoToWgs84(shape, opts);
}

/** Compute a simple centroid of any Polygon / MultiPolygon (first ring only). */
export function shapeCentroid(shape: GeoJSONShape): [number, number] | null {
  const ring =
    shape.type === "Polygon"
      ? shape.coordinates[0]
      : shape.coordinates[0]?.[0];
  if (!ring || ring.length === 0) return null;
  let sx = 0;
  let sy = 0;
  for (const [x, y] of ring) {
    sx += x;
    sy += y;
  }
  return [sx / ring.length, sy / ring.length];
}
