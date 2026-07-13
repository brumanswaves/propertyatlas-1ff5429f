import type { ImportedListing } from "@/features/marketEvidence/listingImporter/types";

export function buildDuplicateKey(listing: ImportedListing): string {
  const canonical = listing.source.canonicalUrl ?? listing.source.url;
  const listingId = listing.source.listingId;
  return [listing.source.portal ?? "unknown", listingId ?? canonical].join(":");
}

export function duplicateMetadata(listing: ImportedListing) {
  return {
    duplicateKey: buildDuplicateKey(listing),
    canonicalUrl: listing.source.canonicalUrl ?? listing.source.url,
    listingId: listing.source.listingId,
    contentHash: listing.source.contentHash ?? null,
  };
}
