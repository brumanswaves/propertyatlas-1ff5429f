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

function validateAnswerAgainstSelectedEvidence(
  value: unknown,
  evidence: AskEasyErfSelectedEvidencePayload,
): AskEasyErfAnswer | null {
  const answer = validateAskEasyErfAnswer(value);
  if (!answer) return null;
  const resolved = resolveAskEasyErfAnswerReferences(
    {
      answer: answer.answer,
      confidence: answer.confidence,
      unknowns: answer.unknowns,
      nextAction: answer.nextAction,
      evidenceReferences: answer.evidenceReferences.map((reference) => ({
        ref: reference.ref ?? "",
        label: reference.label ?? "",
        sourceType: reference.sourceType,
        sourceId: reference.sourceId ?? null,
      })),
    },
    evidence.sources,
  );
  if (!resolved) return null;
  return { ...answer, evidenceReferences: resolved as AskEasyErfEvidenceReference[] };
}
