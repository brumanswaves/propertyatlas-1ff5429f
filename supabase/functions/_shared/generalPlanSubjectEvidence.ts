import {
  SG_DIAGRAM_FORBIDDEN_DOMAINS,
  SG_DIAGRAM_FORBIDDEN_KEYS,
  extractGeneralPlanReference,
  isClaimExplicitlyTiedToSubjectErf,
  isSgDiagramCategory,
  looksLikeGeneralPlanDocument,
  type ErfExpectedIdentity,
  type ErfExtractedClaim,
  type ErfExtractedIdentity,
  type ErfIdentityMatchResult,
} from "./erfExtractionContract.ts";

function normNumber(value: unknown): string | null {
  const match = /\d+/.exec(String(value ?? "").replace(/\s/g, ""));
  return match ? String(Number(match[0])) : null;
}

function visibleSubjectErf(
  documentText: string | null | undefined,
  subjectErfNumber: string,
  extractedErfNumber: string | null | undefined,
) {
  const text = String(documentText ?? "").replace(/[\u00a0]/g, " ");
  if (!text.trim()) return false;
  const target = Number(subjectErfNumber);

  const rangePattern =
    /\b(?:erven|erwe|erfs|stands|portions?)\s*(?:nos?\.?\s*)?(\d{1,6})\s*(?:-|–|—|\bto\b|\bt\/m\b)\s*(\d{1,6})/gi;
  let range: RegExpExecArray | null;
  while ((range = rangePattern.exec(text)) !== null) {
    const from = Number(range[1]);
    const to = Number(range[2]);
    if (target >= Math.min(from, to) && target <= Math.max(from, to)) return true;
  }

  const labelled = new RegExp(
    `\\b(?:erf|stand|portion|ptn)\\s*(?:no\\.?\\s*)?0*${subjectErfNumber}\\b`,
    "i",
  );
  if (labelled.test(text)) return true;

  // Bare numbers are common inside plan figures. Trust one only when the model
  // independently placed the same visible number in identity.erfNumber, and
  // the token is not embedded in a decimal, dimension or longer number.
  if (normNumber(extractedErfNumber) !== subjectErfNumber) return false;
  const bare = new RegExp(
    `(?:^|[^0-9.,])0*${subjectErfNumber}(?![0-9])(?![.,][0-9])(?!\\s*(?:m|mm|km|ha|°|'|′)\\b)`,
    "i",
  );
  return bare.test(text);
}

function namesParentErfInGeneralPlanTitle(
  documentText: string | null | undefined,
  parentErfNumber: string | null | undefined,
) {
  const parent = normNumber(parentErfNumber);
  if (!parent) return false;
  const title = new RegExp(
    `\\b(?:subdivisions?\\s+of|general\\s+plan(?:\\s+(?:no\\.?|nr\\.?|number)\\s*\\d+)?\\s+of)\\s+erf\\s*(?:no\\.?\\s*)?0*${parent}\\b`,
    "i",
  );
  return title.test(String(documentText ?? "").replace(/[\u00a0]/g, " "));
}

export interface GeneralPlanSubjectMatch {
  supportsSubject: boolean;
  /** @deprecated Use supportsSubject. This is support, never an automatic identity status. */
  matched: boolean;
  reason: string | null;
  generalPlanReference: string | null;
}

export function evaluateGeneralPlanSubjectMatch(input: {
  expected: ErfExpectedIdentity;
  document: ErfExtractedIdentity;
  assetCategory: string | null | undefined;
  documentType: string | null | undefined;
  documentText: string | null | undefined;
  documentGeneralPlanReference?: string | null;
  baseline: ErfIdentityMatchResult;
}): GeneralPlanSubjectMatch {
  const subject = normNumber(input.expected.erfNumber);
  if (!subject || !isSgDiagramCategory(input.assetCategory)) {
    return { supportsSubject: false, matched: false, reason: null, generalPlanReference: null };
  }
  if (!looksLikeGeneralPlanDocument(input.documentType, input.documentText)) {
    return { supportsSubject: false, matched: false, reason: null, generalPlanReference: null };
  }

  // Never override a different LPI or explicit subject portion. A township
  // plan may name a parent erf in its title block while visibly including the
  // subject erf; that is supporting context, not an individual-document bind.
  const parentTitleErfMismatch =
    input.baseline.status === "mismatch" &&
    /document states erf \d+, not erf \d+/i.test(input.baseline.reason) &&
    namesParentErfInGeneralPlanTitle(input.documentText, input.document.erfNumber);
  if (
    input.baseline.status === "mismatch" &&
    !parentTitleErfMismatch
  ) {
    return { supportsSubject: false, matched: false, reason: null, generalPlanReference: null };
  }

  if (!visibleSubjectErf(input.documentText, subject, input.document.erfNumber)) {
    return { supportsSubject: false, matched: false, reason: null, generalPlanReference: null };
  }

  const reference =
    input.documentGeneralPlanReference ??
    extractGeneralPlanReference(input.document.sgCode) ??
    extractGeneralPlanReference(input.documentText);
  const label = reference ? `General Plan ${reference}` : "the General Plan";
  return {
    supportsSubject: true,
    matched: true,
    reason:
      `${label} visibly includes Erf ${subject}. It supports this investigation but cannot automatically ` +
      "bind the plan as this erf's individual SG diagram; only annotations explicitly tied to this erf can become subject evidence.",
    generalPlanReference: reference,
  };
}

export function applyGeneralPlanSubjectClaimPolicy(
  claims: ErfExtractedClaim[],
  context: { subjectErfNumber: string | number | null | undefined; generalPlanReference?: string | null },
) {
  const subject = normNumber(context.subjectErfNumber);
  const label = context.generalPlanReference
    ? `General Plan ${context.generalPlanReference}`
    : "General Plan";
  if (!subject) return [];

  const contextual = (claim: ErfExtractedClaim): ErfExtractedClaim => ({
    ...claim,
    domain: "documents",
    key: "contextualPlanAnnotation",
    label: `${label}: ${claim.label}`,
    confidence: "low",
    interpretation: true,
    scope: "parent_plan",
  });

  const output: ErfExtractedClaim[] = [];
  for (const claim of claims) {
    if (SG_DIAGRAM_FORBIDDEN_DOMAINS.includes(claim.domain)) continue;
    if ((SG_DIAGRAM_FORBIDDEN_KEYS[claim.domain] ?? []).includes(claim.key)) continue;

    if (claim.domain === "documents") {
      output.push({ ...claim, label: `${label}: ${claim.label}`, scope: "parent_plan" });
      continue;
    }

    const explicit = isClaimExplicitlyTiedToSubjectErf(claim, subject);
    const subjectIdentity =
      claim.domain === "identity" &&
      claim.key === "erfNumber" &&
      normNumber(claim.value) === subject;

    if (explicit || subjectIdentity) {
      output.push({
        ...claim,
        label: `${label} (states this erf): ${claim.label}`,
        scope: "subject",
      });
    } else {
      output.push(contextual(claim));
    }
  }
  return output;
}
