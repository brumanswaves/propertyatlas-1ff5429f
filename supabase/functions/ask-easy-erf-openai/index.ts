// Ask Easy Erf OpenAI execution, moved off the published TanStack worker runtime.
//
// Trust model: this function is only callable server-to-server. The caller must
// present the project service-role key as a bearer token. The browser never
// receives that key, and OPENAI_API_KEY never leaves this function.
import {
  ASK_EASY_ERF_MODEL,
  ASK_EASY_ERF_OPENAI_TIMEOUT_MS,
  ASK_EASY_ERF_OPENAI_URL,
  askEasyErfResponseFormat,
  askEasyErfSystemPrompt,
  resolveAskEasyErfAnswerReferences,
  validateAskEasyErfContractAnswer,
  type AskEasyErfContractSource,
} from "../_shared/askEasyErfContract.ts";

declare const Deno: { env: { get(key: string): string | undefined } };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type FailureCode =
  | "AUTH_REQUIRED"
  | "INVALID_REQUEST"
  | "OPENAI_NOT_CONFIGURED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "UPSTREAM_REQUEST_REJECTED"
  | "SERVER_UNAVAILABLE"
  | "MALFORMED_MODEL_RESPONSE";

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(code: FailureCode, error: string, status: number, requestId: string) {
  return json({ success: false, code, error, requestId }, status);
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function log(stage: string, requestId: string, extra: Record<string, unknown> = {}) {
  // Only safe stage/status metadata. Never keys, tokens, prompts or evidence.
  console.log(JSON.stringify({ fn: "ask-easy-erf-openai", stage, requestId, ...extra }));
}

Deno.serve(async (request: Request) => {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return fail("INVALID_REQUEST", "Method not allowed.", 405, requestId);
  }

  // Accept a dedicated shared secret first (stable across Supabase key-format
  // migrations), with the service-role key kept as a fallback caller identity.
  const accepted = [
    Deno.env.get("ASK_EASY_ERF_FN_SECRET") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  ].filter((value) => value.length > 0);
  const presented = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!accepted.length || !presented || !accepted.some((value) => safeEqual(presented, value))) {
    log("auth_rejected", requestId);
    return fail("AUTH_REQUIRED", "Unauthorized.", 401, requestId);
  }

  let body: { question?: unknown; evidence?: unknown };
  try {
    body = await request.json();
  } catch {
    log("invalid_json", requestId);
    return fail("INVALID_REQUEST", "Request body must be valid JSON.", 400, requestId);
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  const evidence = body.evidence as { sources?: unknown } | null | undefined;
  const sources = Array.isArray(evidence?.sources)
    ? (evidence?.sources as AskEasyErfContractSource[])
    : null;
  if (!question || !evidence || !sources || !sources.length) {
    log("invalid_payload", requestId);
    return fail("INVALID_REQUEST", "Ask Easy Erf payload is invalid.", 400, requestId);
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
  if (!apiKey) {
    log("missing_openai_key", requestId);
    return fail("OPENAI_NOT_CONFIGURED", "Ask Easy Erf is not configured yet.", 503, requestId);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ASK_EASY_ERF_OPENAI_TIMEOUT_MS);
  try {
    log("openai_request_start", requestId, { model: ASK_EASY_ERF_MODEL });
    const response = await fetch(ASK_EASY_ERF_OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: ASK_EASY_ERF_MODEL,
        temperature: 0.1,
        max_tokens: 700,
        response_format: askEasyErfResponseFormat(),
        messages: [
          { role: "system", content: askEasyErfSystemPrompt() },
          {
            role: "user",
            content: JSON.stringify({ question, selectedPropertyEvidence: evidence }),
          },
        ],
      }),
    });

    const payload = (await response.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string; type?: string; code?: string };
    } | null;

    log("openai_response", requestId, { status: response.status });

    if (!response.ok) {
      console.error(
        JSON.stringify({
          fn: "ask-easy-erf-openai",
          stage: "openai_request_failed",
          requestId,
          status: response.status,
          errorType: payload?.error?.type ?? null,
          errorCode: payload?.error?.code ?? null,
        }),
      );
      if (response.status === 429) {
        return fail(
          "RATE_LIMITED",
          "Ask Easy Erf is temporarily rate limited. Try again shortly.",
          429,
          requestId,
        );
      }
      if (response.status >= 400 && response.status < 500) {
        return fail(
          "UPSTREAM_REQUEST_REJECTED",
          "Ask Easy Erf could not process this question. Please report this if it repeats.",
          502,
          requestId,
        );
      }
      return fail(
        "SERVER_UNAVAILABLE",
        "Ask Easy Erf is temporarily unavailable.",
        502,
        requestId,
      );
    }

    const content = payload?.choices?.[0]?.message?.content;
    let parsed: unknown = null;
    if (typeof content === "string") {
      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = null;
      }
    }
    const shaped = validateAskEasyErfContractAnswer(parsed);
    const resolved = shaped ? resolveAskEasyErfAnswerReferences(shaped, sources) : null;
    if (!shaped || !resolved) {
      log("malformed_model_response", requestId);
      return fail(
        "MALFORMED_MODEL_RESPONSE",
        "Ask Easy Erf returned an invalid answer. Try again.",
        502,
        requestId,
      );
    }

    log("answer_ready", requestId, { referenceCount: resolved.length });
    return json(
      {
        success: true,
        requestId,
        answer: { ...shaped, evidenceReferences: resolved },
      },
      200,
    );
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    if (name === "AbortError" || name === "TimeoutError") {
      log("openai_timeout", requestId, { errorClass: name });
      return fail("TIMEOUT", "Ask Easy Erf took too long to respond. Try again.", 504, requestId);
    }
    console.error(
      JSON.stringify({
        fn: "ask-easy-erf-openai",
        stage: "openai_fetch_error",
        requestId,
        errorClass: name,
      }),
    );
    return fail("SERVER_UNAVAILABLE", "Ask Easy Erf is temporarily unavailable.", 502, requestId);
  } finally {
    clearTimeout(timeout);
  }
});
