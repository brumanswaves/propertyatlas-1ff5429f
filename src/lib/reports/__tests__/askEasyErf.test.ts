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
  ASK_EASY_ERF_MAX_QUESTION_CHARACTERS,
  buildAskEasyErfEvidencePayload,
  buildAskEasyErfSelectedEvidencePayload,
  calibrateAskEasyErfAnswerConfidence,
  hasAskEasyErfPackEvidence,
  hasEnoughAskEasyErfEvidence,
  hasEnoughAskEasyErfSelectedEvidence,
  inferAskEasyErfEvidenceDomains,
  suggestedAskEasyErfQuestions,
  validateAskEasyErfEvidencePayload,
  validateAskEasyErfSelectedEvidencePayload,
} from "../askEasyErf";
import { handleAskEasyErfRequest } from "../askEasyErfServer";
import type { ErfStrategyScenario } from "@/lib/workbench/erfWorkspaceState";
import {
  buildEvidencePackFixture,
  evidenceAsset as packAsset,
  evidenceMarket as packMarket,
  evidenceParcel,
} from "@/lib/evidence/__tests__/propertyEvidenceTestUtils";

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

function strategyScenario(overrides: Partial<ErfStrategyScenario> = {}): ErfStrategyScenario {
  return {
    id: "strategy-1",
    parcelId: "parcel-current",
    label: "Buy and hold rental",
    strategy: "Buy and hold",
    inputs: { purchasePrice: "2100000", rent: "18000" },
    summary: [{ label: "Yield", value: "8.4%" }],
    savedAt: "2026-07-01T00:00:00Z",
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
  const reportInput = input(overrides);
  const report = buildReportViewModel(reportInput);
  const decision = buildDecisionIntelligence(report);
  return buildAskEasyErfEvidencePayload({
    report,
    decision,
    assets: reportInput.assets,
    savedEvidence: reportInput.savedEvidence,
    strategyScenarios: reportInput.strategyScenarios,
  });
}

function selectedPayload(
  question = "What are the biggest risks?",
  overrides: Partial<BuildReportInput> = {},
) {
  const reportInput = input(overrides);
  const report = buildReportViewModel(reportInput);
  if (!report.evidencePack) throw new Error("Expected report evidence pack");
  return buildAskEasyErfSelectedEvidencePayload({
    pack: report.evidencePack,
    question,
    now: new Date("2026-07-16T00:00:00Z"),
  });
}

function selectedFixture(
  question: string,
  overrides: Parameters<typeof buildEvidencePackFixture>[0] = {},
) {
  return buildAskEasyErfSelectedEvidencePayload({
    pack: buildEvidencePackFixture(overrides),
    question,
    now: new Date("2026-07-16T00:00:00Z"),
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

/** Successful Ask Easy Erf Edge Function response (the route now proxies). */
function openAiResponse(content: unknown) {
  return new Response(JSON.stringify({ success: true, answer: content }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Ask Easy Erf evidence payload", () => {
  it("sends only the current parcel's evidence", () => {
    const current = payload({
      savedEvidence: [
        marketEvidence(),
        marketEvidence({
          id: "subject",
          title: "Current active listing",
          listingRole: "subject_active_listing",
          includeInSummary: false,
          askingPrice: 2_400_000,
        }),
        marketEvidence({
          id: "other",
          parcelId: "other-parcel",
          title: "Wrong parcel",
          askingPrice: 99_000_000,
          listingRole: "subject_active_listing",
        }),
      ],
    });

    expect(current.parcelId).toBe("parcel-current");
    expect(current.market.evidenceCount).toBe(2);
    expect(current.market.includedCount).toBe(1);
    expect(current.market.summary.totalEvidence).toBe(2);
    expect(current.market.summary.medianAskingPrice).toBe(2_100_000);
    expect(current.market.subjectListing?.title).toBe("Current active listing");
    expect(current.market.strongest.map((item) => item.title)).toEqual(["Comparable listing"]);
    expect(JSON.stringify(current)).toContain("parcel-current");
    expect(JSON.stringify(current)).not.toContain("Wrong parcel");
    expect(JSON.stringify(current)).not.toContain("other-parcel");
    expect(JSON.stringify(current)).not.toContain("99000000");
  });

  it("filters uploaded assets and selected concepts to the current parcel only", () => {
    const currentConcept = asset({
      id: "current-concept",
      asset_category: "generated_design",
      asset_type: "concept_render",
      original_file_name: "current-concept.png",
      metadata: {
        conceptName: "Current parcel concept",
        conceptRationale: "Works with current evidence",
        extractedText: "Current parcel extracted document text",
        extractionStatus: "ready",
      },
    });
    const otherParcelAsset = asset({
      id: "other-asset",
      parcel_id: "other-parcel",
      original_file_name: "wrong-parcel.pdf",
      metadata: {
        extractedText: "Other parcel secret instructions",
        extractionStatus: "ready",
      },
    });

    const current = payload({
      assets: [otherParcelAsset, currentConcept],
      selectedSiteDesign: currentConcept,
    });

    expect(current.uploadedAssets.map((item) => item.id)).toEqual(["current-concept"]);
    expect(current.sitePotential.selectedConcept?.id).toBe("current-concept");
    expect(current.sitePotential.selectedConcept?.parcelId).toBe("parcel-current");
    expect(current.uploadedAssets[0].parcelId).toBe("parcel-current");
    expect(current.sitePotential.conceptCount).toBe(1);
    expect(JSON.stringify(current)).not.toContain("wrong-parcel.pdf");
    expect(JSON.stringify(current)).not.toContain("Other parcel secret instructions");
  });

  it("keeps adversarial evidence payloads deterministically below the transport budget", () => {
    const long = "A".repeat(5_000);
    const manyAssets = Array.from({ length: 14 }, (_, index) =>
      asset({
        id: `asset-${index}-${long}`,
        source_label: `Source label ${index} ${long}`,
        asset_type: `asset-type-${long}`,
        original_file_name: `asset-${index}-${long}.pdf`,
        metadata: {
          conceptName: `Concept ${index} ${long}`,
          conceptRationale: `Rationale ${index} ${long}`,
          extractionStatus: "ready",
          extractedText: `Document ${index} ${long}`.repeat(10),
        },
        created_at: `2026-07-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
      }),
    );
    const manyEvidence = Array.from({ length: 14 }, (_, index) =>
      marketEvidence({
        id: `market-${index}-${long}`,
        sourceUrl: `https://property24.example/${index}/${long}`,
        sourcePortal: `Property24 ${long}`,
        title: `Comp ${index} ${long}`,
        askingPrice: 1_000_000 + index,
        propertyType: `House ${long}`,
        notes: `Notes ${long}`,
        confidence: index % 2 === 0 ? "high" : "medium",
        importedListing: {
          listingId: `listing-${index}-${long}`,
          canonicalUrl: `https://property24.example/canonical/${index}/${long}`,
          importedAt: "2026-07-01T00:00:00Z",
          fetchedAt: "2026-07-01T00:00:00Z",
          contentHash: `hash-${index}`,
          listingDate: "2026-07-01",
          warnings: Array.from(
            { length: 8 },
            (_, warningIndex) => `Warning ${warningIndex} ${long}`,
          ),
          missingFields: Array.from(
            { length: 8 },
            (_, fieldIndex) => `Missing ${fieldIndex} ${long}`,
          ),
          matchStatus: "needs_review",
          matchReasons: Array.from(
            { length: 8 },
            (_, reasonIndex) => `Reason ${reasonIndex} ${long}`,
          ),
          userConfirmedAttachment: false,
        },
      }),
    );
    const strategyScenarios = Array.from({ length: 10 }, (_, index) => ({
      id: `scenario-${index}-${long}`,
      parcelId: "parcel-current",
      label: `Scenario ${index} ${long}`,
      strategy: `Custom ${long}`,
      inputs: Object.fromEntries(
        Array.from({ length: 12 }, (_, inputIndex) => [
          `input-key-${inputIndex}-${long}`,
          `input-value-${inputIndex}-${long}`,
        ]),
      ),
      summary: Array.from({ length: 8 }, (_, summaryIndex) => ({
        label: `Summary ${summaryIndex} ${long}`,
        value: `R${summaryIndex} ${long}`,
      })),
      savedAt: `2026-07-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
    }));

    const current = payload({ assets: manyAssets, savedEvidence: manyEvidence, strategyScenarios });
    const extractedTextLength = current.uploadedAssets.reduce(
      (sum, item) => sum + (item.extractedText?.length ?? 0),
      0,
    );

    expect(current.uploadedAssets).toHaveLength(4);
    expect(current.market.strongest).toHaveLength(3);
    expect(current.strategy.scenarios).toHaveLength(2);
    expect(extractedTextLength).toBeLessThanOrEqual(750);
    expect(current.market.strongest[0].title).toContain("Comp");
    expect(current.market.strongest[0].title.length).toBeLessThanOrEqual(160);
    expect(Object.keys(current.strategy.scenarios[0].inputs)[0]).toHaveLength(50);
    expect(Object.values(current.strategy.scenarios[0].inputs)[0]).toHaveLength(120);
    expect(JSON.stringify(current).length).toBeLessThan(28_000);
  });

  it("rejects malformed nested evidence payloads instead of trusting client casts", () => {
    const good = payload();
    expect(validateAskEasyErfEvidencePayload(good)).not.toBeNull();

    const malformedAssets = structuredClone(good);
    (malformedAssets.uploadedAssets[0] as unknown as { id: number }).id = 7;
    expect(validateAskEasyErfEvidencePayload(malformedAssets)).toBeNull();

    const malformedDecision = structuredClone(good);
    malformedDecision.decision.confidenceCategories[0].score = 999;
    expect(validateAskEasyErfEvidencePayload(malformedDecision)).toBeNull();

    const malformedMarket = structuredClone(good);
    (malformedMarket.market.strongest[0] as unknown as { parcelId: number }).parcelId = 42;
    expect(validateAskEasyErfEvidencePayload(malformedMarket)).toBeNull();

    const malformedStrategy = structuredClone(good);
    (malformedStrategy.strategy.chosen as unknown) = { id: 7 };
    expect(validateAskEasyErfEvidencePayload(malformedStrategy)).toBeNull();
  });

  it("keeps ownership unknown when no ownership evidence verifies it", () => {
    const current = payload({ assets: [] });
    expect(current.ownership.isVerified).toBe(false);
    expect(current.ownership.message).toMatch(/not verified/i);
  });

  it("renders context-aware suggested questions", () => {
    const questions = suggestedAskEasyErfQuestions(payload({ assets: [] }));
    expect(questions).toEqual([
      "What do you know about this erf?",
      "What is still unconfirmed?",
      "What does the market evidence show?",
      "What should I do next?",
    ]);
  });

  it("uses investor suggestions without changing the evidence payload", () => {
    const evidencePayload = payload({ assets: [] });
    const standard = suggestedAskEasyErfQuestions(evidencePayload);
    const investor = suggestedAskEasyErfQuestions(evidencePayload, "investor");

    expect(investor).toContain(
      "What assumptions have the greatest effect on this investment case?",
    );
    expect(investor).toContain("What should I verify before making an offer?");
    expect(standard).not.toEqual(investor);
    expect(JSON.stringify(evidencePayload)).toEqual(JSON.stringify(payload({ assets: [] })));
  });

  it("makes every built-in suggested question retrievable from selected evidence", () => {
    const reportInput = input({
      assets: [
        asset({ id: "sg", asset_category: "sg_diagram", asset_type: "pdf" }),
        asset({
          id: "concept",
          asset_category: "generated_design",
          asset_type: "site_concept",
          original_file_name: "concept.png",
          mime_type: "image/png",
        }),
      ],
      selectedSiteDesign: asset({
        id: "concept",
        asset_category: "generated_design",
        asset_type: "site_concept",
        original_file_name: "concept.png",
        mime_type: "image/png",
      }),
      strategyScenarios: [strategyScenario()],
      chosenScenario: strategyScenario(),
    });
    const report = buildReportViewModel(reportInput);
    const decision = buildDecisionIntelligence(report);
    if (!report.evidencePack) throw new Error("Expected evidence pack");
    const evidencePayload = buildAskEasyErfEvidencePayload({
      report,
      decision,
      assets: reportInput.assets,
      savedEvidence: reportInput.savedEvidence,
      strategyScenarios: reportInput.strategyScenarios,
    });
    const suggestions = [
      ...suggestedAskEasyErfQuestions(evidencePayload, "standard"),
      ...suggestedAskEasyErfQuestions(evidencePayload, "investor"),
    ];

    expect(suggestions.length).toBeGreaterThan(8);
    for (const suggestion of suggestions) {
      const selected = buildAskEasyErfSelectedEvidencePayload({
        pack: report.evidencePack,
        question: suggestion,
      });
      expect(
        selected.claims.length + selected.contradictions.length + selected.gaps.length,
        suggestion,
      ).toBeGreaterThan(0);
      expect(validateAskEasyErfSelectedEvidencePayload(selected)).not.toBeNull();
    }
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

  it("uses canonical Property Evidence Pack availability, including gaps and contradictions", () => {
    const pack = buildEvidencePackFixture();
    expect(hasAskEasyErfPackEvidence(pack, "parcel-a")).toBe(true);
    expect(hasAskEasyErfPackEvidence(null, "parcel-a")).toBe(false);
    expect(hasAskEasyErfPackEvidence(pack, "other-parcel")).toBe(false);

    const gapOnly = { ...pack, claims: [], contradictions: [] };
    expect(hasAskEasyErfPackEvidence(gapOnly, "parcel-a")).toBe(true);

    const contradictionOnly = { ...pack, claims: [], gaps: [] };
    expect(hasAskEasyErfPackEvidence(contradictionOnly, "parcel-a")).toBe(
      pack.contradictions.length > 0,
    );

    const emptyPack = { ...pack, claims: [], contradictions: [], gaps: [] };
    expect(hasAskEasyErfPackEvidence(emptyPack, "parcel-a")).toBe(false);
  });

  it("builds selected evidence from the canonical Property Evidence Pack for one question", () => {
    const selected = selectedPayload("Is the market evidence strong enough?");

    expect(selected.kind).toBe("ask_easy_erf_selected_property_evidence");
    expect(selected.parcelId).toBe("parcel-current");
    expect(selected.evidenceFingerprint).toMatch(/\w/);
    expect(selected.question).toBe("Is the market evidence strong enough?");
    expect(selected.sources[0].ref).toBe("S1");
    expect(selected.claims.length).toBeGreaterThan(0);
    expect(selected.claims.every((claim) => claim.parcelId === "parcel-current")).toBe(true);
    expect(selected.sources.every((source) => source.parcelId === "parcel-current")).toBe(true);
    expect(hasEnoughAskEasyErfSelectedEvidence(selected)).toBe(true);
    expect(validateAskEasyErfSelectedEvidencePayload(selected)).not.toBeNull();
    expect(JSON.stringify(selected)).not.toContain("private/path");
    expect(JSON.stringify(selected)).not.toContain("storage_bucket");
  });

  it("keeps selected evidence within explicit retrieval budgets", () => {
    const selected = selectedPayload(
      "Tell me everything about planning, market, documents and strategy.",
    );

    expect(selected.limits).toEqual({
      maxClaims: 12,
      maxSourceFragments: 6,
      maxTotalCharacters: 5500,
    });
    expect(selected.claims.length).toBeLessThanOrEqual(12);
    expect(selected.sources.flatMap((source) => source.fragments).length).toBeLessThanOrEqual(6);
    expect(selected.selectedText.length).toBeLessThanOrEqual(5500);
    expect(JSON.stringify(selected).length).toBeLessThan(16000);
  });

  it("infers deterministic evidence domains from question intent", () => {
    expect(inferAskEasyErfEvidenceDomains("What is the LPI and parcel identity?")).toEqual([
      "identity",
      "address",
    ]);
    expect(inferAskEasyErfEvidenceDomains("Who owns it and is there a title deed?")).toEqual([
      "ownership",
      "deeds",
      "documents",
    ]);
    expect(inferAskEasyErfEvidenceDomains("Can I build two units under zoning?")).toEqual([
      "planning",
    ]);
    expect(inferAskEasyErfEvidenceDomains("What is the asking price and market value?")).toEqual([
      "market",
    ]);
    expect(inferAskEasyErfEvidenceDomains("Which strategy assumptions affect yield?")).toEqual([
      "strategy",
    ]);
    expect(inferAskEasyErfEvidenceDomains("Show the Site Potential concept render.")).toEqual([
      "site",
    ]);
    expect(inferAskEasyErfEvidenceDomains("How big is this erf?")).toEqual([
      "identity",
      "address",
    ]);
  });

  it("selects canonical CSG area evidence for a basic first-read question", () => {
    const selected = selectedPayload("How big is this erf?", {
      parcel: parcel({ rawProperties: { GEOM_AREA: 618.7 } }),
    });
    const area = selected.claims.find((claim) => claim.key === "areaM2");

    expect(area).toMatchObject({
      domain: "identity",
      value: 618.7,
      status: "supported",
    });
    expect(area?.confidenceReason).toContain("official CSG parcel record");
    expect(area?.sourceRefs.length).toBeGreaterThan(0);
  });

  it("retains the approximate-map-area caveat for Shape__Area", () => {
    const selected = selectedPayload("How big is this property?", {
      parcel: parcel({ rawProperties: { Shape__Area: 812.4 } }),
    });
    const area = selected.claims.find((claim) => claim.key === "areaM2");

    expect(area?.value).toBe(812.4);
    expect(area?.confidence).toBe("low");
    expect(area?.confidenceReason).toContain("Approximate: derived from projected map geometry");
    expect(area?.warning).toContain("Approximate: derived from projected map geometry");
  });

  it("answers ownership questions with canonical gaps when ownership evidence is absent", () => {
    const selected = selectedFixture("Do we know who owns this property?", { assets: [] });

    expect(
      selected.claims.some(
        (claim) => claim.domain === "ownership" && claim.status === "supported",
      ),
    ).toBe(false);
    expect(
      selected.gaps.some((gap) => gap.domain === "ownership" || gap.domain === "deeds"),
    ).toBe(true);
  });

  it("selects a bounded cross-section for a broad property first-read question", () => {
    const selected = selectedFixture("What do you know about this property?");
    const domains = new Set(selected.claims.map((claim) => claim.domain));
    const usefulDomains = ["planning", "market", "strategy", "site", "documents"] as const;

    expect(domains.has("identity")).toBe(true);
    expect(usefulDomains.filter((domain) => domains.has(domain)).length).toBeGreaterThanOrEqual(2);
    expect(selected.claims.length).toBeLessThanOrEqual(selected.limits.maxClaims);
    expect(selected.selectedText.length).toBeLessThanOrEqual(selected.limits.maxTotalCharacters);
  });

  it("recognizes FAR planning intent without treating ordinary distance questions as planning", () => {
    expect(inferAskEasyErfEvidenceDomains("What is the FAR?")).toContain("planning");
    expect(inferAskEasyErfEvidenceDomains("What is the floor area ratio?")).toContain("planning");
    expect(inferAskEasyErfEvidenceDomains("How far is the beach?")).not.toContain("planning");
    expect(inferAskEasyErfEvidenceDomains("How far is the nearest school?")).not.toContain(
      "planning",
    );

    expect(
      selectedFixture("What is the FAR?").claims.some((claim) => claim.domain === "planning"),
    ).toBe(true);
    expect(selectedFixture("How far is the beach?").claims).toEqual([]);
  });

  it("selects identity and address evidence without unrelated strategy claims", () => {
    const selected = selectedFixture("What is the LPI, parcel key and address?");

    expect(selected.claims.length).toBeGreaterThan(0);
    expect(selected.claims.every((claim) => ["identity", "address"].includes(claim.domain))).toBe(
      true,
    );
    expect(selected.claims.map((claim) => claim.domain)).not.toContain("strategy");
  });

  it("selects ownership, deeds and document gaps for ownership questions", () => {
    const selected = selectedFixture("Who owns it and what title deed evidence is missing?", {
      assets: [
        packAsset({
          id: "windeed",
          asset_category: "paid_report",
          original_file_name: "windeed.pdf",
        }),
      ],
    });

    expect(
      selected.gaps.some((gap) => ["ownership", "deeds", "documents"].includes(gap.domain)),
    ).toBe(true);
    expect(
      selected.sources.some((source) =>
        /windeed|official|ownership|deed/i.test(
          `${source.label} ${source.fileName ?? ""} ${source.sourcePortal ?? ""}`,
        ),
      ),
    ).toBe(true);
    expect(
      selected.claims.every((claim) => ["ownership", "deeds", "documents"].includes(claim.domain)),
    ).toBe(true);
  });

  it("selects planning controls and missing planning controls", () => {
    const selected = selectedFixture("What zoning, FAR and building line controls apply?");

    expect(selected.claims.some((claim) => claim.domain === "planning")).toBe(true);
    expect(selected.claims.every((claim) => claim.domain === "planning")).toBe(true);
    expect(selected.gaps.some((gap) => gap.domain === "planning")).toBe(true);
  });

  it("keeps official parcel zoning distinct from document-supported zoning", () => {
    const official = selectedFixture("What zoning applies?");
    const officialZoning = official.claims.find(
      (claim) => claim.domain === "planning" && claim.key === "zoning",
    );
    const officialSource = official.sources.find((source) =>
      officialZoning?.sourceRefs.includes(source.ref),
    );

    const documentSupported = selectedFixture("What zoning applies?", {
      parcel: evidenceParcel({ rawProperties: { AREA_M2: 900 } }),
      assets: [
        packAsset({
          id: "zoning-document",
          asset_category: "zoning_document",
          source_label: "Zoning certificate",
          original_file_name: "zoning-certificate.pdf",
          metadata: {
            extractionStatus: "ready",
            identityMatchStatus: "matched",
            extractedText: "Zoning: Residential 1",
            extractedClaims: [
              {
                domain: "planning",
                key: "zoning",
                label: "Zoning",
                value: "Residential 1",
                numericValue: null,
                unit: null,
                page: 1,
                quote: "Zoning: Residential 1",
                confidence: "high",
              },
            ],
          },
        }),
      ],
      selectedSiteDesign: null,
    });
    const documentZoning = documentSupported.claims.find(
      (claim) => claim.domain === "planning" && claim.key === "zoning",
    );
    const documentSource = documentSupported.sources.find((source) =>
      documentZoning?.sourceRefs.includes(source.ref),
    );

    expect(officialSource?.kind).toBe("official_parcel");
    expect(officialZoning?.confidenceReason).toContain("official parcel raw properties");
    expect(documentSource?.kind).toBe("uploaded_document");
    expect(documentZoning?.confidenceReason).toContain("identity-matched uploaded report");
  });

  it("selects market listing evidence without unrelated notes", () => {
    const selected = selectedFixture("Is the market comparable evidence strong enough?", {
      savedMarketEvidence: [packMarket({ id: "comp-a", title: "Comparable listing" })],
    });
    const askingPrice = selected.claims.find(
      (claim) => claim.domain === "market" && claim.key === "askingPrice",
    );

    expect(selected.claims.some((claim) => claim.domain === "market")).toBe(true);
    expect(selected.claims.map((claim) => claim.domain)).not.toContain("notes");
    expect(askingPrice?.nature).toBe("observation");
    expect(askingPrice?.confidenceReason).toContain("not valuations");
  });

  it("selects Strategy assumptions and calculations without high-confidence identity crowd-out", () => {
    const selected = selectedFixture("Which strategy assumptions affect profit and return?");

    expect(selected.claims.length).toBeGreaterThan(0);
    expect(selected.claims.every((claim) => claim.domain === "strategy")).toBe(true);
    expect(
      selected.claims.some(
        (claim) => claim.nature === "assumption" || claim.nature === "calculation",
      ),
    ).toBe(true);
    expect(selected.claims.map((claim) => claim.domain)).not.toContain("identity");
  });

  it("selects Site Potential interpretation without unrelated ownership facts", () => {
    const selected = selectedFixture("What does the Site Potential concept design say?");
    const conceptClaims = selected.claims.filter((claim) => claim.domain === "site");

    expect(conceptClaims.length).toBeGreaterThan(0);
    expect(selected.claims.every((claim) => claim.domain === "site")).toBe(true);
    expect(selected.claims.map((claim) => claim.domain)).not.toContain("ownership");
    expect(
      conceptClaims.every(
        (claim) => claim.nature === "interpretation" || claim.nature === "assumption",
      ),
    ).toBe(true);
    expect(conceptClaims.some((claim) => /not prove planning approval|AI interpretation/i.test(claim.confidenceReason))).toBe(true);
  });

  it("keeps real source references for official, Strategy, market and contradiction facts", () => {
    const identity = selectedFixture("What is the LPI and official parcel identity?");
    expect(identity.claims.some((claim) => claim.domain === "identity")).toBe(true);
    expect(
      identity.claims.every((claim) => claim.status === "missing" || claim.sourceRefs.length > 0),
    ).toBe(true);
    expect(identity.sources.some((source) => /official|kouga|csg/i.test(source.label))).toBe(true);

    const strategy = selectedFixture("Which Strategy assumptions and calculations matter?");
    expect(strategy.claims.some((claim) => claim.domain === "strategy")).toBe(true);
    expect(
      strategy.claims.every((claim) => claim.status === "missing" || claim.sourceRefs.length > 0),
    ).toBe(true);
    const strategyRefs = new Set(strategy.claims.flatMap((claim) => claim.sourceRefs));
    expect(strategy.sources.some((source) => strategyRefs.has(source.ref))).toBe(true);

    const market = selectedFixture("Is the market evidence strong enough?", {
      savedMarketEvidence: [packMarket({ id: "comp-a", title: "Comparable listing" })],
    });
    expect(market.claims.some((claim) => claim.domain === "market")).toBe(true);
    expect(
      market.claims.every((claim) => claim.status === "missing" || claim.sourceRefs.length > 0),
    ).toBe(true);
    expect(market.sources.some((source) => source.sourceType === "market")).toBe(true);

    const contradictory = selectedFixture("What are the biggest risks?", {
      savedMarketEvidence: [
        packMarket({
          id: "subject",
          listingRole: "subject_active_listing",
          relationship: "target_asset",
          landSizeM2: 1200,
        }),
      ],
    });
    expect(contradictory.contradictions.length).toBeGreaterThan(0);
    expect(contradictory.contradictions.every((item) => item.sourceRefs.length > 0)).toBe(true);
  });

  it("allows genuine gap-only selected evidence with a clearly synthetic missing-information source", () => {
    const pack = buildEvidencePackFixture();
    const gapOnly = buildAskEasyErfSelectedEvidencePayload({
      pack: { ...pack, claims: [], contradictions: [], sources: [] },
      question: "What evidence is still needed before a decision?",
    });

    expect(gapOnly.claims).toEqual([]);
    expect(gapOnly.contradictions).toEqual([]);
    expect(gapOnly.gaps.length).toBeGreaterThan(0);
    expect(gapOnly.sources).toHaveLength(1);
    expect(gapOnly.sources[0]).toMatchObject({
      kind: "system_state",
      sourceType: "missing",
      label: "Easy Erf system-generated missing-information state",
    });
    expect(validateAskEasyErfSelectedEvidencePayload(gapOnly)).not.toBeNull();
  });

  it("does not display high answer confidence for low-readiness gap-only evidence", () => {
    const pack = buildEvidencePackFixture();
    const gapOnly = buildAskEasyErfSelectedEvidencePayload({
      pack: { ...pack, claims: [], contradictions: [], sources: [] },
      question: "Can I rely on this erf file?",
    });

    const calibrated = calibrateAskEasyErfAnswerConfidence({
      answer: {
        answer: "The erf file has major evidence gaps.",
        confidence: "high",
        evidenceReferences: [
          {
            ref: gapOnly.sources[0]?.ref,
            label: "Missing evidence",
            sourceType: "missing",
          },
        ],
        unknowns: ["Ownership", "Planning controls"],
        nextAction: "Add evidence",
      },
      selectedEvidence: gapOnly,
      readinessPercent: 30,
    });

    expect(calibrated.confidence).toBe("low");
  });

  it("preserves high answer confidence when the answer cites reviewed official evidence", () => {
    const selected = selectedFixture("What is the official parcel identity?");
    const official = selected.sources.find((source) => source.sourceType === "official");
    if (!official) throw new Error("Expected official selected evidence source");
    const claim = selected.claims.find((item) => item.sourceRefs.includes(official.ref));

    const calibrated = calibrateAskEasyErfAnswerConfidence({
      answer: {
        answer: "The official parcel identifiers are available.",
        confidence: "high",
        evidenceReferences: [
          {
            ref: official.ref,
            label: official.label,
            sourceType: "official",
            status: official.status,
          },
        ],
        unknowns: [],
        nextAction: null,
      },
      selectedEvidence: {
        ...selected,
        sources: [{ ...official, status: "reviewed" }],
        claims: claim
          ? [
              {
                ...claim,
                status: "supported",
                confidence: "high",
                sourceRefs: [official.ref],
              },
            ]
          : [],
        gaps: [],
      },
      readinessPercent: 30,
    });

    expect(calibrated.confidence).toBe("high");
  });

  it("uses broad risk fallback for important contradictions and blocking gaps", () => {
    const selected = selectedFixture("What are the biggest risks?", {
      savedMarketEvidence: [
        packMarket({
          id: "subject",
          listingRole: "subject_active_listing",
          relationship: "target_asset",
          landSizeM2: 1200,
        }),
      ],
    });

    expect(selected.contradictions.length + selected.gaps.length).toBeGreaterThan(0);
    expect(selected.gaps.some((gap) => gap.blocking || gap.importance === "high")).toBe(true);
  });

  it("returns no usable slice for unrelated questions instead of sending unrelated official facts", () => {
    const selected = selectedFixture("Tell me about giraffe migration patterns.");

    expect(selected.claims).toEqual([]);
    expect(selected.contradictions).toEqual([]);
    expect(selected.gaps).toEqual([]);
    expect(selected.sources).toEqual([]);
    expect(hasEnoughAskEasyErfSelectedEvidence(selected)).toBe(false);
  });

  it("keeps selected evidence deterministic", () => {
    const first = selectedFixture("Can I build two units?");
    const second = selectedFixture("Can I build two units?");

    expect(first.claims.map((claim) => claim.id)).toEqual(second.claims.map((claim) => claim.id));
    expect(first.sources.map((source) => source.ref)).toEqual(
      second.sources.map((source) => source.ref),
    );
    expect(first.selectedText).toBe(second.selectedText);
  });
});

describe("Ask Easy Erf server handler", () => {
  async function expectInvalidSelectedEvidence(evidence: ReturnType<typeof selectedPayload>) {
    const fetchMock = vi.fn();
    const response = await handleAskEasyErfRequest(
      request({ parcelId: "parcel-current", question: "What are the risks?", evidence }),
      {
        env: {
          ...process.env,
          SUPABASE_URL: "https://proj.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "server-key",
        },
        fetch: fetchMock,
        authenticate: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ success: false, code: "INVALID_REQUEST" });
    expect(fetchMock).not.toHaveBeenCalled();
  }

  async function expectRejectedBeforeOpenAi(
    body: { parcelId?: string; question?: string; evidence?: unknown },
    expectedCode: string,
  ) {
    const fetchMock = vi.fn();
    const response = await handleAskEasyErfRequest(request(body), {
      env: {
        ...process.env,
        SUPABASE_URL: "https://proj.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "server-key",
      },
      fetch: fetchMock,
      authenticate: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
    const result = await response.json();
    expect(result).toMatchObject({ success: false, code: expectedCode });
    expect(JSON.stringify(result)).not.toContain("server-key");
    expect(JSON.stringify(result)).not.toContain("Comparable listing");
    expect(fetchMock).not.toHaveBeenCalled();
  }

  it("uses strict structured output, sends selected evidence only, and resolves source references", async () => {
    const evidence = selectedPayload("Is ownership verified?");
    const fetchMock = vi.fn().mockResolvedValue(
      openAiResponse({
        answer: "Known: the parcel identity exists. Missing: ownership remains unverified.",
        confidence: "medium",
        evidenceReferences: [{ ref: "S1", label: "Official LPI", sourceType: "official" }],
        unknowns: ["Current registered owner"],
        nextAction: "Upload a deeds report.",
      }),
    );

    const response = await handleAskEasyErfRequest(
      request({
        parcelId: "parcel-current",
        question: "Is ownership verified?",
        evidence,
      }),
      {
        env: {
          ...process.env,
          SUPABASE_URL: "https://proj.supabase.co",
          ASK_EASY_ERF_FN_SECRET: "fn-secret",
          SUPABASE_SERVICE_ROLE_KEY: "server-key",
        },
        fetch: fetchMock,
        authenticate: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
      },
    );

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.answer.evidenceReferences).toHaveLength(1);
    expect(result.answer.evidenceReferences[0].ref).toBe("S1");
    expect(result.answer.evidenceReferences[0].sourceId).toBe(evidence.sources[0].sourceId);

    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://proj.supabase.co/functions/v1/ask-easy-erf-openai");
    expect(String(url)).not.toContain("api.openai.com");
    const headers = options?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer fn-secret");
    const body = JSON.parse(String(options?.body));
    expect(body.question).toBe("Is ownership verified?");
    expect(body.evidence.parcelId).toBe("parcel-current");
    expect(JSON.stringify(body)).not.toContain("server-key");
    expect(JSON.stringify(body)).not.toContain("private/path");
  });

  it("binds the submitted question to the selected evidence question", async () => {
    const evidence = selectedPayload("Who owns it?");
    const exact = await handleAskEasyErfRequest(
      request({ parcelId: "parcel-current", question: "Who owns it?", evidence }),
      {
        env: {
          ...process.env,
          SUPABASE_URL: "https://proj.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "server-key",
        },
        fetch: vi.fn().mockResolvedValue(
          openAiResponse({
            answer: "Ownership is not confirmed by the selected evidence.",
            confidence: "low",
            evidenceReferences: [{ ref: "S1", label: "Source", sourceType: "official" }],
            unknowns: ["Registered owner"],
            nextAction: "Upload a deeds report.",
          }),
        ),
        authenticate: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
      },
    );
    expect(exact.status).toBe(200);

    const whitespace = await handleAskEasyErfRequest(
      request({ parcelId: "parcel-current", question: "  Who   owns it?  ", evidence }),
      {
        env: {
          ...process.env,
          SUPABASE_URL: "https://proj.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "server-key",
        },
        fetch: vi.fn().mockResolvedValue(
          openAiResponse({
            answer: "Ownership is still unknown.",
            confidence: "low",
            evidenceReferences: [{ ref: "S1", label: "Source", sourceType: "official" }],
            unknowns: ["Registered owner"],
            nextAction: "Upload a deeds report.",
          }),
        ),
        authenticate: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
      },
    );
    expect(whitespace.status).toBe(200);

    await expectRejectedBeforeOpenAi(
      { parcelId: "parcel-current", question: "What is the zoning?", evidence },
      "EVIDENCE_QUESTION_MISMATCH",
    );
  });

  it("accepts 1000-character questions and rejects 1001-character questions before OpenAI", async () => {
    const acceptedQuestion = "x".repeat(ASK_EASY_ERF_MAX_QUESTION_CHARACTERS);
    const acceptedEvidence = selectedPayload("What are the biggest risks?");
    acceptedEvidence.question = acceptedQuestion;
    const acceptedResponse = await handleAskEasyErfRequest(
      request({
        parcelId: "parcel-current",
        question: acceptedQuestion,
        evidence: acceptedEvidence,
      }),
      {
        env: {
          ...process.env,
          SUPABASE_URL: "https://proj.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "server-key",
        },
        fetch: vi.fn().mockResolvedValue(
          openAiResponse({
            answer: "The selected evidence has risks and missing information.",
            confidence: "low",
            evidenceReferences: [{ ref: "S1", label: "Source", sourceType: "official" }],
            unknowns: [],
            nextAction: "Review evidence.",
          }),
        ),
        authenticate: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
      },
    );
    expect(acceptedResponse.status).toBe(200);

    const oversizedQuestion = `${acceptedQuestion}x`;
    const truncatedEvidence = structuredClone(acceptedEvidence);
    truncatedEvidence.question = acceptedQuestion;
    const fetchMock = vi.fn();
    const rejectedResponse = await handleAskEasyErfRequest(
      request({
        parcelId: "parcel-current",
        question: oversizedQuestion,
        evidence: truncatedEvidence,
      }),
      {
        env: {
          ...process.env,
          SUPABASE_URL: "https://proj.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "server-key",
        },
        fetch: fetchMock,
        authenticate: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
      },
    );
    const result = await rejectedResponse.json();
    expect(rejectedResponse.status).toBe(400);
    expect(result).toMatchObject({
      success: false,
      code: "INVALID_REQUEST",
      error: "Questions must be 1,000 characters or fewer.",
    });
    expect(JSON.stringify(result)).not.toContain("Comparable listing");
    expect(JSON.stringify(result)).not.toContain("server-key");
    expect(fetchMock).not.toHaveBeenCalled();

    const oversizedEvidence = structuredClone(acceptedEvidence);
    oversizedEvidence.question = oversizedQuestion;
    await expectRejectedBeforeOpenAi(
      {
        parcelId: "parcel-current",
        question: acceptedQuestion,
        evidence: oversizedEvidence,
      },
      "INVALID_REQUEST",
    );
  });

  it("rejects browser-enlarged selected evidence limits and budgets", async () => {
    const base = selectedPayload("What are the risks?");

    const enlargedLimits = structuredClone(base);
    enlargedLimits.limits.maxClaims = 99;
    await expectRejectedBeforeOpenAi(
      { parcelId: "parcel-current", question: base.question, evidence: enlargedLimits },
      "INVALID_REQUEST",
    );

    const tooManyClaims = structuredClone(base);
    tooManyClaims.claims = Array.from({ length: 13 }, (_, index) => ({
      ...base.claims[0],
      id: `claim-${index}`,
    }));
    await expectRejectedBeforeOpenAi(
      { parcelId: "parcel-current", question: base.question, evidence: tooManyClaims },
      "INVALID_REQUEST",
    );

    const tooManyFragments = structuredClone(base);
    tooManyFragments.sources[0].fragments = Array.from(
      { length: 7 },
      (_, index) => `Fragment ${index}`,
    );
    await expectRejectedBeforeOpenAi(
      { parcelId: "parcel-current", question: base.question, evidence: tooManyFragments },
      "INVALID_REQUEST",
    );

    const tooLongText = structuredClone(base);
    tooLongText.selectedText = "x".repeat(5_501);
    await expectRejectedBeforeOpenAi(
      { parcelId: "parcel-current", question: base.question, evidence: tooLongText },
      "INVALID_REQUEST",
    );
  });

  it("rejects duplicate, non-consecutive, and unresolved selected evidence refs", async () => {
    const base = selectedPayload("What are the risks?");

    const duplicateRef = structuredClone(base);
    duplicateRef.sources.push({
      ...duplicateRef.sources[0],
      ref: duplicateRef.sources[0].ref,
      sourceId: "source-duplicate-ref",
    });
    await expectRejectedBeforeOpenAi(
      { parcelId: "parcel-current", question: base.question, evidence: duplicateRef },
      "INVALID_REQUEST",
    );

    const duplicateSourceId = structuredClone(base);
    duplicateSourceId.sources.push({
      ...duplicateSourceId.sources[0],
      ref: `S${duplicateSourceId.sources.length + 1}`,
    });
    await expectRejectedBeforeOpenAi(
      { parcelId: "parcel-current", question: base.question, evidence: duplicateSourceId },
      "INVALID_REQUEST",
    );

    const nonConsecutive = structuredClone(base);
    nonConsecutive.sources[0].ref = "S2";
    await expectRejectedBeforeOpenAi(
      { parcelId: "parcel-current", question: base.question, evidence: nonConsecutive },
      "INVALID_REQUEST",
    );

    const duplicateClaim = structuredClone(base);
    duplicateClaim.claims.push({ ...duplicateClaim.claims[0] });
    await expectRejectedBeforeOpenAi(
      { parcelId: "parcel-current", question: base.question, evidence: duplicateClaim },
      "INVALID_REQUEST",
    );

    const unresolvedClaimRef = structuredClone(base);
    unresolvedClaimRef.claims[0].sourceRefs = ["S999"];
    await expectRejectedBeforeOpenAi(
      { parcelId: "parcel-current", question: base.question, evidence: unresolvedClaimRef },
      "INVALID_REQUEST",
    );

    const emptyClaimRefs = structuredClone(base);
    emptyClaimRefs.claims[0].sourceRefs = [];
    await expectRejectedBeforeOpenAi(
      { parcelId: "parcel-current", question: base.question, evidence: emptyClaimRefs },
      "INVALID_REQUEST",
    );

    const duplicateNestedClaimRefs = structuredClone(base);
    duplicateNestedClaimRefs.claims[0].sourceRefs = [
      duplicateNestedClaimRefs.claims[0].sourceRefs[0],
      duplicateNestedClaimRefs.claims[0].sourceRefs[0],
    ];
    await expectRejectedBeforeOpenAi(
      {
        parcelId: "parcel-current",
        question: base.question,
        evidence: duplicateNestedClaimRefs,
      },
      "INVALID_REQUEST",
    );
  });

  it("rejects duplicate contradiction and gap IDs plus secret-bearing locators", async () => {
    const withContradiction = selectedFixture("What are the biggest risks?", {
      savedMarketEvidence: [
        packMarket({
          id: "subject",
          listingRole: "subject_active_listing",
          relationship: "target_asset",
          landSizeM2: 1200,
        }),
      ],
    });

    if (withContradiction.contradictions.length) {
      const duplicateContradiction = structuredClone(withContradiction);
      duplicateContradiction.contradictions.push({ ...duplicateContradiction.contradictions[0] });
      await expectRejectedBeforeOpenAi(
        {
          parcelId: "parcel-a",
          question: withContradiction.question,
          evidence: duplicateContradiction,
        },
        "INVALID_REQUEST",
      );

      const emptyContradictionRefs = structuredClone(withContradiction);
      emptyContradictionRefs.contradictions[0].sourceRefs = [];
      await expectRejectedBeforeOpenAi(
        {
          parcelId: "parcel-a",
          question: withContradiction.question,
          evidence: emptyContradictionRefs,
        },
        "INVALID_REQUEST",
      );

      const duplicateNestedContradictionRefs = structuredClone(withContradiction);
      duplicateNestedContradictionRefs.contradictions[0].sourceRefs = [
        duplicateNestedContradictionRefs.contradictions[0].sourceRefs[0],
        duplicateNestedContradictionRefs.contradictions[0].sourceRefs[0],
      ];
      await expectRejectedBeforeOpenAi(
        {
          parcelId: "parcel-a",
          question: withContradiction.question,
          evidence: duplicateNestedContradictionRefs,
        },
        "INVALID_REQUEST",
      );
    }

    const duplicateGap = structuredClone(withContradiction);
    duplicateGap.gaps.push({ ...duplicateGap.gaps[0] });
    await expectRejectedBeforeOpenAi(
      { parcelId: "parcel-a", question: withContradiction.question, evidence: duplicateGap },
      "INVALID_REQUEST",
    );

    const signedLocator = structuredClone(withContradiction);
    signedLocator.sources[0].locators = [
      { sourceUrl: "https://example.supabase.co/storage/v1/object/sign/bucket/file?token=secret" },
    ];
    await expectRejectedBeforeOpenAi(
      { parcelId: "parcel-a", question: withContradiction.question, evidence: signedLocator },
      "INVALID_REQUEST",
    );

    const syntheticWithClaim = structuredClone(withContradiction);
    syntheticWithClaim.sources.push({
      ref: `S${syntheticWithClaim.sources.length + 1}`,
      sourceId: "parcel-a:selected-evidence-gaps",
      parcelId: "parcel-a",
      kind: "system_state",
      label: "Easy Erf system-generated missing-information state",
      sourceType: "missing",
      authorityType: "system",
      sourceQuality: "unavailable",
      status: "unavailable",
      fileName: null,
      sourcePortal: "Easy Erf",
      locators: [],
      fragments: [],
    });
    await expectRejectedBeforeOpenAi(
      { parcelId: "parcel-a", question: withContradiction.question, evidence: syntheticWithClaim },
      "INVALID_REQUEST",
    );
  });

  it("accepts valid current-parcel selected evidence", async () => {
    const chosen = strategyScenario();
    const subject = marketEvidence({
      id: "subject",
      listingRole: "subject_active_listing",
      includeInSummary: false,
      title: "User-confirmed active listing",
    });
    const currentPayload = selectedPayload("Summarise the current evidence.", {
      savedEvidence: [subject, marketEvidence()],
      strategyScenarios: [chosen],
      chosenScenario: chosen,
    });

    const response = await handleAskEasyErfRequest(
      request({
        parcelId: "parcel-current",
        question: "Summarise the current evidence.",
        evidence: currentPayload,
      }),
      {
        env: {
          ...process.env,
          SUPABASE_URL: "https://proj.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "server-key",
        },
        fetch: vi.fn().mockResolvedValue(
          openAiResponse({
            answer: "The current parcel has an official identity, a subject listing, and one comp.",
            confidence: "medium",
            evidenceReferences: [
              { ref: "S1", label: "Current parcel evidence", sourceType: "official" },
            ],
            unknowns: ["Ownership"],
            nextAction: "Review sources.",
          }),
        ),
        authenticate: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
      },
    );

    expect(response.status).toBe(200);
  });

  it("rejects cross-parcel selected evidence server-side", async () => {
    const base = selectedPayload("What are the risks?");

    const crossSource = structuredClone(base);
    crossSource.sources[0].parcelId = "other-parcel";
    await expectInvalidSelectedEvidence(crossSource);

    const crossClaim = structuredClone(base);
    crossClaim.claims[0].parcelId = "other-parcel";
    await expectInvalidSelectedEvidence(crossClaim);

    const crossGap = structuredClone(base);
    crossGap.gaps[0].parcelId = "other-parcel";
    await expectInvalidSelectedEvidence(crossGap);
  });

  it("rejects malformed selected evidence as an invalid request without calling OpenAI", async () => {
    const fetchMock = vi.fn();
    const malformed = selectedPayload();
    malformed.sources[0].ref = "not-a-source-ref";

    const response = await handleAskEasyErfRequest(
      request({ parcelId: "parcel-current", question: "What are the risks?", evidence: malformed }),
      {
        env: {
          ...process.env,
          SUPABASE_URL: "https://proj.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "server-key",
        },
        fetch: fetchMock,
        authenticate: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ success: false, code: "INVALID_REQUEST" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns an evidence-limited answer for unsupported questions when the model does", async () => {
    const evidence = selectedPayload("Who owns it?", { assets: [] });
    const response = await handleAskEasyErfRequest(
      request({
        parcelId: "parcel-current",
        question: "Who owns it?",
        evidence,
      }),
      {
        env: {
          ...process.env,
          SUPABASE_URL: "https://proj.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "server-key",
        },
        fetch: vi.fn().mockResolvedValue(
          openAiResponse({
            answer: "The current Easy Erf evidence does not confirm ownership.",
            confidence: "low",
            evidenceReferences: [
              { ref: "S1", label: "Ownership evidence missing", sourceType: "official" },
            ],
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
    expect(result.answer.evidenceReferences[0].ref).toBe("S1");
  });

  it("rejects malformed model output safely", async () => {
    const evidence = selectedPayload();
    const response = await handleAskEasyErfRequest(
      request({ parcelId: "parcel-current", question: evidence.question, evidence }),
      {
        env: {
          ...process.env,
          SUPABASE_URL: "https://proj.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "server-key",
        },
        fetch: vi
          .fn()
          .mockResolvedValue(openAiResponse({ answer: "No refs", confidence: "medium" })),
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
    const empty = selectedPayload("What are the risks?", {
      parcel: parcel({
        erfNumber: null,
        lpi: null,
        parcelKey: null,
        knownFields: [],
        rawProperties: {},
      }),
      workspaceState: createEmptyErfWorkspaceState(),
      savedEvidence: [],
      marketAddress: null,
      assets: [],
    });
    empty.claims = [];
    empty.contradictions = [];
    empty.gaps = [];
    empty.sources = [];
    empty.selectedText = "No relevant evidence selected for this question.";

    const response = await handleAskEasyErfRequest(
      request({ parcelId: "parcel-current", question: "What are the risks?", evidence: empty }),
      {
        env: {
          ...process.env,
          SUPABASE_URL: "https://proj.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "server-key",
        },
        fetch: fetchMock,
        authenticate: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
      },
    );

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("INSUFFICIENT_EVIDENCE");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("handles missing auth, missing config, rate limits, and stale parcels without exposing secrets", async () => {
    const evidence = selectedPayload();
    const authFailure = await handleAskEasyErfRequest(
      request({ parcelId: "parcel-current", question: evidence.question, evidence }),
      { authenticate: vi.fn().mockRejectedValue(new Error("bad token secret")) },
    );
    expect(authFailure.status).toBe(401);
    expect(await authFailure.text()).not.toContain("bad token secret");

    const notConfigured = await handleAskEasyErfRequest(
      request({ parcelId: "parcel-current", question: evidence.question, evidence }),
      { env: {}, authenticate: vi.fn().mockResolvedValue({}) },
    );
    expect(notConfigured.status).toBe(503);

    const stale = await handleAskEasyErfRequest(
      request({ parcelId: "other-parcel", question: evidence.question, evidence }),
      {
        env: { SUPABASE_URL: "https://proj.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "server-key" },
        authenticate: vi.fn().mockResolvedValue({}),
      },
    );
    expect(stale.status).toBe(409);

    const rateLimited = await handleAskEasyErfRequest(
      request({ parcelId: "parcel-current", question: evidence.question, evidence }),
      {
        env: { SUPABASE_URL: "https://proj.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "server-key" },
        fetch: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ success: false, code: "RATE_LIMITED" }), {
            status: 429,
            headers: { "Content-Type": "application/json" },
          }),
        ),
        authenticate: vi.fn().mockResolvedValue({}),
      },
    );
    expect(rateLimited.status).toBe(429);
  });

  it("rejects fake source references returned by the model", async () => {
    const evidence = selectedPayload();
    const response = await handleAskEasyErfRequest(
      request({ parcelId: "parcel-current", question: evidence.question, evidence }),
      {
        env: {
          ...process.env,
          SUPABASE_URL: "https://proj.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "server-key",
        },
        fetch: vi.fn().mockResolvedValue(
          openAiResponse({
            answer: "This cites a source that was not supplied.",
            confidence: "low",
            evidenceReferences: [{ ref: "S999", label: "Fake source", sourceType: "official" }],
            unknowns: ["Real evidence"],
            nextAction: "Review sources.",
          }),
        ),
        authenticate: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
      },
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: "MALFORMED_MODEL_RESPONSE" });
  });
});

describe("Ask Easy Erf report UI guardrails", () => {
  // Ask Easy Erf UI now lives in a shared panel used by both the report and
  // the Investigation Home, so guardrails read both files.
  const source = [
    readFileSync(resolve(__dirname, "../../../components/property/ErfResearchDossier.tsx"), "utf8"),
    readFileSync(
      resolve(__dirname, "../../../components/property/dossier/AskEasyErfPanel.tsx"),
      "utf8",
    ),
  ].join("\n");
  const styles = readFileSync(resolve(__dirname, "../../../styles.css"), "utf8");

  it("renders the Ask Easy Erf section, loading/error states, disclaimer, and print-safe controls", () => {
    expect(source).toContain("Ask Easy Erf");
    expect(source).toContain("Suggested questions");
    expect(source).toContain(
      "Ask Easy Erf answers are limited to the evidence saved for this property",
    );
    expect(source).toContain("Asking...");
    expect(source).toContain("Ask Easy Erf request cancelled.");
    expect(source).toContain("Clear previous answer");
    expect(source).toContain("report-no-print");
    expect(styles).toContain(".report-no-print { display: none !important; }");
  });

  it("clears stale answers when the selected parcel changes", () => {
    expect(source).toContain("[suggestionPayload.parcelId, evidenceFingerprint]");
    expect(source).toContain("currentParcelIdRef");
    expect(source).toContain("currentFingerprintRef");
    expect(source).toContain("currentParcelIdRef.current = suggestionPayload.parcelId");
    expect(source).toContain("currentFingerprintRef.current = evidenceFingerprint");
    expect(source).toContain("renderedParcelIdRef");
    expect(source).toContain("renderedFingerprintRef");
    expect(source).toContain("requestGenerationRef.current += 1");
    expect(source).toContain("requestGeneration");
    expect(source).toContain("requestParcelId");
    expect(source).toContain("requestFingerprint");
    expect(source).toContain("isCurrentRequest");
    expect(source).toContain("if (!isCurrentRequest()) return");
    expect(source).toContain("setAnswer(null)");
    expect(source).toContain("abortRef.current?.abort()");
  });

  it("submits selected canonical evidence instead of the whole report payload", () => {
    expect(source).toContain("buildAskEasyErfSelectedEvidencePayload");
    expect(source).toContain("hasEnoughAskEasyErfSelectedEvidence");
    expect(source).toContain("evidence: selectedEvidence");
    expect(source).not.toContain("evidence: payload,");
  });

  it("uses canonical Property Evidence Pack availability instead of legacy payload weight", () => {
    expect(source).toContain("suggestionPayload");
    expect(source).toContain("hasAskEasyErfPackEvidence");
    expect(source).toContain("hasCanonicalPackEvidence");
    expect(source).not.toContain("hasEnoughAskEasyErfEvidence(payload)");
    expect(source).not.toContain("hasEnoughAskEasyErfEvidence(suggestionPayload)");
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
