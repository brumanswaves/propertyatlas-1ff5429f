/**
 * Server-side Ask Easy Erf grounding contract.
 *
 * These tests exercise the deployed Edge Function handler itself by stubbing
 * the Deno runtime globals before importing the module, plus the shared
 * deterministic contract helpers it relies on.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  askEasyErfRepairInstruction,
  askEasyErfResponseFormat,
  capAskEasyErfConfidence,
  evaluateAskEasyErfAttempt,
  type AskEasyErfContractSource,
} from "../../../../supabase/functions/_shared/askEasyErfContract";

const SOURCES: AskEasyErfContractSource[] = [
  {
    ref: "S1",
    sourceId: "src-official",
    label: "Official parcel record",
    sourceType: "official",
    status: "verified",
  },
  {
    ref: "S2",
    sourceId: "src-upload",
    label: "Uploaded SG diagram",
    sourceType: "uploaded",
    status: "verified",
  },
  {
    ref: "S3",
    sourceId: "src-missing",
    label: "Deeds report (not supplied)",
    sourceType: "missing",
    status: "missing",
  },
];

function answer(refs: string[], confidence: "high" | "medium" | "low" = "medium") {
  return {
    answer: "The selected evidence supports this summary of the erf.",
    confidence,
    evidenceReferences: refs.map((ref) => ({
      ref,
      label: "model supplied label",
      sourceType: "market",
    })),
    unknowns: [],
    nextAction: null,
  };
}

describe("Ask Easy Erf dynamic response schema", () => {
  it("constrains ref to exactly the submitted evidence refs", () => {
    const format = askEasyErfResponseFormat(["S1", "S2", "S3"]);
    const refSchema = format.json_schema.schema.properties.evidenceReferences.items.properties.ref;
    expect(refSchema).toEqual({ type: "string", enum: ["S1", "S2", "S3"] });
    expect(JSON.stringify(format)).not.toContain("minItems");
    expect(format.json_schema.strict).toBe(true);
  });

  it("deduplicates and ignores blank refs, and stays open when none are supplied", () => {
    const format = askEasyErfResponseFormat(["S1", "S1", " ", "S2"]);
    expect(
      format.json_schema.schema.properties.evidenceReferences.items.properties.ref,
    ).toEqual({ type: "string", enum: ["S1", "S2"] });
    expect(
      askEasyErfResponseFormat().json_schema.schema.properties.evidenceReferences.items.properties
        .ref,
    ).toEqual({ type: "string" });
  });

  it("makes a fabricated ref structurally impossible and rejects it deterministically", () => {
    const format = askEasyErfResponseFormat(["S1", "S2", "S3"]);
    const allowed = (
      format.json_schema.schema.properties.evidenceReferences.items.properties.ref as {
        enum?: string[];
      }
    ).enum;
    expect(allowed).not.toContain("S999");
    expect(evaluateAskEasyErfAttempt(answer(["S999"]), SOURCES).reason).toBe("unknown_ref");
  });
});

describe("Ask Easy Erf attempt evaluation", () => {
  it("accepts a broad multi-reference risk answer and canonicalises labels", () => {
    const result = evaluateAskEasyErfAttempt(answer(["S1", "S2", "S3"]), SOURCES);
    expect(result.reason).toBe("ok");
    expect(result.resolved).toHaveLength(3);
    expect(result.resolved?.map((item) => item.label)).toEqual([
      "Official parcel record",
      "Uploaded SG diagram",
      "Deeds report (not supplied)",
    ]);
    expect(result.resolved?.map((item) => item.sourceType)).toEqual([
      "official",
      "uploaded",
      "missing",
    ]);
    expect(result.resolved?.map((item) => item.sourceId)).toEqual([
      "src-official",
      "src-upload",
      "src-missing",
    ]);
  });

  it("keeps a narrow town-planner answer valid", () => {
    const result = evaluateAskEasyErfAttempt(
      {
        ...answer(["S1"]),
        answer: "Ask the town planner to confirm zoning controls and building lines.",
        nextAction: "Contact the municipal planning desk.",
      },
      SOURCES,
    );
    expect(result.reason).toBe("ok");
    expect(result.resolved).toHaveLength(1);
  });

  it("separates empty references from malformed shape", () => {
    expect(evaluateAskEasyErfAttempt(answer([]), SOURCES).reason).toBe("empty_references");
    expect(evaluateAskEasyErfAttempt({ nope: true }, SOURCES).reason).toBe("malformed_shape");
    expect(evaluateAskEasyErfAttempt(null, SOURCES).reason).toBe("malformed_shape");
  });

  it("rejects a reference whose sourceId points at another submitted source", () => {
    const mismatched = {
      ...answer(["S1"]),
      evidenceReferences: [
        { ref: "S1", label: "x", sourceType: "official", sourceId: "src-upload" },
      ],
    };
    expect(evaluateAskEasyErfAttempt(mismatched, SOURCES).reason).toBe("unknown_ref");
  });

  it("caps confidence below high when only weak or unverified evidence is cited", () => {
    expect(evaluateAskEasyErfAttempt(answer(["S3"], "high"), SOURCES).answer?.confidence).toBe(
      "medium",
    );
    expect(evaluateAskEasyErfAttempt(answer(["S1"], "high"), SOURCES).answer?.confidence).toBe(
      "high",
    );
    expect(capAskEasyErfConfidence("high", [{ sourceType: "official", status: "unverified" }])).toBe(
      "medium",
    );
    expect(capAskEasyErfConfidence("low", [{ sourceType: "missing" }])).toBe("low");
  });

  it("names the allowed refs in the single repair instruction", () => {
    const instruction = askEasyErfRepairInstruction(["S1", "S2"]);
    expect(instruction).toMatch(/1 and 3 evidence references/i);
    expect(instruction).toContain("S1, S2");
    expect(instruction).toMatch(/do not browse/i);
  });
});

describe("deployed Ask Easy Erf edge handler", () => {
  let handler: (request: Request) => Promise<Response>;
  const fetchMock = vi.fn();

  beforeEach(async () => {
    vi.resetModules();
    fetchMock.mockReset();
    (globalThis as Record<string, unknown>).Deno = {
      env: {
        get: (key: string) =>
          ({
            OPENAI_API_KEY: "test-key",
            ASK_EASY_ERF_FN_SECRET: "internal-secret",
          })[key],
      },
      serve: (fn: (request: Request) => Promise<Response>) => {
        handler = fn;
      },
    };
    vi.stubGlobal("fetch", fetchMock);
    await import("../../../../supabase/functions/ask-easy-erf-openai/index.ts");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (globalThis as Record<string, unknown>).Deno;
  });

  function modelReply(body: unknown) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(body) } }] }),
    };
  }

  async function ask() {
    const { buildAskEasyErfFixtureRequest } = await import("./askEasyErfServerFixture");
    return handler(buildAskEasyErfFixtureRequest());
  }

  it("returns a grounded answer for a broad risk question", async () => {
    fetchMock.mockResolvedValueOnce(modelReply(answer(["S1", "S2"])));
    const response = await ask();
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.answer.evidenceReferences).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("performs exactly one repair retry when the first answer cites nothing", async () => {
    fetchMock
      .mockResolvedValueOnce(modelReply(answer([])))
      .mockResolvedValueOnce(modelReply(answer(["S1"])));
    const response = await ask();
    expect(response.status).toBe(200);
    expect((await response.json()).success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(JSON.stringify(retryBody.messages)).toContain("1 and 3 evidence references");
  });

  it("returns a grounding failure with request id and never retries twice", async () => {
    fetchMock
      .mockResolvedValueOnce(modelReply(answer([])))
      .mockResolvedValueOnce(modelReply(answer([])));
    const response = await ask();
    expect(response.status).toBe(502);
    const payload = await response.json();
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("EVIDENCE_GROUNDING_FAILED");
    expect(payload.requestId).toBeTruthy();
    expect(payload.error).toContain(payload.requestId);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a malformed-shape response", async () => {
    fetchMock.mockResolvedValueOnce(modelReply({ garbage: true }));
    const response = await ask();
    expect(response.status).toBe(502);
    expect((await response.json()).code).toBe("MALFORMED_MODEL_RESPONSE");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends a schema whose refs are limited to the submitted evidence", async () => {
    fetchMock.mockResolvedValueOnce(modelReply(answer(["S1"])));
    await ask();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const refSchema =
      body.response_format.json_schema.schema.properties.evidenceReferences.items.properties.ref;
    expect(refSchema.enum).toBeInstanceOf(Array);
    expect(refSchema.enum).not.toContain("S999");
  });
});
