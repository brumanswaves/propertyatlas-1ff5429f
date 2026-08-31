export const HUMAN_REVIEW_FOCUS_OPTIONS = [
  {
    id: "property_check",
    label: "Property Check",
    shortLabel: "Property Check",
    description:
      "The important property facts, risks, conflicts, unknowns and checks still worth completing.",
  },
  {
    id: "property_potential",
    label: "Property Potential",
    shortLabel: "Property Potential",
    description:
      "What the available planning and property evidence suggests may be possible, with limitations clearly labelled.",
  },
  {
    id: "intended_use",
    label: "Check My Intended Use",
    shortLabel: "Intended Use",
    description:
      "Whether the evidence supports or conflicts with one selected intended use and what still needs professional confirmation.",
  },
] as const;

export type HumanReviewFocus = (typeof HUMAN_REVIEW_FOCUS_OPTIONS)[number]["id"];

export const HUMAN_REVIEW_INTENDED_USE_OPTIONS = [
  { id: "single_dwelling", label: "Build a single dwelling" },
  { id: "second_dwelling", label: "Add a second dwelling" },
  { id: "renovate_extend", label: "Renovate or extend an existing dwelling" },
  { id: "subdivide", label: "Investigate subdivision potential" },
  { id: "rental_property", label: "Use or hold it as a rental property" },
  { id: "vacant_land_hold", label: "Hold it as vacant land" },
] as const;

export type HumanReviewIntendedUse =
  (typeof HUMAN_REVIEW_INTENDED_USE_OPTIONS)[number]["id"];

export const HUMAN_REVIEW_CORE_QUESTIONS = [
  "What do we know?",
  "What appears possible?",
  "What could be a problem?",
  "What do we not know yet?",
  "What should be verified next?",
] as const;

export const HUMAN_REVIEW_CONTEXT_MAX_LENGTH = 500;

export const HUMAN_REVIEW_SCOPE_BOUNDARY =
  "Easy Erf provides property research and due-diligence support. It does not provide legal, tax, engineering, architectural, valuation or other professional advice, municipal approval, a zoning certificate, a construction quotation, or a buy / do-not-buy recommendation.";

export const HUMAN_REVIEW_SCOPE_ACKNOWLEDGEMENT =
  "I understand Easy Erf provides property research and due-diligence support, not legal, engineering, architectural, valuation, tax, municipal or approval advice.";

export const HUMAN_REVIEW_NOT_INCLUDED = [
  "Legal opinions or confirmation of legal rights",
  "Title, conveyancing or tax advice",
  "Engineering, structural or architectural sign-off",
  "Municipal approval or a zoning certificate",
  "Formal property valuations",
  "Construction quotations or Easy Erf-generated build-cost estimates",
  "Investment recommendations such as buy or do not buy",
] as const;

export function isHumanReviewFocus(value: unknown): value is HumanReviewFocus {
  return HUMAN_REVIEW_FOCUS_OPTIONS.some((option) => option.id === value);
}

export function isHumanReviewIntendedUse(value: unknown): value is HumanReviewIntendedUse {
  return HUMAN_REVIEW_INTENDED_USE_OPTIONS.some((option) => option.id === value);
}

export function humanReviewFocusLabel(value: string | null | undefined) {
  return HUMAN_REVIEW_FOCUS_OPTIONS.find((option) => option.id === value)?.label ?? "Property Check";
}

export function humanReviewIntendedUseLabel(value: string | null | undefined) {
  return HUMAN_REVIEW_INTENDED_USE_OPTIONS.find((option) => option.id === value)?.label ?? null;
}

export function buildHumanReviewHref({
  parcelId,
  propertyReference,
  source,
}: {
  parcelId?: string | null;
  propertyReference?: string | null;
  source?: string | null;
}) {
  const params = new URLSearchParams();
  if (parcelId?.trim()) params.set("parcelId", parcelId.trim());
  if (propertyReference?.trim()) params.set("propertyReference", propertyReference.trim());
  if (source?.trim()) params.set("source", source.trim());
  const query = params.toString();
  return query ? `/pricing?${query}` : "/pricing";
}
