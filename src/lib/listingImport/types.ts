import type {
  ImportedListing,
  ListingImportErrorCode,
} from "@/features/marketEvidence/listingImporter/types";

export type ListingPortal = "property24" | "generic";

export interface ListingImportInput {
  url: string;
  selectedParcelId?: string | null;
}

export interface ListingImportDependencies {
  fetcher?: typeof fetch;
  now?: () => Date;
}

export interface ListingImportSuccess {
  success: true;
  listing: ImportedListing;
}

export interface ListingImportFailure {
  success: false;
  error: {
    code: ListingImportErrorCode;
    message: string;
    details?: string;
  };
}

export type ListingImportResult = ListingImportSuccess | ListingImportFailure;

export class ListingImportError extends Error {
  code: ListingImportErrorCode;
  details?: string;
  status: number;

  constructor(
    code: ListingImportErrorCode,
    message: string,
    options: { details?: string; status?: number } = {},
  ) {
    super(message);
    this.name = "ListingImportError";
    this.code = code;
    this.details = options.details;
    this.status = options.status ?? statusForError(code);
  }
}

export interface FetchedListingPage {
  requestedUrl: string;
  finalUrl: string;
  html: string;
  contentType: string | null;
  fetchedAt: string;
  contentHash: string;
}

export interface RawListingExtraction {
  source: {
    portal: string | null;
    url: string;
    canonicalUrl?: string | null;
    listingId: string | null;
    fetchedAt: string;
    contentHash?: string | null;
  };
  property: {
    title?: string | null;
    propertyType?: string | null;
    askingPrice?: number | null;
    currency?: "ZAR";
    saleOrRental?: "sale" | "rental" | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    garages?: number | null;
    parkingSpaces?: number | null;
    erfSizeM2?: number | null;
    floorSizeM2?: number | null;
    streetAddress?: string | null;
    suburb?: string | null;
    town?: string | null;
    province?: string | null;
    postalCode?: string | null;
    ratesMonthly?: number | null;
    leviesMonthly?: number | null;
    occupationDate?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    erfNumber?: string | null;
  };
  listing: {
    listingDate?: string | null;
    description?: string | null;
    features?: string[];
    imageUrls?: string[];
  };
  agent: {
    name?: string | null;
    agency?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  evidence: Array<{
    field: string;
    value: unknown;
    extractionMethod:
      | "json-ld"
      | "open-graph"
      | "embedded-json"
      | "html"
      | "portal-parser"
      | "openai"
      | "user";
    sourceText: string | null;
    confidence: number;
  }>;
  warnings: string[];
}

export interface ListingProvider {
  canHandle(url: URL): boolean;
  fetch(url: URL, deps?: ListingImportDependencies): Promise<FetchedListingPage>;
  extract(page: FetchedListingPage): Promise<RawListingExtraction>;
}

export function statusForError(code: ListingImportErrorCode): number {
  switch (code) {
    case "INVALID_URL":
      return 400;
    case "UNSUPPORTED_URL":
      return 415;
    case "BLOCKED":
      return 403;
    case "RATE_LIMITED":
      return 429;
    case "FETCH_FAILED":
    case "EXTRACTION_FAILED":
      return 422;
    case "SERVICE_NOT_CONFIGURED":
      return 501;
    default:
      return 500;
  }
}
