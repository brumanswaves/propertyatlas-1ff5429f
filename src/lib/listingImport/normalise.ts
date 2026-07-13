import type { ImportedListing } from "@/features/marketEvidence/listingImporter/types";
import { ImportedListingSchema } from "./schema";
import { suggestListingMatch } from "./match";
import { ListingImportError, type RawListingExtraction } from "./types";

const REQUIRED_REVIEW_FIELDS: Array<keyof ImportedListing["property"]> = [
  "askingPrice",
  "propertyType",
  "bedrooms",
  "bathrooms",
  "erfSizeM2",
  "streetAddress",
  "suburb",
  "town",
  "province",
];

function nullableString(value: unknown): string | null {
  if (value == null) return null;
  const str = String(value).trim();
  return str || null;
}

function nullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildMissingFields(property: ImportedListing["property"]): string[] {
  return REQUIRED_REVIEW_FIELDS.filter((field) => property[field] == null);
}

export function normaliseListing(
  raw: RawListingExtraction,
  options: { importedAt: string; selectedParcelId?: string | null },
): ImportedListing {
  const property: ImportedListing["property"] = {
    title: nullableString(raw.property.title),
    propertyType: nullableString(raw.property.propertyType),
    askingPrice: nullableNumber(raw.property.askingPrice),
    currency: "ZAR",
    saleOrRental: raw.property.saleOrRental ?? null,
    bedrooms: nullableNumber(raw.property.bedrooms),
    bathrooms: nullableNumber(raw.property.bathrooms),
    garages: nullableNumber(raw.property.garages),
    parkingSpaces: nullableNumber(raw.property.parkingSpaces),
    erfSizeM2: nullableNumber(raw.property.erfSizeM2),
    floorSizeM2: nullableNumber(raw.property.floorSizeM2),
    streetAddress: nullableString(raw.property.streetAddress),
    suburb: nullableString(raw.property.suburb),
    town: nullableString(raw.property.town),
    province: nullableString(raw.property.province),
    postalCode: nullableString(raw.property.postalCode),
    ratesMonthly: nullableNumber(raw.property.ratesMonthly),
    leviesMonthly: nullableNumber(raw.property.leviesMonthly),
    occupationDate: nullableString(raw.property.occupationDate),
    latitude: nullableNumber(raw.property.latitude),
    longitude: nullableNumber(raw.property.longitude),
    erfNumber: nullableString(raw.property.erfNumber),
  };
  const missingFields = buildMissingFields(property);
  const warnings = [...raw.warnings];
  if (!property.streetAddress) warnings.push("No street address was displayed in the extracted listing data.");
  if (!property.erfNumber) warnings.push("No erf number was explicitly stated in the listing.");
  if (!property.erfSizeM2 && property.floorSizeM2) {
    warnings.push("Floor size was extracted, but erf size was not. These are kept separate.");
  }
  if (property.suburb && !property.streetAddress) {
    warnings.push("Area-level location is not enough to match this listing to the selected erf.");
  }

  const listing: ImportedListing = {
    source: {
      portal: raw.source.portal,
      url: raw.source.url,
      canonicalUrl: raw.source.canonicalUrl ?? raw.source.url,
      listingId: raw.source.listingId,
      fetchedAt: raw.source.fetchedAt,
      importedAt: options.importedAt,
      contentHash: raw.source.contentHash ?? null,
    },
    property,
    listing: {
      listingDate: nullableString(raw.listing.listingDate),
      description: nullableString(raw.listing.description),
      features: raw.listing.features ?? [],
      imageUrls: raw.listing.imageUrls ?? [],
    },
    agent: {
      name: nullableString(raw.agent.name),
      agency: nullableString(raw.agent.agency),
      phone: nullableString(raw.agent.phone),
      email: nullableString(raw.agent.email),
    },
    evidence: raw.evidence.filter((item) => item.value != null && item.value !== ""),
    missingFields,
    warnings: [...new Set(warnings)],
    match: suggestListingMatch(property, options.selectedParcelId),
    importStatus: missingFields.length > 0 ? "needs_verification" : "ready_for_review",
  };

  const parsed = ImportedListingSchema.safeParse(listing);
  if (!parsed.success) {
    throw new ListingImportError(
      "EXTRACTION_FAILED",
      "The listing was fetched, but the extracted data could not be validated.",
      { details: parsed.error.issues.map((issue) => issue.path.join(".")).slice(0, 4).join(", ") },
    );
  }
  void parsed;
  return listing;
}
