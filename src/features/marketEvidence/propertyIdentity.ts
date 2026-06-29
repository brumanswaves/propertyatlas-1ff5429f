import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import {
  ERF_962_IDENTITY,
  matchesErf962HarbourRoad,
} from "@/lib/research/seedParcels/erf962HarbourRoad";
import { detectPropertyCategory } from "./resolveMarketEvidenceContext";

export type PropertyIdentityConfidence = "high" | "medium" | "low" | "needs_confirmation";

export type PropertyIdentityAddressSource =
  | "official_parcel"
  | "seeded_showcase"
  | "municipal"
  | "user_entered"
  | "reverse_geocode_hint"
  | "area_only"
  | "unknown";

export interface PropertyIdentityOverride {
  address?: string | null;
  streetName?: string | null;
  marketSuburb?: string | null;
  note?: string | null;
  confirmedAt?: string | null;
}

export interface PropertyIdentity {
  officialErf?: string;
  officialPortion?: string;
  lpi?: string;
  parcelKey?: string;
  bestAddress?: string;
  streetNumber?: string;
  streetName?: string;
  officialSuburb?: string;
  marketSuburb?: string;
  town?: string;
  municipality?: string;
  province?: string;
  coordinates?: { lng: number; lat: number };
  landSizeM2?: number;
  confidence: PropertyIdentityConfidence;
  addressSource: PropertyIdentityAddressSource;
  warnings: string[];
  canSearchExactAddress: boolean;
  canSearchStreet: boolean;
  canSearchNearby: boolean;
  propertyCategory: ReturnType<typeof detectPropertyCategory>;
  userNote?: string;
}

function knownField(parcel: NormalizedOfficialParcel, pattern: RegExp): string | undefined {
  const match = parcel.knownFields.find((field) => pattern.test(`${field.label} ${field.source}`));
  return match?.value?.trim() || undefined;
}

function parseLandSize(value: string | number | null | undefined): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function splitAddress(address: string | undefined) {
  if (!address) return {};
  const match = address.match(/^\s*(\d+[a-zA-Z]?)\s+(.+?)\s*$/);
  if (!match) return { streetName: address };
  return { streetNumber: match[1], streetName: match[2] };
}

function sourceForAddress(parcel: NormalizedOfficialParcel): PropertyIdentityAddressSource {
  const field = parcel.knownFields.find((item) => /address|street number/i.test(item.label));
  const source = `${field?.source ?? ""} ${field?.label ?? ""}`.toLowerCase();
  if (/user/.test(source)) return "user_entered";
  if (/municipal|kouga/.test(source)) return "municipal";
  if (/official|csg|parcel/.test(source)) return "official_parcel";
  return field ? "official_parcel" : "unknown";
}

export function resolvePropertyIdentity(
  parcel: NormalizedOfficialParcel,
  override?: PropertyIdentityOverride | null,
): PropertyIdentity {
  const seeded = matchesErf962HarbourRoad(parcel);
  const rawAddress =
    override?.address?.trim() ||
    knownField(parcel, /address|display title|street number/i) ||
    (seeded ? ERF_962_IDENTITY.address : undefined);
  const knownStreet = knownField(parcel, /street|road/i);
  const split = splitAddress(rawAddress);
  const streetName = override?.streetName?.trim() || split.streetName || knownStreet;
  const officialSuburb = parcel.suburbOrArea ?? knownField(parcel, /suburb|minor region|area/i);
  const marketSuburb =
    override?.marketSuburb?.trim() ||
    (seeded ? "Santareme" : undefined) ||
    knownField(parcel, /market area|marketing suburb/i) ||
    officialSuburb;
  const town = parcel.town ?? knownField(parcel, /town|major region/i);
  const municipality = parcel.municipality ?? (seeded ? ERF_962_IDENTITY.municipality : undefined);
  const province = parcel.province ?? (seeded ? ERF_962_IDENTITY.province : undefined);
  const warnings: string[] = [];
  const addressSource: PropertyIdentityAddressSource = override?.address?.trim()
    ? "user_entered"
    : seeded
      ? "seeded_showcase"
      : rawAddress
        ? sourceForAddress(parcel)
        : officialSuburb || town || municipality
          ? "area_only"
          : "unknown";

  if (!parcel.province && !knownField(parcel, /province/i)) {
    warnings.push("Province missing; portal searches may be broad.");
  }
  if (officialSuburb && marketSuburb && officialSuburb !== marketSuburb) {
    warnings.push("Official suburb and market suburb differ; verify the listing area manually.");
  }
  if (!rawAddress && !streetName) {
    warnings.push("No confirmed street address yet.");
  }

  const confidence: PropertyIdentityConfidence = override?.confirmedAt
    ? "high"
    : rawAddress
      ? seeded || addressSource === "official_parcel" || addressSource === "municipal"
        ? "high"
        : "medium"
      : streetName
        ? "low"
        : officialSuburb || town || municipality
          ? "needs_confirmation"
          : "needs_confirmation";

  return {
    officialErf: parcel.erfNumber != null ? String(parcel.erfNumber) : undefined,
    officialPortion: parcel.portion != null ? String(parcel.portion) : undefined,
    lpi: parcel.lpi ?? undefined,
    parcelKey: parcel.parcelKey ?? undefined,
    bestAddress: rawAddress,
    streetNumber: split.streetNumber,
    streetName,
    officialSuburb: officialSuburb ?? undefined,
    marketSuburb: marketSuburb ?? undefined,
    town: town ?? undefined,
    municipality: municipality ?? undefined,
    province: province ?? undefined,
    coordinates: parcel.coordinates ?? undefined,
    landSizeM2: parseLandSize(
      knownField(parcel, /land size|erf size|geometry area|shape area|area/i),
    ),
    confidence,
    addressSource,
    warnings,
    canSearchExactAddress: Boolean(rawAddress && (marketSuburb || town || municipality)),
    canSearchStreet: Boolean(streetName && (marketSuburb || town || municipality)),
    canSearchNearby: Boolean(marketSuburb || town || municipality || province),
    propertyCategory: detectPropertyCategory(parcel),
    userNote: override?.note?.trim() || undefined,
  };
}

export interface SimpleListingSearch {
  id: string;
  label: string;
  phrase: string;
  helper: string;
  primaryPortalUrls: Array<{ portal: "Property24" | "Private Property"; url: string }>;
}

function area(identity: PropertyIdentity) {
  return (
    identity.marketSuburb ?? identity.officialSuburb ?? identity.town ?? identity.municipality ?? ""
  );
}

function pushUnique(
  items: SimpleListingSearch[],
  item: Omit<SimpleListingSearch, "id" | "primaryPortalUrls">,
) {
  if (!item.phrase.trim()) return;
  const id = item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  if (items.some((existing) => existing.phrase === item.phrase || existing.id === id)) return;
  items.push({
    ...item,
    id,
    primaryPortalUrls: [
      { portal: "Property24", url: "https://www.property24.com/" },
      { portal: "Private Property", url: "https://www.privateproperty.co.za/" },
    ],
  });
}

export function buildSimpleListingSearches(identity: PropertyIdentity): SimpleListingSearch[] {
  const items: SimpleListingSearch[] = [];
  const localArea = area(identity);
  const broader = identity.town ?? identity.municipality ?? identity.province ?? localArea;

  if (identity.canSearchExactAddress && identity.bestAddress) {
    pushUnique(items, {
      label: "Search exact address",
      phrase: [identity.bestAddress, localArea].filter(Boolean).join(" "),
      helper: "Start here when the address looks right. Verify photos, map pin and agent text.",
    });
  }
  if (identity.canSearchStreet && identity.streetName) {
    pushUnique(items, {
      label: "Search same street",
      phrase: [identity.streetName, localArea].filter(Boolean).join(" "),
      helper: "Useful when listings hide the street number but mention the road or neighbourhood.",
    });
  }
  if (identity.canSearchNearby && localArea) {
    pushUnique(items, {
      label: "Search nearby comps",
      phrase: `${localArea} property for sale`,
      helper: "Find comparable asking prices in the same market area.",
    });
  }
  if (identity.propertyCategory === "vacant_land" || !identity.bestAddress) {
    const vacantArea = localArea || broader;
    pushUnique(items, {
      label: "Search vacant land / plots",
      phrase: `${vacantArea} vacant land for sale`,
      helper: "Use this for plots, stands, vacant land and erf-only comparables.",
    });
  }
  if (broader && broader !== localArea) {
    pushUnique(items, {
      label: "Search broader market",
      phrase: `${broader} property for sale`,
      helper: "Use only as a broader market check when local evidence is thin.",
    });
  }

  return items.slice(0, 5);
}
