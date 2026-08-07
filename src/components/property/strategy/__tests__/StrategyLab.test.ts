import { describe, expect, it } from "vitest";

import {
  calculateAcquisition,
  calculateBond,
  calculateBrrrr,
  calculateBuildCost,
  calculateBuyHold,
  calculateDevelopmentCashRequired,
  calculateDevelopmentSensitivity,
  calculateDevelopmentToRent,
  calculateDevelopmentToSell,
  calculateFlip,
  calculateMaximumOffer,
  calculateResidualLandValue,
  calculateShortTermRental,
} from "@/lib/research/calculators";
import { buildDealSnapshot, deriveStrategyBuildAreaM2 } from "../StrategyLab";

function baseSnapshotInputs() {
  const acquisition = calculateAcquisition({
    purchasePrice: 1_500_000,
    depositPercent: 10,
    transferDuty: 50_000,
    conveyancerFees: 25_000,
    bondRegistrationFees: 20_000,
    initiationFees: 6_000,
    inspectionAllowance: 5_000,
    renovationBudget: 0,
    furnitureBudget: 0,
    cashBuffer: 30_000,
  });
  const rental = calculateBuyHold({
    purchasePrice: 1_500_000,
    totalCashInvested: acquisition.totalCashRequired,
    monthlyRent: 18_000,
    vacancyPercent: 5,
    monthlyRates: 1_200,
    monthlyLevies: 0,
    insurance: 900,
    maintenancePercent: 2,
    managementPercent: 8,
    otherMonthlyCosts: 1_000,
    monthlyBondPayment: 12_000,
    loanAmount: acquisition.loanAmount,
  });
  const flip = calculateFlip({
    purchasePrice: 1_500_000,
    acquisitionCosts: 100_000,
    renovationBudget: 350_000,
    contingencyPercent: 10,
    holdingMonths: 6,
    monthlyHoldingCost: 15_000,
    expectedResalePrice: 2_550_000,
    agentCommissionPercent: 6,
    sellingCosts: 35_000,
    targetProfit: 250_000,
    targetRoiPercent: 20,
  });
  const buildCostModel = calculateBuildCost({
    directBuildCost: 0,
    buildAreaM2: 300,
    buildRatePerM2: 12_000,
  });
  const developmentCashRequired = calculateDevelopmentCashRequired({
    landCost: 1_000_000,
    acquisitionCostsExcludingPurchase: 100_000,
    professionalFees: 350_000,
    municipalPlanningFees: 80_000,
    contingency: 360_000,
    holdingFinanceCosts: 180_000,
  });
  const developmentSell = calculateDevelopmentToSell({
    landCost: 1_000_000,
    buildCost: buildCostModel.selectedBuildCost,
    professionalFees: 350_000,
    municipalPlanningFees: 80_000,
    contingencyPercent: 10,
    developmentDurationMonths: 12,
    monthlyHoldingCost: 15_000,
    exitSellingCosts: 150_000,
    expectedSaleValue: 5_800_000,
    acquisitionCosts: 100_000,
    cashInvested: developmentCashRequired,
  });
  const developmentRent = calculateDevelopmentToRent({
    landCost: 1_000_000,
    buildCost: buildCostModel.selectedBuildCost,
    professionalFees: 350_000,
    municipalPlanningFees: 80_000,
    contingencyPercent: 10,
    developmentDurationMonths: 12,
    monthlyHoldingCost: 15_000,
    expectedMonthlyRent: 42_000,
    vacancyPercent: 5,
    operatingExpenses: 9_000,
    bondPayment: 14_000,
  });
  const maximumOffer = calculateMaximumOffer({
    expectedSaleValue: 5_800_000,
    sellingCosts: 150_000,
    buildCosts: buildCostModel.selectedBuildCost,
    professionalFees: 350_000,
    municipalPlanningFees: 80_000,
    holdingFinanceCosts: 180_000,
    acquisitionCostsExcludingPurchase: 100_000,
    contingency: 360_000,
    requiredProfit: 0,
    targetReturnOnCostPercent: 15,
    targetMarginOnRevenuePercent: 0,
  });
  const residualLandValue = calculateResidualLandValue({
    expectedGdv: 5_800_000,
    sellingCosts: 150_000,
    requiredDeveloperProfit: maximumOffer.requiredProfit,
    constructionCost: buildCostModel.selectedBuildCost,
    professionalFees: 350_000,
    municipalPlanningCosts: 80_000,
    contingency: 360_000,
    financeHoldingCosts: 180_000,
    otherDevelopmentCosts: 100_000,
  });
  const developmentSensitivity = calculateDevelopmentSensitivity({
    landCost: 1_000_000,
    buildCost: buildCostModel.selectedBuildCost,
    professionalFees: 350_000,
    municipalPlanningFees: 80_000,
    contingencyPercent: 10,
    developmentDurationMonths: 12,
    monthlyHoldingCost: 15_000,
    exitSellingCosts: 150_000,
    expectedSaleValue: 5_800_000,
    acquisitionCosts: 100_000,
    cashInvested: developmentCashRequired,
  });
  return {
    rental,
    flip,
    developmentSell,
    developmentRent,
    str: calculateShortTermRental({
      averageDailyRate: 2_000,
      occupancyPercent: 50,
      platformFeePercent: 15,
      cleaningCost: 3_000,
      utilities: 3_000,
      internet: 800,
      linenLaundry: 1_200,
      managementPercent: 12,
      maintenanceReserve: 2_000,
      bondPayment: 12_000,
      cashInvested: acquisition.totalCashRequired,
    }),
    brrrr: calculateBrrrr({
      purchasePrice: 1_500_000,
      renovationBudget: 300_000,
      allInCost: 1_850_000,
      afterRepairValue: 2_400_000,
      refinanceLtv: 75,
      refinanceFees: 40_000,
      monthlyRent: 20_000,
      monthlyExpenses: 6_000,
      monthlyDebtService: 12_500,
      targetDscr: 1.2,
    }),
    bond: calculateBond({
      loanAmount: acquisition.loanAmount,
      interestRate: 11.75,
      termYears: 20,
      extraMonthlyPayment: 0,
      monthlyNoi: rental.monthlyNoi,
      monthlyRent: 18_000,
    }),
    landBankHoldingCost: 120_000,
    acquisition,
    buildCostModel,
    maximumOffer,
    residualLandValue,
    developmentSensitivity,
    developmentCashRequired,
    biggestUncertainty: "build cost",
  };
}

describe("Strategy Lab deal snapshot", () => {
  it("keeps coverage footprint separate from total floor/build area", () => {
    const result = deriveStrategyBuildAreaM2({
      explicitBuildAreaM2: 0,
      explicitFloorAreaM2: 0,
      coverageFootprintM2: 309.35,
      numberOfFloors: 2,
    });

    expect(result.coverageFootprintM2).toBe(309.35);
    expect(result.derivedTotalFloorAreaM2).toBe(618.7);
    expect(result.buildAreaM2).toBe(618.7);
    expect(result.method).toBe("coverage_footprint_x_floors");
  });

  it("shows rental outputs for Buy & Hold instead of development max-offer outputs", () => {
    const snapshot = buildDealSnapshot({ ...baseSnapshotInputs(), active: "buy_hold" });
    const labels = [...snapshot.items, ...snapshot.emphasis].map(([label]) => label);

    expect(snapshot.eyebrow).toBe("Rental hold");
    expect(labels).toContain("Monthly cash flow");
    expect(labels).toContain("Net yield");
    expect(labels).not.toContain("Maximum justified offer");
    expect(labels).not.toContain("Residual land value");
  });

  it("shows development outputs only for Development to sell", () => {
    const snapshot = buildDealSnapshot({ ...baseSnapshotInputs(), active: "development_sell" });
    const labels = [...snapshot.items, ...snapshot.emphasis].map(([label]) => label);

    expect(snapshot.eyebrow).toBe("Development to sell");
    expect(labels).toContain("Expected GDV");
    expect(labels).toContain("Maximum justified offer");
    expect(labels).toContain("Residual land value");
    expect(labels).toContain("Cash required");
  });
});
