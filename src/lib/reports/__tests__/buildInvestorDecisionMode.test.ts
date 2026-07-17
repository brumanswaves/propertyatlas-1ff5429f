import { describe, expect, it } from "vitest";
import type { SavedMarketEvidence } from "@/features/marketEvidence/types";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import {
  buildInvestorDecisionMode,
  type InvestorReadinessStatus,
} from "@/lib/reports/buildInvestorDecisionMode";
import { buildDecisionIntelligence } from "@/lib/reports/buildDecisionIntelligence";
import { buildReportViewModel, type BuildReportInput } from "@/lib/reports/buildReportViewModel";
import {
  coerceReportDecisionMode,
  readReportDecisionMode,
  reportDecisionModeStorageKey,
  writeReportDecisionMode,
} from "@/lib/reports/reportDecisionMode";
import {
  createEmptyErfWorkspaceState,
  type ErfStrategyScenario,
} from "@/lib/workbench/erfWorkspaceState";

function parcel(overrides: Partial<NormalizedOfficialParcel> = {}): NormalizedOfficialParcel {
  return {
    id: "parcel-1",
    sourceLabel: "Kouga SG",
    erfNumber: 1021,
    portion: 0,
    lpi: "C03400140000102100000",
    parcelKey: "E108C034001400001021000000",
    municipality: "Kouga",
    province: "Eastern Cape",
    knownFields: [{ label: "Erf", value: "1021", source: "kouga" }],
    missingFields: [],
    rawProperties: { SHAPE_Area: 600, ZONING: "Residential 1" },
    coordinates: { lng: 24.8, lat: -34.1 },
    ...overrides,
  } as NormalizedOfficialParcel;
}

function scenario(
  strategy: string,
  inputs: Record<string, string>,
  overrides: Partial<ErfStrategyScenario> = {},
): ErfStrategyScenario {
  return {
    id: `${strategy}-scenario`,
    parcelId: "parcel-1",
    label: `${strategy} scenario`,
    strategy,
    inputs,
    summary: [{ label: "Summary fallback", value: "R 999" }],
    selected: true,
    savedAt: "2026-07-17T10:00:00Z",
    ...overrides,
  };
}

function evidence(overrides: Partial<SavedMarketEvidence> = {}): SavedMarketEvidence {
  return {
    id: "evidence-1",
    parcelId: "parcel-1",
    sourceUrl: "https://example.com/listing",
    sourcePortal: "Property24",
    title: "Comparable",
    askingPrice: 1_200_000,
    relationship: "same_node_comp",
    confidence: "high",
    includeInSummary: true,
    listingRole: "comparable_evidence",
    savedAt: "2026-07-17T10:00:00Z",
    updatedAt: "2026-07-17T10:00:00Z",
    ...overrides,
  };
}

function input(overrides: Partial<BuildReportInput> = {}): BuildReportInput {
  const chosenScenario = overrides.chosenScenario ?? null;
  return {
    parcel: parcel(),
    workspaceState: {
      ...createEmptyErfWorkspaceState(),
      identityStatus: "looks_correct",
      reviewedSourceIds: ["csg", "kouga"],
      marketAddressSaved: true,
      strategyScenarioCount: chosenScenario ? 1 : 0,
      chosenScenarioId: chosenScenario?.id ?? null,
    },
    savedEvidence: [],
    marketAddress: null,
    assets: [],
    chosenScenario,
    strategyScenarios: chosenScenario ? [chosenScenario] : [],
    selectedSiteDesign: null,
    now: new Date("2026-07-17T10:00:00Z"),
    ...overrides,
  };
}

function investor(overrides: Partial<BuildReportInput> = {}) {
  const report = buildReportViewModel(input(overrides));
  const decision = buildDecisionIntelligence(report);
  return buildInvestorDecisionMode({
    report,
    decision,
    savedEvidence: input(overrides).savedEvidence,
    chosenScenario: input(overrides).chosenScenario,
  });
}

function compactCurrency(value: string | undefined) {
  return String(value ?? "").replace(/\s|\u00A0/g, " ");
}

describe("report decision mode preference", () => {
  it("defaults to Standard, validates stored values and isolates parcels", () => {
    const storage = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    } as unknown as Storage;

    expect(readReportDecisionMode("parcel-a", mockStorage)).toBe("standard");
    expect(coerceReportDecisionMode("bad")).toBe("standard");
    writeReportDecisionMode("parcel-a", "investor", mockStorage);
    storage.set(reportDecisionModeStorageKey("parcel-b"), "bad");

    expect(readReportDecisionMode("parcel-a", mockStorage)).toBe("investor");
    expect(readReportDecisionMode("parcel-b", mockStorage)).toBe("standard");
  });

  it("falls back safely when browser storage throws", () => {
    const throwingStorage = {
      getItem: () => {
        throw new Error("blocked storage");
      },
      setItem: () => {
        throw new Error("blocked storage");
      },
    } as unknown as Storage;

    expect(readReportDecisionMode("parcel-a", throwingStorage)).toBe("standard");
    expect(writeReportDecisionMode("parcel-a", "investor", throwingStorage)).toBe("investor");
  });
});

describe("buildInvestorDecisionMode", () => {
  it("never fabricates missing asking or acquisition prices", () => {
    const result = investor();

    expect(result.numberRows.find((row) => row.id === "asking-price")).toMatchObject({
      value: "Not provided",
      state: "missing",
    });
    expect(JSON.stringify(result)).not.toMatch(
      /\bR\s?0\b|Strong buy|Buy this property|Sell|Undervalued|Overvalued|Guaranteed|Great investment|Recommended investment|Expected return|Verified return/i,
    );
  });

  it("uses subject listing asking price only from current-parcel evidence", () => {
    const otherParcelSubject = evidence({
      id: "other",
      parcelId: "other-parcel",
      listingRole: "subject_active_listing",
      askingPrice: 9_000_000,
    });
    const result = investor({ savedEvidence: [otherParcelSubject] });

    expect(result.numberRows.find((row) => row.id === "asking-price")?.value).toBe("Not provided");

    const currentSubject = evidence({
      id: "subject",
      listingRole: "subject_active_listing",
      askingPrice: 2_100_000,
    });
    const withSubject = investor({ savedEvidence: [currentSubject] });
    const asking = withSubject.numberRows.find((row) => row.id === "asking-price");
    expect(compactCurrency(asking?.value)).toBe("R 2 100 000");
    expect(asking).toMatchObject({ provenance: "Saved subject listing" });
  });

  it("rejects a chosen scenario from another parcel", () => {
    const result = investor({
      chosenScenario: scenario("buy_hold", { purchasePrice: "1000000" }, { parcelId: "other" }),
    });

    expect(result.chosenStrategyStatus).toContain("No parcel-matched strategy");
    expect(result.readinessStatus).toBe("Strategy assumptions incomplete");
  });

  it("prefers raw inputs and deterministic calculators over formatted summary rows", () => {
    const result = investor({
      chosenScenario: scenario("flip", {
        purchasePrice: "1000000",
        renovationBudget: "100000",
        expectedResalePrice: "1500000",
        holdingMonths: "4",
        monthlyHoldingCost: "10000",
      }),
      savedEvidence: [evidence(), evidence({ id: "e2" }), evidence({ id: "e3" })],
    });

    const profit = result.numberRows.find((row) => row.id === "projected-profit");
    expect(profit).toMatchObject({ provenance: "Deterministic calculation" });
    expect(compactCurrency(profit?.value)).toBe("R 360 000");
    expect(result.numberRows.map((row) => row.value)).not.toContain("R 999");
  });

  it("separates purchase price from acquisition and transfer costs", () => {
    const result = investor({
      chosenScenario: scenario("buy_hold", {
        purchasePrice: "1000000",
        loanAmount: "0",
        monthlyRent: "12000",
        transferDuty: "10000",
        transferCosts: "20000",
        attorneyFees: "5000",
        bondCosts: "7000",
        financeFees: "3000",
        inspectionCosts: "2000",
        otherAcquisitionCosts: "1000",
      }),
      savedEvidence: [evidence({ id: "rental", askingPrice: 1_000_000 })],
    });

    expect(
      compactCurrency(result.numberRows.find((row) => row.id === "acquisition-price")?.value),
    ).toBe("R 1 000 000");
    expect(
      compactCurrency(result.numberRows.find((row) => row.id === "acquisition-costs")?.value),
    ).toBe("R 48 000");
    expect(
      compactCurrency(result.numberRows.find((row) => row.id === "total-acquisition-cost")?.value),
    ).toBe("R 1 048 000");
    expect(
      compactCurrency(result.numberRows.find((row) => row.id === "total-cash-required")?.value),
    ).toBe("R 1 048 000");
  });

  it("preserves explicit cash purchases as zero debt instead of missing finance", () => {
    const result = investor({
      chosenScenario: scenario("buy_hold", {
        purchasePrice: "1200000",
        loanAmount: "0",
        monthlyRent: "11000",
      }),
    });

    const bond = result.numberRows.find((row) => row.id === "monthly-bond-payment");
    expect(bond).toMatchObject({ label: "Monthly bond payment", state: "available" });
    expect(compactCurrency(bond?.value)).toBe("R 0");
    expect(result.missingInputs.join(" ")).not.toMatch(/interest rate|loan term|finance terms/i);
  });

  it("uses precise STR labels and avoids fake zero cash-on-cash when cash investment is missing", () => {
    const result = investor({
      chosenScenario: scenario("str_airbnb", {
        averageDailyRate: "1800",
        occupancyPercent: "45",
      }),
    });

    expect(result.numberRows.find((row) => row.id === "average-daily-rate")).toMatchObject({
      label: "Average daily rate",
      state: "available",
    });
    expect(result.numberRows.map((row) => row.label)).not.toContain("Projected rental income");
    expect(result.numberRows.find((row) => row.id === "cash-on-cash-return")).toMatchObject({
      value: "Not calculated",
      state: "not_calculated",
    });
  });

  it.each([
    ["buy_hold", { monthlyRent: "10000" }, "purchase price"],
    ["buy_hold", { purchasePrice: "1000000" }, "monthly rental income"],
    ["flip", { renovationBudget: "100000", expectedResalePrice: "1300000" }, "purchase price"],
    ["flip", { purchasePrice: "1000000", expectedResalePrice: "1300000" }, "renovation budget"],
    ["development_sell", { landCost: "800000", expectedSaleValue: "2500000" }, "build cost"],
    ["development_sell", { landCost: "800000", buildCost: "1200000" }, "projected exit value"],
    ["development_rent", { buildCost: "1200000", expectedMonthlyRent: "18000" }, "land cost"],
    ["development_rent", { landCost: "800000", buildCost: "1200000" }, "monthly rental income"],
    ["str_airbnb", { occupancyPercent: "40" }, "average daily rate"],
    ["str_airbnb", { averageDailyRate: "1800" }, "occupancy percentage"],
    ["brrrr", { purchasePrice: "900000", monthlyRent: "12000" }, "after-repair value"],
    [
      "brrrr",
      { purchasePrice: "900000", monthlyRent: "12000", afterRepairValue: "1300000" },
      "renovation budget or all-in cost",
    ],
    ["bond", { purchasePrice: "1000000", termYears: "20" }, "interest rate"],
    ["bond", { purchasePrice: "1000000", interestRate: "11.75" }, "loan term"],
    ["land_bank", { futureValue: "900000" }, "land or acquisition price"],
    ["custom", {}, "at least one saved custom assumption"],
  ])("marks missing required %s input: %s", (kind, inputs, missingLabel) => {
    const result = investor({ chosenScenario: scenario(kind, inputs) });
    expect(result.readinessStatus).toBe("Strategy assumptions incomplete");
    expect(result.missingInputs).toContain(missingLabel);
  });

  it.each([
    ["buy_hold", { purchasePrice: "1000000", loanAmount: "0", monthlyRent: "10000" }, "net-yield"],
    [
      "flip",
      { purchasePrice: "1000000", renovationBudget: "100000", expectedResalePrice: "1300000" },
      "projected-profit",
    ],
    [
      "development_sell",
      { landCost: "800000", buildCost: "1200000", expectedSaleValue: "2500000" },
      "total-project-cost",
    ],
    [
      "development_rent",
      { landCost: "800000", buildCost: "1200000", expectedMonthlyRent: "18000" },
      "monthly-cash-flow",
    ],
    ["str_airbnb", { averageDailyRate: "1800", occupancyPercent: "40" }, "monthly-net-income"],
    [
      "brrrr",
      {
        purchasePrice: "900000",
        monthlyRent: "12000",
        afterRepairValue: "1300000",
        renovationBudget: "100000",
      },
      "cash-left-in-deal",
    ],
    [
      "bond",
      { loanAmount: "900000", interestRate: "11.75", termYears: "20" },
      "monthly-bond-payment",
    ],
    ["land_bank", { purchasePrice: "700000", futureValue: "900000" }, "projected-exit-value"],
    ["custom", { customUpside: "50000" }, "projected-profit"],
  ])("produces an exact core output for %s", (kind, inputs, rowId) => {
    const result = investor({ chosenScenario: scenario(kind, inputs) });
    expect(result.numberRows.find((row) => row.id === rowId)).toMatchObject({
      state: "available",
    });
  });

  it("does not let generic comps satisfy rental-specific support", () => {
    const result = investor({
      chosenScenario: scenario("buy_hold", {
        purchasePrice: "1000000",
        loanAmount: "0",
        monthlyRent: "10000",
      }),
      savedEvidence: [evidence(), evidence({ id: "e2" }), evidence({ id: "e3" })],
    });

    expect(result.marketEvidenceStatus).toContain("Rental support: not structurally verified");
    expect(result.missingInputs).toContain("Rental support is not structurally verified.");
    expect(result.readinessStatus).toBe("Market support insufficient");
  });

  it("counts priced exit comparables for exit strategies but not rental support", () => {
    const comps = [evidence(), evidence({ id: "e2" }), evidence({ id: "e3" })];
    const flipResult = investor({
      chosenScenario: scenario("flip", {
        purchasePrice: "1000000",
        renovationBudget: "100000",
        expectedResalePrice: "1500000",
      }),
      savedEvidence: comps,
    });
    expect(flipResult.marketEvidenceStatus).toContain("Exit-value support: 3 priced comparables");
    expect(flipResult.missingInputs).not.toContain("Add exit-value market support.");

    const strResult = investor({
      chosenScenario: scenario("str_airbnb", {
        averageDailyRate: "1800",
        occupancyPercent: "40",
      }),
      savedEvidence: comps,
    });
    expect(strResult.marketEvidenceStatus).toContain("Rental support: not structurally verified");
  });

  it("does not require irrelevant market support for a bond-only scenario", () => {
    const result = investor({
      chosenScenario: scenario("bond", {
        loanAmount: "900000",
        interestRate: "11.75",
        termYears: "20",
      }),
    });

    expect(result.marketEvidenceStatus).toContain(
      "Strategy does not require extra market support yet",
    );
    expect(result.missingInputs).not.toContain("Save comparable market evidence.");
    expect(result.readinessStatus).not.toBe("Market support insufficient");
  });

  it("fails unsupported legacy scenarios honestly", () => {
    const result = investor({
      chosenScenario: scenario(
        "legacy_strategy",
        {},
        { summary: [{ label: "Saved old row", value: "R 1" }] },
      ),
    });

    expect(result.readinessStatus).toBe("Strategy assumptions incomplete");
    expect(result.missingInputs[0]).toContain("Unsupported or legacy strategy type");
    expect(result.numberRows.some((row) => row.provenance === "Saved scenario summary")).toBe(true);
  });

  it("applies deterministic readiness priority", () => {
    const contradiction = investor({
      marketAddress: {
        selectedAddressId: "addr-1",
        candidates: [],
        userConfirmedAddress: {
          id: "addr-1",
          formattedAddress: "1 Other Road, Cape Town",
          municipality: "City of Cape Town",
          source: "user_entered",
          confidence: "high",
          reason: "user",
          createdAt: "2026-07-17T10:00:00Z",
        },
      },
    });
    expect(contradiction.readinessStatus).toBe("Material contradiction requires review");

    expect(investor().readinessStatus).toBe("Strategy assumptions incomplete");

    const marketWeak = investor({
      chosenScenario: scenario("buy_hold", { purchasePrice: "1000000", monthlyRent: "10000" }),
    });
    expect(marketWeak.readinessStatus).toBe("Market support insufficient");
  });

  it("routes investor next actions to existing Workbench sections", () => {
    const result = investor();
    const tabs = [result.primaryAction, ...result.nextActions].map((action) => action.tab);
    expect(
      tabs.every(
        (tab) =>
          !tab ||
          [
            "research",
            "reports",
            "listings",
            "calculators",
            "site-potential",
            "stoep-report",
          ].includes(tab),
      ),
    ).toBe(true);
  });
});
