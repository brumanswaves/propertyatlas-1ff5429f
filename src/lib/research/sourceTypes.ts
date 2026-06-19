import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";

export type ResearchSourceCategory =
  | "official"
  | "municipal"
  | "market"
  | "reports"
  | "rental"
  | "environmental"
  | "search"
  | "saved_evidence"
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

export type ResearchSourceConfidence =
  | "confirmed_for_parcel"
  | "official_relevant"
  | "external_relevant"
  | "paid_report"
  | "future_integration";

export type ResearchDossierGroup =
  | "official-parcel-identity"
  | "municipal-evidence"
  | "planning-zoning"
  | "deeds-ownership"
  | "market-intelligence"
  | "building-improvement"
  | "rental-tourism"
  | "environmental-coastal-risk"
  | "generated-searches"
  | "user-workspace"
  | "paid-reports";

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
  description?: string;
  helpsWith?: string;
  fieldsFound?: string[];
  requiredFields: ParcelFieldKey[];
  actionLabel: string;
  complianceNote: string;
  confidence?: ResearchSourceConfidence;
  parcelSpecific?: boolean;
  dossierGroup?: ResearchDossierGroup;
  buildUrl?: (ctx: ResearchSourceContext) => string | null;
}

export interface ResearchSource extends ResearchSourceDefinition {
  status: ResearchSourceStatus;
  url: string | null;
  missingFields: ParcelFieldKey[];
}

export const RESEARCH_CATEGORY_LABELS: Record<ResearchSourceCategory, string> = {
  official: "Official",
  municipal: "Municipal",
  market: "Market",
  reports: "Reports",
  rental: "Rental",
  environmental: "Environmental",
  search: "Search",
  saved_evidence: "Saved evidence",
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

export const RESEARCH_DOSSIER_GROUP_LABELS: Record<ResearchDossierGroup, string> = {
  "official-parcel-identity": "Official Parcel Identity",
  "municipal-evidence": "Municipal Evidence",
  "planning-zoning": "Planning and Zoning",
  "deeds-ownership": "Deeds and Ownership",
  "market-intelligence": "Market Intelligence",
  "building-improvement": "Building and Improvement Clues",
  "rental-tourism": "Rental and Tourism Intelligence",
  "environmental-coastal-risk": "Environmental and Coastal Risk",
  "generated-searches": "Generated Searches",
  "user-workspace": "User Workspace",
  "paid-reports": "Paid Reports",
};
