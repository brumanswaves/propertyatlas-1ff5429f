/**
 * Runtime-neutral Ask Easy Erf selected-evidence contract + validation.
 *
 * Imported by BOTH the Supabase Edge Function (Deno) and the browser/Node app
 * code, so it must stay free of browser, React, Node-only and database imports.
 * This is the single canonical validator for untrusted Ask Easy Erf request
 * payloads: do not fork a looser copy anywhere else.
 */

export type AskEasyErfEvidenceSourceType =
  | "official"
  | "uploaded"
  | "market"
  | "user_confirmed"
  | "calculation"
  | "ai_interpretation"
  | "missing";

export type AskEasyErfEvidenceDomain =
  | "identity"
  | "address"
  | "ownership"
  | "deeds"
  | "planning"
  | "valuation"
  | "transfers"
  | "market"
  | "environment"
  | "infrastructure"
  | "site"
  | "strategy"
  | "documents"
  | "notes";

export type AskEasyErfEvidenceSourceKind =
  | "official_parcel"
  | "official_portal"
  | "municipal_portal"
  | "uploaded_document"
  | "uploaded_image"
  | "market_listing"
  | "user_note"
  | "user_confirmation"
  | "strategy_workspace"
  | "deterministic_calculator"
  | "site_potential"
  | "system_state";

export type AskEasyErfEvidenceAuthorityType =
  | "official"
  | "municipal"
  | "paid_provider"
  | "user_supplied"
  | "market"
  | "calculation"
  | "ai_generated"
  | "system";

export type AskEasyErfEvidenceSourceQuality =
  | "direct"
  | "strong"
  | "reference"
  | "untrusted_content"
  | "generated_search"
  | "unavailable";

export type AskEasyErfEvidenceSourceStatus =
  | "not_opened"
  | "opened"
  | "reviewed"
  | "uploaded"
  | "ready"
  | "failed"
  | "unavailable"
  | "excluded";

export type AskEasyErfEvidenceClaimNature =
  | "fact"
  | "observation"
  | "assumption"
  | "calculation"
  | "interpretation"
  | "unknown";

export type AskEasyErfEvidenceStatus =
  | "supported"
  | "partial"
  | "conflicting"
  | "missing"
  | "excluded"
  | "not_reviewed";

export type AskEasyErfEvidenceConfidence = "high" | "medium" | "low" | "unverified";

export interface AskEasyErfEvidenceLocator {
  fieldPath?: string;
  pageNumber?: number;
  pageLabel?: string;
  assetId?: string;
  sourceUrl?: string;
  excerpt?: string;
  metadataKey?: string;
}

export interface AskEasyErfSelectedEvidenceSource {
  ref: string;
  sourceId: string;
  parcelId: string;
  kind: AskEasyErfEvidenceSourceKind;
  label: string;
  sourceType: AskEasyErfEvidenceSourceType;
  authorityType: AskEasyErfEvidenceAuthorityType;
  sourceQuality: AskEasyErfEvidenceSourceQuality;
  status: AskEasyErfEvidenceSourceStatus;
  fileName: string | null;
  sourcePortal: string | null;
  locators: AskEasyErfEvidenceLocator[];
  fragments: string[];
}

export interface AskEasyErfSelectedEvidenceClaim {
  id: string;
  parcelId: string;
  domain: AskEasyErfEvidenceDomain;
  key: string;
  label: string;
  value: string | number | boolean | null;
  unit: string | null;
  nature: AskEasyErfEvidenceClaimNature;
  status: AskEasyErfEvidenceStatus;
  confidence: AskEasyErfEvidenceConfidence;
  confidenceReason: string;
  sourceRefs: string[];
  locators: AskEasyErfEvidenceLocator[];
  userConfirmed: boolean;
  warning: string | null;
}

export interface AskEasyErfSelectedEvidencePayload {
  schemaVersion: 1;
  kind: "ask_easy_erf_selected_property_evidence";
  parcelId: string;
  generatedAt: string;
  evidenceFingerprint: string;
  question: string;
  limits: {
    maxClaims: number;
    maxSourceFragments: number;
    maxTotalCharacters: number;
  };
  truncated: boolean;
  selectedText: string;
  sources: AskEasyErfSelectedEvidenceSource[];
  claims: AskEasyErfSelectedEvidenceClaim[];
  contradictions: Array<{
    id: string;
    parcelId: string;
    title: string;
    severity: "low" | "medium" | "high";
    explanation: string;
    claimIds: string[];
    sourceRefs: string[];
    displayedValues: string[];
    nextAction: string;
  }>;
  gaps: Array<{
    id: string;
    parcelId: string;
    domain: AskEasyErfEvidenceDomain;
    importance: "low" | "medium" | "high";
    title: string;
    explanation: string;
    basis: string;
    nextAction: string;
    blocking: boolean;
  }>;
}

export const ASK_EASY_ERF_SELECTED_EVIDENCE_LIMITS = {
  maxClaims: 12,
  maxSourceFragments: 6,
  maxTotalCharacters: 5_500,
} as const;

export const ASK_EASY_ERF_MAX_QUESTION_CHARACTERS = 1_000;
export const ASK_EASY_ERF_MAX_REQUEST_BYTES = 32_000;
export const ASK_EASY_ERF_SELECTED_EVIDENCE_KIND =
  "ask_easy_erf_selected_property_evidence" as const;

const MAX_TEXT = 800;
const MAX_SELECTED_SOURCES =
  ASK_EASY_ERF_SELECTED_EVIDENCE_LIMITS.maxClaims +
  ASK_EASY_ERF_SELECTED_EVIDENCE_LIMITS.maxSourceFragments +
  1;

const SOURCE_TYPES: AskEasyErfEvidenceSourceType[] = [
  "official",
  "uploaded",
  "market",
  "user_confirmed",
  "calculation",
  "ai_interpretation",
  "missing",
];

const DOMAINS = [
  "identity",
  "address",
  "ownership",
  "deeds",
  "planning",
  "valuation",
  "transfers",
  "market",
  "environment",
  "infrastructure",
  "site",
  "strategy",
  "documents",
  "notes",
] as const;

export function normalizeAskEasyErfQuestion(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function hasEnoughAskEasyErfSelectedEvidence(
  payload: AskEasyErfSelectedEvidencePayload,
): boolean {
  return (
    payload.parcelId.length > 0 &&
    (payload.claims.length > 0 || payload.contradictions.length > 0 || payload.gaps.length > 0)
  );
}

export function nestedAskEasyErfEvidenceMatchesParcel(
  evidence: AskEasyErfSelectedEvidencePayload,
  parcelId: string,
): boolean {
  return (
    evidence.parcelId === parcelId &&
    evidence.sources.every((source) => source.parcelId === parcelId) &&
    evidence.claims.every((claim) => claim.parcelId === parcelId) &&
    evidence.contradictions.every((item) => item.parcelId === parcelId) &&
    evidence.gaps.every((gap) => gap.parcelId === parcelId)
  );
}

export function validateAskEasyErfSelectedEvidencePayload(
  value: unknown,
): AskEasyErfSelectedEvidencePayload | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const schemaVersion = raw.schemaVersion === 1 ? 1 : null;
  const kind =
    raw.kind === ASK_EASY_ERF_SELECTED_EVIDENCE_KIND ? ASK_EASY_ERF_SELECTED_EVIDENCE_KIND : null;
  const parcelId = requireText(raw.parcelId, 160);
  const generatedAt = requireText(raw.generatedAt, 80);
  const evidenceFingerprint = requireText(raw.evidenceFingerprint, 180);
  if (
    typeof raw.question !== "string" ||
    raw.question.length > ASK_EASY_ERF_MAX_QUESTION_CHARACTERS
  ) {
    return null;
  }
  const question = normalizeAskEasyErfQuestion(raw.question);
  const limits = validateSelectedLimits(raw.limits);
  if (
    !arrayWithin(raw.sources, MAX_SELECTED_SOURCES) ||
    !arrayWithin(raw.claims, ASK_EASY_ERF_SELECTED_EVIDENCE_LIMITS.maxClaims) ||
    !arrayWithin(raw.contradictions, 5) ||
    !arrayWithin(raw.gaps, 8)
  ) {
    return null;
  }
  if (
    typeof raw.selectedText !== "string" ||
    raw.selectedText.length > ASK_EASY_ERF_SELECTED_EVIDENCE_LIMITS.maxTotalCharacters
  ) {
    return null;
  }
  const sources = validateArray(raw.sources, validateSelectedSource, MAX_SELECTED_SOURCES);
  const claims = validateArray(
    raw.claims,
    validateSelectedClaim,
    ASK_EASY_ERF_SELECTED_EVIDENCE_LIMITS.maxClaims,
  );
  const contradictions = validateArray(raw.contradictions, validateSelectedContradiction, 5);
  const gaps = validateArray(raw.gaps, validateSelectedGap, 8);
  const selectedText = requireText(
    raw.selectedText,
    ASK_EASY_ERF_SELECTED_EVIDENCE_LIMITS.maxTotalCharacters,
  );
  if (
    !schemaVersion ||
    !kind ||
    !parcelId ||
    !generatedAt ||
    !evidenceFingerprint ||
    !question ||
    !limits ||
    !sources ||
    !claims ||
    !contradictions ||
    !gaps ||
    !selectedText ||
    typeof raw.truncated !== "boolean"
  ) {
    return null;
  }
  if (
    !sources.every((source) => source.parcelId === parcelId) ||
    !claims.every((claim) => claim.parcelId === parcelId) ||
    !contradictions.every((item) => item.parcelId === parcelId) ||
    !gaps.every((gap) => gap.parcelId === parcelId)
  ) {
    return null;
  }
  const validRefs = new Set(sources.map((source) => source.ref));
  if (!hasConsecutiveSourceRefs(sources)) return null;
  if (hasDuplicates(sources.map((source) => source.ref))) return null;
  if (hasDuplicates(sources.map((source) => source.sourceId))) return null;
  if (hasDuplicates(claims.map((claim) => claim.id))) return null;
  if (hasDuplicates(contradictions.map((item) => item.id))) return null;
  if (hasDuplicates(gaps.map((gap) => gap.id))) return null;
  const totalFragments = sources.reduce((sum, source) => sum + source.fragments.length, 0);
  if (totalFragments > ASK_EASY_ERF_SELECTED_EVIDENCE_LIMITS.maxSourceFragments) return null;
  if (claims.some((claim) => claim.status !== "missing" && claim.sourceRefs.length === 0)) {
    return null;
  }
  if (contradictions.some((item) => item.sourceRefs.length === 0)) return null;
  if (claims.some((claim) => hasDuplicates(claim.sourceRefs))) return null;
  if (contradictions.some((item) => hasDuplicates(item.sourceRefs))) return null;
  if (claims.some((claim) => claim.sourceRefs.some((ref) => !validRefs.has(ref)))) return null;
  if (contradictions.some((item) => item.sourceRefs.some((ref) => !validRefs.has(ref)))) {
    return null;
  }
  const referencedRefs = new Set([
    ...claims.flatMap((claim) => claim.sourceRefs),
    ...contradictions.flatMap((item) => item.sourceRefs),
  ]);
  if (
    sources.some(
      (source) =>
        source.fragments.length === 0 &&
        !referencedRefs.has(source.ref) &&
        source.sourceType !== "missing",
    )
  ) {
    return null;
  }
  if (
    (claims.some((claim) => claim.status !== "missing") || contradictions.length > 0) &&
    sources.some((source) => isSyntheticMissingEvidenceSource(source))
  ) {
    return null;
  }
  return {
    schemaVersion,
    kind,
    parcelId,
    generatedAt,
    evidenceFingerprint,
    question,
    limits,
    truncated: raw.truncated,
    selectedText,
    sources,
    claims,
    contradictions,
    gaps,
  };
}

export type AskEasyErfRequestFailureCode =
  | "INVALID_REQUEST"
  | "STALE_PARCEL"
  | "EVIDENCE_QUESTION_MISMATCH"
  | "INSUFFICIENT_EVIDENCE";

export type AskEasyErfRequestValidation =
  | {
      ok: true;
      parcelId: string;
      question: string;
      evidence: AskEasyErfSelectedEvidencePayload;
    }
  | {
      ok: false;
      code: AskEasyErfRequestFailureCode;
      error: string;
      status: number;
    };

/**
 * Canonical boundary validation for an untrusted Ask Easy Erf request body.
 * Callers must additionally enforce POST-only and the raw size cap before
 * parsing JSON.
 */
export function validateAskEasyErfRequestPayload(body: unknown): AskEasyErfRequestValidation {
  const raw = asRecord(body);
  if (!raw) {
    return invalid("INVALID_REQUEST", "Ask Easy Erf request body must be an object.", 400);
  }
  const parcelId = typeof raw.parcelId === "string" ? raw.parcelId.trim() : "";
  const rawQuestion = typeof raw.question === "string" ? raw.question : "";
  if (rawQuestion.length > ASK_EASY_ERF_MAX_QUESTION_CHARACTERS) {
    return invalid("INVALID_REQUEST", "Questions must be 1,000 characters or fewer.", 400);
  }
  const question = normalizeAskEasyErfQuestion(rawQuestion);
  const evidence = validateAskEasyErfSelectedEvidencePayload(raw.evidence);
  if (!parcelId || !question || !evidence) {
    return invalid(
      "INVALID_REQUEST",
      "Ask Easy Erf needs a question and a valid property evidence payload.",
      400,
    );
  }
  if (question !== evidence.question) {
    return invalid(
      "EVIDENCE_QUESTION_MISMATCH",
      "The selected evidence does not match the submitted question. Ask again.",
      409,
    );
  }
  if (evidence.parcelId !== parcelId) {
    return invalid(
      "STALE_PARCEL",
      "The selected property changed. Reopen the report and ask again.",
      409,
    );
  }
  if (!nestedAskEasyErfEvidenceMatchesParcel(evidence, parcelId)) {
    return invalid(
      "INVALID_REQUEST",
      "Ask Easy Erf received evidence that does not match the selected property.",
      400,
    );
  }
  if (!hasEnoughAskEasyErfSelectedEvidence(evidence)) {
    return invalid(
      "INSUFFICIENT_EVIDENCE",
      "More saved evidence is required before Ask Easy Erf can answer this property question.",
      400,
    );
  }
  return { ok: true, parcelId, question, evidence };
}

function invalid(
  code: AskEasyErfRequestFailureCode,
  error: string,
  status: number,
): AskEasyErfRequestValidation {
  return { ok: false, code, error, status };
}

function validateSelectedLimits(value: unknown): AskEasyErfSelectedEvidencePayload["limits"] | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const maxClaims = wholeNumber(raw.maxClaims, 1, 24);
  const maxSourceFragments = wholeNumber(raw.maxSourceFragments, 1, 16);
  const maxTotalCharacters = wholeNumber(raw.maxTotalCharacters, 1_000, 12_000);
  if (maxClaims == null || maxSourceFragments == null || maxTotalCharacters == null) return null;
  if (
    maxClaims !== ASK_EASY_ERF_SELECTED_EVIDENCE_LIMITS.maxClaims ||
    maxSourceFragments !== ASK_EASY_ERF_SELECTED_EVIDENCE_LIMITS.maxSourceFragments ||
    maxTotalCharacters !== ASK_EASY_ERF_SELECTED_EVIDENCE_LIMITS.maxTotalCharacters
  ) {
    return null;
  }
  return { maxClaims, maxSourceFragments, maxTotalCharacters };
}

function validateSelectedSource(value: unknown): AskEasyErfSelectedEvidenceSource | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const ref = requireText(raw.ref, 20);
  const sourceId = requireText(raw.sourceId, 160);
  const parcelId = requireText(raw.parcelId, 160);
  const kind = enumValue(raw.kind, [
    "official_parcel",
    "official_portal",
    "municipal_portal",
    "uploaded_document",
    "uploaded_image",
    "market_listing",
    "user_note",
    "user_confirmation",
    "strategy_workspace",
    "deterministic_calculator",
    "site_potential",
    "system_state",
  ] as const);
  const label = requireText(raw.label, 180);
  const sourceType = enumValue(raw.sourceType, SOURCE_TYPES);
  const authorityType = enumValue(raw.authorityType, [
    "official",
    "municipal",
    "paid_provider",
    "user_supplied",
    "market",
    "calculation",
    "ai_generated",
    "system",
  ] as const);
  const sourceQuality = enumValue(raw.sourceQuality, [
    "direct",
    "strong",
    "reference",
    "untrusted_content",
    "generated_search",
    "unavailable",
  ] as const);
  const status = enumValue(raw.status, [
    "not_opened",
    "opened",
    "reviewed",
    "uploaded",
    "ready",
    "failed",
    "unavailable",
    "excluded",
  ] as const);
  if (
    Array.isArray(raw.fragments) &&
    raw.fragments.length > ASK_EASY_ERF_SELECTED_EVIDENCE_LIMITS.maxSourceFragments
  ) {
    return null;
  }
  const locators = validateArray(raw.locators, validateLocator, 4);
  const fragments = validateStringArray(
    raw.fragments,
    ASK_EASY_ERF_SELECTED_EVIDENCE_LIMITS.maxSourceFragments,
    500,
  );
  if (
    !ref ||
    !/^S\d+$/.test(ref) ||
    !sourceId ||
    !parcelId ||
    !kind ||
    !label ||
    !sourceType ||
    !authorityType ||
    !sourceQuality ||
    !status ||
    !locators ||
    !fragments
  ) {
    return null;
  }
  return {
    ref,
    sourceId,
    parcelId,
    kind,
    label,
    sourceType,
    authorityType,
    sourceQuality,
    status,
    fileName: nullableText(raw.fileName, 220),
    sourcePortal: nullableText(raw.sourcePortal, 120),
    locators,
    fragments,
  };
}

function validateSelectedClaim(rawValue: unknown): AskEasyErfSelectedEvidenceClaim | null {
  const raw = asRecord(rawValue);
  if (!raw) return null;
  const id = requireText(raw.id, 160);
  const parcelId = requireText(raw.parcelId, 160);
  const domain = enumValue(raw.domain, DOMAINS);
  const key = requireText(raw.key, 120);
  const label = requireText(raw.label, 180);
  const nature = enumValue(raw.nature, [
    "fact",
    "observation",
    "assumption",
    "calculation",
    "interpretation",
    "unknown",
  ] as const);
  const status = enumValue(raw.status, [
    "supported",
    "partial",
    "conflicting",
    "missing",
    "excluded",
    "not_reviewed",
  ] as const);
  const confidence = enumValue(raw.confidence, ["high", "medium", "low", "unverified"] as const);
  const sourceRefs = validateStringArray(raw.sourceRefs, 8, 20);
  const locators = validateArray(raw.locators, validateLocator, 4);
  if (
    !id ||
    !parcelId ||
    !domain ||
    !key ||
    !label ||
    !nature ||
    !status ||
    !confidence ||
    !sourceRefs ||
    !locators ||
    typeof raw.userConfirmed !== "boolean"
  ) {
    return null;
  }
  const valueType = typeof raw.value;
  const claimValue =
    raw.value == null || valueType === "string" || valueType === "number" || valueType === "boolean"
      ? (raw.value as string | number | boolean | null)
      : undefined;
  if (claimValue === undefined) return null;
  return {
    id,
    parcelId,
    domain,
    key,
    label,
    value: typeof claimValue === "string" ? cleanText(claimValue, 500) : claimValue,
    unit: nullableText(raw.unit, 60),
    nature,
    status,
    confidence,
    confidenceReason: requireText(raw.confidenceReason, 500) ?? "Evidence confidence not stated.",
    sourceRefs,
    locators,
    userConfirmed: raw.userConfirmed,
    warning: nullableText(raw.warning, 400),
  };
}

function validateSelectedContradiction(
  value: unknown,
): AskEasyErfSelectedEvidencePayload["contradictions"][number] | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const id = requireText(raw.id, 160);
  const parcelId = requireText(raw.parcelId, 160);
  const title = requireText(raw.title, 180);
  const severity = enumValue(raw.severity, ["low", "medium", "high"] as const);
  const explanation = requireText(raw.explanation, 600);
  const claimIds = validateStringArray(raw.claimIds, 8, 160);
  const sourceRefs = validateStringArray(raw.sourceRefs, 8, 20);
  const displayedValues = validateStringArray(raw.displayedValues, 6, 220);
  const nextAction = requireText(raw.nextAction, 300);
  if (
    !id ||
    !parcelId ||
    !title ||
    !severity ||
    !explanation ||
    !claimIds ||
    !sourceRefs ||
    !displayedValues ||
    !nextAction
  ) {
    return null;
  }
  return {
    id,
    parcelId,
    title,
    severity,
    explanation,
    claimIds,
    sourceRefs,
    displayedValues,
    nextAction,
  };
}

function validateSelectedGap(
  value: unknown,
): AskEasyErfSelectedEvidencePayload["gaps"][number] | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const id = requireText(raw.id, 160);
  const parcelId = requireText(raw.parcelId, 160);
  const domain = enumValue(raw.domain, DOMAINS);
  const importance = enumValue(raw.importance, ["low", "medium", "high"] as const);
  const title = requireText(raw.title, 180);
  const explanation = requireText(raw.explanation, 500);
  const basis = requireText(raw.basis, 300);
  const nextAction = requireText(raw.nextAction, 300);
  if (
    !id ||
    !parcelId ||
    !domain ||
    !importance ||
    !title ||
    !explanation ||
    !basis ||
    !nextAction ||
    typeof raw.blocking !== "boolean"
  ) {
    return null;
  }
  return {
    id,
    parcelId,
    domain,
    importance,
    title,
    explanation,
    basis,
    nextAction,
    blocking: raw.blocking,
  };
}

function validateLocator(value: unknown): AskEasyErfEvidenceLocator | null {
  const raw = asRecord(value);
  if (!raw) return null;
  if (typeof raw.sourceUrl === "string" && !safePublicLocatorUrl(raw.sourceUrl)) return null;
  return sanitizeLocator(raw);
}

export function sanitizeAskEasyErfLocator(
  locator: AskEasyErfEvidenceLocator | Record<string, unknown>,
): AskEasyErfEvidenceLocator {
  return sanitizeLocator(locator);
}

export function safeAskEasyErfPublicLocatorUrl(value: string) {
  return safePublicLocatorUrl(value);
}

function sanitizeLocator(
  locator: AskEasyErfEvidenceLocator | Record<string, unknown>,
): AskEasyErfEvidenceLocator {
  const output: AskEasyErfEvidenceLocator = {};
  if (typeof locator.fieldPath === "string") output.fieldPath = cleanText(locator.fieldPath, 160);
  if (typeof locator.pageNumber === "number" && Number.isInteger(locator.pageNumber)) {
    output.pageNumber = locator.pageNumber;
  }
  if (typeof locator.pageLabel === "string") output.pageLabel = cleanText(locator.pageLabel, 80);
  if (typeof locator.assetId === "string") output.assetId = cleanText(locator.assetId, 160);
  if (typeof locator.excerpt === "string") output.excerpt = cleanText(locator.excerpt, 300);
  if (typeof locator.metadataKey === "string") {
    output.metadataKey = cleanText(locator.metadataKey, 120);
  }
  if (typeof locator.sourceUrl === "string") {
    const url = safePublicLocatorUrl(locator.sourceUrl);
    if (url) output.sourceUrl = url;
  }
  return output;
}

function safePublicLocatorUrl(value: string) {
  const trimmed = cleanText(value, 500);
  if (!/^https?:\/\//i.test(trimmed)) return undefined;
  if (/storage\/v1\/object\/sign|token=|signature=|x-amz-|signed/i.test(trimmed)) return undefined;
  return trimmed;
}

function hasConsecutiveSourceRefs(sources: AskEasyErfSelectedEvidenceSource[]) {
  return sources.every((source, index) => source.ref === `S${index + 1}`);
}

function hasDuplicates(values: string[]) {
  return new Set(values).size !== values.length;
}

function isSyntheticMissingEvidenceSource(source: AskEasyErfSelectedEvidenceSource) {
  return (
    source.kind === "system_state" &&
    source.sourceType === "missing" &&
    source.sourceId.endsWith(":selected-evidence-gaps")
  );
}

function validateArray<T>(
  value: unknown,
  validator: (item: unknown) => T | null,
  max: number,
): T[] | null {
  if (!Array.isArray(value)) return null;
  const output: T[] = [];
  for (const item of value.slice(0, max)) {
    const valid = validator(item);
    if (!valid) return null;
    output.push(valid);
  }
  return output;
}

function arrayWithin(value: unknown, max: number) {
  return Array.isArray(value) && value.length <= max;
}

function validateStringArray(value: unknown, max: number, textMax: number): string[] | null {
  if (!Array.isArray(value)) return null;
  const output: string[] = [];
  for (const item of value.slice(0, max)) {
    if (typeof item !== "string") return null;
    const cleaned = cleanText(item, textMax);
    if (cleaned) output.push(cleaned);
  }
  return output;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function requireText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = cleanText(value, max);
  return cleaned || null;
}

function nullableText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  return cleanText(value, max) || null;
}

function wholeNumber(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

function enumValue<const T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

function cleanText(value: string, max = MAX_TEXT) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}
