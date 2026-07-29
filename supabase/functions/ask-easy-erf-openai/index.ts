// Ask Easy Erf OpenAI execution.
//
// Trust model:
// - Normal live path: the BROWSER calls this function directly with the
//   signed-in user's Supabase access token. The token is verified against
//   Supabase Auth here; no user id is ever trusted from the request body.
// - Internal fixture path: a server-to-server caller may present
//   ASK_EASY_ERF_FN_SECRET (or the service-role key). This never weakens user
//   authentication and is not used by the browser.
// OPENAI_API_KEY never leaves this function.
import {
  ASK_EASY_ERF_MODEL,
  ASK_EASY_ERF_OPENAI_TIMEOUT_MS,
  ASK_EASY_ERF_OPENAI_URL,
  askEasyErfRepairInstruction,
  askEasyErfResponseFormat,
  askEasyErfSystemPrompt,
  capAskEasyErfConfidence,
  resolveAskEasyErfAnswerReferences,
  validateAskEasyErfContractAnswer,
  type AskEasyErfContractSource,
} from "../_shared/askEasyErfContract.ts";
import {
  ASK_EASY_ERF_MAX_REQUEST_BYTES,
  validateAskEasyErfRequestPayload,
} from "../_shared/askEasyErfSelectedEvidence.ts";


declare const Deno: { env: { get(key: string): string | undefined } };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type FailureCode =
  | "AUTH_REQUIRED"
  | "INVALID_REQUEST"
  | "STALE_PARCEL"
  | "EVIDENCE_QUESTION_MISMATCH"
  | "INSUFFICIENT_EVIDENCE"
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
  return json({ success: false, code, error: `${error} (ref ${requestId})`, requestId }, status);
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

/** Verifies a Supabase user access token against Supabase Auth. */
async function verifyUserToken(token: string): Promise<{ userId: string } | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const anonKey =
    Deno.env.get("SUPABASE_ANON_KEY")?.trim() ||
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim() ||
    "";
  if (!supabaseUrl || !anonKey) return null;
  try {
    const response = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    });
    if (!response.ok) return null;
    const user = (await response.json().catch(() => null)) as { id?: unknown } | null;
    if (!user || typeof user.id !== "string" || !user.id) return null;
    return { userId: user.id };
  } catch {
    return null;
  }
}

Deno.serve(async (request: Request) => {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return fail("INVALID_REQUEST", "Method not allowed.", 405, requestId);
  }

  const presented = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!presented) {
    log("auth_rejected", requestId, { reason: "missing_bearer" });
    return fail("AUTH_REQUIRED", "Sign in is required.", 401, requestId);
  }

  // Internal server-to-server fixture identity (never used by the browser).
  const internalSecrets = [
    Deno.env.get("ASK_EASY_ERF_FN_SECRET") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  ].filter((value) => value.length > 0);
  const isInternalCaller = internalSecrets.some((value) => safeEqual(presented, value));

  if (!isInternalCaller) {
    const user = await verifyUserToken(presented);
    if (!user) {
      log("auth_rejected", requestId, { reason: "invalid_user_token" });
      return fail("AUTH_REQUIRED", "Sign in is required.", 401, requestId);
    }
    log("auth_ok", requestId, { caller: "user" });
  } else {
    log("auth_ok", requestId, { caller: "internal" });
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return fail("INVALID_REQUEST", "Request body could not be read.", 400, requestId);
  }
  if (text.length > ASK_EASY_ERF_MAX_REQUEST_BYTES) {
    log("request_too_large", requestId);
    return fail("INVALID_REQUEST", "Ask Easy Erf request is too large.", 413, requestId);
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    log("invalid_json", requestId);
    return fail("INVALID_REQUEST", "Request body must be valid JSON.", 400, requestId);
  }

  const validated = validateAskEasyErfRequestPayload(body);
  if (!validated.ok) {
    log("invalid_payload", requestId, { code: validated.code });
    return fail(validated.code, validated.error, validated.status, requestId);
  }
  const { question, evidence } = validated;
  const sources = evidence.sources as unknown as AskEasyErfContractSource[];
  if (!sources.length) {
    log("invalid_payload", requestId, { code: "NO_SOURCES" });
    return fail("INVALID_REQUEST", "Ask Easy Erf payload is invalid.", 400, requestId);
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
  if (!apiKey) {
    log("missing_openai_key", requestId);
    return fail("OPENAI_NOT_CONFIGURED", "Ask Easy Erf is not configured yet.", 503, requestId);
  }

  const allowedRefs = sources.map((source) => source.ref);
  const responseFormat = askEasyErfResponseFormat(allowedRefs);
  const baseMessages = [
    { role: "system", content: askEasyErfSystemPrompt() },
    {
      role: "user",
      content: JSON.stringify({ question, selectedPropertyEvidence: evidence }),
    },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ASK_EASY_ERF_OPENAI_TIMEOUT_MS);
  try {
    // At most two attempts: the initial answer, then one controlled repair when
    // the shape was fine but no usable evidence reference was cited.
    let attempt = 0;
    let lastReason = "malformed_shape";
    while (attempt < 2) {
      const isRepair = attempt === 1;
      log(isRepair ? "retry_started" : "openai_request_start", requestId, {
        model: ASK_EASY_ERF_MODEL,
      });
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
          response_format: responseFormat,
          messages: isRepair
            ? [
                ...baseMessages,
                { role: "system", content: askEasyErfRepairInstruction(allowedRefs) },
              ]
            : baseMessages,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string; type?: string; code?: string };
      } | null;

      log("openai_response", requestId, { status: response.status, attempt: attempt + 1 });

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

      const attemptResult = evaluateAskEasyErfAttempt(parsed, sources);
      lastReason = attemptResult.reason;

      if (attemptResult.reason === "ok" && attemptResult.answer && attemptResult.resolved) {
        if (isRepair) log("retry_succeeded", requestId);
        log("answer_ready", requestId, { referenceCount: attemptResult.resolved.length });
        return json(
          {
            success: true,
            requestId,
            answer: {
              ...attemptResult.answer,
              evidenceReferences: attemptResult.resolved,
            },
          },
          200,
        );
      }

      log(isRepair ? "retry_failed" : "attempt_rejected", requestId, {
        reason: attemptResult.reason,
      });

      // Only an ungrounded but well-shaped first answer earns the single repair.
      if (isRepair || attemptResult.reason === "malformed_shape") break;
      attempt += 1;
    }

    if (lastReason === "malformed_shape") {
      return fail(
        "MALFORMED_MODEL_RESPONSE",
        "Ask Easy Erf returned an invalid answer. Try again.",
        502,
        requestId,
      );
    }
    return fail(
      "EVIDENCE_GROUNDING_FAILED",
      "Ask Easy Erf could not ground an answer in this property's selected evidence. Try the question again.",
      502,
      requestId,
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
