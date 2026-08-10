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

function realisticStrategyDefaults(defaultPrice = 1_500_000): Record<string, string> {
  const price = defaultPrice > 0 ? String(defaultPrice) : "";
  return {
    purchasePrice: price,
    transferDuty: "",
    transferCosts: "",
    bondCosts: "",
    attorneyFees: "",
    inspectionCosts: "",
    agentCommission: "",
    otherAcquisitionCosts: "",
    depositPercent: "10",
    deposit: "",
    loanAmount: "",
    interestRate: "11.75",
    termYears: "20",
    interestOnlyMonths: "",
    monthlyBondPayment: "",
    financeFees: "",
    monthlyRent: "",
    otherIncome: "",
    vacancyPercent: "5",
    monthlyRates: "",
    monthlyLevies: "",
    insurance: "",
    utilitiesPaidByOwner: "",
    security: "",
    gardenPool: "",
    propertyManagementPercent: "8",
    maintenanceReserve: "",
    otherMonthlyCosts: "",
    renovationBudget: "",
    contingencyPercent: "10",
    holdingMonths: "6",
    monthlyHoldingCost: "",
    expectedResalePrice: "",
    sellingCosts: "",
    landCost: price,
    buildCost: "",
    professionalFees: "",
    municipalPlanningFees: "",
    developmentDurationMonths: "12",
    exitSellingCosts: "",
    expectedSaleValue: "",
    expectedMonthlyRent: "",
    operatingExpenses: "",
    averageDailyRate: "",
    occupancyPercent: "50",
    nightsPerMonth: "30.4",
    platformFeePercent: "15",
    cleaningRevenue: "",
    cleaningCost: "",
    utilities: "",
    internet: "",
    linenLaundry: "",
    strManagementPercent: "12",
    furnishingSetupCost: "",
    allInCost: "",
    afterRepairValue: "",
    refinanceLtv: "75",
    refinanceFees: "",
    monthlyExpenses: "",
    monthlyDebtService: "",
    targetDscr: "1.2",
    futureValue: "",
    annualHoldingYears: "5",
    customUpside: "",
    customNotes: "",
  };
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

  it("does not expose one signed-in account's report mode to another", () => {
    const storage = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    };

    writeReportDecisionMode("parcel-a", "investor", mockStorage, "user-a");

    expect(readReportDecisionMode("parcel-a", mockStorage, "user-b")).toBe("standard");
    expect(readReportDecisionMode("parcel-a", mockStorage, "user-a")).toBe("investor");
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
    expect(result.readinessStatus).toBe("Material contradiction requires review");
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

  it("does not infer acquisition totals or financing from sparse legacy purchase inputs", () => {
    const result = investor({
      chosenScenario: scenario("buy_hold", {
        purchasePrice: "1000000",
        monthlyRent: "12000",
      }),
    });

    expect(result.numberRows.find((row) => row.id === "acquisition-costs")).toMatchObject({
      value: "Not provided",
      state: "missing",
    });
    expect(result.numberRows.find((row) => row.id === "total-acquisition-cost")).toMatchObject({
      value: "Not calculated",
      state: "not_calculated",
    });
    expect(result.numberRows.find((row) => row.id === "total-cash-required")).toMatchObject({
      value: "Not calculated",
      state: "not_calculated",
    });
    expect(result.numberRows.find((row) => row.id === "monthly-bond-payment")).toMatchObject({
      value: "Not calculated",
      state: "not_calculated",
    });
    expect(result.numberRows.map((row) => row.value)).not.toContain("R 100 000");
  });

  it("allows explicitly entered zero acquisition costs to participate in cash totals", () => {
    const result = investor({
      chosenScenario: scenario("buy_hold", {
        purchasePrice: "1000000",
        loanAmount: "0",
        monthlyRent: "12000",
        transferDuty: "0",
        transferCosts: "0",
      }),
    });

    expect(
      compactCurrency(result.numberRows.find((row) => row.id === "acquisition-costs")?.value),
    ).toBe("R 0");
    expect(
      compactCurrency(result.numberRows.find((row) => row.id === "total-cash-required")?.value),
    ).toBe("R 1 000 000");
  });

  it("calculates total cash required only when valid financing inputs are saved", () => {
    const result = investor({
      chosenScenario: scenario("buy_hold", {
        purchasePrice: "1000000",
        depositPercent: "20",
        interestRate: "12",
        termYears: "20",
        monthlyRent: "12000",
        transferDuty: "10000",
      }),
    });

    expect(
      compactCurrency(result.numberRows.find((row) => row.id === "monthly-bond-payment")?.value),
    ).toBe("R 8 809");
    expect(
      compactCurrency(result.numberRows.find((row) => row.id === "total-cash-required")?.value),
    ).toBe("R 210 000");
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
        refinanceLtv: "75",
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

  it("supports loan-only bond scenarios without requiring purchase price", () => {
    const result = investor({
      chosenScenario: scenario("bond", {
        loanAmount: "900000",
        interestRate: "11.75",
        termYears: "20",
      }),
    });

    expect(result.readinessStatus).not.toBe("Strategy assumptions incomplete");
    expect(result.calculationStatus).toBe(
      "Core deterministic calculation outputs are available from saved raw inputs.",
    );
    expect(result.missingInputs).not.toContain("purchase price");
    expect(
      compactCurrency(result.numberRows.find((row) => row.id === "monthly-bond-payment")?.value),
    ).toBe("R 9 753");
    expect(
      compactCurrency(result.numberRows.find((row) => row.id === "annual-debt-service")?.value),
    ).toBe("R 117 040");
    expect(
      compactCurrency(result.numberRows.find((row) => row.id === "total-interest")?.value),
    ).toBe("R 1 440 807");
  });

  it("keeps development rent debt on land cost when stale purchase price defaults exist", () => {
    const result = investor({
      chosenScenario: scenario("development_rent", {
        ...realisticStrategyDefaults(1_500_000),
        landCost: "900000",
        buildCost: "1200000",
        expectedMonthlyRent: "22000",
        depositPercent: "20",
      }),
    });

    expect(compactCurrency(result.numberRows.find((row) => row.id === "land-cost")?.value)).toBe(
      "R 900 000",
    );
    expect(result.numberRows.find((row) => row.id === "acquisition-price")).toBeUndefined();
    expect(
      compactCurrency(result.numberRows.find((row) => row.id === "monthly-bond-payment")?.value),
    ).toBe("R 7 803");
    expect(
      compactCurrency(result.numberRows.find((row) => row.id === "monthly-cash-flow")?.value),
    ).toBe("R 13 097");
  });

  it("keeps land-bank cash and debt on the selected acquisition basis", () => {
    const result = investor({
      chosenScenario: scenario("land_bank", {
        ...realisticStrategyDefaults(0),
        purchasePrice: "700000",
        landCost: "650000",
        transferCosts: "10000",
        depositPercent: "20",
        interestRate: "11.75",
        termYears: "20",
      }),
    });

    expect(result.numberRows.find((row) => row.id === "acquisition-price")).toBeUndefined();
    expect(compactCurrency(result.numberRows.find((row) => row.id === "land-cost")?.value)).toBe(
      "R 650 000",
    );
    expect(
      compactCurrency(result.numberRows.find((row) => row.id === "monthly-bond-payment")?.value),
    ).toBe("R 5 635");
    expect(
      compactCurrency(result.numberRows.find((row) => row.id === "total-cash-required")?.value),
    ).toBe("R 140 000");
  });

  it("does not create hidden STR debt from shared acquisition defaults", () => {
    const defaultsOnlyDebt = investor({
      chosenScenario: scenario("str_airbnb", {
        ...realisticStrategyDefaults(1_500_000),
        averageDailyRate: "1800",
        occupancyPercent: "45",
      }),
    });

    expect(
      defaultsOnlyDebt.numberRows.find((row) => row.id === "monthly-bond-payment"),
    ).toMatchObject({
      state: "not_calculated",
      value: "Not calculated",
    });

    const explicitLoan = investor({
      chosenScenario: scenario("str_airbnb", {
        ...realisticStrategyDefaults(1_500_000),
        averageDailyRate: "1800",
        occupancyPercent: "45",
        loanAmount: "500000",
      }),
    });

    expect(explicitLoan.numberRows.find((row) => row.id === "monthly-bond-payment")).toMatchObject({
      state: "available",
    });
  });

  it("requires a saved deposit percentage before deriving bond debt from purchase price", () => {
    const purchaseOnly = investor({
      chosenScenario: scenario("bond", {
        purchasePrice: "1000000",
        interestRate: "11.75",
        termYears: "20",
      }),
    });
    expect(purchaseOnly.readinessStatus).toBe("Strategy assumptions incomplete");
    expect(purchaseOnly.missingInputs).toContain(
      "loan amount or purchase price with deposit percentage",
    );
    expect(purchaseOnly.calculationStatus).toBe(
      "Strategy calculations are incomplete until required inputs are saved.",
    );

    const withDeposit = investor({
      chosenScenario: scenario("bond", {
        purchasePrice: "1000000",
        depositPercent: "20",
        interestRate: "11.75",
        termYears: "20",
      }),
    });
    expect(withDeposit.missingInputs).not.toContain(
      "loan amount or purchase price with deposit percentage",
    );
    expect(withDeposit.calculationStatus).toBe(
      "Core deterministic calculation outputs are available from saved raw inputs.",
    );
    expect(
      compactCurrency(
        withDeposit.numberRows.find((row) => row.id === "monthly-bond-payment")?.value,
      ),
    ).toBe("R 8 670");
  });

  it("uses land cost only for development when realistic defaults also contain purchase price", () => {
    const result = investor({
      chosenScenario: scenario("development_sell", {
        ...realisticStrategyDefaults(1_500_000),
        buildCost: "2200000",
        expectedSaleValue: "4300000",
      }),
      savedEvidence: [evidence(), evidence({ id: "e2" }), evidence({ id: "e3" })],
    });

    expect(result.numberRows.filter((row) => row.id === "land-cost")).toHaveLength(1);
    expect(result.numberRows.find((row) => row.id === "acquisition-price")).toBeUndefined();
    expect(result.numberRows.find((row) => row.id === "total-cash-required")).toBeUndefined();
    expect(compactCurrency(result.numberRows.find((row) => row.id === "land-cost")?.value)).toBe(
      "R 1 500 000",
    );
  });

  it("gates BRRRR refinance outputs until renovation and refinance LTV are complete", () => {
    const missingRehab = investor({
      chosenScenario: scenario("brrrr", {
        ...realisticStrategyDefaults(900_000),
        monthlyRent: "12000",
        afterRepairValue: "1300000",
      }),
    });
    expect(missingRehab.missingInputs).toContain("renovation budget or all-in cost");
    expect(missingRehab.numberRows.find((row) => row.id === "cash-left-in-deal")).toBeUndefined();

    const missingRefi = investor({
      chosenScenario: scenario("brrrr", {
        ...realisticStrategyDefaults(900_000),
        monthlyRent: "12000",
        afterRepairValue: "1300000",
        renovationBudget: "100000",
        refinanceLtv: "",
      }),
    });
    expect(missingRefi.missingInputs).toContain("refinance LTV");
    expect(missingRefi.numberRows.find((row) => row.id === "cash-left-in-deal")).toBeUndefined();

    const zeroRefi = investor({
      chosenScenario: scenario("brrrr", {
        ...realisticStrategyDefaults(900_000),
        monthlyRent: "12000",
        afterRepairValue: "1300000",
        renovationBudget: "100000",
        refinanceLtv: "0",
      }),
    });
    expect(zeroRefi.missingInputs).toContain("refinance LTV");
    expect(zeroRefi.numberRows.find((row) => row.id === "cash-left-in-deal")).toBeUndefined();
  });

  it("marks BRRRR cash-on-cash not calculated when cash left in deal is zero", () => {
    const result = investor({
      chosenScenario: scenario("brrrr", {
        ...realisticStrategyDefaults(900_000),
        monthlyRent: "12000",
        afterRepairValue: "1300000",
        renovationBudget: "75000",
        refinanceLtv: "75",
      }),
    });

    expect(
      compactCurrency(result.numberRows.find((row) => row.id === "cash-left-in-deal")?.value),
    ).toBe("R 0");
    expect(result.numberRows.find((row) => row.id === "cash-on-cash-return")).toMatchObject({
      value: "Not calculated",
      state: "not_calculated",
    });
  });

  it("allows complete BRRRR scenarios to render refinance outputs", () => {
    const result = investor({
      chosenScenario: scenario("brrrr", {
        ...realisticStrategyDefaults(900_000),
        monthlyRent: "12000",
        afterRepairValue: "1200000",
        renovationBudget: "250000",
        refinanceLtv: "70",
      }),
    });

    expect(result.missingInputs).not.toContain("refinance LTV");
    expect(result.numberRows.find((row) => row.id === "cash-left-in-deal")).toMatchObject({
      state: "available",
    });
  });

  it.each([
    [
      "note-only custom",
      scenario("custom", {
        ...realisticStrategyDefaults(1_500_000),
        customNotes: "Hold until zoning evidence improves.",
      }),
      "Assumptions are saved, but no deterministic financial calculation is available for this scenario.",
    ],
    [
      "custom upside",
      scenario("custom", {
        ...realisticStrategyDefaults(1_500_000),
        customUpside: "50000",
      }),
      "Assumptions are saved, but no deterministic financial calculation is available for this scenario.",
    ],
    [
      "price-only land bank",
      scenario("land_bank", {
        ...realisticStrategyDefaults(0),
        purchasePrice: "700000",
      }),
      "Assumptions are saved, but no deterministic financial calculation is available for this scenario.",
    ],
    [
      "land bank with holding-cost calculation",
      scenario("land_bank", {
        ...realisticStrategyDefaults(0),
        purchasePrice: "700000",
        monthlyHoldingCost: "1500",
        annualHoldingYears: "5",
      }),
      "Core deterministic calculation outputs are available from saved raw inputs.",
    ],
    [
      "loan-only bond",
      scenario("bond", {
        loanAmount: "900000",
        interestRate: "11.75",
        termYears: "20",
      }),
      "Core deterministic calculation outputs are available from saved raw inputs.",
    ],
    [
      "complete flip",
      scenario("flip", {
        purchasePrice: "1000000",
        renovationBudget: "100000",
        expectedResalePrice: "1500000",
      }),
      "Core deterministic calculation outputs are available from saved raw inputs.",
    ],
    [
      "unsupported legacy",
      scenario("old_strategy", {
        purchasePrice: "1000000",
      }),
      "This legacy scenario must be reviewed and resaved before calculations are available.",
    ],
  ])("reports calculation status for %s", (_label, chosenScenario, expectedStatus) => {
    expect(investor({ chosenScenario }).calculationStatus).toBe(expectedStatus);
  });

  it("ignores shared Strategy Lab defaults for custom scenarios", () => {
    const defaultsOnly = investor({
      chosenScenario: scenario("custom", realisticStrategyDefaults(1_500_000)),
    });
    expect(defaultsOnly.readinessStatus).toBe("Strategy assumptions incomplete");
    expect(defaultsOnly.missingInputs).toContain("at least one saved custom assumption");
    expect(defaultsOnly.numberRows.find((row) => row.id === "projected-profit")).toBeUndefined();

    const noteOnly = investor({
      chosenScenario: scenario("custom", {
        ...realisticStrategyDefaults(1_500_000),
        customNotes: "Wait for updated zoning evidence.",
      }),
    });
    expect(noteOnly.missingInputs).not.toContain("at least one saved custom assumption");
    expect(noteOnly.numberRows.find((row) => row.id === "projected-profit")).toBeUndefined();

    const financial = investor({
      chosenScenario: scenario("custom", {
        ...realisticStrategyDefaults(1_500_000),
        customUpside: "85000",
      }),
    });
    expect(
      compactCurrency(financial.numberRows.find((row) => row.id === "projected-profit")?.value),
    ).toBe("R 85 000");
  });

  it("accepts one land-bank acquisition basis without duplication", () => {
    const purchaseOnly = investor({
      chosenScenario: scenario("land_bank", {
        ...realisticStrategyDefaults(0),
        purchasePrice: "700000",
      }),
    });
    expect(purchaseOnly.readinessStatus).not.toBe("Strategy assumptions incomplete");
    expect(
      compactCurrency(purchaseOnly.numberRows.find((row) => row.id === "acquisition-price")?.value),
    ).toBe("R 700 000");
    expect(purchaseOnly.numberRows.find((row) => row.id === "land-cost")).toBeUndefined();

    const landOnly = investor({
      chosenScenario: scenario("land_bank", {
        ...realisticStrategyDefaults(0),
        landCost: "650000",
      }),
    });
    expect(landOnly.readinessStatus).not.toBe("Strategy assumptions incomplete");
    expect(compactCurrency(landOnly.numberRows.find((row) => row.id === "land-cost")?.value)).toBe(
      "R 650 000",
    );
    expect(landOnly.numberRows.find((row) => row.id === "acquisition-price")).toBeUndefined();

    const both = investor({
      chosenScenario: scenario("land_bank", {
        ...realisticStrategyDefaults(0),
        purchasePrice: "700000",
        landCost: "650000",
      }),
    });
    expect(both.numberRows.filter((row) => row.id === "land-cost")).toHaveLength(1);
    expect(both.numberRows.find((row) => row.id === "acquisition-price")).toBeUndefined();

    const neither = investor({
      chosenScenario: scenario("land_bank", realisticStrategyDefaults(0)),
    });
    expect(neither.readinessStatus).toBe("Strategy assumptions incomplete");
    expect(neither.missingInputs).toContain("land or acquisition price");
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
