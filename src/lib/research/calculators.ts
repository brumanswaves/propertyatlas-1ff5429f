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
  vacancyPercent: number;
  monthlyRates: number;
  monthlyLevies: number;
  insurance: number;
  maintenancePercent: number;
  managementPercent: number;
  otherMonthlyCosts: number;
  monthlyBondPayment: number;
}

export function calculateBuyHold(input: BuyHoldInputs) {
  const effectiveRent = input.monthlyRent * (1 - percent(input.vacancyPercent));
  const maintenance = input.monthlyRent * percent(input.maintenancePercent);
  const management = input.monthlyRent * percent(input.managementPercent);
  const monthlyExpenses =
    input.monthlyRates +
    input.monthlyLevies +
    input.insurance +
    maintenance +
    management +
    input.otherMonthlyCosts;
  const monthlyNoi = effectiveRent - monthlyExpenses;
  const annualNoi = monthlyNoi * 12;
  const cashFlowAfterDebt = monthlyNoi - input.monthlyBondPayment;
  return {
    grossYield: input.purchasePrice > 0 ? (input.monthlyRent * 12) / input.purchasePrice : 0,
    netYield: input.purchasePrice > 0 ? annualNoi / input.purchasePrice : 0,
    monthlyNoi: roundMoney(monthlyNoi),
    annualNoi: roundMoney(annualNoi),
    cashFlowAfterDebt: roundMoney(cashFlowAfterDebt),
    cashOnCashReturn:
      input.totalCashInvested > 0 ? (cashFlowAfterDebt * 12) / input.totalCashInvested : 0,
    capRate: input.purchasePrice > 0 ? annualNoi / input.purchasePrice : 0,
    breakEvenRent: roundMoney(monthlyExpenses + input.monthlyBondPayment),
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
  return {
    totalProjectCost: roundMoney(totalProjectCost),
    netSaleProceeds: roundMoney(netSaleProceeds),
    profit: roundMoney(profit),
    roi,
    annualizedRoi: years > 0 ? roi / years : 0,
    requiredResalePriceForTargetProfit: roundMoney(
      totalProjectCost + input.sellingCosts + input.targetProfit,
    ),
    maximumPurchasePriceForTargetProfit: roundMoney(
      netSaleProceeds -
        input.acquisitionCosts -
        input.renovationBudget -
        contingency -
        holdingCost -
        input.targetProfit,
    ),
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
}

export function calculateBrrrr(input: BrrrrInputs) {
  const allInCost = input.allInCost || input.purchasePrice + input.renovationBudget;
  const refinanceLoanAmount = input.afterRepairValue * percent(input.refinanceLtv);
  const cashReturned = Math.max(0, refinanceLoanAmount - input.refinanceFees);
  const cashLeftInDeal = Math.max(0, allInCost - cashReturned);
  const monthlyNoi = input.monthlyRent - input.monthlyExpenses;
  const cashFlow = monthlyNoi - input.monthlyDebtService;
  return {
    refinanceLoanAmount: roundMoney(refinanceLoanAmount),
    cashReturned: roundMoney(cashReturned),
    cashLeftInDeal: roundMoney(cashLeftInDeal),
    cashOnCashReturn: cashLeftInDeal > 0 ? (cashFlow * 12) / cashLeftInDeal : 0,
    equityCreated: roundMoney(input.afterRepairValue - refinanceLoanAmount),
    dscr: input.monthlyDebtService > 0 ? monthlyNoi / input.monthlyDebtService : 0,
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
}

export function calculateScenarioComparison(cases: ScenarioInput[]) {
  return cases.map((item) => {
    const debt = calculateBondPayment(item.loanAmount, item.interestRate, item.termYears);
    const monthlyNoi = item.rent - item.monthlyExpenses;
    const profit = item.resalePrice - item.purchasePrice - item.renovationOrBuildCost;
    const cashFlow = monthlyNoi - debt;
    const dscr = debt > 0 ? monthlyNoi / debt : 0;
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
      status,
    };
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
