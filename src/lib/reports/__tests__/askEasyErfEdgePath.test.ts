/**
 * Live Ask Easy Erf path: browser -> Supabase Edge Function -> OpenAI.
 * These tests cover the browser client and the canonical request boundary that
 * the Edge Function enforces (shared module, identical code on both sides).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { askEasyErfViaEdgeFunction, ASK_EASY_ERF_FUNCTION_NAME } from "../askEasyErfClient";
import { buildAskEasyErfSelectedEvidencePayload } from "../askEasyErf";
import { buildEvidencePackFixture } from "@/lib/evidence/__tests__/propertyEvidenceTestUtils";
import { validateAskEasyErfRequestPayload } from "../../../../supabase/functions/_shared/askEasyErfSelectedEvidence";

const FUNCTIONS_URL = `https://proj.supabase.co/functions/v1/${ASK_EASY_ERF_FUNCTION_NAME}`;

function evidence(question = "Who owns this property?") {
  return buildAskEasyErfSelectedEvidencePayload({
    pack: buildEvidencePackFixture({}),
    question,
    now: new Date("2026-07-16T00:00:00Z"),
  });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function answerFor(evidencePayload: ReturnType<typeof evidence>) {
  const source = evidencePayload.sources[0];
  return {
    answer: "The Easy Erf evidence does not confirm the registered owner.",
    confidence: "low" as const,
    evidenceReferences: [{ ref: source.ref, label: source.label, sourceType: source.sourceType }],
    unknowns: ["Registered owner"],
    nextAction: "Order a Deeds Office search.",
  };
}

async function callClient(
  overrides: {
    accessToken?: string;
    response?: Response;
    question?: string;
  } = {},
) {
  const payload = evidence(overrides.question);
  const fetchImpl = vi
    .fn()
    .mockResolvedValue(
      overrides.response ?? jsonResponse({ success: true, answer: answerFor(payload) }),
    );
  const result = await askEasyErfViaEdgeFunction({
    parcelId: payload.parcelId,
    question: overrides.question ?? "Who owns this property?",
    evidence: payload,
    accessToken: overrides.accessToken ?? "user-access-token",
    deps: {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      functionsUrl: FUNCTIONS_URL,
      apiKey: "publishable-key",
    },
  });
  return { result, fetchImpl, payload };
}

describe("Ask Easy Erf live browser path", () => {
  it("calls the Edge Function directly instead of the TanStack proxy route", async () => {
    const { fetchImpl } = await callClient();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(FUNCTIONS_URL);
    expect(url).not.toContain("/api/reports/ask-easy-erf");
    expect(init.method).toBe("POST");
  });

  it("sends the signed-in user's access token and no privileged secret", async () => {
    const { fetchImpl } = await callClient();
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;

    expect(headers.Authorization).toBe("Bearer user-access-token");
    expect(JSON.stringify(init)).not.toContain("service_role");
    expect(JSON.stringify(init)).not.toContain("sk-");
  });

  it("never calls the network when the visitor is signed out", async () => {
    const { result, fetchImpl } = await callClient({ accessToken: "" });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false, error: "Sign in to use Ask Easy Erf." });
  });

  it("returns a grounded answer that resolves to a submitted source", async () => {
    const { result, payload } = await callClient();

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.answer.evidenceReferences).toHaveLength(1);
    expect(result.answer.evidenceReferences[0].ref).toBe(payload.sources[0].ref);
    expect(result.answer.answer).not.toMatch(/owned by/i);
  });

  it("rejects fabricated source references returned by the model", async () => {
    const { result } = await callClient({
      response: jsonResponse({
        success: true,
        requestId: "ask-fixture",
        answer: {
          answer: "The owner is J. Smith.",
          confidence: "high",
          evidenceReferences: [{ ref: "S99", label: "Deeds", sourceType: "official" }],
          unknowns: [],
          nextAction: null,
        },
      }),
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("could not match the answer to this property's evidence");
    expect(result.error).toContain("ask-fixture");
  });

  it("surfaces the Edge Function failure message with its reference", async () => {
    const { result } = await callClient({
      response: jsonResponse(
        {
          success: false,
          code: "AUTH_REQUIRED",
          error: "Sign in is required. (ref ask-401)",
          requestId: "ask-401",
        },
        401,
      ),
    });

    expect(result).toEqual({ success: false, error: "Sign in is required. (ref ask-401)" });
  });
});

describe("Ask Easy Erf canonical request boundary (shared with the Edge Function)", () => {
  const payload = evidence();
  const body = {
    parcelId: payload.parcelId,
    question: "Who owns this property?",
    evidence: payload,
  };

  it("accepts a well-formed canonical request", () => {
    const validated = validateAskEasyErfRequestPayload(body);
    expect(validated.ok).toBe(true);
  });

  it("rejects a parcel mismatch between the request and the evidence slice", () => {
    const validated = validateAskEasyErfRequestPayload({ ...body, parcelId: "other-parcel" });
    expect(validated.ok).toBe(false);
    if (validated.ok) return;
    expect(validated.code).toBe("STALE_PARCEL");
  });

  it("rejects an evidence slice built for a different question", () => {
    const validated = validateAskEasyErfRequestPayload({
      ...body,
      question: "What are the building lines?",
    });
    expect(validated.ok).toBe(false);
    if (validated.ok) return;
    expect(validated.code).toBe("EVIDENCE_QUESTION_MISMATCH");
  });

  it("rejects malformed or missing evidence", () => {
    for (const bad of [
      {},
      { ...body, evidence: null },
      { ...body, evidence: { sources: [] } },
      { ...body, question: "" },
    ]) {
      expect(validateAskEasyErfRequestPayload(bad).ok).toBe(false);
    }
  });
});

describe("Ask Easy Erf secret hygiene", () => {
  it("keeps privileged keys out of the browser client and report UI", () => {
    const client = readFileSync(resolve(__dirname, "../askEasyErfClient.ts"), "utf8");
    const dossier = readFileSync(
      resolve(__dirname, "../../../components/property/ErfResearchDossier.tsx"),
      "utf8",
    );
    for (const source of [client, dossier]) {
      expect(source).not.toContain("OPENAI_API_KEY");
      expect(source).not.toContain("SERVICE_ROLE");
      expect(source).not.toContain("ASK_EASY_ERF_FN_SECRET");
    }
    expect(dossier).toContain("askEasyErfViaEdgeFunction");
    expect(dossier).not.toContain("/api/reports/ask-easy-erf");
  });
});
