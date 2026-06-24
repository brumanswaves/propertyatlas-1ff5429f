export function roundMoney(value: number): number {
  return Math.round(Number.isFinite(value) ? value : 0);
}

export function percent(value: number): number {
  return Number.isFinite(value) ? value / 100 : 0;
}

export function calculateBondPayment(
  loanAmount: number,
  annualInterestRate: number,
  termYears: number,
): number {
  if (loanAmount <= 0 || termYears <= 0) return 0;
  const months = termYears * 12;
  const monthlyRate = percent(annualInterestRate) / 12;
  if (monthlyRate <= 0) return loanAmount / months;
  return (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}

export interface AcquisitionInputs {
  purchasePrice: number;
  depositPercent: number;
  transferDuty: number;
  conveyancerFees: number;
  bondRegistrationFees: number;
  initiationFees: number;
  inspectionAllowance: number;
  renovationBudget: number;
  furnitureBudget: number;
  cashBuffer: number;
}

export function calculateAcquisition(input: AcquisitionInputs) {
  const deposit = input.purchasePrice * percent(input.depositPercent);
  const loanAmount = Math.max(0, input.purchasePrice - deposit);
  const cashCosts =
    deposit +
    input.transferDuty +
    input.conveyancerFees +
    input.bondRegistrationFees +
    input.initiationFees +
    input.inspectionAllowance +
    input.renovationBudget +
    input.furnitureBudget +
    input.cashBuffer;
  const acquisitionCost =
    input.purchasePrice +
    input.transferDuty +
    input.conveyancerFees +
    input.bondRegistrationFees +
    input.initiationFees +
    input.inspectionAllowance;
  return {
    deposit: roundMoney(deposit),
    loanAmount: roundMoney(loanAmount),
    loanToValue: input.purchasePrice > 0 ? loanAmount / input.purchasePrice : 0,
    totalCashRequired: roundMoney(cashCosts),
    totalAcquisitionCost: roundMoney(acquisitionCost),
    costBasisBeforeFinancing: roundMoney(
      acquisitionCost + input.renovationBudget + input.furnitureBudget,
    ),
  };
}

export interface BuyHoldInputs {
  purchasePrice: number;
  totalCashInvested: number;
  monthlyRent: number;
  otherIncome?: number;
  vacancyPercent: number;
  monthlyRates: number;
  monthlyLevies: number;
  insurance: number;
  utilitiesPaidByOwner?: number;
  capitalExpenditureReserve?: number;
  maintenancePercent: number;
  managementPercent: number;
  otherMonthlyCosts: number;
  monthlyBondPayment: number;
  appreciationPercent?: number;
  rentGrowthPercent?: number;
  expenseGrowthPercent?: number;
  holdingPeriodYears?: number;
  sellingCostPercent?: number;
  loanAmount?: number;
  closingCosts?: number;
  downPayment?: number;
}

export function calculateBuyHold(input: BuyHoldInputs) {
  const grossMonthlyIncome = input.monthlyRent + (input.otherIncome ?? 0);
  const effectiveRent = grossMonthlyIncome * (1 - percent(input.vacancyPercent));
  const maintenance = input.monthlyRent * percent(input.maintenancePercent);
  const management = grossMonthlyIncome * percent(input.managementPercent);
  const monthlyExpenses =
    input.monthlyRates +
    input.monthlyLevies +
    input.insurance +
    (input.utilitiesPaidByOwner ?? 0) +
    (input.capitalExpenditureReserve ?? 0) +
    maintenance +
    management +
    input.otherMonthlyCosts;
  const monthlyNoi = effectiveRent - monthlyExpenses;
  const annualNoi = monthlyNoi * 12;
  const cashFlowAfterDebt = monthlyNoi - input.monthlyBondPayment;
  const holdingYears = Math.max(0, input.holdingPeriodYears ?? 0);
  const estimatedFutureValue =
    input.purchasePrice * Math.pow(1 + percent(input.appreciationPercent ?? 0), holdingYears);
  const estimatedSaleProceeds = estimatedFutureValue * (1 - percent(input.sellingCostPercent ?? 0));
  const currentEquity = Math.max(0, input.purchasePrice - (input.loanAmount ?? 0));
  const equityBuilt = Math.max(0, estimatedSaleProceeds - (input.loanAmount ?? 0) - currentEquity);
  const totalCashFlow = cashFlowAfterDebt * 12 * holdingYears;
  const totalProfitOverHolding =
    estimatedSaleProceeds > 0
      ? estimatedSaleProceeds - input.purchasePrice + totalCashFlow
      : totalCashFlow;
  const annualizedReturn =
    holdingYears > 0 && input.totalCashInvested > 0
      ? totalProfitOverHolding / input.totalCashInvested / holdingYears
      : 0;
  return {
    grossYield: input.purchasePrice > 0 ? (grossMonthlyIncome * 12) / input.purchasePrice : 0,
    netYield: input.purchasePrice > 0 ? annualNoi / input.purchasePrice : 0,
    effectiveMonthlyIncome: roundMoney(effectiveRent),
    monthlyOperatingExpenses: roundMoney(monthlyExpenses),
    monthlyNoi: roundMoney(monthlyNoi),
    annualNoi: roundMoney(annualNoi),
    cashFlowAfterDebt: roundMoney(cashFlowAfterDebt),
    annualCashFlowAfterDebt: roundMoney(cashFlowAfterDebt * 12),
    cashOnCashReturn:
      input.totalCashInvested > 0 ? (cashFlowAfterDebt * 12) / input.totalCashInvested : 0,
    capRate: input.purchasePrice > 0 ? annualNoi / input.purchasePrice : 0,
    breakEvenRent: roundMoney(monthlyExpenses + input.monthlyBondPayment),
    breakEvenOccupancy:
      grossMonthlyIncome > 0
        ? Math.min(1, (monthlyExpenses + input.monthlyBondPayment) / grossMonthlyIncome)
        : 0,
    dscr: input.monthlyBondPayment > 0 ? (monthlyNoi * 12) / (input.monthlyBondPayment * 12) : 0,
    estimatedFutureValue: roundMoney(estimatedFutureValue),
    estimatedSaleProceeds: roundMoney(estimatedSaleProceeds),
    equityBuilt: roundMoney(equityBuilt),
    totalProfitOverHolding: roundMoney(totalProfitOverHolding),
    simpleAnnualizedReturn: annualizedReturn,
    onePercentRuleRatio: input.purchasePrice > 0 ? input.monthlyRent / input.purchasePrice : 0,
    fiftyPercentRuleNoiEstimate: roundMoney(grossMonthlyIncome * 0.5),
  };
}

export interface BondInputs {
  loanAmount: number;
  interestRate: number;
  termYears: number;
  extraMonthlyPayment: number;
  monthlyNoi: number;
  monthlyRent: number;
}

export function calculateBond(input: BondInputs) {
  const payment = calculateBondPayment(input.loanAmount, input.interestRate, input.termYears);
  const totalMonthlyPayment = payment + input.extraMonthlyPayment;
  const months = input.termYears * 12;
  const totalPaid = totalMonthlyPayment * months;
  const totalInterest = Math.max(0, totalPaid - input.loanAmount);
  const annualDebtService = totalMonthlyPayment * 12;
  return {
    monthlyBondPayment: roundMoney(payment),
    monthlyPaymentWithExtra: roundMoney(totalMonthlyPayment),
    annualDebtService: roundMoney(annualDebtService),
    totalInterest: roundMoney(totalInterest),
    payoffEstimateYears:
      input.extraMonthlyPayment > 0
        ? Math.max(1, Math.round(input.termYears * 0.85))
        : input.termYears,
    dscr: annualDebtService > 0 ? (input.monthlyNoi * 12) / annualDebtService : 0,
    breakEvenOccupancy:
      input.monthlyRent > 0 ? Math.min(1, totalMonthlyPayment / input.monthlyRent) : 0,
  };
}

export interface FlipInputs {
  purchasePrice: number;
  acquisitionCosts: number;
  renovationBudget: number;
  contingencyPercent: number;
  holdingMonths: number;
  monthlyHoldingCost: number;
  expectedResalePrice: number;
  agentCommissionPercent: number;
  sellingCosts: number;
  targetProfit: number;
  targetRoiPercent?: number;
  delayMonths?: number;
  resaleSensitivityPercent?: number;
}

export function calculateFlip(input: FlipInputs) {
  const contingency = input.renovationBudget * percent(input.contingencyPercent);
  const holdingCost = input.holdingMonths * input.monthlyHoldingCost;
  const totalProjectCost =
    input.purchasePrice +
    input.acquisitionCosts +
    input.renovationBudget +
    contingency +
    holdingCost;
  const commission = input.expectedResalePrice * percent(input.agentCommissionPercent);
  const netSaleProceeds = input.expectedResalePrice - commission - input.sellingCosts;
  const profit = netSaleProceeds - totalProjectCost;
  const roi = totalProjectCost > 0 ? profit / totalProjectCost : 0;
  const years = input.holdingMonths > 0 ? input.holdingMonths / 12 : 1;
  const targetRoiProfit = totalProjectCost * percent(input.targetRoiPercent ?? 0);
  const requiredTargetProfit = Math.max(input.targetProfit, targetRoiProfit);
  const seventyPercentRuleOffer = input.expectedResalePrice * 0.7 - input.renovationBudget;
  const delaySensitivity = (input.delayMonths ?? 0) * input.monthlyHoldingCost;
  const resaleSensitivity =
    input.expectedResalePrice * percent(input.resaleSensitivityPercent ?? 0);
  return {
    totalProjectCost: roundMoney(totalProjectCost),
    netSaleProceeds: roundMoney(netSaleProceeds),
    profit: roundMoney(profit),
    roi,
    annualizedRoi: years > 0 ? roi / years : 0,
    requiredResalePriceForTargetProfit: roundMoney(totalProjectCost + requiredTargetProfit),
    maximumPurchasePriceForTargetProfit: roundMoney(
      netSaleProceeds -
        input.acquisitionCosts -
        input.renovationBudget -
        contingency -
        holdingCost -
        requiredTargetProfit,
    ),
    seventyPercentRuleOffer: roundMoney(seventyPercentRuleOffer),
    contingencyCost: roundMoney(contingency),
    delaySensitivity: roundMoney(delaySensitivity),
    resaleDownsideProfit: roundMoney(profit - resaleSensitivity),
    resaleUpsideProfit: roundMoney(profit + resaleSensitivity),
  };
}

export interface BrrrrInputs {
  purchasePrice: number;
  renovationBudget: number;
  allInCost: number;
  afterRepairValue: number;
  refinanceLtv: number;
  refinanceFees: number;
  monthlyRent: number;
  monthlyExpenses: number;
  monthlyDebtService: number;
  targetDscr?: number;
}

export function calculateBrrrr(input: BrrrrInputs) {
  const allInCost = input.allInCost || input.purchasePrice + input.renovationBudget;
  const refinanceLoanAmount = input.afterRepairValue * percent(input.refinanceLtv);
  const cashReturned = Math.max(0, refinanceLoanAmount - input.refinanceFees);
  const cashLeftInDeal = Math.max(0, allInCost - cashReturned);
  const monthlyNoi = input.monthlyRent - input.monthlyExpenses;
  const cashFlow = monthlyNoi - input.monthlyDebtService;
  const targetDscr = input.targetDscr ?? 1.2;
  return {
    refinanceLoanAmount: roundMoney(refinanceLoanAmount),
    cashReturned: roundMoney(cashReturned),
    cashLeftInDeal: roundMoney(cashLeftInDeal),
    cashOnCashReturn: cashLeftInDeal > 0 ? (cashFlow * 12) / cashLeftInDeal : 0,
    equityCreated: roundMoney(input.afterRepairValue - refinanceLoanAmount),
    dscr: input.monthlyDebtService > 0 ? monthlyNoi / input.monthlyDebtService : 0,
    rentNeededForTargetDscr: roundMoney(
      input.monthlyExpenses + input.monthlyDebtService * targetDscr,
    ),
  };
}

export interface DevelopmentInputs {
  landPrice: number;
  buildableSqm: number;
  buildCostPerSqm: number;
  professionalFeesPercent: number;
  contingencyPercent: number;
  municipalServiceCosts: number;
  financeHoldingCosts: number;
  expectedGrossValue: number;
}

export function calculateDevelopment(input: DevelopmentInputs) {
  const hardCost = input.buildableSqm * input.buildCostPerSqm;
  const softCost = hardCost * percent(input.professionalFeesPercent);
  const contingency = hardCost * percent(input.contingencyPercent);
  const totalDevelopmentCost =
    input.landPrice +
    hardCost +
    softCost +
    contingency +
    input.municipalServiceCosts +
    input.financeHoldingCosts;
  const profit = input.expectedGrossValue - totalDevelopmentCost;
  return {
    hardCost: roundMoney(hardCost),
    softCost: roundMoney(softCost),
    totalDevelopmentCost: roundMoney(totalDevelopmentCost),
    profit: roundMoney(profit),
    margin: input.expectedGrossValue > 0 ? profit / input.expectedGrossValue : 0,
    returnOnCost: totalDevelopmentCost > 0 ? profit / totalDevelopmentCost : 0,
    breakEvenSalePrice: roundMoney(totalDevelopmentCost),
    pricePerSqm: input.buildableSqm > 0 ? roundMoney(totalDevelopmentCost / input.buildableSqm) : 0,
  };
}

export interface ScenarioInput {
  label: string;
  resalePrice: number;
  rent: number;
  renovationOrBuildCost: number;
  interestRate: number;
  purchasePrice: number;
  monthlyExpenses: number;
  loanAmount: number;
  termYears: number;
  cashInvested?: number;
}

export function calculateScenarioComparison(cases: ScenarioInput[]) {
  return cases.map((item) => {
    const debt = calculateBondPayment(item.loanAmount, item.interestRate, item.termYears);
    const monthlyNoi = item.rent - item.monthlyExpenses;
    const profit = item.resalePrice - item.purchasePrice - item.renovationOrBuildCost;
    const cashFlow = monthlyNoi - debt;
    const dscr = debt > 0 ? monthlyNoi / debt : 0;
    const roi = item.cashInvested && item.cashInvested > 0 ? profit / item.cashInvested : 0;
    const status =
      profit > 0 && cashFlow >= 0 && dscr >= 1.2
        ? "green"
        : profit >= 0 && dscr >= 1
          ? "yellow"
          : "red";
    return {
      label: item.label,
      profit: roundMoney(profit),
      monthlyCashFlow: roundMoney(cashFlow),
      dscr,
      roi,
      status,
    };
  });
}

export interface RentalAnalysisInputs extends BuyHoldInputs {
  loanAmount: number;
  downPayment: number;
  closingCosts: number;
}

export function calculateRentalAnalysis(input: RentalAnalysisInputs) {
  const totalCashInvested = input.totalCashInvested || input.downPayment + input.closingCosts;
  return calculateBuyHold({
    ...input,
    totalCashInvested,
    loanAmount: input.loanAmount,
  });
}

export function formatZAR(value: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(roundMoney(value));
}

export function formatPct(value: number): string {
  return `${(Number.isFinite(value) ? value : 0).toFixed(1)}%`;
}

export function yieldCalc(input: {
  purchasePrice: number;
  transferCosts: number;
  renovationBudget: number;
  monthlyRent: number;
  monthlyRates: number;
  monthlyLevies: number;
  monthlyInsurance: number;
}) {
  const basis = input.purchasePrice + input.transferCosts + input.renovationBudget;
  const grossYearly = input.monthlyRent * 12;
  const netYearly =
    (input.monthlyRent - input.monthlyRates - input.monthlyLevies - input.monthlyInsurance) * 12;

  return {
    grossYieldPct: basis > 0 ? (grossYearly / basis) * 100 : 0,
    netYieldPct: basis > 0 ? (netYearly / basis) * 100 : 0,
    grossYearly: roundMoney(grossYearly),
    netYearly: roundMoney(netYearly),
  };
}

export function flipCalc(input: {
  purchasePrice: number;
  transferCosts: number;
  renovationBudget: number;
  sellingPrice: number;
  agentCommissionPct: number;
  holdingMonths: number;
  monthlyHoldingCost: number;
}) {
  const commission = input.sellingPrice * percent(input.agentCommissionPct);
  const holdingCost = input.holdingMonths * input.monthlyHoldingCost;
  const totalCost =
    input.purchasePrice + input.transferCosts + input.renovationBudget + commission + holdingCost;
  const profit = input.sellingPrice - totalCost;

  return {
    commission: roundMoney(commission),
    totalCost: roundMoney(totalCost),
    profit: roundMoney(profit),
    roiPct: totalCost > 0 ? (profit / totalCost) * 100 : 0,
  };
}

export function devCalc(input: {
  landPrice: number;
  buildCostPerSqm: number;
  buildableSqm: number;
  softCostPct: number;
  gdv: number;
  agentCommissionPct: number;
}) {
  const hardCost = input.buildCostPerSqm * input.buildableSqm;
  const softCost = hardCost * percent(input.softCostPct);
  const commission = input.gdv * percent(input.agentCommissionPct);
  const totalCost = input.landPrice + hardCost + softCost + commission;
  const profit = input.gdv - totalCost;

  return {
    hardCost: roundMoney(hardCost),
    totalCost: roundMoney(totalCost),
    profit: roundMoney(profit),
    marginPct: input.gdv > 0 ? (profit / input.gdv) * 100 : 0,
  };
}

export function holdingCostCalc(input: {
  monthlyRates: number;
  monthlyLevies: number;
  monthlyInsurance: number;
  otherMonthly: number;
}) {
  const monthly =
    input.monthlyRates + input.monthlyLevies + input.monthlyInsurance + input.otherMonthly;

  return {
    monthly: roundMoney(monthly),
    yearly: roundMoney(monthly * 12),
  };
}
