import type { Geometry, Position } from "geojson";
import {
  type IndexedOfficialParcel,
  buildOfficialParcelIndex,
  type OfficialParcelFeature,
} from "@/lib/search/officialParcelIndex";

export type PropertySearchConfidence =
  | "exact_official_match"
  | "address_inside_official_parcel"
  | "likely_nearby_parcel"
  | "address_only"
  | "no_match";

export interface ParsedPropertyQuery {
  raw: string;
  normalized: string;
  terms: string[];
  lpi?: string;
  parcelKey?: string;
  erfNumber?: string;
  portion?: string;
  areaText?: string;
  coordinate?: { lat: number; lng: number };
  isAddressLike: boolean;
}

export interface PropertySearchResult {
  id: string;
  parcel?: IndexedOfficialParcel;
  title: string;
  subtitle: string;
  matchReason: string;
  confidence: PropertySearchConfidence;
  sourceLabel: string;
  fields: {
    erf?: string;
    portion?: string;
    lpi?: string;
    parcelKey?: string;
    town?: string;
    municipality?: string;
    province?: string;
  };
  distanceMeters?: number;
}

type Candidate = {
  parcel: IndexedOfficialParcel;
  score: number;
  matchReason: string;
  confidence: PropertySearchConfidence;
};

export interface OfficialParcelSearchOptions {
  visibleAreaTerms?: string[];
}

const KNOWN_ADDRESS_HINTS: Array<{
  aliases: string[];
  erfNumber: string;
  portion: string;
  areaText: string;
}> = [
  {
    aliases: ["8 harbour road", "8 harbour drive"],
    erfNumber: "962",
    portion: "0",
    areaText: "sea vista st francis bay eastern cape",
  },
];

export function normalizePropertyText(value: string | number | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalCode(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase() || undefined;
}

function parseCoordinate(normalized: string): { lat: number; lng: number } | undefined {
  const match = normalized.match(/(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return undefined;
  const first = Number(match[1]);
  const second = Number(match[2]);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return undefined;
  if (Math.abs(first) <= 90 && Math.abs(second) <= 180) return { lat: first, lng: second };
  if (Math.abs(second) <= 90 && Math.abs(first) <= 180) return { lat: second, lng: first };
  return undefined;
}

export function parsePropertyQuery(query: string): ParsedPropertyQuery {
  const raw = query;
  const normalized = normalizePropertyText(query);
  const terms = normalized ? normalized.split(" ") : [];
  const compact = query.replace(/[^a-z0-9]/gi, "");
  const lpi = canonicalCode(compact.match(/c\d{10,25}/i)?.[0]);
  const parcelKey = canonicalCode(compact.match(/e[a-z0-9]{10,35}/i)?.[0]);
  const coordinate = parseCoordinate(normalized);

  let erfNumber = normalized.match(/\berf\s+(\d+)\b/)?.[1];
  let portion = normalized.match(/\bportion\s+(\d+)\s+erf\s+(\d+)\b/)?.[1];
  const portionErf = normalized.match(/\bportion\s+(\d+)\s+erf\s+(\d+)\b/);
  const erfPortion = normalized.match(/\berf\s+(\d+)\s+portion\s+(\d+)\b/);
  if (portionErf) {
    portion = portionErf[1];
    erfNumber = portionErf[2];
  } else if (erfPortion) {
    erfNumber = erfPortion[1];
    portion = erfPortion[2];
  } else if (!erfNumber && /^\d{2,7}$/.test(normalized)) {
    erfNumber = normalized;
  }

  let areaText = terms
    .filter((term) => !["erf", "portion", erfNumber, portion].includes(term))
    .join(" ");
  for (const hint of KNOWN_ADDRESS_HINTS) {
    if (hint.aliases.some((alias) => normalized.includes(alias))) {
      erfNumber = hint.erfNumber;
      portion = hint.portion;
      areaText = `${areaText} ${hint.areaText}`.trim();
    }
  }

  const isAddressLike =
    Boolean(normalized && /[a-z]/.test(normalized)) &&
    !lpi &&
    !parcelKey &&
    (!erfNumber ||
      KNOWN_ADDRESS_HINTS.some((hint) => hint.aliases.some((a) => normalized.includes(a))));

  return {
    raw,
    normalized,
    terms,
    lpi,
    parcelKey,
    erfNumber,
    portion,
    areaText: areaText || undefined,
    coordinate,
    isAddressLike,
  };
}

function parcelText(parcel: IndexedOfficialParcel): string {
  return normalizePropertyText(
    [
      parcel.erf,
      parcel.portion,
      parcel.lpi,
      parcel.parcelKey,
      parcel.town,
      parcel.municipality,
      parcel.province,
      parcel.displayAreaLabel,
    ].join(" "),
  );
}

function scoreParcel(
  parcel: IndexedOfficialParcel,
  parsed: ParsedPropertyQuery,
  options: OfficialParcelSearchOptions = {},
): Candidate | null {
  let score = 0;
  let reason = "Possible official parcel match";
  let confidence: PropertySearchConfidence = "likely_nearby_parcel";
  const text = parcelText(parcel);

  if (parsed.lpi && parcel.lpi === parsed.lpi) {
    return {
      parcel,
      score: 1000,
      matchReason: "Exact CSG LPI match",
      confidence: "exact_official_match",
    };
  }
  if (parsed.parcelKey && parcel.parcelKey === parsed.parcelKey) {
    return {
      parcel,
      score: 980,
      matchReason: "Exact CSG parcel key match",
      confidence: "exact_official_match",
    };
  }

  if (parsed.erfNumber) {
    if (parcel.erf !== parsed.erfNumber) return null;
    score += 250;
    reason = "Official erf number match";
    if (parsed.portion !== undefined) {
      if ((parcel.portion ?? "0") !== parsed.portion) return null;
      score += 120;
      reason = "Official erf and portion match";
    }
    if (parsed.areaText) {
      const areaTerms = normalizePropertyText(parsed.areaText)
        .split(" ")
        .filter((term) => term.length > 2);
      const hits = areaTerms.filter((term) => text.includes(term)).length;
      score += hits * 45;
      if (hits > 0) reason = "Official erf match with area context";
    } else if (options.visibleAreaTerms?.length) {
      const hits = options.visibleAreaTerms.filter((term) => text.includes(term)).length;
      score += hits * 35;
      if (hits > 0) reason = "Official erf match inside visible map area";
    }
    return { parcel, score, matchReason: reason, confidence };
  }

  if (parsed.isAddressLike && parsed.terms.length) {
    const hits = parsed.terms.filter((term) => term.length > 2 && text.includes(term)).length;
    if (!hits) return null;
    score = hits * 25;
    confidence = "address_only";
    reason = "Address or area text matches current official parcel fields";
    return { parcel, score, matchReason: reason, confidence };
  }

  return null;
}

export function rankParcelCandidates(
  candidates: Candidate[],
  parsedQuery: ParsedPropertyQuery,
): Candidate[] {
  return [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (parsedQuery.portion !== undefined) {
      const aPortion = (a.parcel.portion ?? "0") === parsedQuery.portion ? 1 : 0;
      const bPortion = (b.parcel.portion ?? "0") === parsedQuery.portion ? 1 : 0;
      if (bPortion !== aPortion) return bPortion - aPortion;
    }
    return a.parcel.id.localeCompare(b.parcel.id);
  });
}

export function buildPropertySearchResult(
  parcel: IndexedOfficialParcel,
  matchReason: string,
  confidence: PropertySearchConfidence,
): PropertySearchResult {
  const subject = parcel.erf ? `Erf ${parcel.erf}` : "Official parcel";
  const portion = parcel.portion ? `, Portion ${parcel.portion}` : "";
  return {
    id: parcel.id,
    parcel,
    title: `${subject}${portion}`,
    subtitle: parcel.displayAreaLabel,
    matchReason,
    confidence,
    sourceLabel: parcel.sourceLabel,
    fields: {
      erf: parcel.erf,
      portion: parcel.portion,
      lpi: parcel.lpi,
      parcelKey: parcel.parcelKey,
      town: parcel.town,
      municipality: parcel.municipality,
      province: parcel.province,
    },
  };
}

function pointInRing(lng: number, lat: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInGeometry(lng: number, lat: number, geometry: Geometry | null): boolean {
  if (!geometry) return false;
  if (geometry.type === "Polygon") {
    const [outer, ...holes] = geometry.coordinates;
    return pointInRing(lng, lat, outer) && !holes.some((ring) => pointInRing(lng, lat, ring));
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some(([outer, ...holes]) => {
      return pointInRing(lng, lat, outer) && !holes.some((ring) => pointInRing(lng, lat, ring));
    });
  }
  return false;
}

function pointToSegmentDistanceMeters(
  lng: number,
  lat: number,
  start: Position,
  end: Position,
): number {
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng = metersPerDegreeLat * Math.cos((lat * Math.PI) / 180);
  const px = lng * metersPerDegreeLng;
  const py = lat * metersPerDegreeLat;
  const ax = start[0] * metersPerDegreeLng;
  const ay = start[1] * metersPerDegreeLat;
  const bx = end[0] * metersPerDegreeLng;
  const by = end[1] * metersPerDegreeLat;
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function ringDistanceMeters(lng: number, lat: number, ring: Position[]): number {
  if (ring.length < 2) return Number.POSITIVE_INFINITY;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < ring.length - 1; i += 1) {
    best = Math.min(best, pointToSegmentDistanceMeters(lng, lat, ring[i], ring[i + 1]));
  }
  return best;
}

function distanceToGeometryMeters(lng: number, lat: number, geometry: Geometry | null): number {
  if (!geometry) return Number.POSITIVE_INFINITY;
  if (pointInGeometry(lng, lat, geometry)) return 0;
  if (geometry.type === "Polygon") {
    return Math.min(...geometry.coordinates.map((ring) => ringDistanceMeters(lng, lat, ring)));
  }
  if (geometry.type === "MultiPolygon") {
    return Math.min(
      ...geometry.coordinates.flatMap((polygon) =>
        polygon.map((ring) => ringDistanceMeters(lng, lat, ring)),
      ),
    );
  }
  return Number.POSITIVE_INFINITY;
}

export function searchByCoordinate(
  lat: number,
  lng: number,
  parcelFeatures: IndexedOfficialParcel[] | OfficialParcelFeature[],
): PropertySearchResult | null {
  const parcels =
    parcelFeatures.length > 0 && "parcel" in parcelFeatures[0]
      ? (parcelFeatures as IndexedOfficialParcel[])
      : buildOfficialParcelIndex(parcelFeatures as OfficialParcelFeature[]);
  // API callers pass lat/lng for readability; GeoJSON/Turf-style checks use [lng, lat].
  const exactMatch = parcels.find((parcel) => pointInGeometry(lng, lat, parcel.geometry));
  if (exactMatch) {
    return buildPropertySearchResult(
        exactMatch,
        "Coordinate falls inside this rendered official parcel",
        "address_inside_official_parcel",
      );
  }

  const nearest = parcels
    .map((parcel) => ({
      parcel,
      distanceMeters: distanceToGeometryMeters(lng, lat, parcel.geometry),
    }))
    .filter((candidate) => Number.isFinite(candidate.distanceMeters))
    .sort((a, b) => a.distanceMeters - b.distanceMeters)[0];

  if (!nearest || nearest.distanceMeters > 50) return null;
  return {
    ...buildPropertySearchResult(
      nearest.parcel,
      `Nearest official parcel outline is ${Math.round(nearest.distanceMeters)}m from this address point`,
      "likely_nearby_parcel",
    ),
    distanceMeters: nearest.distanceMeters,
  };
}

export function searchOfficialParcels(
  query: string,
  parcelIndex: IndexedOfficialParcel[],
  options: OfficialParcelSearchOptions = {},
): PropertySearchResult[] {
  const parsed = parsePropertyQuery(query);
  if (!parsed.normalized) return [];
  if (parsed.coordinate) {
    const coordinateMatch = searchByCoordinate(
      parsed.coordinate.lat,
      parsed.coordinate.lng,
      parcelIndex,
    );
    return coordinateMatch ? [coordinateMatch] : [];
  }
  const candidates = parcelIndex
    .map((parcel) => scoreParcel(parcel, parsed, options))
    .filter((candidate): candidate is Candidate => Boolean(candidate));
  return rankParcelCandidates(candidates, parsed).map((candidate) =>
    buildPropertySearchResult(candidate.parcel, candidate.matchReason, candidate.confidence),
  );
}
