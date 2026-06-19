import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";

export type ResearchSourceCategory =
  | "csg-sg-documents"
  | "deeds-ownership"
  | "municipal-valuation-rates"
  | "zoning-land-use"
  | "planning-notices"
  | "environmental-heritage-risk"
  | "listings-market-evidence"
  | "neighbourhood-intelligence"
  | "roads-access-infrastructure"
  | "legal-entity-distress"
  | "tenders-catalysts"
  | "paid-reports";

export type ResearchSourceType =
  | "official"
  | "municipal"
  | "public-web"
  | "generated-search"
  | "paid-provider"
  | "user-supplied"
  | "sponsored"
  | "unavailable";

export type ResearchSourceStatus =
  | "available"
  | "open-search"
  | "manual-check"
  | "paid-report"
  | "unavailable";

export type ParcelFieldKey =
  | "erfNumber"
  | "portion"
  | "lpi"
  | "parcelKey"
  | "municipality"
  | "province"
  | "suburbOrArea"
  | "coordinates";

export interface ResearchSourceContext {
  parcel: NormalizedOfficialParcel;
}

export interface ResearchSourceDefinition {
  id: string;
  category: ResearchSourceCategory;
  name: string;
  sourceType: ResearchSourceType;
  defaultStatus: ResearchSourceStatus;
  missingStatus?: ResearchSourceStatus;
  reveals: string;
  requiredFields: ParcelFieldKey[];
  actionLabel: string;
  complianceNote: string;
  buildUrl?: (ctx: ResearchSourceContext) => string | null;
}

export interface ResearchSource extends ResearchSourceDefinition {
  status: ResearchSourceStatus;
  url: string | null;
  missingFields: ParcelFieldKey[];
}

export const RESEARCH_CATEGORY_LABELS: Record<ResearchSourceCategory, string> = {
  "csg-sg-documents": "CSG and SG documents",
  "deeds-ownership": "Deeds and ownership research",
  "municipal-valuation-rates": "Municipal valuation roll, rates, and taxes",
  "zoning-land-use": "Zoning and land use",
  "planning-notices": "Planning applications and public notices",
  "environmental-heritage-risk": "Environmental, heritage, flood, coastal, and geology risk",
  "listings-market-evidence": "Listings and market evidence",
  "neighbourhood-intelligence": "Neighbourhood intelligence",
  "roads-access-infrastructure": "Roads, access, and infrastructure",
  "legal-entity-distress": "Legal, entity, estate, and distress research",
  "tenders-catalysts": "Public tenders and future area catalysts",
  "paid-reports": "Paid reports",
};
