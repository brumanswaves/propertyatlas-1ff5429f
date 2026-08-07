import { describe, expect, it } from "vitest";

import {
  calculateAcquisition,
  calculateBond,
  calculateBrrrr,
  calculateBuildCost,
  calculateBuyHold,
  calculateDevelopment,
  calculateDevelopmentCashRequired,
  calculateDevelopmentSensitivity,
  calculateDevelopmentToRent,
  calculateDevelopmentToSell,
  calculateFlip,
  calculateMaximumOffer,
  calculatePricePerM2,
  calculateResidualLandValue,
  calculateScenarioComparison,
  calculateShortTermRental,
} from "../calculators";

describe("residential investment calculators", () => {
  it("calculates acquisition cash needed and loan amount", () => {
    const result = calculateAcquisition({
      purchasePrice: 2_000_000,
      depositPercent: 10,
      transferDuty: 60_000,
      conveyancerFees: 30_000,
      bondRegistrationFees: 25_000,
      initiationFees: 6_037,
      inspectionAllowance: 8_000,
      renovationBudget: 150_000,
      furnitureBudget: 40_000,
      cashBuffer: 50_000,
    });

    expect(result.loanAmount).toBe(1_800_000);
    expect(result.loanToValue).toBeCloseTo(0.9);
    expect(result.totalCashRequired).toBe(569_037);
    expect(result.costBasisBeforeFinancing).toBe(2_319_037);
  });

  it("calculates buy-and-hold rental returns", () => {
    const result = calculateBuyHold({
      purchasePrice: 2_000_000,
      totalCashInvested: 500_000,
      monthlyRent: 18_000,
      otherIncome: 0,
      vacancyPercent: 5,
      monthlyRates: 1_500,
      monthlyLevies: 1_000,
      insurance: 600,
      utilitiesPaidByOwner: 0,
      capitalExpenditureReserve: 0,
      maintenancePercent: 5,
      managementPercent: 8,
      otherMonthlyCosts: 500,
      monthlyBondPayment: 15_000,
      appreciationPercent: 5,
      holdingPeriodYears: 5,
      sellingCostPercent: 6,
      loanAmount: 1_500_000,
    });

    expect(result.monthlyNoi).toBe(11_160);
    expect(result.cashFlowAfterDebt).toBe(-3_840);
    expect(result.grossYield).toBeCloseTo(0.108);
    expect(result.breakEvenRent).toBe(20_940);
    expect(result.capRate).toBeGreaterThan(0.06);
    expect(result.dscr).toBeCloseTo(0.744);
    expect(result.totalProfitOverHolding).toBeGreaterThan(0);
    expect(result.simpleAnnualizedReturn).toBeGreaterThan(0);
  });

  it("calculates bond payment and DSCR", () => {
    const result = calculateBond({
      loanAmount: 1_800_000,
      interestRate: 12,
      termYears: 20,
      extraMonthlyPayment: 1_000,
      monthlyNoi: 18_000,
      monthlyRent: 25_000,
    });

    expect(result.monthlyBondPayment).toBeGreaterThan(19_000);
    expect(result.annualDebtService).toBeGreaterThan(240_000);
    expect(result.dscr).toBeGreaterThan(0.8);
    expect(result.breakEvenOccupancy).toBeLessThanOrEqual(1);
  });

  it("calculates flip profit and target prices", () => {
    const result = calculateFlip({
      purchasePrice: 1_500_000,
      acquisitionCosts: 120_000,
      renovationBudget: 300_000,
      contingencyPercent: 10,
      holdingMonths: 6,
      monthlyHoldingCost: 12_000,
      expectedResalePrice: 2_400_000,
      agentCommissionPercent: 5,
      sellingCosts: 30_000,
      targetProfit: 250_000,
      targetRoiPercent: 20,
      delayMonths: 2,
      resaleSensitivityPercent: 5,
    });

    expect(result.totalProjectCost).toBe(2_022_000);
    expect(result.netSaleProceeds).toBe(2_250_000);
    expect(result.profit).toBe(228_000);
    expect(result.maximumPurchasePriceForTargetProfit).toBe(1_323_600);
    expect(result.seventyPercentRuleOffer).toBe(1_380_000);
    expect(result.delaySensitivity).toBe(24_000);
    expect(result.resaleDownsideProfit).toBe(108_000);
    expect(result.annualizedRoi).toBeCloseTo(0.2255, 3);
  });

  it("calculates BRRRR refinance outputs", () => {
    const result = calculateBrrrr({
      purchasePrice: 1_400_000,
      renovationBudget: 250_000,
      allInCost: 1_650_000,
      afterRepairValue: 2_200_000,
      refinanceLtv: 75,
      refinanceFees: 35_000,
      monthlyRent: 22_000,
      monthlyExpenses: 7_000,
      monthlyDebtService: 14_000,
      targetDscr: 1.2,
    });

    expect(result.refinanceLoanAmount).toBe(1_650_000);
    expect(result.cashReturned).toBe(1_615_000);
    expect(result.cashLeftInDeal).toBe(35_000);
    expect(result.dscr).toBeCloseTo(1.071, 2);
    expect(result.equityCreated).toBe(550_000);
    expect(result.rentNeededForTargetDscr).toBe(23_800);
  });

  it("calculates land plus build development metrics", () => {
    const result = calculateDevelopment({
      landPrice: 1_000_000,
      buildableSqm: 250,
      buildCostPerSqm: 14_000,
      professionalFeesPercent: 12,
      contingencyPercent: 10,
      municipalServiceCosts: 120_000,
      financeHoldingCosts: 180_000,
      expectedGrossValue: 5_600_000,
    });

    expect(result.hardCost).toBe(3_500_000);
    expect(result.softCost).toBe(420_000);
    expect(result.totalDevelopmentCost).toBe(5_570_000);
    expect(result.profit).toBe(30_000);
  });

  it("calculates development-to-sell with duration and monthly holding cost", () => {
    const result = calculateDevelopmentToSell({
      landCost: 1_000_000,
      buildCost: 3_500_000,
      professionalFees: 420_000,
      municipalPlanningFees: 120_000,
      contingencyPercent: 10,
      developmentDurationMonths: 10,
      monthlyHoldingCost: 18_000,
      exitSellingCosts: 150_000,
      expectedSaleValue: 5_900_000,
      acquisitionCosts: 0,
      buildAreaM2: 250,
      cashInvested: 1_000_000,
    });

    expect(result.contingencyAmount).toBe(350_000);
    expect(result.totalHoldingCost).toBe(180_000);
    expect(result.totalProjectCost).toBe(5_720_000);
    expect(result.netProfit).toBe(180_000);
    expect(result.margin).toBeCloseTo(0.0305, 3);
    expect(result.returnOnCost).toBeCloseTo(0.0315, 3);
    expect(result.returnOnInvestedCash).toBeCloseTo(0.18);
    expect(result.breakEvenSalePrice).toBe(5_720_000);
    expect(result.breakEvenSalePricePerM2).toBe(22_880);
    expect(result.profitPerM2).toBe(720);
    expect(result.costStack.buildCost).toBe(3_500_000);
  });

  it("calculates build cost from area and rate without destroying the direct-cost override", () => {
    const calculated = calculateBuildCost({
      directBuildCost: 3_000_000,
      buildAreaM2: 250,
      buildRatePerM2: 14_000,
      useCalculatedBuildCost: true,
    });
    const direct = calculateBuildCost({
      directBuildCost: 3_000_000,
      buildAreaM2: 250,
      buildRatePerM2: 14_000,
      useCalculatedBuildCost: false,
    });

    expect(calculated.selectedBuildCost).toBe(3_500_000);
    expect(calculated.directBuildCost).toBe(3_000_000);
    expect(calculated.method).toBe("calculated");
    expect(calculated.equation).toContain("250 m²");
    expect(direct.selectedBuildCost).toBe(3_000_000);
    expect(direct.buildCostPerM2).toBe(12_000);
  });

  it("calculates maximum offer without using a generic 70 percent rule", () => {
    const result = calculateMaximumOffer({
      expectedSaleValue: 5_900_000,
      sellingCosts: 150_000,
      buildCosts: 3_500_000,
      professionalFees: 420_000,
      municipalPlanningFees: 120_000,
      holdingFinanceCosts: 180_000,
      acquisitionCostsExcludingPurchase: 90_000,
      contingency: 350_000,
      requiredProfit: 500_000,
      targetReturnOnCostPercent: 12,
      targetMarginOnRevenuePercent: 0,
    });

    expect(result.netExpectedSaleProceeds).toBe(5_750_000);
    expect(result.fixedCostsBeforeLand).toBe(4_660_000);
    expect(result.fixedProjectCostBeforeLand).toBe(4_810_000);
    expect(result.requiredProfit).toBe(632_143);
    expect(result.maximumPurchasePrice).toBe(457_857);
    expect(result.missingAssumptions).toEqual([]);

    const pluggedBack = calculateDevelopmentToSell({
      landCost: result.maximumPurchasePrice,
      buildCost: 3_500_000,
      professionalFees: 420_000,
      municipalPlanningFees: 120_000,
      contingencyPercent: 10,
      developmentDurationMonths: 10,
      monthlyHoldingCost: 18_000,
      exitSellingCosts: 150_000,
      expectedSaleValue: 5_900_000,
      acquisitionCosts: 90_000,
    });
    expect(pluggedBack.returnOnCost).toBeCloseTo(0.12, 4);
  });

  it("calculates development cash required from development fields only", () => {
    const cashRequired = calculateDevelopmentCashRequired({
      landCost: 900_000,
      acquisitionCostsExcludingPurchase: 75_000,
      professionalFees: 220_000,
      municipalPlanningFees: 80_000,
      contingency: 300_000,
      holdingFinanceCosts: 150_000,
    });

    const result = calculateDevelopmentToSell({
      landCost: 900_000,
      buildCost: 3_000_000,
      professionalFees: 220_000,
      municipalPlanningFees: 80_000,
      contingencyPercent: 10,
      developmentDurationMonths: 10,
      monthlyHoldingCost: 15_000,
      exitSellingCosts: 120_000,
      expectedSaleValue: 5_200_000,
      acquisitionCosts: 75_000,
      cashInvested: cashRequired,
    });

    expect(cashRequired).toBe(1_725_000);
    expect(result.returnOnInvestedCash).toBeCloseTo(355_000 / 1_725_000, 4);
  });

  it("calculates residual land value from GDV less development deductions", () => {
    const result = calculateResidualLandValue({
      expectedGdv: 6_200_000,
      sellingCosts: 180_000,
      requiredDeveloperProfit: 650_000,
      constructionCost: 3_500_000,
      professionalFees: 420_000,
      municipalPlanningCosts: 120_000,
      contingency: 350_000,
      financeHoldingCosts: 180_000,
      otherDevelopmentCosts: 40_000,
    });

    expect(result.deductions).toBe(5_440_000);
    expect(result.residualLandValue).toBe(760_000);
    expect(result.isPositive).toBe(true);
  });

  it("calculates price-per-square-metre metrics with honest zero fallbacks", () => {
    expect(
      calculatePricePerM2({
        landPurchasePrice: 1_175_000,
        erfAreaM2: 618.7,
        buildCost: 3_500_000,
        buildAreaM2: 309.35,
        completedValue: 5_900_000,
        completedAreaM2: 309.35,
      }),
    ).toEqual({
      landPricePerErfM2: 1_899,
      buildCostPerBuildM2: 11_314,
      completedValuePerM2: 19_072,
    });

    expect(
      calculatePricePerM2({
        landPurchasePrice: 1_175_000,
        erfAreaM2: 0,
        buildCost: 0,
        buildAreaM2: 0,
        completedValue: 0,
        completedAreaM2: 0,
      }).landPricePerErfM2,
    ).toBe(0);
  });

  it("calculates deterministic base, downside and upside development sensitivity", () => {
    const result = calculateDevelopmentSensitivity({
      landCost: 1_000_000,
      buildCost: 3_000_000,
      professionalFees: 300_000,
      municipalPlanningFees: 100_000,
      contingencyPercent: 10,
      developmentDurationMonths: 12,
      monthlyHoldingCost: 20_000,
      exitSellingCosts: 150_000,
      expectedSaleValue: 5_500_000,
    });

    expect(result.base.netProfit).toBe(410_000);
    expect(result.downside.netProfit).toBeLessThan(result.base.netProfit);
    expect(result.upside.netProfit).toBeGreaterThan(result.base.netProfit);
    expect(result.assumptions.downside).toContain("Build cost +15%");
  });

  it("calculates development-to-rent yield and cash flow", () => {
    const result = calculateDevelopmentToRent({
      landCost: 1_000_000,
      buildCost: 3_000_000,
      professionalFees: 360_000,
      municipalPlanningFees: 90_000,
      contingencyPercent: 8,
      developmentDurationMonths: 9,
      monthlyHoldingCost: 15_000,
      expectedMonthlyRent: 42_000,
      vacancyPercent: 5,
      operatingExpenses: 9_000,
      bondPayment: 22_000,
    });

    expect(result.totalProjectCost).toBe(4_825_000);
    expect(result.totalHoldingCost).toBe(135_000);
    expect(result.monthlyNetOperatingIncome).toBe(30_900);
    expect(result.monthlyCashFlow).toBe(8_900);
    expect(result.grossYield).toBeCloseTo(0.1045, 3);
    expect(result.netYield).toBeCloseTo(0.0768, 3);
    expect(result.breakEvenRent).toBe(31_000);
  });

  it("calculates STR / Airbnb revenue, net income and break-even occupancy", () => {
    const result = calculateShortTermRental({
      averageDailyRate: 2_400,
      occupancyPercent: 55,
      nightsPerMonth: 30,
      platformFeePercent: 15,
      cleaningRevenue: 3_000,
      cleaningCost: 4_000,
      utilities: 3_500,
      internet: 900,
      linenLaundry: 1_500,
      managementPercent: 12,
      maintenanceReserve: 2_500,
      furnishingSetupCost: 180_000,
      bondPayment: 18_000,
      cashInvested: 280_000,
    });

    expect(result.bookedNights).toBe(16.5);
    expect(result.grossAccommodationRevenue).toBe(39_600);
    expect(result.platformFees).toBe(6_390);
    expect(result.monthlyOperatingCost).toBe(23_902);
    expect(result.monthlyNetIncome).toBe(18_698);
    expect(result.monthlyCashFlow).toBe(698);
    expect(result.breakEvenOccupancy).toBeGreaterThan(0.5);
    expect(result.cashOnCashReturn).toBeCloseTo(0.03, 2);
  });

  it("handles missing STR and development assumptions without divide-by-zero results", () => {
    const str = calculateShortTermRental({
      averageDailyRate: 0,
      occupancyPercent: 0,
      platformFeePercent: 15,
      cleaningCost: 0,
      utilities: 0,
      internet: 0,
      linenLaundry: 0,
      managementPercent: 10,
      maintenanceReserve: 0,
    });
    const development = calculateDevelopmentToRent({
      landCost: 0,
      buildCost: 0,
      professionalFees: 0,
      municipalPlanningFees: 0,
      contingencyPercent: 10,
      developmentDurationMonths: 0,
      monthlyHoldingCost: 0,
      expectedMonthlyRent: 0,
      vacancyPercent: 5,
      operatingExpenses: 0,
    });

    expect(str.breakEvenOccupancy).toBe(0);
    expect(str.cashOnCashReturn).toBe(0);
    expect(str.missingAssumptions).toEqual(["average daily rate", "occupancy percentage"]);
    expect(development.grossYield).toBe(0);
    expect(development.netYield).toBe(0);
    expect(development.missingAssumptions).toContain("land cost");
  });

  it("calculates red/yellow/green scenario comparison", () => {
    const result = calculateScenarioComparison([
      {
        label: "Low",
        resalePrice: 1_700_000,
        rent: 12_000,
        renovationOrBuildCost: 400_000,
        interestRate: 13,
        purchasePrice: 1_500_000,
        monthlyExpenses: 6_000,
        loanAmount: 1_200_000,
        termYears: 20,
        cashInvested: 400_000,
      },
      {
        label: "High",
        resalePrice: 2_400_000,
        rent: 25_000,
        renovationOrBuildCost: 250_000,
        interestRate: 10,
        purchasePrice: 1_500_000,
        monthlyExpenses: 5_000,
        loanAmount: 1_000_000,
        termYears: 20,
        cashInvested: 400_000,
      },
    ]);

    expect(result[0].status).toBe("red");
    expect(result[1].status).toBe("green");
    expect(result[1].roi).toBeGreaterThan(1);
  });
});
