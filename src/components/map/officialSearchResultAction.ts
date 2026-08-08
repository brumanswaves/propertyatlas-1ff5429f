import type { PropertySearchResult } from "@/lib/search/propertySearch";

interface OfficialSearchResultActions {
  openOfficialWorkbench: (result: PropertySearchResult) => void;
  highlightResult: (result: PropertySearchResult) => void;
}

function shouldOpenOfficialWorkbenchDirectly(result: PropertySearchResult) {
  return result.confidence === "exact_official_match" && Boolean(result.parcel);
}

export function selectOfficialErfResult(
  result: PropertySearchResult,
  actions: OfficialSearchResultActions,
) {
  if (shouldOpenOfficialWorkbenchDirectly(result)) {
    actions.openOfficialWorkbench(result);
    return;
  }
  actions.highlightResult(result);
}
