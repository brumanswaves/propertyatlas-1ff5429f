import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { resolveMarketEvidenceContext } from "./resolveMarketEvidenceContext";
import type {
  ListingCandidate,
  MarketEvidenceRelationship,
  RadarCandidateResult,
  RadarClassification,
  RadarMatch,
  RadarSignal,
  SavedMarketEvidence,
} from "./types";

function clean(value: string | number | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasNeedle(haystack: string, needle: string | number | null | undefined): boolean {
  const value = clean(needle);
  return Boolean(value) && haystack.includes(value);
}

function text(candidate: ListingCandidate): string {
  return clean(
    [
      candidate.title,
      candidate.locationText,
      candidate.microMarket,
      candidate.suburb,
      candidate.town,
      candidate.municipality,
      candidate.province,
      candidate.streetName,
      candidate.descriptionText,
      candidate.rawSourceArea,
      candidate.propertyType,
    ].join(" "),
  );
}

function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

function pushSignal(signals: RadarSignal[], signal: RadarSignal) {
  if (!signals.includes(signal)) signals.push(signal);
}

export function classifyRadarCandidate(score: number, signals: RadarSignal[]): RadarClassification {
  if (score >= 85) return "possible_target_property";
  if (score >= 65) return "strong_comp";
  if (score >= 50) {
    if (signals.includes("street_name_match")) return "same_street_comp";
    return "same_node_comp";
  }
  if (score >= 35) return "nearby_market_comp";
  if (score >= 25) return "broader_market_comp";
  return "hidden";
}

export function buildRadarReasons(
  score: number,
  signals: RadarSignal[],
  _parcel: NormalizedOfficialParcel,
  _candidate: ListingCandidate,
): string[] {
  const labels: Record<RadarSignal, string> = {
    erf_number_mentioned: "Erf number mentioned",
    exact_address_match: "Exact address match",
    street_name_match: "Street name match",
    land_size_exact: "Land size match",
    land_size_close: "Land size close",
    coordinate_close: "Coordinate proximity",
    same_micro_market: "Same micro-market",
    same_suburb: "Same suburb or town",
    same_property_type: "Same property type",
    estate_or_scheme_match: "Estate or scheme match",
    vacant_land_match: "Vacant land match",
    broader_area_match: "Broader area match",
  };
  const reasons = signals.map((signal) => labels[signal]);
  if (score < 25) reasons.push("Too little subject-erf signal; hidden by default");
  return reasons;
}

export function scoreListingCandidate(
  parcel: NormalizedOfficialParcel,
  candidate: ListingCandidate,
): RadarMatch {
  const ctx = resolveMarketEvidenceContext(parcel);
  const candidateText = text(candidate);
  const signals: RadarSignal[] = [];
  let score = 0;
  let distanceMeters: number | undefined;
  let sizeVariancePercent: number | undefined;

  if (ctx.address && hasNeedle(candidateText, ctx.address)) {
    score += 40;
    pushSignal(signals, "exact_address_match");
  }
  if (ctx.erfNumber && hasNeedle(candidateText, `erf ${ctx.erfNumber}`)) {
    score += 40;
    pushSignal(signals, "erf_number_mentioned");
  }
  if (ctx.schemeOrEstate && hasNeedle(candidateText, ctx.schemeOrEstate)) {
    score += 30;
    pushSignal(signals, "estate_or_scheme_match");
  }
  if (
    ctx.streetName &&
    (hasNeedle(candidateText, ctx.streetName) ||
      clean(candidate.streetName) === clean(ctx.streetName))
  ) {
    score += 25;
    pushSignal(signals, "street_name_match");
  }
  if (ctx.landSizeM2 && candidate.landSizeM2) {
    const variance = (Math.abs(candidate.landSizeM2 - ctx.landSizeM2) / ctx.landSizeM2) * 100;
    sizeVariancePercent = Math.round(variance * 10) / 10;
    if (variance <= 1) {
      score += 35;
      pushSignal(signals, "land_size_exact");
    } else if (variance <= 5) {
      score += 25;
      pushSignal(signals, "land_size_close");
    }
  }
  if (ctx.coordinates && candidate.lat != null && candidate.lng != null) {
    distanceMeters = Math.round(
      metres(ctx.coordinates, { lat: candidate.lat, lng: candidate.lng }),
    );
    if (distanceMeters <= 100) {
      score += 25;
      pushSignal(signals, "coordinate_close");
    } else if (distanceMeters <= 500) {
      score += 15;
      pushSignal(signals, "coordinate_close");
    }
  }
  if (ctx.marketArea && hasNeedle(candidateText, ctx.marketArea)) {
    score += 15;
    pushSignal(signals, "same_micro_market");
  } else if (ctx.suburb && hasNeedle(candidateText, ctx.suburb)) {
    score += 15;
    pushSignal(signals, "same_micro_market");
  }
  if (
    (ctx.suburb && clean(candidate.suburb) === clean(ctx.suburb)) ||
    (ctx.town && clean(candidate.town) === clean(ctx.town))
  ) {
    score += 10;
    pushSignal(signals, "same_suburb");
  }
  if (candidate.propertyType && hasNeedle(clean(ctx.category), clean(candidate.propertyType))) {
    score += 10;
    pushSignal(signals, "same_property_type");
  }
  if (ctx.category === "vacant_land" && /vacant|plot|stand|erf|land/.test(candidateText)) {
    score += 10;
    pushSignal(signals, "vacant_land_match");
  }
  if (
    !signals.includes("same_micro_market") &&
    ctx.municipality &&
    hasNeedle(candidateText, ctx.municipality)
  ) {
    score += 5;
    pushSignal(signals, "broader_area_match");
  }

  return {
    candidateId: candidate.id,
    score,
    classification: classifyRadarCandidate(score, signals),
    reasons: buildRadarReasons(score, signals, parcel, candidate),
    distanceMeters,
    sizeVariancePercent,
    matchedSignals: signals,
  };
}

export function runActiveListingRadar(
  parcel: NormalizedOfficialParcel,
  candidates: ListingCandidate[],
): RadarCandidateResult[] {
  return candidates
    .map((candidate) => ({ candidate, match: scoreListingCandidate(parcel, candidate) }))
    .filter((item) => item.match.classification !== "hidden")
    .sort(
      (a, b) => b.match.score - a.match.score || a.candidate.title.localeCompare(b.candidate.title),
    );
}

export function relationshipForRadarClassification(
  classification: RadarClassification,
): MarketEvidenceRelationship {
  if (classification === "possible_target_property") return "possible_target_asset";
  if (classification === "same_street_comp") return "same_street_comp";
  if (classification === "same_node_comp") return "same_node_comp";
  if (classification === "vacant_land_comp") return "vacant_land_comp";
  if (classification === "nearby_market_comp") return "same_suburb_comp";
  if (classification === "broader_market_comp") return "broader_market_comp";
  if (classification === "weak_comp") return "weak_comp";
  return "same_node_comp";
}

export function evidenceFromCandidate(
  candidate: ListingCandidate,
  match: RadarMatch,
  relationship: MarketEvidenceRelationship,
): Omit<SavedMarketEvidence, "id" | "parcelId" | "savedAt" | "updatedAt"> {
  const confidence =
    relationship === "target_asset"
      ? "high"
      : relationship === "not_related"
        ? "excluded"
        : relationship === "broader_market_comp" || relationship === "weak_comp"
          ? "low"
          : "medium";
  return {
    sourceUrl: candidate.sourceUrl,
    sourcePortal: candidate.sourcePortal,
    title: candidate.title || "Radar market evidence",
    askingPrice: candidate.askingPrice ?? null,
    propertyType: candidate.propertyType ?? null,
    beds: candidate.beds ?? null,
    baths: candidate.baths ?? null,
    landSizeM2: candidate.landSizeM2 ?? null,
    buildingSizeM2: candidate.buildingSizeM2 ?? null,
    relationship,
    confidence,
    includeInSummary: relationship !== "not_related" && confidence !== "excluded",
    notes: `Added from Active Listing Radar. Radar score: ${match.score}. Reasons: ${match.reasons.join(", ")}.`,
  };
}
