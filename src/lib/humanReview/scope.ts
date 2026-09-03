export const DONE_FOR_YOU_INVESTIGATION_NAME = "Done-for-You Property Investigation";
export const DONE_FOR_YOU_INVESTIGATION_TAGLINE =
  "You choose the property. We do the investigation.";

export const DONE_FOR_YOU_INVESTIGATION_CHECKLIST_ITEMS = [
  {
    id: "parcel_identity",
    label: "Confirm the exact parcel and working address",
  },
  {
    id: "cadastral_evidence",
    label: "Review cadastral, SG and boundary evidence already available or supplied",
  },
  {
    id: "ownership_title",
    label: "Review ownership, transfer, title indicators and paid property-report evidence",
  },
  {
    id: "zoning_planning",
    label: "Establish the best-supported working zoning and planning position",
  },
  {
    id: "property_checks",
    label: "Complete the standard Easy Erf property checks and surface conflicts or missing evidence",
  },
  {
    id: "market_evidence",
    label: "Review useful market evidence and comparable context where available",
  },
  {
    id: "strategy_calculations",
    label: "Run relevant deterministic Strategy calculations when the required inputs exist",
  },
  {
    id: "site_potential",
    label: "Complete deterministic Site Potential when the evidence supports a useful envelope",
  },
  {
    id: "reviewed_report",
    label: "Prepare the Human-Reviewed Easy Erf Report with facts, risks, unknowns and next checks",
    scopeLabel: "Deliver a Human-Reviewed Easy Erf Report with facts, risks, unknowns and next checks",
  },
] as const;

export type DoneForYouInvestigationChecklistItemId =
  (typeof DONE_FOR_YOU_INVESTIGATION_CHECKLIST_ITEMS)[number]["id"];

export const DONE_FOR_YOU_STANDARD_INVESTIGATION_ITEMS =
  DONE_FOR_YOU_INVESTIGATION_CHECKLIST_ITEMS.map((item) =>
    "scopeLabel" in item ? item.scopeLabel : item.label,
  );

export const DONE_FOR_YOU_PROPERTY_DATA_REPORT_COPY =
  "During Early Access, one third-party property data report is reviewed as part of the investigation at no extra charge where coverage is available. Provider may vary. A branded provider PDF is supplied to the customer only where the provider's terms permit redistribution.";

export const HUMAN_REVIEW_FOCUS_OPTIONS = [
  {
    id: "property_check",
    label: "Overall Property Check",
    shortLabel: "Property Check",
    description:
      "The full standard Easy Erf investigation, with extra emphasis on the important facts, risks, conflicts, unknowns and checks still worth completing.",
  },
  {
    id: "property_potential",
    label: "Property Potential",
    shortLabel: "Property Potential",
    description:
      "The full standard Easy Erf investigation, with extra emphasis on what the available planning and property evidence suggests may be possible.",
  },
  {
    id: "intended_use",
    label: "Check My Intended Use",
    shortLabel: "Intended Use",
    description:
      "The full standard Easy Erf investigation, with extra emphasis on whether the evidence supports or conflicts with one selected intended use and what still needs confirmation.",
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
  "Easy Erf provides property research and due-diligence support. The done-for-you investigation completes the standard Easy Erf workflow as far as the available evidence and inputs allow, but it does not provide legal, tax, engineering, architectural, valuation or other professional advice, municipal approval, a zoning certificate, a construction quotation, or a buy / do-not-buy recommendation.";

export const HUMAN_REVIEW_SCOPE_ACKNOWLEDGEMENT =
  "I understand the done-for-you Easy Erf investigation provides property research and due-diligence support, not legal, engineering, architectural, valuation, tax, municipal or approval advice.";

export const HUMAN_REVIEW_NOT_INCLUDED = [
  "Legal opinions or confirmation of legal rights",
  "Title, conveyancing or tax advice",
  "Engineering, structural or architectural sign-off",
  "Municipal approval or a zoning certificate",
  "Formal property valuations",
  "Construction quotations or Easy Erf-generated build-cost estimates",
  "Investment recommendations such as buy or do not buy",
  "Unlimited paid third-party documents beyond the included Early Access property data report",
] as const;

export function isHumanReviewFocus(value: unknown): value is HumanReviewFocus {
  return HUMAN_REVIEW_FOCUS_OPTIONS.some((option) => option.id === value);
}

export function isHumanReviewIntendedUse(value: unknown): value is HumanReviewIntendedUse {
  return HUMAN_REVIEW_INTENDED_USE_OPTIONS.some((option) => option.id === value);
}

export function humanReviewFocusLabel(value: string | null | undefined) {
  return HUMAN_REVIEW_FOCUS_OPTIONS.find((option) => option.id === value)?.label ?? "Overall Property Check";
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
