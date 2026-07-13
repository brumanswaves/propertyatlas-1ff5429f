import type {
  ImportedListingMatch,
  ImportedListingProperty,
} from "@/features/marketEvidence/listingImporter/types";

function clean(value: string | null | undefined): string {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function suggestListingMatch(
  property: ImportedListingProperty,
  selectedParcelId?: string | null,
): ImportedListingMatch {
  const reasons: string[] = [];
  let confidence = 0;

  if (property.erfNumber && selectedParcelId) {
    const selected = clean(selectedParcelId);
    if (selected.includes(clean(property.erfNumber))) {
      reasons.push("Listing explicitly mentions an erf number that appears in the selected parcel id.");
      confidence += 0.55;
    } else {
      reasons.push("Listing mentions an erf number, but it does not clearly match the selected parcel id.");
      confidence += 0.25;
    }
  }

  if (property.streetAddress) {
    reasons.push("Listing includes a displayed street address that should be reviewed against the selected erf.");
    confidence += 0.2;
  }

  if (property.latitude != null && property.longitude != null) {
    reasons.push("Listing includes coordinates, but the server does not have the selected parcel geometry here.");
  }

  if ((property.suburb || property.town) && !property.streetAddress && !property.erfNumber) {
    reasons.push("Only area-level location was extracted; suburb or town alone is not enough to match an erf.");
  }

  if (confidence >= 0.7 && selectedParcelId) {
    return {
      status: "suggested",
      parcelId: selectedParcelId,
      confidence: Math.min(0.85, confidence),
      reasons,
    };
  }

  return {
    status: confidence > 0 ? "suggested" : "unmatched",
    parcelId: confidence > 0.45 ? (selectedParcelId ?? null) : null,
    confidence: Math.min(0.65, confidence),
    reasons,
  };
}
