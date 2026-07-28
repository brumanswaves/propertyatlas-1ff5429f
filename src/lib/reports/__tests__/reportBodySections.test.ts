import { describe, expect, it } from "vitest";
import { buildMarketSectionModel } from "../marketSection";
import { buildStrategySectionModel } from "../strategySection";
import { buildEvidenceAppendixRows } from "../evidenceAppendix";
import type { MarketView } from "../buildReportViewModel";
import type { SavedMarketEvidence } from "@/features/marketEvidence/types";
import type { PropertyEvidencePack } from "@/lib/evidence/propertyEvidenceTypes";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";

function listing(overrides: Partial<SavedMarketEvidence> = {}): SavedMarketEvidence {
  return {
    id: "listing-1",
    parcelId: "parcel:erf-1570",
    sourceUrl: "https://example.com/listing",
    sourcePortal: "Property24",
    title: "24 Padrone Crescent",
    askingPrice: 2_500_000,
    relationship: "target_asset",
    confidence: "high",
    includeInSummary: true,
    savedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as SavedMarketEvidence;
}

function marketView(overrides: Partial<MarketView> = {}): MarketView {
  return {
    evidenceCount: 1,
    includedCount: 1,
    subjectListing: listing(),
    strongest: [],
    summary: {
      totalEvidence: 1,
      includedEvidence: 1,
      relationshipMix: {},
      confidenceMix: {},
      hasUsablePriceData: true,
    },
    canShowIndicativeValue: false,
    askingCount: 1,
    soldCount: 0,
    latestUpdatedAt: null,
    ...overrides,
  };
}

describe("market section model", () => {
  it("labels an asking price as asking evidence and never as a sold price or valuation", () => {
    const model = buildMarketSectionModel({
      market: marketView(),
      pack: null,
      officialAreaM2: 619,
    });
    const asking = model.figures.find((f) => f.id === "asking-price");
    expect(asking?.value).toMatch(/^R\s2.500.000$/);
    expect(asking?.kind).toBe("evidence_input");
    expect(asking?.caveat).toMatch(/not a sold price/i);
    expect(JSON.stringify(model.figures)).not.toMatch(/sold price of|formal valuation of/i);
  });

  it("shows price per m² only with a named denominator", () => {
    const withArea = buildMarketSectionModel({
      market: marketView(),
      pack: null,
      officialAreaM2: 619,
    });
    expect(withArea.figures.find((f) => f.id === "price-per-m2")?.provenance).toContain(
      "619 m² (official cadastral area)",
    );

    const withoutArea = buildMarketSectionModel({
      market: marketView(),
      pack: null,
      officialAreaM2: null,
    });
    expect(withoutArea.figures.find((f) => f.id === "price-per-m2")).toBeUndefined();
    expect(withoutArea.gaps.join(" ")).toMatch(/denominator/i);
  });

  it("never displays zero or negative money and reports honest empty states", () => {
    const model = buildMarketSectionModel({
      market: marketView({
        subjectListing: listing({ askingPrice: 0 }),
        evidenceCount: 0,
        askingCount: 0,
      }),
      pack: null,
      officialAreaM2: 619,
    });
    expect(model.figures.some((f) => f.value.includes("R 0"))).toBe(false);
    expect(model.strength).toBe("none");
    expect(model.nextStep).toMatch(/Market tab/i);
  });

  it("suppresses an indicative range unless the evidence model allows it", () => {
    const suppressed = buildMarketSectionModel({
      market: marketView({
        summary: { ...marketView().summary, priceRange: { min: 1_000_000, max: 3_000_000 } },
      }),
      pack: null,
      officialAreaM2: null,
    });
    expect(suppressed.figures.find((f) => f.id === "indicative-range")).toBeUndefined();

    const allowed = buildMarketSectionModel({
      market: marketView({
        canShowIndicativeValue: true,
        includedCount: 4,
        summary: { ...marketView().summary, priceRange: { min: 1_000_000, max: 3_000_000 } },
      }),
      pack: null,
      officialAreaM2: null,
    });
    const range = allowed.figures.find((f) => f.id === "indicative-range");
    expect(range?.value).toMatch(/^R\s1.000.000 – R\s3.000.000$/);
    expect(range?.caveat).toMatch(/not a valuation range/i);
  });
});

describe("strategy section model", () => {
  const scenario = {
    id: "s1",
    parcelId: "parcel:erf-1570",
    label: "Buy, renovate and hold",
    strategy: "hold",
    inputs: { purchasePrice: "1850000", renovationCost: "400000", holdYears: "5" },
    summary: [
      { label: "Maximum justified purchase price", value: "R 1,900,000" },
      { label: "Net yield", value: "8.2%" },
    ],
    selected: true,
    savedAt: new Date().toISOString(),
  };

  it("projects the saved scenario verbatim with figure-type labels", () => {
    const model = buildStrategySectionModel({ chosen: scenario, scenarioCount: 2 });
    expect(model.strategyName).toBe("Buy, renovate and hold");
    expect(model.acquisition?.value).toMatch(/^R\s1.850.000$/);
    expect(model.acquisition?.kind).toBe("user_assumption");
    expect(model.maximumJustifiedPrice?.value).toBe("R 1,900,000");
    expect(model.maximumJustifiedPrice?.kind).toBe("calculation");
    expect(model.headline.map((f) => f.value)).toContain("8.2%");
    expect(model.assumptions.map((f) => f.label)).toContain("Renovation cost");
  });

  it("returns an honest empty state with no chosen scenario", () => {
    const model = buildStrategySectionModel({ chosen: null, scenarioCount: 0 });
    expect(model.hasScenario).toBe(false);
    expect(model.emptyMessage).toMatch(/Strategy Lab/);
    expect(model.headline).toEqual([]);
  });
});

describe("evidence appendix", () => {
  function asset(overrides: Partial<ErfAsset> = {}): ErfAsset {
    return {
      id: "asset-1",
      parcel_id: "parcel:erf-1570",
      asset_category: "sg_diagram",
      original_file_name: "SG-5473-1988.tif",
      mime_type: "image/tiff",
      size_bytes: 1024,
      created_at: new Date().toISOString(),
      metadata: {},
      ...overrides,
    } as unknown as ErfAsset;
  }

  it("reports parent-plan context and wrong-property states honestly", () => {
    const rows = buildEvidenceAppendixRows({
      assets: [
        asset({
          id: "a-parent",
          metadata: {
            extractionStatus: "ready",
            identityMatchStatus: "parent_lineage_match",
            documentLineage: { generalPlanReference: "GP12252", parentErfNumber: "1496" },
          } as never,
        }),
        asset({
          id: "a-wrong",
          asset_category: "paid_report",
          original_file_name: "lightstone-sample.pdf",
          mime_type: "application/pdf",
          metadata: { extractionStatus: "ready", identityMatchStatus: "mismatch" } as never,
        }),
      ],
      pack: null,
    });

    const parent = rows.find((row) => row.id === "asset-a-parent");
    expect(parent?.readState).toBe("parent_plan_context");
    expect(parent?.scope).toBe("parent_plan_context");
    expect(parent?.detail).toContain("GP12252");
    expect(parent?.detail).toContain("parent Erf 1496");

    const wrong = rows.find((row) => row.id === "asset-a-wrong");
    expect(wrong?.readState).toBe("wrong_property");
    expect(wrong?.detail).toMatch(/different property/i);
  });

  it("marks matched parcel-specific documents as searchable", () => {
    const pack = {
      sources: [
        {
          id: "src-1",
          assetId: "asset-1",
          label: "Lightstone report",
          kind: "paid_report",
          authorityType: "paid_provider",
          status: "reviewed",
          locators: [{ pageNumber: 3 }],
          asset: { pageCount: 12 },
        },
      ],
      claims: [],
    } as unknown as PropertyEvidencePack;

    const rows = buildEvidenceAppendixRows({
      assets: [
        asset({
          asset_category: "paid_report",
          mime_type: "application/pdf",
          metadata: { extractionStatus: "ready", identityMatchStatus: "matched" } as never,
        }),
      ],
      pack,
    });
    expect(rows[0].readState).toBe("searchable_matched");
    expect(rows[0].scope).toBe("paid_provider");
    expect(rows[0].pageLocator).toBe("Page 3 of 12");
  });
});
