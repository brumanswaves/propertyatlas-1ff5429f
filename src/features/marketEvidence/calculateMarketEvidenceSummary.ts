import type { MarketEvidenceSummary, SavedMarketEvidence } from "./types";

function avg(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : Math.round(sorted[mid]);
}

function mix(items: SavedMarketEvidence[], key: "relationship" | "confidence") {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item[key]] = (acc[item[key]] ?? 0) + 1;
    return acc;
  }, {});
}

export function calculateMarketEvidenceSummary(
  evidence: SavedMarketEvidence[],
): MarketEvidenceSummary {
  const included = evidence.filter(
    (item) =>
      item.includeInSummary &&
      item.listingRole !== "subject_active_listing" &&
      item.relationship !== "not_related" &&
      item.confidence !== "excluded",
  );
  const prices = included
    .map((item) => item.askingPrice ?? 0)
    .filter((value) => Number.isFinite(value) && value > 0);
  const landRates = included
    .map((item) =>
      item.askingPrice && item.landSizeM2 && item.landSizeM2 > 0
        ? item.askingPrice / item.landSizeM2
        : 0,
    )
    .filter((value) => value > 0);
  const buildingRates = included
    .map((item) =>
      item.askingPrice && item.buildingSizeM2 && item.buildingSizeM2 > 0
        ? item.askingPrice / item.buildingSizeM2
        : 0,
    )
    .filter((value) => value > 0);
  const updated = evidence
    .map((item) => item.updatedAt || item.savedAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  return {
    totalEvidence: evidence.length,
    includedEvidence: included.length,
    averageAskingPrice: avg(prices),
    medianAskingPrice: median(prices),
    priceRange: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : undefined,
    averageLandPricePerM2: avg(landRates),
    medianLandPricePerM2: median(landRates),
    averageBuildingPricePerM2: avg(buildingRates),
    medianBuildingPricePerM2: median(buildingRates),
    relationshipMix: mix(evidence, "relationship"),
    confidenceMix: mix(evidence, "confidence"),
    lastUpdated: updated,
    hasUsablePriceData: prices.length > 0 || landRates.length > 0 || buildingRates.length > 0,
  };
}
