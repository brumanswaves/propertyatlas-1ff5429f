import {
  ListingImportError,
  type FetchedListingPage,
  type ListingProvider,
  type RawListingExtraction,
} from "../types";

export class GenericListingProvider implements ListingProvider {
  canHandle(): boolean {
    return false;
  }

  async fetch(): Promise<FetchedListingPage> {
    throw new ListingImportError(
      "UNSUPPORTED_URL",
      "Generic listing import is not enabled yet. Property24 URLs are supported first.",
    );
  }

  async extract(_page: FetchedListingPage): Promise<RawListingExtraction> {
    throw new ListingImportError(
      "UNSUPPORTED_URL",
      "Generic listing import is not enabled yet. Property24 URLs are supported first.",
    );
  }
}

export const genericProvider = new GenericListingProvider();
