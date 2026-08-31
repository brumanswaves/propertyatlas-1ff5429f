export const HUMAN_REVIEW_FOCUS_VALUES = [
  "property_check",
  "before_i_buy",
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

export type HumanReviewFocus = (typeof HUMAN_REVIEW_FOCUS_VALUES)[number];
export type HumanReviewIntendedUse = (typeof HUMAN_REVIEW_INTENDED_USE_VALUES)[number];

const MAX_CONTEXT_LENGTH = 600;
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

export function validateHumanReviewCheckoutRequest(value: unknown): HumanReviewCheckoutValidation {
  if (!isRecord(value)) return { ok: false, error: "A Human Review brief is required." };

  if (!isFocus(value.focus)) {
    return { ok: false, error: "Choose one supported Human Review focus." };
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

  return { ok: true, content: { bottomLine, known, potential, risks, unknowns, nextSteps } };
}
