/**
 * Regression: the DEPLOYED Edge Function response shape.
 *
 * The live function resolves references server-side and returns the canonical
 * source record ({ref, sourceId, label, sourceType, authorityType, status,
 * locator}). The browser must accept that shape and canonicalise it, while
 * still rejecting fabricated refs and mismatched source ids.
 *
 * Reproduces the failure behind request ref
 * 7d32b908-7e44-43d7-9bf0-8af5f81d4b9b ("What are the biggest risks?").
 */
import { describe, expect, it, vi } from "vitest";
import { askEasyErfViaEdgeFunction, canonicalizeAskEasyErfAnswer } from "../askEasyErfClient";
import { buildAskEasyErfSelectedEvidencePayload } from "../askEasyErf";
import { buildEvidencePackFixture } from "@/lib/evidence/__tests__/propertyEvidenceTestUtils";

const QUESTION = "What are the biggest risks?";

function evidence(question = QUESTION) {
  return buildAskEasyErfSelectedEvidencePayload({
    pack: buildEvidencePackFixture({}),
    question,
    now: new Date("2026-07-29T00:00:00Z"),
  });
}

/** Exact shape the deployed Edge Function returns today. */
function deployedAnswer(payload: ReturnType<typeof evidence>, mutate: (ref: Record<string, unknown>) => void = () => {}) {
  const source = payload.sources[0];
  const reference: Record<string, unknown> = {
    ref: source.ref,
    sourceId: source.sourceId,
    label: source.label,
    sourceType: source.sourceType,
    authorityType: source.authorityType,
    status: source.status,
    locator: null,
  };
  mutate(reference);
  return {
    answer:
      "The biggest evidence risks are unconfirmed ownership and missing approved building plans.",
    confidence: "low" as const,
    evidenceReferences: [reference],
    unknowns: ["Registered owner", "Approved building plans"],
    nextAction: "Order a Deeds Office search.",
  };
}

describe("deployed Ask Easy Erf response compatibility", () => {
  it("accepts the deployed already-resolved response for 'What are the biggest risks?'", async () => {
    const payload = evidence();
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          requestId: "7d32b908-7e44-43d7-9bf0-8af5f81d4b9b",
          answer: deployedAnswer(payload),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await askEasyErfViaEdgeFunction({
      parcelId: payload.parcelId,
      question: QUESTION,
      evidence: payload,
      accessToken: "user-access-token",
      deps: { fetchImpl: fetchImpl as unknown as typeof fetch, functionsUrl: "https://p.supabase.co/f", apiKey: "pk" },
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.answer.evidenceReferences[0].ref).toBe(payload.sources[0].ref);
    expect(result.answer.evidenceReferences[0].sourceId).toBe(payload.sources[0].sourceId);
  });

  it("recovers a resolved reference whose label or sourceType did not survive the round trip", () => {
    const payload = evidence();
    const answer = canonicalizeAskEasyErfAnswer(
      deployedAnswer(payload, (reference) => {
        reference.label = "";
        delete reference.sourceType;
      }),
      payload,
    );
    expect(answer).not.toBeNull();
    // Canonical label always comes from the submitted evidence, never the response.
    expect(answer?.evidenceReferences[0].label).toBe(payload.sources[0].label);
    expect(answer?.evidenceReferences[0].sourceType).toBe(payload.sources[0].sourceType);
  });

  it("never accepts a model-supplied label over the canonical evidence label", () => {
    const payload = evidence();
    const answer = canonicalizeAskEasyErfAnswer(
      deployedAnswer(payload, (reference) => {
        reference.label = "Deeds Office title deed (fabricated)";
      }),
      payload,
    );
    expect(answer?.evidenceReferences[0].label).toBe(payload.sources[0].label);
  });

  it("rejects fabricated refs and mismatched source ids", () => {
    const payload = evidence();
    expect(
      canonicalizeAskEasyErfAnswer(
        deployedAnswer(payload, (reference) => {
          reference.ref = "S99";
        }),
        payload,
      ),
    ).toBeNull();
    expect(
      canonicalizeAskEasyErfAnswer(
        deployedAnswer(payload, (reference) => {
          reference.sourceId = "fabricated-source-id";
        }),
        payload,
      ),
    ).toBeNull();
  });

  it("still rejects answers with no evidence references at all", () => {
    const payload = evidence();
    const answer = deployedAnswer(payload);
    expect(
      canonicalizeAskEasyErfAnswer({ ...answer, evidenceReferences: [] }, payload),
    ).toBeNull();
  });
});
