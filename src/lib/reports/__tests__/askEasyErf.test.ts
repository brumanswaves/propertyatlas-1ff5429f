import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import type { SavedMarketEvidence } from "@/features/marketEvidence/types";
import { createEmptyErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";
import { buildReportViewModel, type BuildReportInput } from "../buildReportViewModel";
import { buildDecisionIntelligence } from "../buildDecisionIntelligence";
import {
  buildAskEasyErfEvidencePayload,
  hasEnoughAskEasyErfEvidence,
  suggestedAskEasyErfQuestions,
} from "../askEasyErf";
import { handleAskEasyErfRequest } from "../askEasyErfServer";

const originalEnv = { ...process.env };

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
});

function parcel(overrides: Partial<NormalizedOfficialParcel> = {}): NormalizedOfficialParcel {
  return {
    id: "parcel-current",
    sourceLabel: "Kouga SG",
    erfNumber: 1021,
    portion: 0,
    lpi: "C03400140000102100000",
    parcelKey: "E108C034001400001021000000",
    municipality: "Kouga",
    province: "Eastern Cape",
    knownFields: [{ label: "Erf", value: "1021", source: "csg" }],
    missingFields: [],
    rawProperties: { SHAPE_Area: 721, ZONING: "Residential" },
    coordinates: { lng: 24.82, lat: -34.16 },
    ...overrides,
  } as NormalizedOfficialParcel;
}

function marketEvidence(overrides: Partial<SavedMarketEvidence> = {}): SavedMarketEvidence {
  return {
    id: "market-1",
    parcelId: "parcel-current",
    sourceUrl: "https://property24.example/listing",
    sourcePortal: "Property24",
    title: "Comparable listing",
    askingPrice: 2_100_000,
    relationship: "same_suburb_comp",
    confidence: "medium",
    includeInSummary: true,
    listingRole: "comparable_evidence",
    savedAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

function asset(overrides: Partial<ErfAsset> = {}): ErfAsset {
  return {
    id: "asset-1",
    user_id: "user-1",
    parcel_id: "parcel-current",
    asset_category: "paid_report",
    asset_type: "lightstone_report",
    source_label: "Lightstone",
    storage_bucket: "erf-files",
    storage_path: "private/path",
    original_file_name: "lightstone.pdf",
    mime_type: "application/pdf",
    size_bytes: 1200,
    checksum_sha256: null,
    status: "uploaded_reference_only",
    metadata: {},
    local_migration_fingerprint: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

function input(overrides: Partial<BuildReportInput> = {}): BuildReportInput {
  return {
    parcel: parcel(),
    workspaceState: {
      ...createEmptyErfWorkspaceState(),
      identityStatus: "looks_correct",
      reviewedSourceIds: ["csg"],
      marketEvidenceStarted: true,
      marketAddressSaved: true,
    },
    savedEvidence: [marketEvidence()],
    marketAddress: {
      selectedAddressId: "addr-1",
      candidates: [],
      userConfirmedAddress: {
        id: "addr-1",
        formattedAddress: "8 Harbour Road, St Francis Bay",
        municipality: "Kouga",
        source: "user_entered",
        confidence: "high",
        reason: "User confirmed",
        createdAt: "2026-07-01T00:00:00Z",
      },
    },
    assets: [asset()],
    chosenScenario: null,
    strategyScenarios: [],
    selectedSiteDesign: null,
    siteBrief: null,
    now: new Date("2026-07-16T00:00:00Z"),
    ...overrides,
  };
}

function payload(overrides: Partial<BuildReportInput> = {}) {
  const report = buildReportViewModel(input(overrides));
  const decision = buildDecisionIntelligence(report);
  return buildAskEasyErfEvidencePayload({
    report,
    decision,
    assets: overrides.assets ?? input().assets,
    savedEvidence: overrides.savedEvidence ?? input().savedEvidence,
    strategyScenarios: overrides.strategyScenarios ?? [],
  });
}

function request(body: unknown) {
  return new Request("https://easyerf.test/api/reports/ask-easy-erf", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer user-token",
    },
    body: JSON.stringify(body),
  });
}

function openAiResponse(content: unknown) {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: typeof content === "string" ? content : JSON.stringify(content) } }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("Ask Easy Erf evidence payload", () => {
  it("sends only the current parcel's evidence", () => {
    const current = payload({
      savedEvidence: [
        marketEvidence(),
        marketEvidence({ id: "other", parcelId: "other-parcel", title: "Wrong parcel" }),
      ],
    });

    expect(current.parcelId).toBe("parcel-current");
    expect(JSON.stringify(current)).toContain("parcel-current");
    expect(JSON.stringify(current)).not.toContain("Wrong parcel");
    expect(JSON.stringify(current)).not.toContain("other-parcel");
  });

  it("keeps ownership unknown when no ownership evidence verifies it", () => {
    const current = payload({ assets: [] });
    expect(current.ownership.isVerified).toBe(false);
    expect(current.ownership.message).toMatch(/not verified/i);
  });

  it("renders context-aware suggested questions", () => {
    const questions = suggestedAskEasyErfQuestions(payload({ assets: [] }));
    expect(questions).toContain("Why is ownership still unverified?");
    expect(questions).toContain("What evidence would improve confidence most?");
    expect(questions).toHaveLength(5);
  });

  it("marks truly empty evidence as insufficient", () => {
    const empty = payload({
      parcel: parcel({
        erfNumber: null,
        lpi: null,
        parcelKey: null,
        knownFields: [],
        rawProperties: {},
        coordinates: null,
      }),
      workspaceState: createEmptyErfWorkspaceState(),
      savedEvidence: [],
      marketAddress: null,
      assets: [],
    });
    expect(hasEnoughAskEasyErfEvidence(empty)).toBe(false);
  });
});

describe("Ask Easy Erf server handler", () => {
  it("uses strict structured output, sends no browsing tool, and returns evidence references", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      openAiResponse({
        answer: "Known: the parcel identity exists. Missing: ownership remains unverified.",
        confidence: "medium",
        evidenceReferences: [
          { label: "Official LPI", sourceType: "official" },
          { label: "Ownership missing", sourceType: "missing" },
        ],
        unknowns: ["Current registered owner"],
        nextAction: "Upload a deeds report.",
      }),
    );

    const response = await handleAskEasyErfRequest(
      request({ parcelId: "parcel-current", question: "Is ownership verified?", evidence: payload() }),
      {
        env: { ...process.env, OPENAI_API_KEY: "server-key" },
        fetch: fetchMock,
        authenticate: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
      },
    );

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.answer.evidenceReferences).toHaveLength(2);

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(options?.body));
    expect(body.response_format.type).toBe("json_schema");
    expect(JSON.stringify(body)).toContain("parcel-current");
    expect(JSON.stringify(body)).not.toContain("server-key");
    expect(JSON.stringify(body)).not.toMatch(/web_search|browser_tool|internet_search/i);
    expect(body).not.toHaveProperty("tools");
  });

  it("returns an evidence-limited answer for unsupported questions when the model does", async () => {
    const response = await handleAskEasyErfRequest(
      request({ parcelId: "parcel-current", question: "Who owns it?", evidence: payload({ assets: [] }) }),
      {
        env: { ...process.env, OPENAI_API_KEY: "server-key" },
        fetch: vi.fn().mockResolvedValue(
          openAiResponse({
            answer: "The current Easy Erf evidence does not confirm ownership.",
            confidence: "low",
            evidenceReferences: [{ label: "Ownership evidence missing", sourceType: "missing" }],
            unknowns: ["Registered owner"],
            nextAction: "Upload a Lightstone or WinDeed report.",
          }),
        ),
        authenticate: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
      },
    );

    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.answer.answer).toMatch(/does not confirm ownership/i);
    expect(result.answer.evidenceReferences[0].sourceType).toBe("missing");
  });

  it("rejects malformed model output safely", async () => {
    const response = await handleAskEasyErfRequest(
      request({ parcelId: "parcel-current", question: "What are the risks?", evidence: payload() }),
      {
        env: { ...process.env, OPENAI_API_KEY: "server-key" },
        fetch: vi.fn().mockResolvedValue(openAiResponse({ answer: "No refs", confidence: "medium" })),
        authenticate: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
      },
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      success: false,
      code: "MALFORMED_MODEL_RESPONSE",
    });
  });

  it("does not call OpenAI for insufficient evidence", async () => {
    const fetchMock = vi.fn();
    const empty = payload({
      parcel: parcel({ erfNumber: null, lpi: null, parcelKey: null, knownFields: [], rawProperties: {} }),
      workspaceState: createEmptyErfWorkspaceState(),
      savedEvidence: [],
      marketAddress: null,
      assets: [],
    });

    const response = await handleAskEasyErfRequest(
      request({ parcelId: "parcel-current", question: "What are the risks?", evidence: empty }),
      {
        env: { ...process.env, OPENAI_API_KEY: "server-key" },
        fetch: fetchMock,
        authenticate: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
      },
    );

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("INSUFFICIENT_EVIDENCE");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("handles missing auth, missing config, rate limits, and stale parcels without exposing secrets", async () => {
    const authFailure = await handleAskEasyErfRequest(
      request({ parcelId: "parcel-current", question: "x", evidence: payload() }),
      { authenticate: vi.fn().mockRejectedValue(new Error("bad token secret")) },
    );
    expect(authFailure.status).toBe(401);
    expect(await authFailure.text()).not.toContain("bad token secret");

    const notConfigured = await handleAskEasyErfRequest(
      request({ parcelId: "parcel-current", question: "x", evidence: payload() }),
      { env: {}, authenticate: vi.fn().mockResolvedValue({}) },
    );
    expect(notConfigured.status).toBe(503);

    const stale = await handleAskEasyErfRequest(
      request({ parcelId: "other-parcel", question: "x", evidence: payload() }),
      { env: { OPENAI_API_KEY: "server-key" }, authenticate: vi.fn().mockResolvedValue({}) },
    );
    expect(stale.status).toBe(409);

    const rateLimited = await handleAskEasyErfRequest(
      request({ parcelId: "parcel-current", question: "x", evidence: payload() }),
      {
        env: { OPENAI_API_KEY: "server-key" },
        fetch: vi.fn().mockResolvedValue(new Response("{}", { status: 429 })),
        authenticate: vi.fn().mockResolvedValue({}),
      },
    );
    expect(rateLimited.status).toBe(429);
  });
});

describe("Ask Easy Erf report UI guardrails", () => {
  const source = readFileSync(
    resolve(__dirname, "../../../components/property/ErfResearchDossier.tsx"),
    "utf8",
  );
  const styles = readFileSync(resolve(__dirname, "../../../styles.css"), "utf8");

  it("renders the Ask Easy Erf section, loading/error states, disclaimer, and print-safe controls", () => {
    expect(source).toContain("Ask Easy Erf");
    expect(source).toContain("Suggested questions");
    expect(source).toContain("Ask Easy Erf answers are limited to the evidence saved for this property");
    expect(source).toContain("Asking...");
    expect(source).toContain("Ask Easy Erf request cancelled.");
    expect(source).toContain("Clear previous answer");
    expect(source).toContain("report-no-print");
    expect(styles).toContain(".report-no-print { display: none !important; }");
  });

  it("clears stale answers when the selected parcel changes", () => {
    expect(source).toContain("[payload.parcelId]");
    expect(source).toContain("setAnswer(null)");
    expect(source).toContain("abortRef.current?.abort()");
  });

  it("keeps OPENAI_API_KEY out of browser report code", () => {
    expect(source).not.toContain("OPENAI_API_KEY");
    const shared = readFileSync(resolve(__dirname, "../askEasyErf.ts"), "utf8");
    expect(shared).not.toContain("OPENAI_API_KEY");
  });

  it("does not introduce a Supabase schema or migration for Ask Easy Erf", () => {
    const migrationNames = readdirSync(resolve(__dirname, "../../../../supabase/migrations"));
    expect(migrationNames.filter((name) => /ask[-_]?easy[-_]?erf/i.test(name))).toEqual([]);
  });
});
