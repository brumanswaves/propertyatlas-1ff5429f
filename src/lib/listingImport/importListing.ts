import type { ImportedListing } from "@/features/marketEvidence/listingImporter/types";
import { ListingImportRequestSchema } from "./schema";
import { property24Provider } from "./providers/property24";
import { genericProvider } from "./providers/generic";
import { detectListingPortal, validateImportUrl } from "./url";
import { duplicateMetadata } from "./duplicates";
import { normaliseListing } from "./normalise";
import {
  ListingImportError,
  type ListingImportDependencies,
  type ListingImportInput,
  type ListingImportResult,
  type ListingProvider,
} from "./types";

const PROVIDERS: ListingProvider[] = [property24Provider, genericProvider];

function errorResult(error: unknown): ListingImportResult {
  if (error instanceof ListingImportError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
  }
  return {
    success: false,
    error: {
      code: "UNKNOWN",
      message: "Listing import failed.",
    },
  };
}

export async function importListing(
  input: ListingImportInput,
  deps: ListingImportDependencies = {},
): Promise<ListingImportResult> {
  try {
    const parsedInput = ListingImportRequestSchema.parse(input);
    const url = validateImportUrl(parsedInput.url);
    const portal = detectListingPortal(url);
    const provider = PROVIDERS.find((candidate) => candidate.canHandle(url));
    if (!provider || portal !== "property24") {
      throw new ListingImportError(
        "UNSUPPORTED_URL",
        "This listing source is not supported yet. Property24 URLs are supported first.",
      );
    }
    const page = await provider.fetch(url, deps);
    const raw = await provider.extract(page);
    const now = (deps.now?.() ?? new Date()).toISOString();
    const listing: ImportedListing = normaliseListing(raw, {
      importedAt: now,
      selectedParcelId: parsedInput.selectedParcelId ?? null,
    });
    const duplicate = duplicateMetadata(listing);
    listing.warnings = [
      ...listing.warnings,
      `Duplicate check metadata: ${duplicate.duplicateKey}`,
    ];
    return { success: true, listing };
  } catch (error) {
    return errorResult(error);
  }
}

export { ListingImportError };
