import { describe, expect, it } from "vitest";
import { buildPropertyEvidencePack } from "../buildPropertyEvidencePack";
import { selectPropertyEvidence } from "../selectPropertyEvidence";
import { evidenceFingerprint } from "../evidenceFingerprint";
import { buildReportViewModel } from "@/lib/reports/buildReportViewModel";
import { buildDecisionIntelligence } from "@/lib/reports/buildDecisionIntelligence";
import { buildParcelPlanningAssessment } from "@/lib/planning/parcelPlanningAssessment";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import type {
  MarketAddressIntelligence,
  SavedMarketEvidence,
} from "@/features/marketEvidence/types";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";
import {
  createEmptyErfWorkspaceState,
  createEmptyStrategyWorkspace,
  type ErfStrategyScenario,
} from "@/lib/workbench/erfWorkspaceState";
import type { PropertyNotes } from "@/lib/workbench/propertyNotes";

const NOW = new Date("2026-07-23T10:00:00Z");

function parcel(overrides: Partial<NormalizedOfficialParcel> = {}): NormalizedOfficialParcel {
  return {
    id: "parcel-a",
    source: "kouga-sg",
    sourceLabel: "Kouga SG Properties",
    layer: "csg-parcels",
    erfNumber: 1021,
    portion: 0,
    lpi: "C03400140000102100000",
    parcelKey: "E108C034001400001021000000",
    objectId: 1021,
    municipality: "Kouga Local Municipality",
    province: "Eastern Cape",
    suburbOrArea: "Sea Vista",
    town: "St Francis Bay",
    coordinates: { lng: 24.831, lat: -34.151 },
    knownFields: [{ label: "Erf", value: "1021", source: "Kouga SG Properties" }],
    missingFields: [],
    rawProperties: {
      SHAPE_Area: 900,
      AREA_M2: 900,
      ZONING: "Residential 1",
      COVERAGE: "50%",
      FAR: "0.8",
    },
    ...overrides,
  } as NormalizedOfficialParcel;
}

function workspace(overrides: Partial<ReturnType<typeof createEmptyErfWorkspaceState>> = {}) {
  return {
    ...createEmptyErfWorkspaceState(),
    updatedAt: "2026-07-20T08:00:00Z",
    ...overrides,
  };
}

function asset(overrides: Partial<ErfAsset> = {}): ErfAsset {
  return {
    id: "asset-sg",
    user_id: "user-1",
    parcel_id: "parcel-a",
    asset_category: "sg_diagram",
    asset_type: "pdf",
    source_label: "SG diagram",
    storage_bucket: "erf-files",
    storage_path: "erf-files/parcel-a/sg.pdf",
    original_file_name: "sg-diagram.pdf",
    mime_type: "application/pdf",
    size_bytes: 1200,
    checksum_sha256: "abc",
    status: "ready",
    metadata: {
      extractionStatus: "ready",
      identityMatchStatus: "matched",
      extractedText: "SG diagram shows erf 1021 boundary and survey information.",
      pageNumber: 2,
      signedUrl: "https://signed.example/volatile",
    },
    local_migration_fingerprint: null,
    created_at: "2026-07-19T08:00:00Z",
    updated_at: "2026-07-19T09:00:00Z",
    ...overrides,
  };
}

function market(overrides: Partial<SavedMarketEvidence> = {}): SavedMarketEvidence {
  return {
    id: "market-1",
    parcelId: "parcel-a",
    sourceUrl: "https://www.property24.com/listing/1",
    sourcePortal: "Property24",
    title: "Comparable listing",
    askingPrice: 1_200_000,
    propertyType: "Vacant land",
    beds: null,
    baths: null,
    garages: 0,
    parkingSpaces: 2,
    landSizeM2: 910,
    buildingSizeM2: null,
    relationship: "same_suburb_comp",
    confidence: "medium",
    includeInSummary: true,
    listingRole: "comparable_evidence",
    importedListing: {
      listingId: "117377049",
      canonicalUrl: "https://www.property24.com/for-sale/st-francis-bay/117377049",
      importedAt: "2026-07-21T08:00:00Z",
      fetchedAt: "2026-07-21T07:59:00Z",
      contentHash: "content-hash",
      listingDate: "2026-07-01",
      warnings: ["Address hidden by portal"],
      missingFields: ["erfNumber"],
      matchStatus: "user_review_required",
      matchReasons: ["Suburb alone is not enough to match an erf"],
      userConfirmedAttachment: false,
    },
    notes: "Good local comparable.",
    savedAt: "2026-07-21T08:00:00Z",
    updatedAt: "2026-07-21T08:10:00Z",
    ...overrides,
  };
}

function strategy(overrides: Partial<ErfStrategyScenario> = {}): ErfStrategyScenario {
  return {
    id: "scenario-a",
    parcelId: "parcel-a",
    label: "Development to sell",
    strategy: "development_sell",
    inputs: { landCost: "1200000", buildCost: "2500000" },
    summary: [{ label: "Projected profit", value: "R 300 000" }],
    selected: true,
    savedAt: "2026-07-22T08:00:00Z",
    updatedAt: "2026-07-22T09:00:00Z",
    ...overrides,
  };
}

function notes(overrides: Partial<PropertyNotes> = {}): PropertyNotes {
  return {
    parcelId: "parcel-a",
    personal: "Inspect access road.",
    pros: "Near amenities.",
    cons: "Slope unknown.",
    questions: "Confirm building line?",
    agentContact: "Agent Name",
    municipality: "Need planning desk check.",
    renovation: "",
    checklist: { visited: true },
    createdAt: "2026-07-18T08:00:00Z",
    updatedAt: "2026-07-18T09:00:00Z",
    ...overrides,
  };
}

function address(overrides: Partial<MarketAddressIntelligence> = {}): MarketAddressIntelligence {
  return {
    selectedAddressId: "addr-1",
    candidates: [
      {
        id: "addr-1",
        formattedAddress: "8 Harbour Road, St Francis Bay",
        municipality: "Kouga Local Municipality",
        province: "Eastern Cape",
        lat: -34.151,
        lng: 24.831,
        source: "google_reverse_geocode",
        confidence: "medium",
        reason: "Google reverse geocode candidate.",
        createdAt: "2026-07-20T09:00:00Z",
      },
      {
        id: "addr-2",
        formattedAddress: "Approximate St Francis Bay address",
        municipality: "Kouga Local Municipality",
        province: "Eastern Cape",
        lat: -34.15,
        lng: 24.83,
        source: "google_reverse_geocode",
        confidence: "low",
        reason: "Approximate reverse geocode candidate.",
        createdAt: "2026-07-20T09:05:00Z",
      },
    ],
    userConfirmedAddress: {
      id: "addr-1",
      formattedAddress: "8 Harbour Road, St Francis Bay",
      municipality: "Kouga Local Municipality",
      province: "Eastern Cape",
      lat: -34.151,
      lng: 24.831,
      source: "user_entered",
      confidence: "high",
      reason: "User confirmed the working market address.",
      createdAt: "2026-07-20T09:00:00Z",
      updatedAt: "2026-07-20T10:00:00Z",
    },
    lastResolvedAt: "2026-07-20T10:00:00Z",
    ...overrides,
  };
}

function build(overrides: Partial<Parameters<typeof buildPropertyEvidencePack>[0]> = {}) {
  const scenario = strategy();
  const selectedDesign = asset({
    id: "asset-design",
    asset_category: "generated_design",
    original_file_name: "concept.png",
    mime_type: "image/png",
    metadata: { conceptName: "Courtyard duplex", rationale: "Uses access and north light." },
  });
  const strategyWorkspace = {
    ...createEmptyStrategyWorkspace("parcel-a"),
    activeStrategy: "development_sell",
    draftInputs: { landCost: "1200000" },
    draftUpdatedAt: "2026-07-22T07:00:00Z",
    scenarios: [scenario],
    chosenScenarioId: scenario.id,
    chosenScenarioUpdatedAt: scenario.updatedAt ?? scenario.savedAt,
  };
  return buildPropertyEvidencePack({
    parcel: parcel(),
    workspaceState: workspace({ identityStatus: "checked", reviewedSourceIds: ["source-csg-viewer"] }),
    researchSources: [
      {
        id: "source-csg-viewer",
        category: "csg-sg-documents",
        name: "CSG Viewer",
        label: "CSG Viewer",
        description: "Official cadastral source.",
        sourceType: "official",
        defaultStatus: "available",
        status: "available",
        reveals: "Official cadastral identifiers.",
        url: "https://csg.example",
        requiredFields: [],
        missingFields: [],
        actionLabel: "Open source",
        complianceNote: "Open and review the official source.",
        confidence: "official",
        dossierGroup: "official",
        sourceQuality: "direct_parcel_link",
        userUsefulness: "primary",
        actionInstruction: "Open source",
      } as never,
    ],
    savedMarketEvidence: [market()],
    marketAddressIntelligence: address(),
    assets: [asset(), selectedDesign],
    propertyNotes: notes(),
    strategyWorkspace,
    strategyScenarios: [scenario],
    chosenScenario: scenario,
    selectedSiteDesign: selectedDesign,
    now: NOW,
    ...overrides,
  });
}

describe("buildPropertyEvidencePack", () => {
  it("keeps every evidence source parcel-scoped", () => {
    const pack = build({
      savedMarketEvidence: [market(), market({ id: "other-market", parcelId: "parcel-b" })],
      assets: [asset(), asset({ id: "other-asset", parcel_id: "parcel-b" })],
      propertyNotes: notes({ parcelId: "parcel-b", questions: "Wrong parcel question" }),
      strategyScenarios: [strategy(), strategy({ id: "other-scenario", parcelId: "parcel-b" })],
      selectedSiteDesign: asset({ id: "other-design", parcel_id: "parcel-b", asset_category: "generated_design" }),
    });

    expect(pack.parcelId).toBe("parcel-a");
    expect(pack.sources.every((source) => source.parcelId === "parcel-a")).toBe(true);
    expect(pack.claims.every((claim) => claim.parcelId === "parcel-a")).toBe(true);
    expect(pack.sources.map((source) => source.id)).not.toContain("asset-other-asset");
    expect(pack.claims.map((claim) => claim.id).join(" ")).not.toContain("Wrong parcel");
    expect(pack.contradictions.some((item) => item.id === "selected-site-design-cross-parcel")).toBe(true);
  });

  it("classifies official, user-confirmed, market, assumption, calculation and AI claims explicitly", () => {
    const pack = build();

    expect(pack.claims.find((claim) => claim.key === "lpi")).toMatchObject({
      nature: "fact",
      status: "supported",
      confidence: "high",
    });
    expect(pack.claims.find((claim) => claim.id === "claim-address-addr-1-marketAddress")).toMatchObject({
      nature: "observation",
      userConfirmed: true,
    });
    expect(pack.claims.find((claim) => claim.id === "claim-address-addr-2-marketAddress")).toMatchObject({
      nature: "observation",
      confidence: "low",
      sourceIds: ["address-addr-2"],
    });
    expect(pack.claims.find((claim) => claim.key === "askingPrice")).toMatchObject({
      domain: "market",
      nature: "observation",
    });
    expect(pack.claims.find((claim) => claim.id === "claim-strategy-draft-landCost")).toMatchObject({
      nature: "assumption",
    });
    expect(pack.claims.find((claim) => claim.id === "claim-strategy-scenario-a-summary-projected-profit")).toMatchObject({
      nature: "calculation",
    });
    expect(pack.claims.find((claim) => claim.key === "selectedSitePotentialConcept")).toMatchObject({
      nature: "interpretation",
    });
    expect(pack.domains.find((domain) => domain.domain === "ownership")?.state).not.toBe("supported");
  });

  it("carries a user-confirmed working zoning conclusion through the canonical evidence pack", () => {
    const planningAssessment = buildParcelPlanningAssessment({
      parcelId: "parcel-a",
      municipality: "Kouga Local Municipality",
      locationHints: ["Sea Vista", "St Francis Bay"],
      erfAreaM2: 900,
      manualZoneCode: "RES1",
      userConfirmedZoneCode: "RES1",
      hasParcelPolygon: true,
    });
    const pack = build({ planningAssessment });

    expect(pack.claims.find((claim) => claim.key === "zoning")).toMatchObject({
      nature: "assumption",
      status: "not_reviewed",
      userConfirmed: true,
    });
    expect(pack.claims.find((claim) => claim.key === "coverage")).toMatchObject({
      nature: "assumption",
      status: "not_reviewed",
      userConfirmed: true,
    });
  });

  it("preserves extracted text safely and never stores signed URLs as fragments", () => {
    const pack = build({
      assets: [
        asset(),
        asset({
          id: "asset-waiting",
          metadata: { extractionStatus: "processing", extractedText: "Do not expose this yet." },
        }),
        asset({ id: "asset-extra", original_file_name: "extra.pdf" }),
        asset({ id: "asset-extra-2", original_file_name: "extra-2.pdf" }),
        asset({ id: "asset-extra-3", original_file_name: "extra-3.pdf" }),
        asset({ id: "asset-extra-4", original_file_name: "extra-4.pdf" }),
      ],
    });
    const fragments = pack.sources.flatMap((source) => source.fragments);
    expect(fragments.join(" ")).toContain("SG diagram shows erf 1021");
    expect(fragments.join(" ")).not.toContain("Do not expose this yet");
    expect(JSON.stringify(pack)).not.toContain("signed.example");
    expect(pack.sources.filter((source) => source.kind === "uploaded_document")).toHaveLength(6);
  });

  it("stores structured File Vault asset metadata without volatile URLs", () => {
    const sgDiagram = asset({
      id: "4f47dd8a-bd52-4f20-b455-e3563b147ba0",
      asset_category: "sg_diagram",
      asset_type: "survey_pdf",
      source_label: "Survey document",
      original_file_name: "document-123.pdf",
      mime_type: "application/pdf",
      size_bytes: 98765,
      checksum_sha256: "sha256-sg",
      metadata: {
        extractionStatus: "ready",
        extractionWarning: "Low OCR confidence on page 2",
        extractedText: "Survey document text.",
        pageCount: 3,
        signedUrl: "https://signed.example/sg",
      },
    });
    const paidReport = asset({
      id: "paid-report-random",
      asset_category: "paid_report",
      source_label: "Ownership document",
      original_file_name: "ownership.pdf",
      checksum_sha256: "sha256-paid",
      metadata: { extraction_status: "processing", extraction_warning: "Pending extraction" },
    });
    const titleDeed = asset({
      id: "title-deed-random",
      asset_category: "title_deed",
      source_label: "Paid-looking deed",
      original_file_name: "paid-report-looking-name.pdf",
    });
    const selectedDesign = asset({
      id: "selected-design-random",
      asset_category: "generated_design",
      asset_type: "site_concept",
      source_label: "Concept",
      original_file_name: "concept.png",
      mime_type: "image/png",
      metadata: {
        conceptName: "Courtyard duplex",
        conceptRationale: "Uses northern light.",
        downloadUrl: "https://download.example/concept",
      },
    });

    const pack = build({
      assets: [sgDiagram, paidReport, titleDeed, selectedDesign],
      selectedSiteDesign: selectedDesign,
      workspaceState: workspace({
        sitePotential: {
          ...createEmptyErfWorkspaceState().sitePotential,
          selectedDesignAssetId: selectedDesign.id,
        },
      }),
    });

    const sgSource = pack.sources.find((source) => source.assetId === sgDiagram.id);
    const paidSource = pack.sources.find((source) => source.assetId === paidReport.id);
    const deedSource = pack.sources.find((source) => source.assetId === titleDeed.id);
    const designSource = pack.sources.find((source) => source.assetId === selectedDesign.id);

    expect(sgSource?.asset).toMatchObject({
      category: "sg_diagram",
      assetType: "survey_pdf",
      mimeType: "application/pdf",
      sizeBytes: 98765,
      checksumSha256: "sha256-sg",
      storageStatus: "ready",
      extractionStatus: "ready",
      extractionWarning: "Low OCR confidence on page 2",
      pageCount: 3,
      selectedSiteConcept: false,
    });
    expect(paidSource?.asset?.category).toBe("paid_report");
    expect(deedSource?.asset?.category).toBe("title_deed");
    expect(deedSource?.asset?.category).not.toBe("paid_report");
    expect(paidSource?.asset).toMatchObject({
      extractionStatus: "processing",
      extractionWarning: "Pending extraction",
      pageCount: null,
    });
    expect(designSource?.asset).toMatchObject({
      category: "generated_design",
      selectedSiteConcept: true,
      conceptName: "Courtyard duplex",
      conceptRationale: "Uses northern light.",
    });
    expect(JSON.stringify(pack)).not.toContain("signed.example");
    expect(JSON.stringify(pack)).not.toContain("download.example");

    const report = buildReportViewModel({
      parcel: parcel(),
      workspaceState: workspace(),
      savedEvidence: [],
      marketAddress: null,
      assets: [sgDiagram, paidReport, titleDeed, selectedDesign],
      chosenScenario: null,
      strategyScenarios: [],
      selectedSiteDesign: selectedDesign,
      now: NOW,
    });
    expect(report.documents.assetCount).toBe(3);
    expect(report.documents.sgDiagramCount).toBe(1);
    expect(report.documents.uploadedReportCount).toBe(1);
  });

  it("keeps asset fingerprints stable when File Vault order changes", () => {
    const firstAssets = [
      asset({ id: "asset-a", asset_category: "sg_diagram", checksum_sha256: "a" }),
      asset({ id: "asset-b", asset_category: "paid_report", checksum_sha256: "b" }),
      asset({ id: "asset-c", asset_category: "title_deed", checksum_sha256: "c" }),
    ];
    const first = build({ assets: firstAssets });
    const second = build({ assets: [...firstAssets].reverse() });

    expect(first.fingerprint).toBe(second.fingerprint);
  });

  it("detects evidence contradictions without treating missing information as conflict", () => {
    const pack = build({
      parcel: parcel({
        province: "Eastern Cape",
        rawProperties: {
          SHAPE_Area: 900,
          AREA_M2: 1200,
          ZONING: "Residential 1",
          ZONE: "Business 1",
        },
      }),
      marketAddressIntelligence: address({
        userConfirmedAddress: {
          ...address().userConfirmedAddress!,
          municipality: "City of Cape Town",
          province: "Western Cape",
        },
      }),
      savedMarketEvidence: [
        market({ id: "subject-1", listingRole: "subject_active_listing", relationship: "target_asset", landSizeM2: 1400 }),
        market({ id: "subject-2", listingRole: "subject_active_listing", relationship: "target_asset", landSizeM2: 900 }),
      ],
    });
    const ids = pack.contradictions.map((item) => item.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "market-address-municipality-mismatch",
        "market-address-province-mismatch",
        "official-area-alias-conflict",
        "subject-land-size-mismatch-subject-1",
        "multiple-subject-active-listings",
        "official-zoning-alias-conflict",
      ]),
    );
    expect(ids).not.toContain("missing-zoning");
  });

  it("uses the exact area mismatch threshold boundary", () => {
    const atThreshold = build({
      savedMarketEvidence: [
        market({
          id: "subject-threshold",
          listingRole: "subject_active_listing",
          relationship: "target_asset",
          landSizeM2: 990,
        }),
      ],
    });
    const aboveThreshold = build({
      savedMarketEvidence: [
        market({
          id: "subject-above",
          listingRole: "subject_active_listing",
          relationship: "target_asset",
          landSizeM2: 991,
        }),
      ],
    });
    expect(atThreshold.contradictions.map((item) => item.id)).not.toContain(
      "subject-land-size-mismatch-subject-threshold",
    );
    expect(aboveThreshold.contradictions.map((item) => item.id)).toContain(
      "subject-land-size-mismatch-subject-above",
    );
  });

  it("creates deterministic gaps for missing evidence and clears market comp gap at three usable comps", () => {
    const sparse = build({
      parcel: parcel({ rawProperties: {} }),
      assets: [asset({ asset_category: "paid_report", metadata: { extractionStatus: "processing" } })],
      savedMarketEvidence: [market()],
      chosenScenario: strategy({ strategy: "development_sell" }),
      propertyNotes: notes({ questions: "Can I add another dwelling?" }),
    });
    const gapIds = sparse.gaps.map((gap) => gap.id);
    expect(gapIds).toEqual(
      expect.arrayContaining([
        "missing-erf-area",
        "missing-zoning",
        "missing-coverage",
        "missing-far",
        "missing-height",
        "missing-setbacks",
        "missing-permittedUses",
        "ownership-not-verified",
        "document-extraction-missing-asset-sg",
        "fewer-than-three-comps",
        "development-planning-controls-unverified",
        "unresolved-user-question-1",
      ]),
    );

    const readyMarket = build({
      savedMarketEvidence: [market({ id: "m1" }), market({ id: "m2" }), market({ id: "m3" })],
      chosenScenario: strategy({ strategy: "buy_hold" }),
    });
    expect(readyMarket.gaps.map((gap) => gap.id)).not.toContain("fewer-than-three-comps");
    expect(readyMarket.gaps.map((gap) => gap.id)).not.toContain("site-potential-concept-missing-for-development");
  });

  it("builds a stable evidence timeline from actual timestamps", () => {
    const pack = build({
      assets: [asset({ updated_at: "not-a-date" }), asset({ id: "asset-valid", updated_at: "2026-07-19T09:00:00Z" })],
    });
    const ids = pack.timeline.map((event) => event.id);
    expect(ids).toContain("timeline-market-address-confirmed");
    expect(ids).toContain("timeline-source-reviewed-source-csg-viewer");
    expect(ids).toContain("timeline-market-evidence-market-1");
    expect(ids).not.toContain("timeline-asset-extraction-asset-sg");
    expect(pack.timeline.map((event) => event.occurredAt)).toEqual(
      [...pack.timeline.map((event) => event.occurredAt)].sort(),
    );
  });

  it("uses deterministic fingerprints that ignore volatile runtime fields", () => {
    const first = build({ now: new Date("2026-07-23T10:00:00Z") });
    const second = build({ now: new Date("2026-07-24T10:00:00Z") });
    const changed = build({ savedMarketEvidence: [market({ askingPrice: 1_350_000 })] });

    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.fingerprint).not.toBe(changed.fingerprint);
    expect(evidenceFingerprint({ signedUrl: "a", value: 1 })).toBe(
      evidenceFingerprint({ signedUrl: "b", value: 1 }),
    );
  });

  it("selects relevant evidence without crossing parcels or exceeding the budget", () => {
    const pack = build();
    const selection = selectPropertyEvidence(pack, {
      question: "What official identity and ownership evidence is available?",
      domains: ["identity", "ownership"],
      maxClaims: 6,
      maxSourceFragments: 2,
      maxTotalCharacters: 700,
    });

    expect(selection.parcelId).toBe("parcel-a");
    expect(selection.claims.every((claim) => claim.parcelId === "parcel-a")).toBe(true);
    expect(selection.claims.some((claim) => claim.key === "lpi")).toBe(true);
    expect(selection.gaps.some((gap) => gap.id === "ownership-not-verified")).toBe(true);
    expect(selection.text.length).toBeLessThanOrEqual(700);
    expect(selection.text).toMatch(/fact|observation|missing/i);
  });

  it("feeds report and decision intelligence from the canonical pack", () => {
    const input = {
      parcel: parcel(),
      workspaceState: workspace({ identityStatus: "none" }),
      savedEvidence: [market()],
      marketAddress: address(),
      assets: [asset()],
      chosenScenario: null,
      strategyScenarios: [],
      selectedSiteDesign: null,
      now: NOW,
    };
    const report = buildReportViewModel(input);
    const decision = buildDecisionIntelligence(report);

    expect(report.evidencePack?.parcelId).toBe("parcel-a");
    expect(report.identity.lpi).toBe("C03400140000102100000");
    expect(report.planning.find((field) => field.label === "Zoning")?.value).toBe("Residential 1");
    expect(report.risks.map((risk) => risk.id)).toContain("identity-not-user-reviewed");
    expect(decision.stillNeeded).toContain("Review the official identity in Sources.");
    expect(decision.timeline.map((event) => event.id)).toContain("evidence-pack-built");
  });

  it("keeps CSG and Kouga parcels as official evidence with reliance caveats", () => {
    for (const source of ["csg", "kouga"] as const) {
      const pack = build({ parcel: parcel({ source }) });
      const parcelSource = pack.sources.find((item) => item.id === "official-parcel-record");
      const erfClaim = pack.claims.find((claim) => claim.key === "erfNumber");

      expect(parcelSource).toMatchObject({ kind: "official_parcel", authorityType: "official" });
      expect(erfClaim).toMatchObject({ nature: "fact", status: "supported", confidence: "high" });
      expect(erfClaim?.confidenceReason).toMatch(/Confirm legal reliance/i);
    }
  });

  it("does not promote manual parcel identity or raw planning aliases to official facts", () => {
    const pack = build({
      parcel: parcel({
        source: "manual",
        sourceLabel: "Manual parcel",
        rawProperties: {
          SHAPE_Area: 900,
          ZONING: "Residential 1",
        },
      }),
      workspaceState: workspace({ identityStatus: "checked" }),
    });

    expect(pack.sources.find((item) => item.id === "manual-parcel-record")).toMatchObject({
      kind: "user_confirmation",
      authorityType: "user_supplied",
    });
    expect(pack.sources.some((item) => item.id === "official-parcel-record")).toBe(false);
    expect(pack.claims.find((claim) => claim.key === "erfNumber")).toMatchObject({
      nature: "observation",
      confidence: "unverified",
    });
    expect(pack.claims.find((claim) => claim.key === "zoning")).toBeUndefined();
    expect(pack.claims.find((claim) => claim.key === "identityReview")).toMatchObject({
      userConfirmed: true,
      confidence: "medium",
    });
    expect(pack.claims.find((claim) => claim.key === "identityReview")?.confidenceReason).toMatch(
      /does not convert it into an official record/i,
    );
  });

  it("does not treat selectedAddressId alone as confirmed address evidence", () => {
    const selectedOnly = address({
      userConfirmedAddress: undefined,
      selectedAddressId: "addr-1",
    });
    const pack = build({ marketAddressIntelligence: selectedOnly });
    const selectedClaim = pack.claims.find((claim) => claim.id === "claim-address-addr-1-marketAddress");

    expect(selectedClaim).toMatchObject({
      status: "not_reviewed",
      userConfirmed: false,
    });
    expect(pack.sources.find((source) => source.id === "address-addr-1")).toMatchObject({
      kind: "system_state",
      status: "not_opened",
    });
  });

  it("includes a confirmed address outside candidates once with component claims", () => {
    const confirmed = {
      ...address().userConfirmedAddress!,
      id: "addr-confirmed-outside",
      formattedAddress: "1 Confirmed Road, St Francis Bay",
      municipality: "Kouga Local Municipality",
      province: "Eastern Cape",
    };
    const pack = build({
      marketAddressIntelligence: address({
        selectedAddressId: "addr-1",
        userConfirmedAddress: confirmed,
      }),
    });
    const confirmedClaims = pack.claims.filter((claim) => claim.sourceIds.includes("address-addr-confirmed-outside"));

    expect(pack.sources.filter((source) => source.id === "address-addr-confirmed-outside")).toHaveLength(1);
    expect(confirmedClaims.map((claim) => claim.key)).toEqual(
      expect.arrayContaining(["marketAddress", "municipality", "province", "coordinates"]),
    );
    expect(confirmedClaims.every((claim) => claim.userConfirmed && claim.status === "supported")).toBe(true);
    expect(pack.claims.filter((claim) => claim.id === "claim-address-addr-confirmed-outside-marketAddress")).toHaveLength(1);
  });
});
