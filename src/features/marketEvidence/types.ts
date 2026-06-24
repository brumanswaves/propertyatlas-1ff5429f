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
  landSizeM2?: number | null;
  buildingSizeM2?: number | null;
  relationship: MarketEvidenceRelationship;
  confidence: MarketEvidenceConfidence;
  includeInSummary: boolean;
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
