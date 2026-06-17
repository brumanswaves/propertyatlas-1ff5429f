// Pure-client property-investment calculators. Outputs labelled as estimates only.

export interface YieldInputs {
  purchasePrice: number;
  transferCosts: number;
  renovationBudget: number;
  monthlyRent: number;
  monthlyRates: number;
  monthlyLevies: number;
  monthlyInsurance: number;
}

export interface YieldOutputs {
  totalInvested: number;
  grossYearly: number;
  netYearly: number;
  grossYieldPct: number;
  netYieldPct: number;
}

export function yieldCalc(i: YieldInputs): YieldOutputs {
  const totalInvested = Math.max(1, i.purchasePrice + i.transferCosts + i.renovationBudget);
  const grossYearly = i.monthlyRent * 12;
  const opex = (i.monthlyRates + i.monthlyLevies + i.monthlyInsurance) * 12;
  const netYearly = grossYearly - opex;
  return {
    totalInvested,
    grossYearly,
    netYearly,
    grossYieldPct: (grossYearly / totalInvested) * 100,
    netYieldPct: (netYearly / totalInvested) * 100,
  };
}

export interface FlipInputs {
  purchasePrice: number;
  transferCosts: number;
  renovationBudget: number;
  sellingPrice: number;
  agentCommissionPct: number;
  holdingMonths: number;
  monthlyHoldingCost: number;
}

export interface FlipOutputs {
  totalCost: number;
  commission: number;
  netProceeds: number;
  profit: number;
  roiPct: number;
}

export function flipCalc(i: FlipInputs): FlipOutputs {
  const commission = i.sellingPrice * (i.agentCommissionPct / 100);
  const holding = i.holdingMonths * i.monthlyHoldingCost;
  const totalCost = i.purchasePrice + i.transferCosts + i.renovationBudget + holding;
  const netProceeds = i.sellingPrice - commission;
  const profit = netProceeds - totalCost;
  return {
    totalCost,
    commission,
    netProceeds,
    profit,
    roiPct: totalCost > 0 ? (profit / totalCost) * 100 : 0,
  };
}

export interface HoldingInputs {
  monthlyRates: number;
  monthlyLevies: number;
  monthlyInsurance: number;
  otherMonthly: number;
}

export function holdingCostCalc(i: HoldingInputs) {
  const monthly = i.monthlyRates + i.monthlyLevies + i.monthlyInsurance + i.otherMonthly;
  return { monthly, yearly: monthly * 12 };
}

export interface DevInputs {
  landPrice: number;
  buildCostPerSqm: number;
  buildableSqm: number;
  softCostPct: number;       // 10-25
  gdv: number;               // gross development value
  agentCommissionPct: number;
}

export function devCalc(i: DevInputs) {
  const hardCost = i.buildCostPerSqm * i.buildableSqm;
  const softCost = (i.landPrice + hardCost) * (i.softCostPct / 100);
  const totalCost = i.landPrice + hardCost + softCost;
  const commission = i.gdv * (i.agentCommissionPct / 100);
  const profit = i.gdv - commission - totalCost;
  return {
    hardCost, softCost, totalCost, commission, profit,
    marginPct: i.gdv > 0 ? (profit / i.gdv) * 100 : 0,
  };
}

export function formatZAR(n: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(n);
}
export function formatPct(n: number) {
  return `${n.toFixed(2)}%`;
}
