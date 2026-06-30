import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { scoreListingCandidate } from "./activeListingRadar";
import { selectedMarketAddress } from "./addressIntelligence";
import type {
  AddressCandidate,
  AreaRadarOptions,
  AreaRadarResult,
  ListingCandidate,
} from "./types";

function clean(value: string | number | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function same(a: string | null | undefined, b: string | null | undefined) {
  return Boolean(clean(a) && clean(a) === clean(b));
}

function has(value: string | null | undefined, needle: string | null | undefined) {
  return Boolean(clean(needle) && clean(value).includes(clean(needle)));
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

function parcelArea(parcel: NormalizedOfficialParcel, address?: AddressCandidate | null) {
  return {
    suburb: address?.suburb ?? parcel.suburbOrArea ?? undefined,
    town: address?.town ?? parcel.town ?? undefined,
    municipality: address?.municipality ?? parcel.municipality ?? undefined,
    province: address?.province ?? parcel.province ?? undefined,
  };
}

function candidateText(candidate: ListingCandidate) {
  return [
    candidate.locationText,
    candidate.microMarket,
    candidate.suburb,
    candidate.town,
    candidate.municipality,
    candidate.province,
    candidate.rawSourceArea,
    candidate.descriptionText,
    candidate.title,
  ]
    .filter(Boolean)
    .join(" ");
}

function areaMatchReasons(
  parcel: NormalizedOfficialParcel,
  candidate: ListingCandidate,
  options: AreaRadarOptions,
  address?: AddressCandidate | null,
): string[] {
  const reasons: string[] = [];
  const area = parcelArea(parcel, address);
  const text = candidateText(candidate);

  if (
    (options.scope === "1km" || options.scope === "3km" || options.scope === "10km") &&
    parcel.coordinates &&
    candidate.lat != null &&
    candidate.lng != null
  ) {
    const distance = metres(parcel.coordinates, { lat: candidate.lat, lng: candidate.lng });
    const limit = options.scope === "1km" ? 1000 : options.scope === "3km" ? 3000 : 10000;
    if (distance <= limit) reasons.push(`within ${options.scope}`);
  }

  if (area.suburb && (same(candidate.suburb, area.suburb) || has(text, area.suburb))) {
    reasons.push("same suburb");
  } else if (area.town && (same(candidate.town, area.town) || has(text, area.town))) {
    reasons.push("same town");
  } else if (
    area.municipality &&
    (same(candidate.municipality, area.municipality) || has(text, area.municipality))
  ) {
    reasons.push("same municipality");
  }

  if (options.source !== "all" && clean(candidate.sourcePortal) === clean(options.source)) {
    reasons.push(`source matches ${options.source}`);
  }
  if (options.propertyType !== "all" && propertyTypeMatches(candidate, options.propertyType)) {
    reasons.push("property type matches selected filter");
  }

  return Array.from(new Set(reasons));
}

export function filterCandidatesByArea(
  parcel: NormalizedOfficialParcel,
  candidates: ListingCandidate[],
  options: AreaRadarOptions,
  address?: AddressCandidate | null,
): ListingCandidate[] {
  return candidates.filter(
    (candidate) => areaMatchReasons(parcel, candidate, options, address).length > 0,
  );
}

export function filterCandidatesBySource(
  candidates: ListingCandidate[],
  source: AreaRadarOptions["source"],
): ListingCandidate[] {
  if (source === "all") return candidates;
  return candidates.filter((candidate) => clean(candidate.sourcePortal) === clean(source));
}

export function propertyTypeMatches(
  candidate: ListingCandidate,
  type: AreaRadarOptions["propertyType"],
): boolean {
  if (type === "all") return true;
  const text = clean(
    [candidate.propertyType, candidate.title, candidate.descriptionText].join(" "),
  );
  if (type === "house") return /house|home|residential/.test(text);
  if (type === "vacant_land") return /vacant|land|plot|stand|erf/.test(text);
  if (type === "farm_smallholding") return /farm|smallholding|agricultural/.test(text);
  if (type === "commercial") return /commercial|retail|office|industrial/.test(text);
  return /sectional|apartment|flat|unit|townhouse/.test(text);
}

export function filterCandidatesByPropertyType(
  candidates: ListingCandidate[],
  type: AreaRadarOptions["propertyType"],
): ListingCandidate[] {
  return candidates.filter((candidate) => propertyTypeMatches(candidate, type));
}

export function sortRadarResults(
  results: AreaRadarResult[],
  sort: AreaRadarOptions["sort"],
): AreaRadarResult[] {
  return [...results].sort((a, b) => {
    if (sort === "nearest_first") {
      return (
        (a.match.distanceMeters ?? Number.MAX_SAFE_INTEGER) -
        (b.match.distanceMeters ?? Number.MAX_SAFE_INTEGER)
      );
    }
    if (sort === "newest_first") {
      return (
        Date.parse(
          b.candidate.lastSeenAt ?? b.candidate.importedAt ?? b.candidate.fetchedAt ?? "0",
        ) -
        Date.parse(a.candidate.lastSeenAt ?? a.candidate.importedAt ?? a.candidate.fetchedAt ?? "0")
      );
    }
    if (sort === "price_low_high") {
      return (
        (a.candidate.askingPrice ?? Number.MAX_SAFE_INTEGER) -
        (b.candidate.askingPrice ?? Number.MAX_SAFE_INTEGER)
      );
    }
    if (sort === "price_high_low") {
      return (b.candidate.askingPrice ?? 0) - (a.candidate.askingPrice ?? 0);
    }
    return b.match.score - a.match.score || a.candidate.title.localeCompare(b.candidate.title);
  });
}

export function runAreaListingRadar(
  parcel: NormalizedOfficialParcel,
  candidates: ListingCandidate[],
  options: AreaRadarOptions,
  addressIntelligence?: {
    selectedAddressId?: string | null;
    candidates: AddressCandidate[];
  } | null,
): AreaRadarResult[] {
  const selectedAddress = selectedMarketAddress(addressIntelligence ?? null);
  const sourceFiltered = filterCandidatesBySource(candidates, options.source);
  const typeFiltered = filterCandidatesByPropertyType(sourceFiltered, options.propertyType);
  const areaFiltered = filterCandidatesByArea(parcel, typeFiltered, options, selectedAddress);
  return sortRadarResults(
    areaFiltered.map((candidate) => ({
      candidate,
      match: scoreListingCandidate(parcel, candidate, selectedAddress),
      areaReasons: areaMatchReasons(parcel, candidate, options, selectedAddress),
    })),
    options.sort,
  );
}
