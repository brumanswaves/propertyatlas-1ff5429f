import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { buildPortalActions } from "./buildPortalActions";
import { buildSearchLadder } from "./buildSearchLadder";
import { resolveMarketEvidenceContext } from "./resolveMarketEvidenceContext";

export function generateMarketEvidenceActions(parcel: NormalizedOfficialParcel) {
  const context = resolveMarketEvidenceContext(parcel);
  const searchLadder = buildSearchLadder(context);
  const portalActions = buildPortalActions(context, searchLadder);

  return {
    context,
    searchLadder,
    portalActions,
  };
}

export { resolveMarketEvidenceContext } from "./resolveMarketEvidenceContext";
export { buildSearchLadder } from "./buildSearchLadder";
export { buildPortalActions } from "./buildPortalActions";
export { calculateMarketEvidenceSummary } from "./calculateMarketEvidenceSummary";
export * from "./types";
