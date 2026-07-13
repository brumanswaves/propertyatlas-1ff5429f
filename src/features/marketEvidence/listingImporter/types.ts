// Frontend types for the listing URL importer. Backend contract is enforced
// server-side; these mirror POST /api/listings/import responses so the review
// UI can be built end-to-end before the real pipeline lands.

export type ImportedListingConfidence = number; // 0..1

export type ExtractionMethod =
  | "json-ld"
  | "open-graph"
  | "embedded-json"
  | "html"
  | "portal-parser"
  | "openai"
  | "user";

export type ListingMatchStatus = "matched" | "suggested" | "unmatched" | "manual";

export type ListingImportStatus = "ready_for_review" | "needs_verification" | "failed";

export interface ImportedListingSource {
  portal: string | null;
  url: string;
  canonicalUrl?: string | null;
  listingId: string | null;
  fetchedAt: string;
  importedAt?: string | null;
  contentHash?: string | null;
}

export interface ImportedListingProperty {
  title: string | null;
  propertyType: string | null;
  askingPrice: number | null;
  currency: "ZAR";
  saleOrRental: "sale" | "rental" | null;

  bedrooms: number | null;
  bathrooms: number | null;
  garages: number | null;
  parkingSpaces: number | null;

  erfSizeM2: number | null;
  floorSizeM2: number | null;

  streetAddress: string | null;
  suburb: string | null;
  town: string | null;
  province: string | null;
  postalCode: string | null;

  ratesMonthly: number | null;
  leviesMonthly: number | null;
  occupationDate: string | null;

  latitude?: number | null;
  longitude?: number | null;
  erfNumber?: string | null;
}

export interface ImportedListingBody {
  listingDate?: string | null;
  description: string | null;
  features: string[];
  imageUrls: string[];
}

export interface ImportedListingAgent {
  name: string | null;
  agency: string | null;
  phone: string | null;
  email: string | null;
}

export interface ImportedListingEvidence {
  field: string;
  value: unknown;
  extractionMethod: ExtractionMethod;
  sourceText: string | null;
  confidence: ImportedListingConfidence;
}

export interface ImportedListingMatch {
  status: ListingMatchStatus;
  parcelId: string | null;
  confidence: ImportedListingConfidence;
  reasons?: string[];
}

export interface ImportedListing {
  id?: string;
  source: ImportedListingSource;
  property: ImportedListingProperty;
  listing: ImportedListingBody;
  agent: ImportedListingAgent;
  evidence: ImportedListingEvidence[];
  missingFields: string[];
  warnings: string[];
  match: ImportedListingMatch;
  importStatus?: ListingImportStatus;
}

export type ListingImportErrorCode =
  | "INVALID_URL"
  | "UNSUPPORTED_URL"
  | "FETCH_FAILED"
  | "BLOCKED"
  | "EXTRACTION_FAILED"
  | "RATE_LIMITED"
  | "NOT_CONFIGURED"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export interface ListingImportError {
  code: ListingImportErrorCode;
  message: string;
  details?: string;
}

export type ListingImportResponse =
  | { success: true; listing: ImportedListing }
  | { success: false; error: ListingImportError };

export type ListingImportPhase =
  | "idle"
  | "opening"
  | "extracting"
  | "checking_missing"
  | "preparing_evidence";

export interface ListingImportRequest {
  url: string;
  selectedParcelId?: string | null;
}

export type ListingMatchChoice =
  | { kind: "current_erf" }
  | { kind: "map_pick" }
  | { kind: "unmatched_area_comp" }
  | { kind: "manual"; erfNumber?: string | null; address?: string | null };
