import type { SavedMarketEvidence } from "@/features/marketEvidence/types";
import {
  calculateAcquisition,
  calculateBond,
  calculateBrrrr,
  calculateBuyHold,
  calculateDevelopmentToRent,
  calculateDevelopmentToSell,
  calculateFlip,
  calculateShortTermRental,
} from "@/lib/research/calculators";
import type { ErfStrategyScenario } from "@/lib/workbench/erfWorkspaceState";
import type { DecisionIntelligence } from "./buildDecisionIntelligence";
import type { ReportViewModel } from "./buildReportViewModel";

export type InvestorReadinessStatus =
  | "Material contradiction requires review"
  | "Strategy assumptions incomplete"
  | "Market support insufficient"
  | "More evidence required"
  | "Ready for preliminary evaluation";

export type InvestorNumberProvenance =
  | "Saved subject listing"
  | "Saved market evidence"
  | "User assumption"
  | "Deterministic calculation"
  | "Saved scenario summary";

export interface InvestorNumberRow {
  id: string;
  label: string;
  value: string;
  provenance: InvestorNumberProvenance;
  state: "available" | "missing" | "not_calculated";
}

export interface InvestorAction {
  id: string;
  label: string;
  body: string;
  tab?: string;
}

export interface InvestorDecisionMode {
  readinessStatus: InvestorReadinessStatus;
  readinessExplanation: string;
  evidenceStrength: string;
  acquisitionPriceStatus: string;
  marketEvidenceStatus: string;
  chosenStrategyStatus: string;
  calculationStatus: string;
  numberRows: InvestorNumberRow[];
  supportingEvidence: string[];
  weakeningEvidence: string[];
  assumptions: string[];
  missingInputs: string[];
  downsideRisks: string[];
  primaryAction: InvestorAction;
  nextActions: InvestorAction[];
}

export interface BuildInvestorDecisionModeInput {
  report: ReportViewModel;
  decision: DecisionIntelligence;
  savedEvidence: SavedMarketEvidence[];
  chosenScenario: ErfStrategyScenario | null;
}

type StrategyKind =
  | "buy_hold"
  | "flip"
  | "development_sell"
  | "development_rent"
  | "str_airbnb"
  | "brrrr"
  | "bond"
  | "land_bank"
  | "custom";

const STRATEGY_KINDS: StrategyKind[] = [
  "buy_hold",
  "flip",
  "development_sell",
  "development_rent",
  "str_airbnb",
  "brrrr",
  "bond",
  "land_bank",
  "custom",
];

interface ParsedInput {
  present: boolean;
  value: number | null;
}

interface StrategyAnalysis {
  supported: boolean;
  missingInputs: string[];
  warnings: string[];
  rows: InvestorNumberRow[];
  assumptions: string[];
  needsMarket: Array<"rental" | "exit" | "asking" | "comparable">;
}

const EMPTY_ANALYSIS: StrategyAnalysis = {
  supported: false,
  missingInputs: ["Choose an investment strategy."],
  warnings: ["No chosen Strategy Lab scenario is saved for this erf."],
  rows: [],
  assumptions: [],
  needsMarket: ["comparable"],
};

export function buildInvestorDecisionMode(
  input: BuildInvestorDecisionModeInput,
): InvestorDecisionMode {
  const report = input.report;
  const evidence = input.savedEvidence.filter((item) => item.parcelId === report.parcelId);
  const subjectListing = evidence.find((item) => item.listingRole === "subject_active_listing");
  const comps = evidence.filter(
    (item) =>
      item.listingRole !== "subject_active_listing" &&
      item.includeInSummary &&
      item.relationship !== "not_related" &&
      item.confidence !== "excluded",
  );
  const chosen =
    input.chosenScenario?.parcelId === report.parcelId ? input.chosenScenario : null;
  const strategy = analyzeStrategy(chosen);
  const rows = [
    subjectListing?.askingPrice
      ? moneyRow("asking-price", "Asking price", subjectListing.askingPrice, "Saved subject listing")
      : missingRow("asking-price", "Asking price", "Saved subject listing"),
    ...strategy.rows,
  ];
  const uniqueRows = rows.filter(
    (row, index, all) => all.findIndex((item) => item.id === row.id) === index,
  );
  const missingInputs = unique([
    ...strategy.missingInputs,
    ...marketMissingInputs(strategy, comps, subjectListing),
    ...input.decision.stillNeeded,
  ]).slice(0, 10);
  const contradictionPriority = input.decision.contradictions.some(
    (item) => item.severity === "high" || item.severity === "medium",
  );
  const strategyIncomplete = !chosen || strategy.missingInputs.length > 0 || !strategy.supported;
  const marketInsufficient = marketSupportInsufficient(strategy, comps, subjectListing);
  const moreEvidenceRequired =
    report.brief.categories.some(
      (category) =>
        category.id !== "strategy" &&
        (category.state === "missing" || category.state === "not_reviewed"),
    ) || report.risks.some((risk) => risk.severity === "high" || risk.severity === "medium");

  const readinessStatus: InvestorReadinessStatus = contradictionPriority
    ? "Material contradiction requires review"
    : strategyIncomplete
      ? "Strategy assumptions incomplete"
      : marketInsufficient
        ? "Market support insufficient"
        : moreEvidenceRequired
          ? "More evidence required"
          : "Ready for preliminary evaluation";

  const nextActions = buildInvestorActions({
    status: readinessStatus,
    report,
    strategy,
    subjectListing: Boolean(subjectListing),
    comparableCount: comps.length,
    contradictions: input.decision.contradictions.length,
  });

  return {
    readinessStatus,
    readinessExplanation: readinessExplanation(readinessStatus),
    evidenceStrength: `${report.brief.readinessPercent}% evidence readiness from the neutral report; ${report.market.includedCount} included market evidence item${report.market.includedCount === 1 ? "" : "s"}.`,
    acquisitionPriceStatus: acquisitionPriceStatus(chosen, strategy),
    marketEvidenceStatus: marketStatus(strategy, comps.length, Boolean(subjectListing)),
    chosenStrategyStatus: chosen
      ? `${chosen.label} is selected for this erf.`
      : "No parcel-matched strategy scenario is selected.",
    calculationStatus: strategy.supported
      ? "Deterministic calculations are available from saved raw inputs where required inputs exist."
      : "Calculations are incomplete or unavailable for the selected strategy.",
    numberRows: uniqueRows,
    supportingEvidence: supportingEvidence(report, comps.length, Boolean(subjectListing)),
    weakeningEvidence: weakeningEvidence(input.decision, report, strategy),
    assumptions: unique(strategy.assumptions).slice(0, 8),
    missingInputs,
    downsideRisks: downsideRisks(input.decision, report, strategy, comps.length),
    primaryAction: nextActions[0],
    nextActions: nextActions.slice(1),
  };
}

function analyzeStrategy(scenario: ErfStrategyScenario | null): StrategyAnalysis {
  if (!scenario || !STRATEGY_KINDS.includes(scenario.strategy as StrategyKind)) {
    if (scenario) {
      return {
        supported: false,
        missingInputs: [`Unsupported or legacy strategy type: ${scenario.strategy}.`],
        warnings: ["Review and resave this scenario in Strategy Lab."],
        rows: fallbackSummaryRows(scenario),
        assumptions: ["Legacy saved scenario summary is shown only as a display fallback."],
        needsMarket: ["comparable"],
      };
    }
    return EMPTY_ANALYSIS;
  }
  const strategy = scenario.strategy as StrategyKind;
  const value = (key: string) => parseInput(scenario.inputs[key]);
  const rows: InvestorNumberRow[] = [];
  const missing: string[] = [];
  const assumptions: string[] = [];
  const needsMarket: StrategyAnalysis["needsMarket"] = ["comparable"];

  const addInput = (id: string, label: string, key: string) => {
    const parsed = value(key);
    rows.push(parsed.present ? moneyRow(id, label, parsed.value ?? 0, "User assumption") : missingRow(id, label, "User assumption"));
    if (parsed.present) assumptions.push(`${label}: ${formatMoney(parsed.value ?? 0)}`);
    return parsed;
  };
  const requireInput = (label: string, key: string) => {
    const parsed = value(key);
    if (!parsed.present) missing.push(label);
    return parsed;
  };

  const purchasePrice = addInput("acquisition-price", "Assumed acquisition price", "purchasePrice");
  const landCost = strategy.startsWith("development")
    ? addInput("land-cost", "Land cost", "landCost")
    : null;

  const loanAmount =
    value("loanAmount").value ??
    (purchasePrice.present && purchasePrice.value != null
      ? Math.max(0, purchasePrice.value * (1 - (value("depositPercent").value ?? 10) / 100))
      : null);
  const monthlyBond =
    value("monthlyBondPayment").value ??
    (loanAmount && value("interestRate").present && value("termYears").present
      ? calculateBond({
          loanAmount,
          interestRate: value("interestRate").value ?? 0,
          termYears: value("termYears").value ?? 0,
          extraMonthlyPayment: 0,
          monthlyNoi: 0,
          monthlyRent: value("monthlyRent").value ?? 0,
        }).monthlyBondPayment
      : null);

  const acquisition =
    purchasePrice.present && purchasePrice.value != null
      ? calculateAcquisition({
          purchasePrice: purchasePrice.value,
          depositPercent: value("depositPercent").value ?? 10,
          transferDuty: value("transferDuty").value ?? 0,
          conveyancerFees: (value("transferCosts").value ?? 0) + (value("attorneyFees").value ?? 0),
          bondRegistrationFees: value("bondCosts").value ?? 0,
          initiationFees: value("financeFees").value ?? 0,
          inspectionAllowance: value("inspectionCosts").value ?? 0,
          renovationBudget: value("renovationBudget").value ?? 0,
          furnitureBudget: value("furnishingSetupCost").value ?? 0,
          cashBuffer: value("otherAcquisitionCosts").value ?? 0,
        })
      : null;

  if (acquisition) {
    rows.push(moneyRow("acquisition-costs", "Acquisition and transfer costs", acquisition.totalAcquisitionCost, "Deterministic calculation"));
    rows.push(moneyRow("total-cash-required", "Total cash required", acquisition.totalCashRequired, "Deterministic calculation"));
  } else {
    rows.push(notCalculatedRow("acquisition-costs", "Acquisition and transfer costs", "Deterministic calculation"));
    rows.push(notCalculatedRow("total-cash-required", "Total cash required", "Deterministic calculation"));
  }

  if (value("renovationBudget").present) {
    rows.push(moneyRow("renovation-cost", "Renovation cost", value("renovationBudget").value ?? 0, "User assumption"));
  }
  if (value("buildCost").present) {
    rows.push(moneyRow("build-cost", "Build cost", value("buildCost").value ?? 0, "User assumption"));
  }
  if (monthlyBond != null) {
    rows.push(moneyRow("finance-cost", "Finance cost", monthlyBond, "Deterministic calculation"));
  } else if (strategy === "bond" || strategy === "buy_hold" || strategy === "brrrr") {
    rows.push(notCalculatedRow("finance-cost", "Finance cost", "Deterministic calculation"));
  }
  if (value("monthlyHoldingCost").present && value("holdingMonths").present) {
    rows.push(moneyRow("holding-cost", "Holding cost", (value("monthlyHoldingCost").value ?? 0) * (value("holdingMonths").value ?? 0), "Deterministic calculation"));
  }

  switch (strategy) {
    case "buy_hold": {
      const monthlyRent = requireInput("projected rental income", "monthlyRent");
      if (monthlyRent.present) rows.push(moneyRow("projected-rental-income", "Projected rental income", monthlyRent.value ?? 0, "User assumption"));
      if (purchasePrice.present && monthlyRent.present && acquisition && monthlyBond != null) {
        const result = calculateBuyHold({
          purchasePrice: purchasePrice.value ?? 0,
          totalCashInvested: acquisition.totalCashRequired,
          monthlyRent: monthlyRent.value ?? 0,
          otherIncome: value("otherIncome").value ?? 0,
          vacancyPercent: value("vacancyPercent").value ?? 0,
          monthlyRates: value("monthlyRates").value ?? 0,
          monthlyLevies: value("monthlyLevies").value ?? 0,
          insurance: value("insurance").value ?? 0,
          utilitiesPaidByOwner: value("utilitiesPaidByOwner").value ?? 0,
          capitalExpenditureReserve: value("maintenanceReserve").value ?? 0,
          maintenancePercent: 0,
          managementPercent: value("propertyManagementPercent").value ?? 0,
          otherMonthlyCosts: (value("security").value ?? 0) + (value("gardenPool").value ?? 0) + (value("otherMonthlyCosts").value ?? 0),
          monthlyBondPayment: monthlyBond,
          holdingPeriodYears: value("annualHoldingYears").value ?? 0,
          sellingCostPercent: 6,
          loanAmount: loanAmount ?? 0,
        });
        rows.push(percentRow("cash-on-cash-return", "Cash-on-cash return", result.cashOnCashReturn, "Deterministic calculation"));
        rows.push(percentRow("net-yield", "Net yield", result.netYield, "Deterministic calculation"));
        rows.push(moneyRow("break-even-rent", "Break-even rent", result.breakEvenRent, "Deterministic calculation"));
      }
      needsMarket.push("rental");
      break;
    }
    case "flip": {
      const resale = requireInput("projected exit value", "expectedResalePrice");
      const renovation = requireInput("renovation cost", "renovationBudget");
      if (resale.present) rows.push(moneyRow("projected-exit-value", "Projected exit value", resale.value ?? 0, "User assumption"));
      if (purchasePrice.present && resale.present && renovation.present) {
        const result = calculateFlip({
          purchasePrice: purchasePrice.value ?? 0,
          acquisitionCosts: (value("transferDuty").value ?? 0) + (value("transferCosts").value ?? 0) + (value("bondCosts").value ?? 0) + (value("attorneyFees").value ?? 0) + (value("inspectionCosts").value ?? 0) + (value("otherAcquisitionCosts").value ?? 0),
          renovationBudget: renovation.value ?? 0,
          contingencyPercent: value("contingencyPercent").value ?? 0,
          holdingMonths: value("holdingMonths").value ?? 0,
          monthlyHoldingCost: value("monthlyHoldingCost").value ?? 0,
          expectedResalePrice: resale.value ?? 0,
          agentCommissionPercent: value("agentCommission").value ?? 0,
          sellingCosts: value("sellingCosts").value ?? 0,
          targetProfit: 0,
          targetRoiPercent: 20,
        });
        rows.push(moneyRow("projected-profit", "Projected profit", result.profit, "Deterministic calculation"));
        rows.push(percentRow("return", "Return", result.roi, "Deterministic calculation"));
      }
      needsMarket.push("exit");
      break;
    }
    case "development_sell": {
      const build = requireInput("build cost", "buildCost");
      const sale = requireInput("projected exit value", "expectedSaleValue");
      if (sale.present) rows.push(moneyRow("projected-exit-value", "Projected exit value", sale.value ?? 0, "User assumption"));
      if (landCost?.present && build.present && sale.present) {
        const result = calculateDevelopmentToSell({
          landCost: landCost.value ?? 0,
          buildCost: build.value ?? 0,
          professionalFees: value("professionalFees").value ?? 0,
          municipalPlanningFees: value("municipalPlanningFees").value ?? 0,
          contingencyPercent: value("contingencyPercent").value ?? 0,
          developmentDurationMonths: value("developmentDurationMonths").value ?? 0,
          monthlyHoldingCost: value("monthlyHoldingCost").value ?? 0,
          exitSellingCosts: (value("exitSellingCosts").value ?? 0) + (value("sellingCosts").value ?? 0),
          expectedSaleValue: sale.value ?? 0,
        });
        rows.push(moneyRow("total-project-cost", "Total project cost", result.totalProjectCost, "Deterministic calculation"));
        rows.push(moneyRow("projected-profit", "Projected profit", result.netProfit, "Deterministic calculation"));
        rows.push(percentRow("gross-margin", "Gross margin", result.margin, "Deterministic calculation"));
        rows.push(percentRow("return-on-cost", "Return on cost", result.returnOnCost, "Deterministic calculation"));
        rows.push(moneyRow("break-even-sale-price", "Break-even sale price", result.breakEvenSalePrice, "Deterministic calculation"));
      }
      needsMarket.push("exit");
      break;
    }
    case "development_rent": {
      const build = requireInput("build cost", "buildCost");
      const rent = requireInput("projected rental income", "expectedMonthlyRent");
      if (rent.present) rows.push(moneyRow("projected-rental-income", "Projected rental income", rent.value ?? 0, "User assumption"));
      if (landCost?.present && build.present && rent.present) {
        const result = calculateDevelopmentToRent({
          landCost: landCost.value ?? 0,
          buildCost: build.value ?? 0,
          professionalFees: value("professionalFees").value ?? 0,
          municipalPlanningFees: value("municipalPlanningFees").value ?? 0,
          contingencyPercent: value("contingencyPercent").value ?? 0,
          developmentDurationMonths: value("developmentDurationMonths").value ?? 0,
          monthlyHoldingCost: value("monthlyHoldingCost").value ?? 0,
          expectedMonthlyRent: rent.value ?? 0,
          vacancyPercent: value("vacancyPercent").value ?? 0,
          operatingExpenses: value("operatingExpenses").value ?? 0,
          bondPayment: monthlyBond ?? 0,
        });
        rows.push(moneyRow("total-project-cost", "Total project cost", result.totalProjectCost, "Deterministic calculation"));
        rows.push(percentRow("net-yield", "Net yield", result.netYield, "Deterministic calculation"));
        rows.push(moneyRow("break-even-rent", "Break-even rent", result.breakEvenRent, "Deterministic calculation"));
      }
      needsMarket.push("rental");
      break;
    }
    case "str_airbnb": {
      const adr = requireInput("average daily rate", "averageDailyRate");
      const occupancy = requireInput("occupancy percentage", "occupancyPercent");
      if (adr.present) rows.push(moneyRow("projected-rental-income", "Projected rental income", adr.value ?? 0, "User assumption"));
      if (adr.present && occupancy.present) {
        const result = calculateShortTermRental({
          averageDailyRate: adr.value ?? 0,
          occupancyPercent: occupancy.value ?? 0,
          nightsPerMonth: value("nightsPerMonth").value ?? 30.4,
          platformFeePercent: value("platformFeePercent").value ?? 0,
          cleaningRevenue: value("cleaningRevenue").value ?? 0,
          cleaningCost: value("cleaningCost").value ?? 0,
          utilities: value("utilities").value ?? 0,
          internet: value("internet").value ?? 0,
          linenLaundry: value("linenLaundry").value ?? 0,
          managementPercent: value("strManagementPercent").value ?? 0,
          maintenanceReserve: value("maintenanceReserve").value ?? 0,
          furnishingSetupCost: value("furnishingSetupCost").value ?? 0,
          bondPayment: monthlyBond ?? 0,
          cashInvested: acquisition?.totalCashRequired,
        });
        rows.push(moneyRow("projected-profit", "Projected monthly net income", result.monthlyNetIncome, "Deterministic calculation"));
        rows.push(percentRow("break-even-occupancy", "Break-even occupancy", result.breakEvenOccupancy, "Deterministic calculation"));
        rows.push(percentRow("cash-on-cash-return", "Cash-on-cash return", result.cashOnCashReturn, "Deterministic calculation"));
      }
      needsMarket.push("rental");
      break;
    }
    case "brrrr": {
      const rent = requireInput("projected rental income", "monthlyRent");
      const arv = requireInput("projected exit value", "afterRepairValue");
      if (rent.present) rows.push(moneyRow("projected-rental-income", "Projected rental income", rent.value ?? 0, "User assumption"));
      if (arv.present) rows.push(moneyRow("projected-exit-value", "Projected exit value", arv.value ?? 0, "User assumption"));
      if (purchasePrice.present && rent.present && arv.present) {
        const result = calculateBrrrr({
          purchasePrice: purchasePrice.value ?? 0,
          renovationBudget: value("renovationBudget").value ?? 0,
          allInCost: value("allInCost").value ?? 0,
          afterRepairValue: arv.value ?? 0,
          refinanceLtv: value("refinanceLtv").value ?? 0,
          refinanceFees: value("refinanceFees").value ?? 0,
          monthlyRent: rent.value ?? 0,
          monthlyExpenses: value("monthlyExpenses").value ?? 0,
          monthlyDebtService: value("monthlyDebtService").value ?? monthlyBond ?? 0,
          targetDscr: value("targetDscr").value ?? 1.2,
        });
        rows.push(moneyRow("cash-left-in-deal", "Cash left in deal", result.cashLeftInDeal, "Deterministic calculation"));
        rows.push(percentRow("cash-on-cash-return", "Cash-on-cash return", result.cashOnCashReturn, "Deterministic calculation"));
        rows.push(numberRow("dscr", "DSCR", result.dscr.toFixed(2), "Deterministic calculation"));
      }
      needsMarket.push("rental", "exit");
      break;
    }
    case "bond": {
      if (loanAmount && value("interestRate").present && value("termYears").present) {
        const result = calculateBond({
          loanAmount,
          interestRate: value("interestRate").value ?? 0,
          termYears: value("termYears").value ?? 0,
          extraMonthlyPayment: 0,
          monthlyNoi: 0,
          monthlyRent: value("monthlyRent").value ?? 0,
        });
        rows.push(moneyRow("finance-cost", "Finance cost", result.monthlyBondPayment, "Deterministic calculation"));
        rows.push(percentRow("break-even-occupancy", "Break-even occupancy", result.breakEvenOccupancy, "Deterministic calculation"));
        rows.push(numberRow("dscr", "DSCR", result.dscr.toFixed(2), "Deterministic calculation"));
      } else {
        requireInput("loan amount or purchase price", "purchasePrice");
        requireInput("interest rate", "interestRate");
        requireInput("loan term", "termYears");
      }
      break;
    }
    case "land_bank": {
      requireInput("land or acquisition price", "purchasePrice");
      if (value("futureValue").present) {
        rows.push(moneyRow("projected-exit-value", "Projected exit value", value("futureValue").value ?? 0, "User assumption"));
      }
      break;
    }
    case "custom": {
      if (value("customUpside").present) {
        rows.push(moneyRow("projected-profit", "Projected profit", value("customUpside").value ?? 0, "User assumption"));
      }
      break;
    }
  }

  return {
    supported: missing.length === 0,
    missingInputs: unique(missing),
    warnings: strategyWarnings(strategy, missing),
    rows: rows.length ? rows : fallbackSummaryRows(scenario),
    assumptions,
    needsMarket: unique(needsMarket),
  };
}

function parseInput(raw: string | undefined): ParsedInput {
  if (raw == null || raw.trim() === "") return { present: false, value: null };
  const parsed = Number(raw.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? { present: true, value: parsed } : { present: false, value: null };
}

function moneyRow(
  id: string,
  label: string,
  value: number,
  provenance: InvestorNumberProvenance,
): InvestorNumberRow {
  return { id, label, value: formatMoney(value), provenance, state: "available" };
}

function percentRow(
  id: string,
  label: string,
  value: number,
  provenance: InvestorNumberProvenance,
): InvestorNumberRow {
  return {
    id,
    label,
    value: `${((Number.isFinite(value) ? value : 0) * 100).toFixed(1)}%`,
    provenance,
    state: "available",
  };
}

function numberRow(
  id: string,
  label: string,
  value: string,
  provenance: InvestorNumberProvenance,
): InvestorNumberRow {
  return { id, label, value, provenance, state: "available" };
}

function missingRow(
  id: string,
  label: string,
  provenance: InvestorNumberProvenance,
): InvestorNumberRow {
  return { id, label, value: "Not provided", provenance, state: "missing" };
}

function notCalculatedRow(
  id: string,
  label: string,
  provenance: InvestorNumberProvenance,
): InvestorNumberRow {
  return { id, label, value: "Not calculated", provenance, state: "not_calculated" };
}

function fallbackSummaryRows(scenario: ErfStrategyScenario): InvestorNumberRow[] {
  return scenario.summary.slice(0, 4).map((item, index) => ({
    id: `summary-${index}`,
    label: item.label,
    value: item.value || "Not calculated",
    provenance: "Saved scenario summary",
    state: item.value ? "available" : "not_calculated",
  }));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(Math.round(Number.isFinite(value) ? value : 0));
}

function strategyWarnings(strategy: StrategyKind, missing: string[]) {
  const warnings = missing.map((item) => `Missing ${item}.`);
  if (strategy === "str_airbnb") warnings.push("Verify STR rules, seasonality and occupancy.");
  if (strategy.startsWith("development")) warnings.push("Verify zoning, services and buildability.");
  return warnings;
}

function marketSupportInsufficient(
  strategy: StrategyAnalysis,
  comps: SavedMarketEvidence[],
  subjectListing?: SavedMarketEvidence | null,
) {
  if (strategy.needsMarket.includes("asking") && !subjectListing) return true;
  return comps.length < 3;
}

function marketMissingInputs(
  strategy: StrategyAnalysis,
  comps: SavedMarketEvidence[],
  subjectListing?: SavedMarketEvidence | null,
) {
  const missing: string[] = [];
  if (!subjectListing) missing.push("Add the active subject listing.");
  if (comps.length < 3) missing.push("Save comparable market evidence.");
  if (strategy.needsMarket.includes("rental")) missing.push("Add rental evidence.");
  if (strategy.needsMarket.includes("exit")) missing.push("Add exit-value market support.");
  return missing;
}

function readinessExplanation(status: InvestorReadinessStatus) {
  switch (status) {
    case "Material contradiction requires review":
      return "A recorded contradiction should be resolved before relying on the investor case.";
    case "Strategy assumptions incomplete":
      return "The chosen strategy is missing required assumptions or cannot be calculated safely.";
    case "Market support insufficient":
      return "The strategy case needs stronger saved market evidence before preliminary evaluation.";
    case "More evidence required":
      return "Important identity, ownership, planning, risk, or document evidence is still missing.";
    case "Ready for preliminary evaluation":
      return "The saved evidence is sufficient for a preliminary investor review, not a purchase recommendation.";
  }
}

function acquisitionPriceStatus(chosen: ErfStrategyScenario | null, strategy: StrategyAnalysis) {
  if (!chosen) return "No acquisition price can be assessed until a strategy is chosen.";
  const acquisitionRow = strategy.rows.find((row) =>
    ["acquisition-price", "land-cost"].includes(row.id),
  );
  return acquisitionRow?.state === "available"
    ? `${acquisitionRow.label}: ${acquisitionRow.value} (${acquisitionRow.provenance}).`
    : "Acquisition or land price is not provided.";
}

function marketStatus(strategy: StrategyAnalysis, compCount: number, hasSubject: boolean) {
  const parts = [`${compCount} included comparable${compCount === 1 ? "" : "s"}`];
  parts.push(hasSubject ? "subject listing saved" : "no subject listing saved");
  if (strategy.needsMarket.includes("rental")) parts.push("rental evidence needed");
  if (strategy.needsMarket.includes("exit")) parts.push("exit evidence needed");
  return parts.join("; ");
}

function supportingEvidence(report: ReportViewModel, compCount: number, hasSubject: boolean) {
  const items = new Set<string>();
  if (report.identity.erfNumber || report.identity.lpi || report.identity.parcelKey) {
    items.add("Official parcel identifiers are available.");
  }
  if (report.identity.marketAddressLine) items.add("A user-confirmed Market address is saved.");
  if (hasSubject) items.add("A subject active listing is saved for this erf.");
  if (compCount > 0) items.add(`${compCount} comparable evidence item${compCount === 1 ? "" : "s"} saved.`);
  if (report.site.selectedDesign) items.add("A selected Site Potential concept is linked.");
  if (report.documents.uploadedReportCount > 0) items.add("Paid report documents are uploaded for reference.");
  return Array.from(items);
}

function weakeningEvidence(
  decision: DecisionIntelligence,
  report: ReportViewModel,
  strategy: StrategyAnalysis,
) {
  return unique([
    ...decision.contradictions.map((item) => item.title),
    ...report.risks.map((item) => item.title),
    ...strategy.warnings,
  ]).slice(0, 8);
}

function downsideRisks(
  decision: DecisionIntelligence,
  report: ReportViewModel,
  strategy: StrategyAnalysis,
  compCount: number,
) {
  const risks = new Set<string>();
  if (compCount < 3) risks.add("Market support is weak or missing.");
  if (report.brief.categories.find((item) => item.id === "planning")?.state !== "confirmed") {
    risks.add("Planning or zoning is not fully confirmed.");
  }
  if (!report.ownership.isVerified) risks.add("Ownership and deeds are unconfirmed.");
  for (const missing of strategy.missingInputs) risks.add(`Missing ${missing}.`);
  for (const contradiction of decision.contradictions) risks.add(contradiction.title);
  if (strategy.assumptions.length >= 5) risks.add("The case depends heavily on user assumptions.");
  return Array.from(risks).slice(0, 8);
}

function buildInvestorActions(input: {
  status: InvestorReadinessStatus;
  report: ReportViewModel;
  strategy: StrategyAnalysis;
  subjectListing: boolean;
  comparableCount: number;
  contradictions: number;
}): InvestorAction[] {
  const actions: InvestorAction[] = [];
  if (input.contradictions > 0) {
    actions.push({
      id: "review-contradictions",
      label: "Review contradictions",
      body: "Resolve recorded contradictions before relying on the investor case.",
      tab: "research",
    });
  }
  if (input.strategy.missingInputs.includes("Choose an investment strategy.")) {
    actions.push({
      id: "choose-strategy",
      label: "Choose an investment strategy",
      body: "Save a Strategy Lab scenario for this erf.",
      tab: "calculators",
    });
  }
  for (const missing of input.strategy.missingInputs) {
    if (/acquisition|land/.test(missing)) {
      actions.push({
        id: "confirm-acquisition-price",
        label: "Confirm the exact acquisition price",
        body: "Add the purchase or land-cost assumption in Strategy Lab.",
        tab: "calculators",
      });
    }
    if (/build/.test(missing)) {
      actions.push({
        id: "add-build-cost",
        label: "Add build-cost evidence",
        body: "Add build-cost assumptions before relying on a development case.",
        tab: "calculators",
      });
    }
    if (/renovation/.test(missing)) {
      actions.push({
        id: "add-renovation-cost",
        label: "Add renovation-cost evidence",
        body: "Add renovation assumptions before relying on a flip or BRRRR case.",
        tab: "calculators",
      });
    }
    if (/rental|rent|daily|occupancy/.test(missing)) {
      actions.push({
        id: "add-rental-evidence",
        label: "Add rental evidence",
        body: "Support rental assumptions with saved market evidence.",
        tab: "listings",
      });
    }
    if (/exit|resale|sale/.test(missing)) {
      actions.push({
        id: "add-exit-support",
        label: "Add exit-value market support",
        body: "Save comparable market evidence before relying on an exit value.",
        tab: "listings",
      });
    }
  }
  if (!input.subjectListing) {
    actions.push({
      id: "add-subject-listing",
      label: "Add the active subject listing",
      body: "Attach the current active listing if this erf is listed for sale.",
      tab: "listings",
    });
  }
  if (input.comparableCount < 3) {
    actions.push({
      id: "save-comps",
      label: "Save comparable market evidence",
      body: "Add comparable listings or sales evidence for the selected erf.",
      tab: "listings",
    });
  }
  if (!input.report.ownership.hasUploadedReport) {
    actions.push({
      id: "obtain-deeds",
      label: "Obtain ownership or deeds evidence",
      body: "Upload Lightstone, WinDeed, title deed, or other deeds-level evidence.",
      tab: "reports",
    });
  }
  actions.push({
    id: "save-snapshot",
    label: "Save a report snapshot after updating evidence",
    body: "Create a new report baseline once the missing evidence is updated.",
    tab: "stoep-report",
  });
  return uniqueActions(actions);
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function uniqueActions(actions: InvestorAction[]) {
  const seen = new Set<string>();
  return actions.filter((action) => {
    if (seen.has(action.id)) return false;
    seen.add(action.id);
    return true;
  });
}

