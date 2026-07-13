import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";

export type MarketEvidenceRelationship =
  | "target_asset"
  | "possible_target_asset"
  | "same_street_comp"
  | "same_node_comp"
  | "same_suburb_comp"
  | "vacant_land_comp"
  | "broader_market_comp"
  | "inverse_comp"
  | "weak_comp"
  | "not_related";

export type MarketEvidenceConfidence = "high" | "medium" | "low" | "excluded";

export type MarketEvidenceListingRole =
  | "subject_active_listing"
  | "comparable_evidence"
  | "market_note";

export type RadarClassification =
  | "possible_target_property"
  | "strong_comp"
  | "same_street_comp"
  | "same_node_comp"
  | "vacant_land_comp"
  | "nearby_market_comp"
  | "broader_market_comp"
  | "weak_comp"
  | "hidden";

export type RadarSignal =
  | "erf_number_mentioned"
  | "exact_address_match"
  | "street_name_match"
  | "land_size_exact"
  | "land_size_close"
  | "coordinate_close"
  | "same_micro_market"
  | "same_suburb"
  | "same_property_type"
  | "estate_or_scheme_match"
  | "vacant_land_match"
  | "broader_area_match";

export type MarketEvidenceCategory =
  | "residential"
  | "vacant_land"
  | "sectional_title"
  | "farm_smallholding"
  | "estate_complex";

export interface MarketEvidenceContext {
  parcel: NormalizedOfficialParcel;
  parcelId: string;
  erfNumber?: string;
  portion?: string;
  address?: string;
  streetName?: string;
  suburb?: string;
  town?: string;
  municipality?: string;
  province?: string;
  landSizeM2?: number;
  lpi?: string;
  parcelKey?: string;
  coordinates?: { lng: number; lat: number };
  officialSourceLabel?: string;
  marketArea?: string;
  schemeOrEstate?: string;
  farmNumber?: string;
  district?: string;
  warnings: string[];
  category: MarketEvidenceCategory;
}

export type AddressSource =
  | "official_parcel"
  | "municipal_record"
  | "google_reverse_geocode"
  | "manual_google_maps_whats_here"
  | "user_entered"
  | "unknown";

export type AddressConfidence = "high" | "medium" | "low" | "unverified";

export interface AddressCandidate {
  id: string;
  formattedAddress: string;
  streetNumber?: string | null;
  streetName?: string | null;
  suburb?: string | null;
  town?: string | null;
  municipality?: string | null;
  province?: string | null;
  postalCode?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  source: AddressSource;
  confidence: AddressConfidence;
  reason: string;
  createdAt: string;
  updatedAt?: string | null;
}

export interface MarketAddressIntelligence {
  selectedAddressId?: string | null;
  candidates: AddressCandidate[];
  userConfirmedAddress?: AddressCandidate | null;
  lastResolvedAt?: string | null;
  notes?: string | null;
}

export interface SearchLadderItem {
  id: string;
  level: number;
  label: string;
  phrase: string;
  helper: string;
  confidence: MarketEvidenceConfidence;
  relationshipSuggestion: MarketEvidenceRelationship;
}

export type PortalActionGroup =
  | "major_portals"
  | "agency_portals"
  | "vacant_land_portals"
  | "local_agencies"
  | "farm_smallholding"
  | "manual_fallback";

export interface MarketEvidencePortalAction {
  id: string;
  portal: string;
  title: string;
  description: string;
  url: string;
  searchPhrase: string;
  confidence: MarketEvidenceConfidence;
  actionType: "open_portal" | "open_area_page" | "manual_search";
  group: PortalActionGroup;
  opensReliableAreaPage: boolean;
  requiresManualPaste: boolean;
  helperText: string;
}

export type ListingCandidateSource = "manual_import" | "source_backed_seed";

export interface ListingCandidate {
  id: string;
  sourceType: ListingCandidateSource;
  sourcePortal: string;
  sourceUrl: string;
  title: string;
  askingPrice?: number | null;
  propertyType?: string | null;
  locationText?: string | null;
  microMarket?: string | null;
  suburb?: string | null;
  town?: string | null;
  municipality?: string | null;
  province?: string | null;
  streetName?: string | null;
  descriptionText?: string | null;
  beds?: number | null;
  baths?: number | null;
  landSizeM2?: number | null;
  buildingSizeM2?: number | null;
  agencyName?: string | null;
  imageUrl?: string | null;
  listingStatus?: string | null;
  fetchedAt?: string | null;
  lastSeenAt?: string | null;
  importedAt?: string | null;
  rawSourceArea?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface RadarMatch {
  candidateId: string;
  score: number;
  classification: RadarClassification;
  reasons: string[];
  distanceMeters?: number;
  sizeVariancePercent?: number;
  matchedSignals: RadarSignal[];
}

export interface RadarCandidateResult {
  candidate: ListingCandidate;
  match: RadarMatch;
}

export type AreaRadarMode = "exact_match" | "area_listings";
export type AreaSearchScope = "1km" | "3km" | "10km" | "same_suburb" | "same_town" | "municipality";
export type AreaRadarSource =
  | "all"
  | "Property24"
  | "Private Property"
  | "Pam Golding"
  | "Seeff"
  | "Chas Everitt"
  | "Rawson"
  | "RE/MAX";
export type AreaRadarPropertyType =
  | "all"
  | "house"
  | "vacant_land"
  | "farm_smallholding"
  | "commercial"
  | "sectional_title";
export type AreaRadarSortMode =
  | "best_match"
  | "nearest_first"
  | "newest_first"
  | "price_low_high"
  | "price_high_low";

export interface AreaRadarOptions {
  scope: AreaSearchScope;
  source: AreaRadarSource;
  propertyType: AreaRadarPropertyType;
  sort: AreaRadarSortMode;
}

export interface AreaRadarResult extends RadarCandidateResult {
  areaReasons: string[];
}

export interface SavedMarketEvidence {
  id: string;
  parcelId: string;
  sourceUrl: string;
  sourcePortal: string;
  title: string;
  askingPrice?: number | null;
  propertyType?: string | null;
  beds?: number | null;
  baths?: number | null;
  garages?: number | null;
  parkingSpaces?: number | null;
  landSizeM2?: number | null;
  buildingSizeM2?: number | null;
  relationship: MarketEvidenceRelationship;
  confidence: MarketEvidenceConfidence;
  includeInSummary: boolean;
  listingRole?: MarketEvidenceListingRole;
  importedListing?: {
    listingId?: string | null;
    canonicalUrl?: string | null;
    importedAt?: string | null;
    fetchedAt?: string | null;
    contentHash?: string | null;
    listingDate?: string | null;
    warnings?: string[];
    missingFields?: string[];
    matchStatus?: string | null;
    matchReasons?: string[];
    userConfirmedAttachment?: boolean;
  } | null;
  notes?: string | null;
  savedAt: string;
  updatedAt: string;
}

export interface MarketEvidenceSummary {
  totalEvidence: number;
  includedEvidence: number;
  averageAskingPrice?: number;
  medianAskingPrice?: number;
  priceRange?: { min: number; max: number };
  averageLandPricePerM2?: number;
  medianLandPricePerM2?: number;
  averageBuildingPricePerM2?: number;
  medianBuildingPricePerM2?: number;
  relationshipMix: Record<string, number>;
  confidenceMix: Record<string, number>;
  lastUpdated?: string;
  hasUsablePriceData: boolean;
}

export const RELATIONSHIP_LABELS: Record<MarketEvidenceRelationship, string> = {
  target_asset: "Target asset",
  possible_target_asset: "Possible target asset",
  same_street_comp: "Same street comp",
  same_node_comp: "Same node comp",
  same_suburb_comp: "Same suburb comp",
  vacant_land_comp: "Vacant land comp",
  broader_market_comp: "Broader market comp",
  inverse_comp: "Inverse comp",
  weak_comp: "Weak comp",
  not_related: "Not related",
};

export const CONFIDENCE_LABELS: Record<MarketEvidenceConfidence, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  excluded: "Excluded",
};

export const CONFIDENCE_COPY: Record<MarketEvidenceConfidence, string> = {
  high: "Exact address, strong visual confirmation, or direct match.",
  medium: "Similar size, specs, street, node, or local market, but not confirmed.",
  low: "Address hidden, approximate location, broader market, or weak similarity.",
  excluded: "Stored for reference but excluded from thesis calculations.",
};
