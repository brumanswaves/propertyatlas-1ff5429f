import { describe, expect, it } from "vitest";

import {
  calculateAcquisition,
  calculateBond,
  calculateBrrrr,
  calculateBuyHold,
  calculateDevelopment,
  calculateFlip,
  calculateScenarioComparison,
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
