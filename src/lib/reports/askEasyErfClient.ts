/**
 * Live Ask Easy Erf browser submission.
 *
 * The browser calls the deployed `ask-easy-erf-openai` Supabase Edge Function
 * directly with the signed-in user's access token. No service-role key, shared
 * function secret, or OpenAI key is ever present in browser code, and the
 * legacy `/api/reports/ask-easy-erf` TanStack route is NOT used by this path.
 */
import {
  validateAskEasyErfAnswer,
  type AskEasyErfAnswer,
  type AskEasyErfEvidenceReference,
  type AskEasyErfSelectedEvidencePayload,
} from "./askEasyErf";
import { resolveAskEasyErfAnswerReferences } from "../../../supabase/functions/_shared/askEasyErfContract";

export const ASK_EASY_ERF_FUNCTION_NAME = "ask-easy-erf-openai";

export type AskEasyErfClientResult =
  | { success: true; answer: AskEasyErfAnswer }
  | { success: false; error: string };

export interface AskEasyErfClientDeps {
  fetchImpl?: typeof fetch;
  functionsUrl?: string;
  apiKey?: string;
}

function defaultFunctionsUrl() {
  const base =
    (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ??
    (typeof process !== "undefined" ? process.env?.SUPABASE_URL : undefined) ??
    "";
  return `${base.replace(/\/+$/, "")}/functions/v1/${ASK_EASY_ERF_FUNCTION_NAME}`;
}

function defaultApiKey() {
  return (
    (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
    (typeof process !== "undefined" ? process.env?.SUPABASE_PUBLISHABLE_KEY : undefined) ??
    ""
  );
}

/**
 * Sends one Ask Easy Erf question to the Edge Function using the caller's
 * Supabase access token and validates the returned answer against the exact
 * evidence slice that was submitted.
 */
export async function askEasyErfViaEdgeFunction(input: {
  parcelId: string;
  question: string;
  evidence: AskEasyErfSelectedEvidencePayload;
  accessToken: string;
  signal?: AbortSignal;
  deps?: AskEasyErfClientDeps;
}): Promise<AskEasyErfClientResult> {
  const deps = input.deps ?? {};
  const fetchImpl = deps.fetchImpl ?? fetch;
  const url = deps.functionsUrl ?? defaultFunctionsUrl();
  const apiKey = deps.apiKey ?? defaultApiKey();

  // Signed-out users never reach the network.
  if (!input.accessToken) {
    return { success: false, error: "Sign in to use Ask Easy Erf." };
  }


  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.accessToken}`,
      apikey: apiKey,
    },
    signal: input.signal,
    body: JSON.stringify({
      parcelId: input.parcelId,
      question: input.question,
      evidence: input.evidence,
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    error?: string;
    requestId?: string;
    answer?: unknown;
  } | null;

  if (!response.ok || !payload || payload.success !== true) {
    return {
      success: false,
      error:
        typeof payload?.error === "string" && payload.error
          ? payload.error
          : "Ask Easy Erf could not answer right now.",
    };
  }

  const answer = validateAnswerAgainstSelectedEvidence(payload.answer, input.evidence);
  if (!answer) {
    const ref = typeof payload.requestId === "string" ? ` (ref ${payload.requestId})` : "";
    return { success: false, error: `Ask Easy Erf returned an invalid answer. Try again.${ref}` };
  }
  return { success: true, answer };
}

/**
 * Canonicalises the Edge Function answer against the exact evidence slice the
 * browser submitted.
 *
 * ROOT CAUSE THIS REPAIRS: the deployed Edge Function already resolves every
 * reference and returns the canonical source record. The browser used to run
 * that resolved payload through the *model-answer* validator first, which
 * requires a non-empty `label` and a `sourceType` inside the enum on the
 * reference object itself. Any resolved reference whose label/sourceType did
 * not survive the round-trip in that exact shape was rejected client-side with
 * "Ask Easy Erf returned an invalid answer", even though its `ref` mapped
 * cleanly to a submitted source (observed as request ref
 * 7d32b908-7e44-43d7-9bf0-8af5f81d4b9b).
 *
 * The repair does not weaken evidence safety:
 *  - every returned `ref` must exist in the submitted evidence, or the answer
 *    is rejected;
 *  - a returned `sourceId` that disagrees with the submitted source is
 *    rejected;
 *  - labels, source types, authority, status and locators are always taken
 *    from the submitted canonical evidence, never from the response.
 */
export function canonicalizeAskEasyErfAnswer(
  value: unknown,
  evidence: AskEasyErfSelectedEvidencePayload,
): AskEasyErfAnswer | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;

  if (typeof raw.answer !== "string" || !raw.answer.trim()) return null;
  if (raw.confidence !== "high" && raw.confidence !== "medium" && raw.confidence !== "low") {
    return null;
  }
  if (!Array.isArray(raw.evidenceReferences) || raw.evidenceReferences.length === 0) return null;
  if (!Array.isArray(raw.unknowns)) return null;
  if (raw.nextAction != null && typeof raw.nextAction !== "string") return null;

  const contractReferences: Array<{
    ref: string;
    label: string;
    sourceType: AskEasyErfSelectedEvidencePayload["sources"][number]["sourceType"];
    sourceId: string | null;
  }> = [];

  for (const item of raw.evidenceReferences.slice(0, 10)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const reference = item as Record<string, unknown>;
    const ref = typeof reference.ref === "string" ? reference.ref.trim() : "";
    if (!ref) return null;
    const source = evidence.sources.find((candidate) => candidate.ref === ref);
    // Fabricated refs are rejected outright.
    if (!source) return null;
    if (typeof reference.sourceId === "string" && reference.sourceId !== source.sourceId) {
      return null;
    }
    // Canonical label / sourceType always win over anything in the response.
    contractReferences.push({
      ref: source.ref,
      label: source.label,
      sourceType: source.sourceType,
      sourceId: source.sourceId,
    });
  }
  if (!contractReferences.length) return null;

  const resolved = resolveAskEasyErfAnswerReferences(
    {
      answer: raw.answer,
      confidence: raw.confidence,
      unknowns: raw.unknowns.filter((entry): entry is string => typeof entry === "string"),
      nextAction: typeof raw.nextAction === "string" ? raw.nextAction : null,
      evidenceReferences: contractReferences,
    },
    evidence.sources,
  );
  if (!resolved) return null;

  const answer = validateAskEasyErfAnswer({
    answer: raw.answer,
    confidence: raw.confidence,
    unknowns: raw.unknowns,
    nextAction: typeof raw.nextAction === "string" ? raw.nextAction : null,
    evidenceReferences: resolved,
  });
  if (!answer) return null;

  return { ...answer, evidenceReferences: resolved as AskEasyErfEvidenceReference[] };
}

function validateAnswerAgainstSelectedEvidence(
  value: unknown,
  evidence: AskEasyErfSelectedEvidencePayload,
): AskEasyErfAnswer | null {
  return canonicalizeAskEasyErfAnswer(value, evidence);
}

