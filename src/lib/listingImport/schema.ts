import { z } from "zod";

const nullableString = z.string().nullable();
const nullableNumber = z.number().finite().nullable();

export const ListingImportRequestSchema = z.object({
  url: z.string().min(1),
  selectedParcelId: z.string().nullable().optional(),
});

export const ImportedListingSchema = z.object({
  id: z.string().optional(),
  source: z.object({
    portal: nullableString,
    url: z.string().url(),
    canonicalUrl: nullableString.optional(),
    listingId: nullableString,
    fetchedAt: z.string(),
    importedAt: nullableString.optional(),
    contentHash: nullableString.optional(),
  }),
  property: z.object({
    title: nullableString,
    propertyType: nullableString,
    askingPrice: nullableNumber,
    currency: z.literal("ZAR"),
    saleOrRental: z.union([z.literal("sale"), z.literal("rental")]).nullable(),
    bedrooms: nullableNumber,
    bathrooms: nullableNumber,
    garages: nullableNumber,
    parkingSpaces: nullableNumber,
    erfSizeM2: nullableNumber,
    floorSizeM2: nullableNumber,
    streetAddress: nullableString,
    suburb: nullableString,
    town: nullableString,
    province: nullableString,
    postalCode: nullableString,
    ratesMonthly: nullableNumber,
    leviesMonthly: nullableNumber,
    occupationDate: nullableString,
    latitude: nullableNumber.optional(),
    longitude: nullableNumber.optional(),
    erfNumber: nullableString.optional(),
  }),
  listing: z.object({
    listingDate: nullableString.optional(),
    description: nullableString,
    features: z.array(z.string()),
    imageUrls: z.array(z.string()),
  }),
  agent: z.object({
    name: nullableString,
    agency: nullableString,
    phone: nullableString,
    email: nullableString,
  }),
  evidence: z.array(
    z.object({
      field: z.string(),
      value: z.unknown(),
      extractionMethod: z.enum([
        "json-ld",
        "open-graph",
        "embedded-json",
        "html",
        "portal-parser",
        "openai",
        "user",
      ]),
      sourceText: nullableString,
      confidence: z.number().min(0).max(1),
    }),
  ),
  missingFields: z.array(z.string()),
  warnings: z.array(z.string()),
  match: z.object({
    status: z.enum(["matched", "suggested", "unmatched", "manual"]),
    parcelId: nullableString,
    confidence: z.number().min(0).max(1),
    reasons: z.array(z.string()).optional(),
  }),
  importStatus: z.enum(["ready_for_review", "needs_verification", "failed"]).optional(),
});

export type ListingImportRequest = z.infer<typeof ListingImportRequestSchema>;
