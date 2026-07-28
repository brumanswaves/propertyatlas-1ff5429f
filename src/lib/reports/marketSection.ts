/**
 * Market Evidence report section model.
 *
 * Pure derivation from the already-built market view and evidence pack.
 * Rules that must never be broken here:
 *  - an asking price is never described as a sold price or a valuation
 *  - no zero / negative money value is ever displayed
 *  - a price per m² only appears with the exact denominator it was divided by
 *  - an indicative range only appears when the evidence model already allows it
 */
import type { MarketView } from "./buildReportViewModel";
import type { PropertyEvidencePack } from "@/lib/evidence/propertyEvidenceTypes";
import { RELATIONSHIP_LABELS } from "@/features/marketEvidence/types";
import type { SavedMarketEvidence } from "@/features/marketEvidence/types";

export type MarketFigureKind =
  | "evidence_input"
  | "user_assumption"
  | "calculation"
  | "ai_interpretation";

export interface MarketFigure {
  id: string;
  label: string;
  value: string;
  kind: MarketFigureKind;
  /** Where the number came from, in plain language. */
  provenance: string;
  /** Extra clarification such as "asking price, not a sold price". */
  caveat?: string;
}

export type MarketEvidenceStrength = "none" | "thin" | "indicative";

export interface MarketComparableRow {
  id: string;
  title: string;
  relationshipLabel: string;
  priceLabel: string | null;
  sizeLabel: string | null;
  /** Asking vs sold is never blurred. Sold is only ever stated when known. */
  evidenceType: "Asking listing" | "Sold evidence" | "Market note";
  confidenceLabel: string;
  url: string | null;
}

export interface MarketSectionModel {
  figures: MarketFigure[];
  comparables: MarketComparableRow[];
  subjectListing: SavedMarketEvidence | null;
  subjectListingStatus: string | null;
  subjectListingAge: string | null;
  strongest: SavedMarketEvidence[];
  askingCount: number;
  soldCount: number;
  strength: MarketEvidenceStrength;
  strengthNote: string;
  gaps: string[];
  nextStep: string | null;
}

function buildComparableRows(items: SavedMarketEvidence[]): MarketComparableRow[] {
  return items.map((item) => {
    const price = isDisplayableAmount(item.askingPrice) ? item.askingPrice : null;
    const land = isDisplayableAmount(item.landSizeM2) ? item.landSizeM2 : null;
    const building = isDisplayableAmount(item.buildingSizeM2) ? item.buildingSizeM2 : null;
    const size = [
      land !== null ? `${land.toLocaleString("en-ZA")} m² land` : null,
      building !== null ? `${building.toLocaleString("en-ZA")} m² building` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      id: item.id,
      title: item.title || item.sourcePortal || "Saved comparable",
      relationshipLabel: RELATIONSHIP_LABELS[item.relationship] ?? String(item.relationship),
      priceLabel: price === null ? null : formatZarAmount(price),
      sizeLabel: size || null,
      evidenceType: price === null ? "Market note" : "Asking listing",
      confidenceLabel:
        item.confidence === "high"
          ? "High confidence"
          : item.confidence === "medium"
            ? "Medium confidence"
            : item.confidence === "low"
              ? "Low confidence"
              : "Unrated",
      url: item.sourceUrl ?? null,
    };
  });
}

export function isDisplayableAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function formatZarAmount(value: number): string {
  return `R ${Math.round(value).toLocaleString("en-ZA")}`;
}

function claimAmount(
  pack: PropertyEvidencePack | null,
  key: string,
): { value: number; sourceIds: string[] } | null {
  if (!pack) return null;
  for (const claim of pack.claims) {
    if (claim.key !== key) continue;
    if (claim.excluded || claim.status === "missing" || claim.status === "excluded") continue;
    const raw =
      typeof claim.normalizedValue === "number"
        ? claim.normalizedValue
        : typeof claim.value === "number"
          ? claim.value
          : typeof claim.value === "string"
            ? Number(claim.value.replace(/[^0-9.]/g, ""))
            : NaN;
    if (isDisplayableAmount(raw)) return { value: raw, sourceIds: claim.sourceIds };
  }
  return null;
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  const days = Math.floor((Date.now() - then) / 86_400_000);
  return days >= 0 ? days : null;
}

export interface MarketSectionInput {
  market: MarketView;
  pack: PropertyEvidencePack | null;
  /** Canonical official cadastral area, used only as a labelled denominator. */
  officialAreaM2: number | null;
}

export function buildMarketSectionModel(input: MarketSectionInput): MarketSectionModel {
  const { market, pack, officialAreaM2 } = input;
  const figures: MarketFigure[] = [];
  const gaps: string[] = [];

  const subject = market.subjectListing;
  const asking = subject && isDisplayableAmount(subject.askingPrice) ? subject.askingPrice : null;

  if (asking !== null) {
    figures.push({
      id: "asking-price",
      label: "Current asking price",
      value: formatZarAmount(asking),
      kind: "evidence_input",
      provenance: `Subject listing${subject?.sourcePortal ? ` on ${subject.sourcePortal}` : ""}`,
      caveat: "Asking price only. It is not a sold price and not a valuation.",
    });
  } else {
    gaps.push("No asking price captured for the subject property.");
  }

  const municipal = claimAmount(pack, "municipalValue");
  if (municipal) {
    figures.push({
      id: "municipal-valuation",
      label: "Municipal valuation",
      value: formatZarAmount(municipal.value),
      kind: "evidence_input",
      provenance: `Read from ${municipal.sourceIds.join(", ") || "an identity-matched document"}`,
      caveat: "Municipal roll value for rating purposes, not a market valuation.",
    });
  } else {
    gaps.push("No municipal valuation has been read from an identity-matched document.");
  }

  const paidValue = claimAmount(pack, "estimatedMarketValue");
  if (paidValue) {
    figures.push({
      id: "paid-valuation",
      label: "Paid-report estimated value",
      value: formatZarAmount(paidValue.value),
      kind: "ai_interpretation",
      provenance: `Provider estimate read from ${paidValue.sourceIds.join(", ") || "a paid report"}`,
      caveat: "Provider model estimate. It is not a sworn or professional valuation.",
    });
  }

  // Price per m² — only with an explicit, named denominator.
  if (asking !== null) {
    const listingLand = isDisplayableAmount(subject?.landSizeM2) ? subject!.landSizeM2! : null;
    const listingBuilding = isDisplayableAmount(subject?.buildingSizeM2)
      ? subject!.buildingSizeM2!
      : null;
    const denominator =
      listingLand !== null
        ? { m2: listingLand, label: "listing land size" }
        : isDisplayableAmount(officialAreaM2)
          ? { m2: officialAreaM2, label: "official cadastral area" }
          : listingBuilding !== null
            ? { m2: listingBuilding, label: "listing building size" }
            : null;
    if (denominator) {
      figures.push({
        id: "price-per-m2",
        label: "Asking price per m²",
        value: `${formatZarAmount(asking / denominator.m2)} / m²`,
        kind: "calculation",
        provenance: `Asking price divided by ${denominator.m2.toLocaleString("en-ZA")} m² (${denominator.label})`,
        caveat: "Derived from an asking price, so it tracks the asking market only.",
      });
    } else {
      gaps.push("No verified area denominator, so price per m² cannot be calculated.");
    }
  }

  // Indicative range only when the evidence model already permits it.
  const range = market.summary.priceRange;
  if (
    market.canShowIndicativeValue &&
    range &&
    isDisplayableAmount(range.min) &&
    isDisplayableAmount(range.max) &&
    range.max > range.min
  ) {
    figures.push({
      id: "indicative-range",
      label: "Indicative asking range",
      value: `${formatZarAmount(range.min)} – ${formatZarAmount(range.max)}`,
      kind: "calculation",
      provenance: `Range across ${market.includedCount} included comparable(s)`,
      caveat: "Range of asking prices across saved comparables, not a valuation range.",
    });
  } else if (!market.canShowIndicativeValue) {
    gaps.push("Too few comparables to justify an indicative range.");
  }

  if (market.soldCount === 0 && market.askingCount > 0) {
    gaps.push("All saved market evidence is asking-price evidence. No sold evidence is attached.");
  }

  const days = daysSince(subject?.savedAt ?? null);
  const strength: MarketEvidenceStrength =
    market.evidenceCount === 0 ? "none" : market.canShowIndicativeValue ? "indicative" : "thin";

  return {
    comparables: buildComparableRows(market.strongest),

    figures,
    subjectListing: subject,
    subjectListingStatus: subject
      ? subject.listingRole
        ? String(subject.listingRole)
        : "Saved subject listing"
      : null,
    subjectListingAge:
      days === null
        ? null
        : days === 0
          ? "Saved today"
          : `Saved ${days} day${days === 1 ? "" : "s"} ago`,
    strongest: market.strongest,
    askingCount: market.askingCount,
    soldCount: market.soldCount,
    strength,
    strengthNote:
      strength === "none"
        ? "No market evidence has been saved for this erf yet."
        : strength === "thin"
          ? "Evidence is currently too thin to responsibly calculate an indicative value."
          : "Enough comparables are saved to show an indicative asking picture — still not a valuation.",
    gaps,
    nextStep:
      strength === "indicative" && gaps.length === 0
        ? null
        : "Add or verify comparable listings and sold evidence in the Market tab.",
  };
}
