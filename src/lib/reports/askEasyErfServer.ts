import {
  ASK_EASY_ERF_MAX_QUESTION_CHARACTERS,
  hasEnoughAskEasyErfSelectedEvidence,
  normalizeAskEasyErfQuestion,
  validateAskEasyErfAnswer,
  type AskEasyErfAnswer,
  type AskEasyErfEvidenceReference,
  type AskEasyErfSelectedEvidencePayload,
  validateAskEasyErfSelectedEvidencePayload,
} from "./askEasyErf";
import { ApiRequestError, authenticateApiRequest } from "@/lib/sitePotential/serverAuth";
import { resolveAskEasyErfAnswerReferences } from "../../../supabase/functions/_shared/askEasyErfContract";


export type AskEasyErfErrorCode =
  | "INVALID_REQUEST"
  | "AUTH_REQUIRED"
  | "STALE_PARCEL"
  | "EVIDENCE_QUESTION_MISMATCH"
  | "INSUFFICIENT_EVIDENCE"
  | "OPENAI_NOT_CONFIGURED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "UPSTREAM_REQUEST_REJECTED"
  | "SERVER_UNAVAILABLE"
  | "MALFORMED_MODEL_RESPONSE";


export interface AskEasyErfSuccess {
  success: true;
  answer: AskEasyErfAnswer;
}

export interface AskEasyErfFailure {
  success: false;
  code: AskEasyErfErrorCode;
  error: string;
}

export type AskEasyErfResponse = AskEasyErfSuccess | AskEasyErfFailure;

interface AskEasyErfRequestBody {
  parcelId?: unknown;
  question?: unknown;
  evidence?: unknown;
}

export interface AskEasyErfServerDeps {
  env?: NodeJS.ProcessEnv;
  fetch?: typeof fetch;
  authenticate?: (request: Request) => Promise<unknown>;
  requestId?: () => string;
}

const MAX_REQUEST_BYTES = 32_000;
/** Route -> Edge Function budget; the function itself caps the OpenAI call. */
const EDGE_FUNCTION_TIMEOUT_MS = 50_000;
export const ASK_EASY_ERF_FUNCTION_NAME = "ask-easy-erf-openai";

function defaultRequestId() {
  return `ask-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}


export async function handleAskEasyErfRequest(
  request: Request,
  deps: AskEasyErfServerDeps = {},
): Promise<Response> {
  const auth = deps.authenticate ?? authenticateApiRequest;
  try {
    await auth(request);
  } catch (error) {
    const status = error instanceof ApiRequestError ? error.status : 401;
    return json(
      {
        success: false,
        code: "AUTH_REQUIRED",
        error: status === 401 ? "Sign in is required." : "Request authorization failed.",
      },
      status === 401 ? 401 : 500,
    );
  }

  const parsed = await parseRequestBody(request);
  if (!parsed.ok) return json(parsed.payload, parsed.status);

  const body = parsed.body;
  const parcelId = typeof body.parcelId === "string" ? body.parcelId.trim() : "";
  const rawQuestion = typeof body.question === "string" ? body.question : "";
  if (rawQuestion.length > ASK_EASY_ERF_MAX_QUESTION_CHARACTERS) {
    return json(
      {
        success: false,
        code: "INVALID_REQUEST",
        error: "Questions must be 1,000 characters or fewer.",
      },
      400,
    );
  }
  const question = normalizeAskEasyErfQuestion(rawQuestion);
  const evidence = validateAskEasyErfSelectedEvidencePayload(body.evidence);

  if (!parcelId || !question || !evidence) {
    return json(
      {
        success: false,
        code: "INVALID_REQUEST",
        error: "Ask Easy Erf needs a question and a valid property evidence payload.",
      },
      400,
    );
  }
  if (question !== evidence.question) {
    return json(
      {
        success: false,
        code: "EVIDENCE_QUESTION_MISMATCH",
        error: "The selected evidence does not match the submitted question. Ask again.",
      },
      409,
    );
  }
  if (evidence.parcelId !== parcelId) {
    return json(
      {
        success: false,
        code: "STALE_PARCEL",
        error: "The selected property changed. Reopen the report and ask again.",
      },
      409,
    );
  }
  if (!nestedEvidenceMatchesParcel(evidence, parcelId)) {
    return json(
      {
        success: false,
        code: "INVALID_REQUEST",
        error: "Ask Easy Erf received evidence that does not match the selected property.",
      },
      400,
    );
  }
  if (!hasEnoughAskEasyErfSelectedEvidence(evidence)) {
    return json(
      {
        success: false,
        code: "INSUFFICIENT_EVIDENCE",
        error:
          "More saved evidence is required before Ask Easy Erf can answer this property question.",
      },
      400,
    );
  }

  const env = deps.env ?? process.env;
  const supabaseUrl = env.SUPABASE_URL?.trim();
  const callerSecret =
    env.ASK_EASY_ERF_FN_SECRET?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const requestId = (deps.requestId ?? defaultRequestId)();
  if (!supabaseUrl || !callerSecret) {
    console.error(
      "[ask-easy-erf] edge function not configured",
      JSON.stringify({ requestId, hasUrl: Boolean(supabaseUrl), hasKey: Boolean(callerSecret) }),
    );
    return json(
      {
        success: false,
        code: "OPENAI_NOT_CONFIGURED",
        error: messageForCode("OPENAI_NOT_CONFIGURED", requestId),
      },
      503,
    );
  }

  const result = await askViaEdgeFunction({
    question,
    evidence,
    functionUrl: `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/${ASK_EASY_ERF_FUNCTION_NAME}`,
    serviceRoleKey: callerSecret,
    requestId,
    fetchImpl: deps.fetch ?? fetch,
  });
  if (!result.success) return json(result, statusForCode(result.code));
  return json(result, 200);
}


function nestedEvidenceMatchesParcel(
  evidence: AskEasyErfSelectedEvidencePayload,
  parcelId: string,
) {
  return (
    evidence.parcelId === parcelId &&
    evidence.sources.every((source) => source.parcelId === parcelId) &&
    evidence.claims.every((claim) => claim.parcelId === parcelId) &&
    evidence.contradictions.every((item) => item.parcelId === parcelId) &&
    evidence.gaps.every((gap) => gap.parcelId === parcelId)
  );
}

async function parseRequestBody(
  request: Request,
): Promise<
  | { ok: true; body: AskEasyErfRequestBody }
  | { ok: false; status: number; payload: AskEasyErfFailure }
> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return {
      ok: false,
      status: 400,
      payload: {
        success: false,
        code: "INVALID_REQUEST",
        error: "Request body could not be read.",
      },
    };
  }
  if (text.length > MAX_REQUEST_BYTES) {
    return {
      ok: false,
      status: 413,
      payload: {
        success: false,
        code: "INVALID_REQUEST",
        error: "Ask Easy Erf request is too large.",
      },
    };
  }
  try {
    return { ok: true, body: JSON.parse(text) as AskEasyErfRequestBody };
  } catch {
    return {
      ok: false,
      status: 400,
      payload: {
        success: false,
        code: "INVALID_REQUEST",
        error: "Request body must be valid JSON.",
      },
    };
  }
}

async function askViaEdgeFunction(input: {
  question: string;
  evidence: AskEasyErfSelectedEvidencePayload;
  functionUrl: string;
  serviceRoleKey: string;
  requestId: string;
  fetchImpl: typeof fetch;
}): Promise<AskEasyErfResponse> {
  const { signal, cleanup } = timeoutSignal(EDGE_FUNCTION_TIMEOUT_MS);
  try {
    const response = await input.fetchImpl(input.functionUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.serviceRoleKey}`,
        "Content-Type": "application/json",
        "x-request-id": input.requestId,
      },
      signal,
      body: JSON.stringify({
        question: input.question,
        evidence: input.evidence,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; code?: AskEasyErfErrorCode; error?: string; answer?: unknown }
      | null;

    if (!response.ok || !payload || payload.success !== true) {
      console.error(
        "[ask-easy-erf] edge function request failed",
        JSON.stringify({
          requestId: input.requestId,
          status: response.status,
          code: payload?.code ?? null,
        }),
      );
      const code = normalizeEdgeErrorCode(payload?.code);
      return { success: false, code, error: messageForCode(code, input.requestId) };
    }

    const answer = validateAnswerAgainstSelectedEvidence(payload.answer, input.evidence);
    if (!answer) {
      console.error(
        "[ask-easy-erf] malformed answer from edge function",
        JSON.stringify({ requestId: input.requestId }),
      );
      return {
        success: false,
        code: "MALFORMED_MODEL_RESPONSE",
        error: messageForCode("MALFORMED_MODEL_RESPONSE", input.requestId),
      };
    }
    return { success: true, answer };
  } catch (error) {
    const errorClass = error instanceof Error ? error.name : "UnknownError";
    if (isAbortError(error)) {
      console.error(
        "[ask-easy-erf] edge function timeout",
        JSON.stringify({ requestId: input.requestId, errorClass }),
      );
      return { success: false, code: "TIMEOUT", error: messageForCode("TIMEOUT", input.requestId) };
    }
    console.error(
      "[ask-easy-erf] edge function unreachable",
      JSON.stringify({ requestId: input.requestId, errorClass }),
    );
    return {
      success: false,
      code: "SERVER_UNAVAILABLE",
      error: messageForCode("SERVER_UNAVAILABLE", input.requestId),
    };
  } finally {
    cleanup();
  }
}

function normalizeEdgeErrorCode(code: unknown): AskEasyErfErrorCode {
  switch (code) {
    case "RATE_LIMITED":
    case "TIMEOUT":
    case "UPSTREAM_REQUEST_REJECTED":
    case "MALFORMED_MODEL_RESPONSE":
    case "OPENAI_NOT_CONFIGURED":
      return code;
    default:
      return "SERVER_UNAVAILABLE";
  }
}

function messageForCode(code: AskEasyErfErrorCode, requestId: string) {
  const suffix = ` (ref ${requestId})`;
  switch (code) {
    case "RATE_LIMITED":
      return `Ask Easy Erf is temporarily rate limited. Try again shortly.${suffix}`;
    case "TIMEOUT":
      return `Ask Easy Erf took too long to respond. Try again.${suffix}`;
    case "UPSTREAM_REQUEST_REJECTED":
      return `Ask Easy Erf could not process this question. Please report this if it repeats.${suffix}`;
    case "MALFORMED_MODEL_RESPONSE":
      return `Ask Easy Erf returned an invalid answer. Try again.${suffix}`;
    case "OPENAI_NOT_CONFIGURED":
      return `Ask Easy Erf is not configured yet.${suffix}`;
    default:
      return `Ask Easy Erf is temporarily unavailable.${suffix}`;
  }
}



function validateAnswerAgainstSelectedEvidence(
  value: unknown,
  evidence: AskEasyErfSelectedEvidencePayload,
): AskEasyErfAnswer | null {
  const answer = validateAskEasyErfAnswer(value);
  if (!answer) return null;
  // Shared runtime-neutral resolver: rejects fabricated S-references and
  // requires at least one resolvable reference.
  const resolved = resolveAskEasyErfAnswerReferences(
    {
      ...answer,
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
  return {
    ...answer,
    evidenceReferences: resolved as AskEasyErfEvidenceReference[],
  };
}


function timeoutSignal(ms: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeout),
  };
}

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

function statusForCode(code: AskEasyErfErrorCode) {
  switch (code) {
    case "AUTH_REQUIRED":
      return 401;
    case "STALE_PARCEL":
    case "EVIDENCE_QUESTION_MISMATCH":
      return 409;
    case "INSUFFICIENT_EVIDENCE":
    case "INVALID_REQUEST":
      return 400;
    case "OPENAI_NOT_CONFIGURED":
      return 503;
    case "RATE_LIMITED":
      return 429;
    case "TIMEOUT":
      return 504;
    case "UPSTREAM_REQUEST_REJECTED":
      return 502;

    case "MALFORMED_MODEL_RESPONSE":
    case "SERVER_UNAVAILABLE":
      return 502;
  }
}

function json(payload: AskEasyErfResponse, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
