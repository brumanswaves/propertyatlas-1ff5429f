export const HUMAN_REVIEW_FOCUS_VALUES = [
  "property_check",
  "property_potential",
  "intended_use",
] as const;

export const HUMAN_REVIEW_INTENDED_USE_VALUES = [
  "single_dwelling",
  "second_dwelling",
  "renovate_extend",
  "subdivide",
  "rental_property",
  "vacant_land_hold",
] as const;

export const HUMAN_REVIEW_INVESTIGATION_CHECKLIST_IDS = [
  "parcel_identity",
  "cadastral_evidence",
  "ownership_title",
  "zoning_planning",
  "property_checks",
  "market_evidence",
  "strategy_calculations",
  "site_potential",
  "reviewed_report",
] as const;

export const HUMAN_REVIEW_INVESTIGATION_CHECKLIST_STATUSES = [
  "pending",
  "complete",
  "blocked",
  "not_applicable",
] as const;

export type HumanReviewFocus = (typeof HUMAN_REVIEW_FOCUS_VALUES)[number];
export type HumanReviewIntendedUse = (typeof HUMAN_REVIEW_INTENDED_USE_VALUES)[number];
export type HumanReviewInvestigationChecklistId =
  (typeof HUMAN_REVIEW_INVESTIGATION_CHECKLIST_IDS)[number];
export type HumanReviewInvestigationChecklistStatus =
  (typeof HUMAN_REVIEW_INVESTIGATION_CHECKLIST_STATUSES)[number];
export type HumanReviewInvestigationChecklist = Record<
  HumanReviewInvestigationChecklistId,
  HumanReviewInvestigationChecklistStatus
>;

const MAX_CONTEXT_LENGTH = 500;
const MAX_PROPERTY_REFERENCE_LENGTH = 255;
const MAX_SOURCE_LENGTH = 80;

type UnknownRecord = Record<string, unknown>;

export type HumanReviewCheckoutRequest = {
  focus: HumanReviewFocus;
  intendedUse: HumanReviewIntendedUse | null;
  context: string | null;
  parcelId: string | null;
  propertyReferenceHint: string | null;
  sourceSurface: string | null;
  scopeAcknowledged: true;
};

export type HumanReviewCheckoutValidation =
  | { ok: true; request: HumanReviewCheckoutRequest }
  | { ok: false; error: string };

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanOptionalText(value: unknown, maxLength: number): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  return text.length <= maxLength ? text : null;
}

function isFocus(value: unknown): value is HumanReviewFocus {
  return typeof value === "string" && HUMAN_REVIEW_FOCUS_VALUES.includes(value as HumanReviewFocus);
}

function isIntendedUse(value: unknown): value is HumanReviewIntendedUse {
  return typeof value === "string" &&
    HUMAN_REVIEW_INTENDED_USE_VALUES.includes(value as HumanReviewIntendedUse);
}

function isInvestigationChecklistStatus(
  value: unknown,
): value is HumanReviewInvestigationChecklistStatus {
  return typeof value === "string" &&
    HUMAN_REVIEW_INVESTIGATION_CHECKLIST_STATUSES.includes(
      value as HumanReviewInvestigationChecklistStatus,
    );
}

export function validateHumanReviewCheckoutRequest(value: unknown): HumanReviewCheckoutValidation {
  if (!isRecord(value)) return { ok: false, error: "A Human Review brief is required." };

  if (!isFocus(value.focus)) {
    return { ok: false, error: "Choose one supported Human Review focus." };
  }
  if (value.scopeAcknowledged !== true) {
    return { ok: false, error: "Acknowledge the Human Review scope before checkout." };
  }

  const intendedUse = value.intendedUse == null || value.intendedUse === ""
    ? null
    : isIntendedUse(value.intendedUse)
      ? value.intendedUse
      : undefined;
  if (intendedUse === undefined) {
    return { ok: false, error: "Choose one supported intended use." };
  }
  if (value.focus === "intended_use" && !intendedUse) {
    return { ok: false, error: "Choose the intended use you want Easy Erf to check." };
  }
  if (value.focus !== "intended_use" && intendedUse) {
    return { ok: false, error: "Intended use is only valid for Check My Intended Use." };
  }

  const context = cleanOptionalText(value.context, MAX_CONTEXT_LENGTH);
  if (typeof value.context === "string" && value.context.trim().length > MAX_CONTEXT_LENGTH) {
    return { ok: false, error: `Situation context must be ${MAX_CONTEXT_LENGTH} characters or fewer.` };
  }

  const parcelId = cleanOptionalText(value.parcelId, MAX_PROPERTY_REFERENCE_LENGTH);
  const propertyReferenceHint = cleanOptionalText(
    value.propertyReferenceHint,
    MAX_PROPERTY_REFERENCE_LENGTH,
  );
  const sourceSurface = cleanOptionalText(value.sourceSurface, MAX_SOURCE_LENGTH);

  return {
    ok: true,
    request: {
      focus: value.focus,
      intendedUse,
      context,
      parcelId,
      propertyReferenceHint,
      sourceSurface,
      scopeAcknowledged: true,
    },
  };
}

export type HumanReviewReportContent = {
  bottomLine: string;
  known: string[];
  potential: string[];
  risks: string[];
  unknowns: string[];
  nextSteps: string[];
};

function cleanRequiredText(value: unknown, maxLength: number): string | null {
  const text = cleanOptionalText(value, maxLength);
  return text;
}

function cleanStringList(value: unknown, maxItems = 8, maxLength = 700): string[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length > maxItems) return null;
  const cleaned: string[] = [];
  for (const item of value) {
    const text = cleanRequiredText(item, maxLength);
    if (!text) return null;
    cleaned.push(text);
  }
  return cleaned;
}

export function validateHumanReviewReportContent(value: unknown):
  | { ok: true; content: HumanReviewReportContent }
  | { ok: false; error: string } {
  if (!isRecord(value)) return { ok: false, error: "Review content is required." };
  const bottomLine = cleanRequiredText(value.bottomLine, 1400);
  const known = cleanStringList(value.known);
  const potential = cleanStringList(value.potential);
  const risks = cleanStringList(value.risks);
  const unknowns = cleanStringList(value.unknowns);
  const nextSteps = cleanStringList(value.nextSteps);

  if (!bottomLine) return { ok: false, error: "Add a concise reviewed bottom line." };
  if (!known || !potential || !risks || !unknowns || !nextSteps) {
    return { ok: false, error: "Each Human Review section must contain no more than eight concise items." };
  }
  if (
    known.length === 0 ||
    potential.length === 0 ||
    risks.length === 0 ||
    unknowns.length === 0 ||
    nextSteps.length === 0
  ) {
    return {
      ok: false,
      error:
        "Complete all five Human Review sections before delivery. Use an explicit none-identified item when appropriate.",
    };
  }

  return { ok: true, content: { bottomLine, known, potential, risks, unknowns, nextSteps } };
}

export function validateHumanReviewInvestigationChecklist(value: unknown):
  | { ok: true; checklist: HumanReviewInvestigationChecklist }
  | { ok: false; error: string } {
  if (!isRecord(value)) {
    return { ok: false, error: "The standard investigation checklist is required." };
  }

  const actualIds = Object.keys(value);
  const expectedIds = new Set<string>(HUMAN_REVIEW_INVESTIGATION_CHECKLIST_IDS);
  if (
    actualIds.length !== expectedIds.size ||
    actualIds.some((id) => !expectedIds.has(id))
  ) {
    return {
      ok: false,
      error: "Save one status for every standard investigation checklist item.",
    };
  }

  const checklist = {} as HumanReviewInvestigationChecklist;
  for (const id of HUMAN_REVIEW_INVESTIGATION_CHECKLIST_IDS) {
    const status = value[id];
    if (!isInvestigationChecklistStatus(status)) {
      return {
        ok: false,
        error: "Each standard investigation item must be pending, complete, blocked or not applicable.",
      };
    }
    checklist[id] = status;
  }

  return { ok: true, checklist };
}

export function isHumanReviewInvestigationChecklistResolved(value: unknown): boolean {
  const validation = validateHumanReviewInvestigationChecklist(value);
  if (!validation.ok) return false;
  return HUMAN_REVIEW_INVESTIGATION_CHECKLIST_IDS.every((id) => {
    const status = validation.checklist[id];
    return status === "complete" || status === "not_applicable";
  });
}
