/**
 * Deterministic build-envelope engine for vacant land.
 *
 * Everything here is computed from real parcel geometry plus structured
 * planning inputs the user confirmed. Nothing is generated, illustrated or
 * inferred from an image model. When an input is missing the engine says so
 * instead of inventing a value.
 */

export type BuildEnvelopeState =
  | "verified"
  | "estimated"
  | "more_information_required"
  | "unavailable";

/** Where the numeric build rules came from. Manual can never be verified. */
export type BuildEnvelopeRuleSource = "document" | "registry" | "manual";

export type BuildEnvelopeEdgeKind = "street" | "side" | "rear";

export interface LocalPoint {
  x: number;
  y: number;
}

export interface BuildEnvelopeEdge {
  index: number;
  kind: BuildEnvelopeEdgeKind;
  a: LocalPoint;
  b: LocalPoint;
  lengthM: number;
  setbackM: number | null;
  /** Offset line actually used for the setback, when a setback was applied. */
  setbackLine: { a: LocalPoint; b: LocalPoint } | null;
}

export interface BuildEnvelopeInputs {
  parcelId: string;
  /** GeoJSON exterior ring, [lng, lat]. Null when no polygon is available. */
  ring: Array<[number, number]> | null;
  boundaryConfirmed: boolean;
  /** Index of the street-facing edge in the ring. */
  streetEdgeIndex: number | null;
  streetName: string | null;
  ruleSource: BuildEnvelopeRuleSource | null;
  zoneLabel: string | null;
  streetSetbackM: number | null;
  sideSetbackM: number | null;
  rearSetbackM: number | null;
  maxCoveragePercent: number | null;
  maxHeightM: number | null;
  dwellingUnits: number | null;
  additionalDwellingRule: string | null;
  additionalDwellingRequiresConsent: boolean;
  servitudeNotes: string | null;
  /** Canonical recorded extent, used in preference to geometry-derived area. */
  recordedAreaM2: number | null;
}

export interface BuildEnvelopeSummary {
  erfAreaM2: number | null;
  erfAreaSourceLabel: string;
  geometryAreaM2: number | null;
  maxCoveragePercent: number | null;
  theoreticalGroundFloorM2: number | null;
  setbackEnvelopeAreaM2: number | null;
  maxHeightM: number | null;
  dwellingAllowance: string;
  additionalDwellingRule: string;
  indicativeUpperFloorM2: number | null;
  knownConstraints: string[];
}

export interface BuildEnvelopeResult {
  state: BuildEnvelopeState;
  stateLabel: string;
  stateExplanation: string;
  /** Parcel ring projected to local metres, y already flipped for SVG use. */
  parcelPolygon: LocalPoint[];
  /** Projection origin, so local-metre polygons can be mapped back to WGS84. */
  projection: LocalProjection | null;
  edges: BuildEnvelopeEdge[];
  streetEdge: BuildEnvelopeEdge | null;
  /** Setback-constrained envelope. Null when it cannot be computed honestly. */
  envelopePolygon: LocalPoint[] | null;
  /**
   * Maximum coverage footprint, always reported separately from the setback
   * envelope. Only an area is trustworthy, so no dimensions are emitted.
   */
  coverageFootprint: {
    areaM2: number;
    polygon: LocalPoint[];
    /** Illustrative split of the same maximum, never a design. */
    allocation: { mainM2: number; additionalM2: number; totalM2: number };
  } | null;

  secondDwelling: { label: string; requiresConsent: boolean } | null;
  summary: BuildEnvelopeSummary;
  missingInformation: string[];
  assumptions: string[];
  sources: string[];
  /** Edge dimensions are only emitted when the boundary was confirmed. */
  showsDimensions: boolean;
}

const EARTH_M_PER_DEG = 111_320;

function round(value: number, dp = 2) {
  const factor = 10 ** dp;
  return Math.round(value * factor) / factor;
}

function normalizeRing(ring: Array<[number, number]>): Array<[number, number]> {
  const out = ring.filter(
    (point) =>
      Array.isArray(point) &&
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1]),
  );
  if (out.length > 1) {
    const first = out[0];
    const last = out[out.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) out.pop();
  }
  return out;
}

/**
 * Origin of the local equirectangular projection used for the envelope maths.
 * Retaining it lets every local-metre polygon be converted back to WGS84 so
 * map layers land in the correct geographic position.
 */
export interface LocalProjection {
  lat0: number;
  lng0: number;
  cos: number;
}

export function ringProjection(ring: Array<[number, number]>): LocalProjection | null {
  const points = normalizeRing(ring);
  if (points.length < 3) return null;
  const lat0 = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  const lng0 = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  return { lat0, lng0, cos: Math.cos((lat0 * Math.PI) / 180) };
}

/** Equirectangular projection around the ring centroid. Accurate at erf scale. */
export function projectRingToLocalMetres(ring: Array<[number, number]>): LocalPoint[] {
  const points = normalizeRing(ring);
  const projection = ringProjection(ring);
  if (!projection) return [];
  return points.map((p) => ({
    x: (p[0] - projection.lng0) * EARTH_M_PER_DEG * projection.cos,
    // Flip so that increasing y renders downwards in SVG space.
    y: -(p[1] - projection.lat0) * EARTH_M_PER_DEG,
  }));
}

/** Exact inverse of `projectRingToLocalMetres` for a single point. */
export function localToWgs84(point: LocalPoint, projection: LocalProjection): [number, number] {
  const cos = projection.cos || 1;
  return [
    projection.lng0 + point.x / (EARTH_M_PER_DEG * cos),
    projection.lat0 - point.y / EARTH_M_PER_DEG,
  ];
}

export function localPolygonToWgs84(
  polygon: LocalPoint[],
  projection: LocalProjection,
): Array<[number, number]> {
  return polygon.map((point) => localToWgs84(point, projection));
}

/**
 * Picks the boundary that faces the street from a set of edge lengths, using a
 * known frontage length range (e.g. a surveyed street frontage). Returns null
 * when no edge falls inside the range, so nothing is guessed.
 */
export function pickStreetEdgeIndexByLength(
  lengths: number[],
  range: [number, number],
): number | null {
  const [min, max] = range[0] <= range[1] ? range : [range[1], range[0]];
  const mid = (min + max) / 2;
  let best: number | null = null;
  let bestDelta = Infinity;
  lengths.forEach((length, index) => {
    if (!Number.isFinite(length) || length < min || length > max) return;
    const delta = Math.abs(length - mid);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = index;
    }
  });
  return best;
}


export function polygonAreaM2(polygon: LocalPoint[]): number {
  if (polygon.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export function polygonCentroid(polygon: LocalPoint[]): LocalPoint {
  const n = polygon.length || 1;
  return {
    x: polygon.reduce((sum, p) => sum + p.x, 0) / n,
    y: polygon.reduce((sum, p) => sum + p.y, 0) / n,
  };
}

function distance(a: LocalPoint, b: LocalPoint) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Inward unit normal of edge a->b relative to the polygon centroid. */
function inwardNormal(a: LocalPoint, b: LocalPoint, centroid: LocalPoint): LocalPoint {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const n = { x: -dy / len, y: dx / len };
  const toCentroid = { x: centroid.x - a.x, y: centroid.y - a.y };
  return n.x * toCentroid.x + n.y * toCentroid.y >= 0 ? n : { x: -n.x, y: -n.y };
}

/**
 * Clip a polygon by the half-plane on the inward side of an offset edge.
 * Sutherland–Hodgman, so irregular (non-rectangular) parcels are supported.
 */
function clipByHalfPlane(
  polygon: LocalPoint[],
  origin: LocalPoint,
  normal: LocalPoint,
  offset: number,
): LocalPoint[] {
  if (polygon.length < 3) return [];
  const value = (p: LocalPoint) =>
    (p.x - origin.x) * normal.x + (p.y - origin.y) * normal.y - offset;
  const out: LocalPoint[] = [];
  for (let i = 0; i < polygon.length; i += 1) {
    const current = polygon[i];
    const next = polygon[(i + 1) % polygon.length];
    const dCurrent = value(current);
    const dNext = value(next);
    if (dCurrent >= 0) out.push(current);
    if ((dCurrent >= 0 && dNext < 0) || (dCurrent < 0 && dNext >= 0)) {
      const t = dCurrent / (dCurrent - dNext);
      out.push({
        x: current.x + (next.x - current.x) * t,
        y: current.y + (next.y - current.y) * t,
      });
    }
  }
  return out.length >= 3 ? out : [];
}

function classifyEdges(
  polygon: LocalPoint[],
  streetEdgeIndex: number | null,
): BuildEnvelopeEdgeKind[] {
  const kinds: BuildEnvelopeEdgeKind[] = polygon.map(() => "side");
  if (streetEdgeIndex == null || streetEdgeIndex < 0 || streetEdgeIndex >= polygon.length) {
    return kinds;
  }
  kinds[streetEdgeIndex] = "street";
  const streetA = polygon[streetEdgeIndex];
  const streetB = polygon[(streetEdgeIndex + 1) % polygon.length];
  const streetMid = { x: (streetA.x + streetB.x) / 2, y: (streetA.y + streetB.y) / 2 };
  let rearIndex = -1;
  let rearDistance = -1;
  for (let i = 0; i < polygon.length; i += 1) {
    if (i === streetEdgeIndex) continue;
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const d = distance(streetMid, mid);
    if (d > rearDistance) {
      rearDistance = d;
      rearIndex = i;
    }
  }
  if (rearIndex >= 0) kinds[rearIndex] = "rear";
  return kinds;
}

/** Scale a polygon about its centroid. Area scales with factor². */
export function scalePolygonAboutCentroid(polygon: LocalPoint[], factor: number): LocalPoint[] {
  const c = polygonCentroid(polygon);
  return polygon.map((p) => ({
    x: c.x + (p.x - c.x) * factor,
    y: c.y + (p.y - c.y) * factor,
  }));
}

/**
 * Deterministically fit the maximum-coverage polygon INSIDE the setback
 * envelope by insetting the envelope around its centroid until its area equals
 * the target coverage area. This preserves the parcel/envelope orientation and
 * shape instead of drawing an arbitrary axis-aligned box, and it can never
 * exceed the envelope because the scale factor is capped at 1.
 */
export function fitCoveragePolygonInEnvelope(
  envelope: LocalPoint[],
  targetAreaM2: number,
): LocalPoint[] | null {
  if (envelope.length < 3 || !Number.isFinite(targetAreaM2) || targetAreaM2 <= 0) return null;
  const envelopeArea = polygonAreaM2(envelope);
  if (envelopeArea <= 0) return null;
  if (targetAreaM2 >= envelopeArea) return envelope.map((p) => ({ ...p }));

  // Binary search on the inset factor. Area is monotonic in the factor.
  let low = 0;
  let high = 1;
  let best = envelope.map((p) => ({ ...p }));
  for (let i = 0; i < 60; i += 1) {
    const mid = (low + high) / 2;
    const candidate = scalePolygonAboutCentroid(envelope, mid);
    const area = polygonAreaM2(candidate);
    if (area > targetAreaM2) {
      high = mid;
    } else {
      low = mid;
      best = candidate;
    }
    if (Math.abs(area - targetAreaM2) < 1e-6) {
      best = candidate;
      break;
    }
  }
  return best;
}

/**
 * Illustrative allocation of the permitted coverage between the main dwelling
 * and an additional dwelling. It is a split of the same maximum, so the total
 * can never exceed the permitted coverage area.
 */
export function coverageAllocationFor(
  coverageAreaM2: number,
): { mainM2: number; additionalM2: number; totalM2: number } {
  const additional = round(Math.min(45, coverageAreaM2 * 0.15));
  const main = round(coverageAreaM2 - additional);
  return { mainM2: main, additionalM2: additional, totalM2: round(main + additional) };
}


const STATE_LABEL: Record<BuildEnvelopeState, string> = {
  verified: "Verified Site Potential",
  estimated: "Estimated Site Potential",
  more_information_required: "More information required",
  unavailable: "Site Potential unavailable",
};

export function calculateBuildEnvelope(input: BuildEnvelopeInputs): BuildEnvelopeResult {
  const missingInformation: string[] = [];
  const assumptions: string[] = [];
  const sources: string[] = [];

  const parcelPolygon = input.ring ? projectRingToLocalMetres(input.ring) : [];
  const hasPolygon = parcelPolygon.length >= 3;
  const geometryAreaM2 = hasPolygon ? round(polygonAreaM2(parcelPolygon)) : null;

  if (!hasPolygon) missingInformation.push("Parcel boundary geometry");
  if (hasPolygon && !input.boundaryConfirmed) missingInformation.push("Confirmed parcel boundary");
  if (input.streetEdgeIndex == null) missingInformation.push("Street-facing boundary");
  if (input.streetSetbackM == null) missingInformation.push("Street building line");
  if (input.sideSetbackM == null) missingInformation.push("Side building lines");
  if (input.rearSetbackM == null) missingInformation.push("Rear building line");
  if (input.maxCoveragePercent == null) missingInformation.push("Maximum coverage");
  if (input.maxHeightM == null) missingInformation.push("Maximum height");
  if (!input.additionalDwellingRule) missingInformation.push("Additional dwelling rule");
  if (!input.ruleSource) missingInformation.push("Zoning or rule source");

  if (input.ruleSource === "manual") {
    assumptions.push(
      "Building lines, coverage, height and dwelling rules were entered by you and are treated as user-supplied assumptions, not official facts.",
    );
  }
  if (input.ruleSource === "registry") {
    assumptions.push(
      "Rules come from the published municipal rule set for the selected zone. The zone itself is not confirmed for this erf.",
    );
    sources.push("Published municipal planning rule set");
  }
  if (input.ruleSource === "document") {
    sources.push("Zoning document attached to this erf");
  }
  if (geometryAreaM2 != null && input.recordedAreaM2 != null) {
    sources.push("Official cadastral parcel geometry");
  }
  if (!input.servitudeNotes) {
    missingInformation.push("Registered servitudes and exclusion areas");
  }

  const centroid = hasPolygon ? polygonCentroid(parcelPolygon) : { x: 0, y: 0 };
  const kinds = classifyEdges(parcelPolygon, input.streetEdgeIndex);

  const setbackFor = (kind: BuildEnvelopeEdgeKind) =>
    kind === "street"
      ? input.streetSetbackM
      : kind === "rear"
        ? input.rearSetbackM
        : input.sideSetbackM;

  const edges: BuildEnvelopeEdge[] = parcelPolygon.map((a, index) => {
    const b = parcelPolygon[(index + 1) % parcelPolygon.length];
    const kind = kinds[index] ?? "side";
    const setbackM = setbackFor(kind);
    let setbackLine: BuildEnvelopeEdge["setbackLine"] = null;
    if (setbackM != null && setbackM > 0) {
      const n = inwardNormal(a, b, centroid);
      setbackLine = {
        a: { x: a.x + n.x * setbackM, y: a.y + n.y * setbackM },
        b: { x: b.x + n.x * setbackM, y: b.y + n.y * setbackM },
      };
    }
    return {
      index,
      kind,
      a,
      b,
      lengthM: round(distance(a, b), 1),
      setbackM,
      setbackLine,
    };
  });

  const setbacksComplete =
    input.streetSetbackM != null && input.sideSetbackM != null && input.rearSetbackM != null;

  let envelopePolygon: LocalPoint[] | null = null;
  if (hasPolygon && input.streetEdgeIndex != null && setbacksComplete) {
    let working = parcelPolygon;
    for (const edge of edges) {
      const setback = edge.setbackM ?? 0;
      if (setback <= 0) continue;
      const n = inwardNormal(edge.a, edge.b, centroid);
      working = clipByHalfPlane(working, edge.a, n, setback);
      if (!working.length) break;
    }
    envelopePolygon = working.length >= 3 ? working : null;
  }

  const setbackEnvelopeAreaM2 = envelopePolygon ? round(polygonAreaM2(envelopePolygon)) : null;

  const erfAreaM2 = input.recordedAreaM2 ?? geometryAreaM2;
  const erfAreaSourceLabel =
    input.recordedAreaM2 != null
      ? "Recorded cadastral extent"
      : geometryAreaM2 != null
        ? "Derived from parcel geometry"
        : "Not available";

  const theoreticalGroundFloorM2 =
    erfAreaM2 != null && input.maxCoveragePercent != null
      ? round((erfAreaM2 * input.maxCoveragePercent) / 100)
      : null;

  let coverageFootprint: BuildEnvelopeResult["coverageFootprint"] = null;
  if (envelopePolygon && theoreticalGroundFloorM2 != null) {
    const cappedArea = Math.min(theoreticalGroundFloorM2, setbackEnvelopeAreaM2 ?? Infinity);
    const polygon = fitCoveragePolygonInEnvelope(envelopePolygon, cappedArea);
    if (polygon) {
      coverageFootprint = {
        areaM2: round(cappedArea),
        polygon,
        allocation: coverageAllocationFor(round(cappedArea)),
      };
    }
  }


  const knownConstraints: string[] = [];
  if (input.servitudeNotes) knownConstraints.push(input.servitudeNotes);
  if (
    theoreticalGroundFloorM2 != null &&
    setbackEnvelopeAreaM2 != null &&
    setbackEnvelopeAreaM2 < theoreticalGroundFloorM2
  ) {
    knownConstraints.push(
      "The setback envelope is smaller than the coverage allowance, so building lines are the binding constraint.",
    );
  }

  const dwellingAllowance =
    input.dwellingUnits != null
      ? `${input.dwellingUnits} dwelling unit${input.dwellingUnits === 1 ? "" : "s"}`
      : "Not confirmed";

  const additionalDwellingRule = input.additionalDwellingRule
    ? input.additionalDwellingRequiresConsent
      ? `${input.additionalDwellingRule} — subject to municipal consent.`
      : input.additionalDwellingRule
    : "Not confirmed";

  const indicativeUpperFloorM2 =
    coverageFootprint && input.maxHeightM != null && input.maxHeightM >= 6
      ? round(coverageFootprint.areaM2)
      : null;

  let state: BuildEnvelopeState;
  if (!hasPolygon) {
    state = "unavailable";
  } else if (
    input.streetEdgeIndex == null ||
    !setbacksComplete ||
    input.maxCoveragePercent == null ||
    input.maxHeightM == null ||
    !input.ruleSource
  ) {
    state = "more_information_required";
  } else if (input.ruleSource === "document" && input.boundaryConfirmed) {
    state = "verified";
  } else {
    state = "estimated";
  }

  const stateExplanation =
    state === "unavailable"
      ? "No parcel boundary geometry is available for this erf, so a build envelope cannot be drawn."
      : state === "more_information_required"
        ? "Easy Erf needs the remaining inputs listed below before it will draw a build envelope for this erf."
        : state === "estimated"
          ? "This envelope is calculated from real parcel geometry and the rules you supplied. The rules are not confirmed with the municipality."
          : "This envelope is calculated from real parcel geometry and a zoning document attached to this erf. It is still theoretical and subject to title conditions and approvals.";

  return {
    state,
    stateLabel: STATE_LABEL[state],
    stateExplanation,
    parcelPolygon,
    projection: input.ring ? ringProjection(input.ring) : null,
    edges,
    streetEdge: edges.find((edge) => edge.kind === "street") ?? null,
    envelopePolygon: state === "more_information_required" ? null : envelopePolygon,
    coverageFootprint: state === "more_information_required" ? null : coverageFootprint,
    secondDwelling: input.additionalDwellingRule
      ? {
          label: input.additionalDwellingRule,
          requiresConsent: input.additionalDwellingRequiresConsent,
        }
      : null,
    summary: {
      erfAreaM2,
      erfAreaSourceLabel,
      geometryAreaM2,
      maxCoveragePercent: input.maxCoveragePercent,
      theoreticalGroundFloorM2,
      setbackEnvelopeAreaM2: state === "more_information_required" ? null : setbackEnvelopeAreaM2,
      maxHeightM: input.maxHeightM,
      dwellingAllowance,
      additionalDwellingRule,
      indicativeUpperFloorM2: state === "more_information_required" ? null : indicativeUpperFloorM2,
      knownConstraints,
    },
    missingInformation: Array.from(new Set(missingInformation)),
    assumptions,
    sources,
    showsDimensions: hasPolygon && input.boundaryConfirmed,
  };
}

export function createEmptyBuildEnvelopeInputs(
  parcelId: string,
  ring: Array<[number, number]> | null,
  recordedAreaM2: number | null,
): BuildEnvelopeInputs {
  return {
    parcelId,
    ring,
    boundaryConfirmed: false,
    streetEdgeIndex: null,
    streetName: null,
    ruleSource: null,
    zoneLabel: null,
    streetSetbackM: null,
    sideSetbackM: null,
    rearSetbackM: null,
    maxCoveragePercent: null,
    maxHeightM: null,
    dwellingUnits: null,
    additionalDwellingRule: null,
    additionalDwellingRequiresConsent: true,
    servitudeNotes: null,
    recordedAreaM2,
  };
}
