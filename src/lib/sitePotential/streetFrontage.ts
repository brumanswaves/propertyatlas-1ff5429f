/**
 * Deterministic street-frontage detection for Site Potential.
 *
 * Product rule: the street-facing boundary is never guessed from polygon
 * orientation, longest edge, shortest edge, compass direction or a prototype
 * default. It is matched against real rendered road geometry plus the saved
 * street name. When the evidence is weak or ambiguous the detector returns
 * `null` and asks the user to confirm, instead of inventing an answer.
 *
 * Everything in this module is pure so it can be tested without a map.
 */

import {
  polygonCentroid,
  projectRingToLocalMetres,
  ringProjection,
  type LocalPoint,
  type LocalProjection,
} from "./buildEnvelope";

const EARTH_M_PER_DEG = 111_320;

/** A road line pulled from the rendered map style, already name-tagged. */
export interface RoadLineInput {
  /** Road name as rendered by the map style, when the style exposes one. */
  name?: string | null;
  /** LineString or MultiLineString coordinates in [lng, lat]. */
  coordinates: Array<[number, number]> | Array<Array<[number, number]>>;
  /** Originating style layer id, kept for diagnostics only. */
  layerId?: string | null;
}

export interface StreetFrontageCandidate {
  edgeIndex: number;
  /** Shortest distance in metres from the parcel edge to any road segment. */
  distanceM: number;
  /** Absolute parallel misalignment in degrees, 0 = perfectly parallel. */
  alignmentDeg: number;
  /** True when the nearest road point lies outside the parcel polygon. */
  roadOutsideParcel: boolean;
  /** True when the nearest road name matches the saved street name. */
  nameMatch: boolean;
  roadName: string | null;
  /** Edge length in metres. Diagnostic only: never a deciding signal. */
  lengthM: number;
  score: number;
}

export type StreetFrontageMethod = "map_road_match" | "user_confirmed" | "none";

export interface StreetFrontageDetection {
  /** Auto-selected edge, or null when confirmation is required. */
  edgeIndex: number | null;
  roadName: string | null;
  /** 0..1. Only meaningful when `edgeIndex` is not null. */
  confidence: number;
  method: StreetFrontageMethod;
  candidates: StreetFrontageCandidate[];
  requiresConfirmation: boolean;
  reason: string;
}

/** Metres beyond which a road can no longer be considered adjacent to an edge. */
const MAX_ADJACENT_ROAD_M = 30;
const AUTO_SELECT_MIN_SCORE = 0.62;
const AUTO_SELECT_MIN_SEPARATION = 0.1;

/* --------------------------------- names -------------------------------- */

const SUFFIX_CANONICAL: Record<string, string> = {
  st: "street",
  str: "street",
  street: "street",
  rd: "road",
  road: "road",
  ave: "avenue",
  av: "avenue",
  avenue: "avenue",
  cres: "crescent",
  cresc: "crescent",
  crescent: "crescent",
  dr: "drive",
  drv: "drive",
  drive: "drive",
  ln: "lane",
  lane: "lane",
  cl: "close",
  close: "close",
  blvd: "boulevard",
  boulevard: "boulevard",
  pl: "place",
  place: "place",
  way: "way",
  ct: "court",
  court: "court",
  ter: "terrace",
  terrace: "terrace",
};

/** Lower-cases, strips punctuation and expands common street abbreviations. */
export function normalizeStreetName(value: string | null | undefined): string {
  if (!value) return "";
  const words = value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => SUFFIX_CANONICAL[word] ?? word);
  return words.join(" ");
}

/** True when two street names refer to the same street after normalization. */
export function streetNamesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = normalizeStreetName(a);
  const right = normalizeStreetName(b);
  if (!left || !right) return false;
  if (left === right) return true;
  // A saved market address may carry a street number or suburb around the name.
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  return shorter.length >= 4 && longer.includes(shorter);
}

/* -------------------------------- layers -------------------------------- */

const ROAD_LAYER_HINT =
  /(road|street|motorway|trunk|primary|secondary|tertiary|residential|service|track|link|path)/i;
const NON_ROAD_LAYER_HINT =
  /(parcel|contour|water|waterway|admin|boundary|building|landuse|landcover|poi|place|label|shield|aeroway|rail|ferry|hillshade|site-potential)/i;

export interface StyleLayerLike {
  id: string;
  type: string;
  "source-layer"?: string;
}

/**
 * Picks road line layers from the live style rather than hard-coding a single
 * brittle layer id, so a Mapbox style update cannot silently break detection.
 */
export function selectRoadLayerIds(layers: StyleLayerLike[] | null | undefined): string[] {
  if (!Array.isArray(layers)) return [];
  return layers
    .filter((layer) => layer && layer.type === "line")
    .filter((layer) => {
      const haystack = `${layer.id} ${layer["source-layer"] ?? ""}`;
      if (NON_ROAD_LAYER_HINT.test(haystack)) return false;
      return ROAD_LAYER_HINT.test(haystack);
    })
    .map((layer) => layer.id);
}

/** Flattens LineString / MultiLineString road inputs into plain line arrays. */
export function flattenRoadLines(road: RoadLineInput): Array<Array<[number, number]>> {
  const coords = road.coordinates as unknown[];
  if (!Array.isArray(coords) || coords.length === 0) return [];
  const first = coords[0];
  if (Array.isArray(first) && typeof first[0] === "number") {
    return [coords as Array<[number, number]>];
  }
  return (coords as Array<Array<[number, number]>>).filter(
    (line) => Array.isArray(line) && line.length >= 2,
  );
}

/* ------------------------------- geometry ------------------------------- */

function toLocal(point: [number, number], projection: LocalProjection): LocalPoint {
  return {
    x: (point[0] - projection.lng0) * EARTH_M_PER_DEG * projection.cos,
    y: -(point[1] - projection.lat0) * EARTH_M_PER_DEG,
  };
}

function pointSegmentDistance(p: LocalPoint, a: LocalPoint, b: LocalPoint) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { distance: Math.hypot(p.x - a.x, p.y - a.y), point: a };
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const closest = { x: a.x + dx * t, y: a.y + dy * t };
  return { distance: Math.hypot(p.x - closest.x, p.y - closest.y), point: closest };
}

/** Shortest distance between two segments, plus the closest point on cd. */
function segmentSegmentDistance(a: LocalPoint, b: LocalPoint, c: LocalPoint, d: LocalPoint) {
  const options = [
    { ...pointSegmentDistance(a, c, d), onRoad: true },
    { ...pointSegmentDistance(b, c, d), onRoad: true },
  ];
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  options.push({ ...pointSegmentDistance(mid, c, d), onRoad: true });
  const reverse = [pointSegmentDistance(c, a, b), pointSegmentDistance(d, a, b)];
  let best = options[0];
  for (const option of options) if (option.distance < best.distance) best = option;
  for (const option of reverse) {
    if (option.distance < best.distance) {
      // Keep a road-side reference point for the inside/outside test.
      const nearest = pointSegmentDistance(option.point, c, d);
      best = { distance: option.distance, point: nearest.point, onRoad: true };
    }
  }
  return best;
}

function angleDeg(a: LocalPoint, b: LocalPoint) {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

/** Parallel misalignment in [0, 90]. Direction of travel is irrelevant. */
function parallelDifference(angleA: number, angleB: number) {
  let diff = Math.abs(angleA - angleB) % 180;
  if (diff > 90) diff = 180 - diff;
  return diff;
}

export function pointInPolygon(point: LocalPoint, polygon: LocalPoint[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

/* ------------------------------- detection ------------------------------ */

export interface DetectStreetFrontageArgs {
  /** Official parcel exterior ring in [lng, lat]. */
  ring: Array<[number, number]> | null;
  /** Nearby rendered road line features. */
  roads: RoadLineInput[];
  /** Saved Market address or street name, e.g. "Padrone Crescent". */
  savedStreetName?: string | null;
  /** User-confirmed edge always wins and short-circuits scoring. */
  confirmedEdgeIndex?: number | null;
}

export function detectStreetFrontage(args: DetectStreetFrontageArgs): StreetFrontageDetection {
  const projection = args.ring ? ringProjection(args.ring) : null;
  const polygon = args.ring ? projectRingToLocalMetres(args.ring) : [];

  if (!projection || polygon.length < 3) {
    return {
      edgeIndex: null,
      roadName: null,
      confidence: 0,
      method: "none",
      candidates: [],
      requiresConfirmation: true,
      reason: "No parcel geometry is available, so the street boundary cannot be detected.",
    };
  }

  if (
    args.confirmedEdgeIndex != null &&
    args.confirmedEdgeIndex >= 0 &&
    args.confirmedEdgeIndex < polygon.length
  ) {
    return {
      edgeIndex: args.confirmedEdgeIndex,
      roadName: args.savedStreetName ?? null,
      confidence: 1,
      method: "user_confirmed",
      candidates: [],
      requiresConfirmation: false,
      reason: "You confirmed this boundary as the street frontage.",
    };
  }

  const centroid = polygonCentroid(polygon);
  const roadSegments: Array<{ a: LocalPoint; b: LocalPoint; name: string | null }> = [];
  for (const road of args.roads ?? []) {
    for (const line of flattenRoadLines(road)) {
      for (let i = 0; i < line.length - 1; i += 1) {
        roadSegments.push({
          a: toLocal(line[i], projection),
          b: toLocal(line[i + 1], projection),
          name: road.name ?? null,
        });
      }
    }
  }

  if (roadSegments.length === 0) {
    return {
      edgeIndex: null,
      roadName: null,
      confidence: 0,
      method: "none",
      candidates: [],
      requiresConfirmation: true,
      reason:
        "No road geometry is available for this parcel, so the street boundary must be confirmed by you.",
    };
  }

  const candidates: StreetFrontageCandidate[] = polygon.map((a, index) => {
    const b = polygon[(index + 1) % polygon.length];
    const edgeAngle = angleDeg(a, b);
    let bestDistance = Infinity;
    let bestSegment: (typeof roadSegments)[number] | null = null;
    let bestPoint: LocalPoint | null = null;

    let bestAlignment = 90;
    for (const segment of roadSegments) {
      const measured = segmentSegmentDistance(a, b, segment.a, segment.b);
      const nameBonus = streetNamesMatch(segment.name, args.savedStreetName) ? 0.001 : 0;
      const effective = measured.distance - nameBonus;
      const alignment = parallelDifference(edgeAngle, angleDeg(segment.a, segment.b));
      // Ties on distance are broken by parallel alignment, so a road running
      // alongside the edge always beats one merely crossing near its corner.
      const closer =
        effective < bestDistance - 0.05 ||
        (Math.abs(effective - bestDistance) <= 0.05 && alignment < bestAlignment);
      if (closer) {
        bestDistance = Math.min(bestDistance, effective);
        bestAlignment = alignment;
        bestSegment = segment;
        bestPoint = measured.point;
      }
    }

    const distanceM = Math.max(0, bestDistance);
    const alignmentDeg = bestSegment
      ? parallelDifference(edgeAngle, angleDeg(bestSegment.a, bestSegment.b))
      : 90;
    const roadOutsideParcel = bestPoint ? !pointInPolygon(bestPoint, polygon) : false;
    const nameMatch = streetNamesMatch(bestSegment?.name ?? null, args.savedStreetName);

    const distanceScore =
      distanceM >= MAX_ADJACENT_ROAD_M ? 0 : 1 - distanceM / MAX_ADJACENT_ROAD_M;
    const alignmentScore = Math.max(0, 1 - alignmentDeg / 45);
    const outsideScore = roadOutsideParcel ? 1 : 0;
    const nameScore = nameMatch ? 1 : 0;

    const score =
      0.35 * distanceScore + 0.25 * alignmentScore + 0.15 * outsideScore + 0.25 * nameScore;

    return {
      edgeIndex: index,
      distanceM: Math.round(distanceM * 100) / 100,
      alignmentDeg: Math.round(alignmentDeg * 10) / 10,
      roadOutsideParcel,
      nameMatch,
      roadName: bestSegment?.name ?? null,
      lengthM: Math.round(Math.hypot(b.x - a.x, b.y - a.y) * 10) / 10,
      score: Math.round(score * 1000) / 1000,
    };
  });

  // Centroid is only used to keep the type honest about polygon orientation.
  void centroid;

  const ranked = [...candidates].sort((left, right) => right.score - left.score);
  const best = ranked[0];
  const second = ranked[1];
  const separation = best && second ? best.score - second.score : best ? 1 : 0;

  const eligible = best && best.distanceM < MAX_ADJACENT_ROAD_M;
  const confident =
    Boolean(eligible) &&
    best.score >= AUTO_SELECT_MIN_SCORE &&
    separation >= AUTO_SELECT_MIN_SEPARATION;

  if (!confident) {
    return {
      edgeIndex: null,
      roadName: eligible ? best.roadName : null,
      confidence: best ? best.score : 0,
      method: "none",
      candidates,
      requiresConfirmation: true,
      reason: !eligible
        ? "No road runs close enough to any boundary of this erf."
        : "Two or more boundaries score alike, so the street frontage must be confirmed by you.",
    };
  }

  return {
    edgeIndex: best.edgeIndex,
    roadName: best.roadName,
    confidence: best.score,
    method: "map_road_match",
    candidates,
    requiresConfirmation: false,
    reason: best.nameMatch
      ? `Matched to ${best.roadName} on the map, ${best.distanceM} m from this boundary.`
      : `Matched to the nearest road on the map, ${best.distanceM} m from this boundary.`,
  };
}
