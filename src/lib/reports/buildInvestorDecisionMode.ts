import type { SavedMarketEvidence } from "@/features/marketEvidence/types";
import {
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

type MarketNeed = "rental" | "exit" | "asking" | "comparable";

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

const ACQUISITION_COST_KEYS = [
  "transferDuty",
  "transferCosts",
  "attorneyFees",
  "bondCosts",
  "financeFees",
  "inspectionCosts",
  "otherAcquisitionCosts",
] as const;

const CUSTOM_MEANINGFUL_FIELDS = [
  "customUpside",
  "customNotes",
  "customCashRequired",
  "customPurchasePrice",
  "customRent",
  "customExitValue",
] as const;

interface ParsedInput {
  present: boolean;
  value: number | null;
}

interface DebtResolution {
  loanAmount: number | null;
  monthlyBondPayment: number | null;
  bondResult: ReturnType<typeof calculateBond> | null;
  cashPurchase: boolean;
  debtIntended: boolean;
  missingFinanceInputs: string[];
}

interface StrategyAnalysis {
  supportedStrategy: boolean;
  requiredInputsComplete: boolean;
  calculationAvailable: boolean;
  missingInputs: string[];
  warnings: string[];
  rows: InvestorNumberRow[];
  assumptions: string[];
  needsMarket: MarketNeed[];
}

interface AcquisitionBasis {
  id: "acquisition-price" | "land-cost";
  label: "Assumed acquisition price" | "Land cost";
  input: ParsedInput;
}

interface MarketSupport {
  subjectListingSaved: boolean;
  comparableCount: number;
  pricedExitComparableCount: number;
  needsRentalSupport: boolean;
  needsExitSupport: boolean;
  needsComparableSupport: boolean;
  needsSubjectListing: boolean;
  insufficient: boolean;
  missingInputs: string[];
  status: string;
}

const EMPTY_ANALYSIS: StrategyAnalysis = {
  supportedStrategy: true,
  requiredInputsComplete: false,
  calculationAvailable: false,
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
  const comps = includedComparableEvidence(evidence);
  const chosen = input.chosenScenario?.parcelId === report.parcelId ? input.chosenScenario : null;
  const strategy = analyzeStrategy(chosen);
  const marketSupport = buildMarketSupport(strategy, comps, subjectListing);
  const rows = [
    subjectListing?.askingPrice
      ? moneyRow(
          "asking-price",
          "Asking price",
          subjectListing.askingPrice,
          "Saved subject listing",
        )
      : missingRow("asking-price", "Asking price", "Saved subject listing"),
    ...strategy.rows,
  ];
  const uniqueRows = rows.filter(
    (row, index, all) => all.findIndex((item) => item.id === row.id) === index,
  );
  const missingInputs = unique([
    ...strategy.missingInputs,
    ...marketSupport.missingInputs,
    ...input.decision.stillNeeded,
  ]).slice(0, 10);
  const contradictionPriority = input.decision.contradictions.some(
    (item) => item.severity === "high" || item.severity === "medium",
  );
  const strategyIncomplete =
    !chosen || !strategy.supportedStrategy || !strategy.requiredInputsComplete;
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
      : marketSupport.insufficient
        ? "Market support insufficient"
        : moreEvidenceRequired
          ? "More evidence required"
          : "Ready for preliminary evaluation";

  const nextActions = buildInvestorActions({
    report,
    strategy,
    marketSupport,
    contradictions: input.decision.contradictions.length,
  });

  return {
    readinessStatus,
    readinessExplanation: readinessExplanation(readinessStatus),
    evidenceStrength: `${report.brief.readinessPercent}% evidence readiness from the neutral report; ${report.market.includedCount} included market evidence item${report.market.includedCount === 1 ? "" : "s"}.`,
    acquisitionPriceStatus: acquisitionPriceStatus(chosen, strategy),
    marketEvidenceStatus: marketSupport.status,
    chosenStrategyStatus: chosen
      ? `${chosen.label} is selected for this erf.`
      : "No parcel-matched strategy scenario is selected.",
    calculationStatus: strategyCalculationStatus(strategy),
    numberRows: uniqueRows,
    supportingEvidence: supportingEvidence(report, marketSupport),
    weakeningEvidence: weakeningEvidence(input.decision, report, strategy),
    assumptions: unique(strategy.assumptions).slice(0, 8),
    missingInputs,
    downsideRisks: downsideRisks(input.decision, report, strategy, marketSupport),
    primaryAction: nextActions[0],
    nextActions: nextActions.slice(1),
  };
}

function includedComparableEvidence(evidence: SavedMarketEvidence[]) {
  return evidence.filter(
    (item) =>
      item.listingRole !== "subject_active_listing" &&
      item.includeInSummary &&
      item.relationship !== "not_related" &&
      item.confidence !== "excluded",
  );
}

function strategyCalculationStatus(strategy: StrategyAnalysis) {
  if (!strategy.supportedStrategy) {
    return "This legacy scenario must be reviewed and resaved before calculations are available.";
  }
  if (!strategy.requiredInputsComplete) {
    return "Strategy calculations are incomplete until required inputs are saved.";
  }
  if (strategy.calculationAvailable) {
    return "Core deterministic calculation outputs are available from saved raw inputs.";
  }
  return "Assumptions are saved, but no deterministic financial calculation is available for this scenario.";
}

function analyzeStrategy(scenario: ErfStrategyScenario | null): StrategyAnalysis {
  if (!scenario || !STRATEGY_KINDS.includes(scenario.strategy as StrategyKind)) {
    if (scenario) {
      return {
        supportedStrategy: false,
        requiredInputsComplete: false,
        calculationAvailable: false,
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
  const rows: InvestorNumberRow[] = [];
  const missing: string[] = [];
  const assumptions: string[] = [];
  const needsMarket: MarketNeed[] = [];
  let calculationAvailable = false;
  const value = (key: string) => parseInput(scenario.inputs[key]);
  const requirePositive = (label: string, key: string) => {
    const parsed = value(key);
    if (!isPositive(parsed)) missing.push(label);
    return parsed;
  };
  const requirePositiveOneOf = (label: string, keys: string[]) => {
    const values = keys.map((key) => value(key));
    if (!values.some(isPositive)) missing.push(label);
    return values;
  };

  let purchasePrice = value("purchasePrice");
  let landCost = value("landCost");
  let acquisitionBasis: AcquisitionBasis | null = null;

  if (["buy_hold", "flip", "brrrr"].includes(strategy)) {
    purchasePrice = requirePositive("purchase price", "purchasePrice");
    acquisitionBasis = {
      id: "acquisition-price",
      label: "Assumed acquisition price",
      input: purchasePrice,
    };
  } else if (strategy === "development_sell" || strategy === "development_rent") {
    landCost = requirePositive("land cost", "landCost");
    acquisitionBasis = { id: "land-cost", label: "Land cost", input: landCost };
  } else if (strategy === "land_bank") {
    if (!isPositive(purchasePrice) && !isPositive(landCost)) {
      missing.push("land or acquisition price");
    }
    acquisitionBasis = isPositive(landCost)
      ? { id: "land-cost", label: "Land cost", input: landCost }
      : { id: "acquisition-price", label: "Assumed acquisition price", input: purchasePrice };
  } else if (strategy === "bond" && isPositive(purchasePrice) && !isPositive(value("loanAmount"))) {
    acquisitionBasis = {
      id: "acquisition-price",
      label: "Assumed acquisition price",
      input: purchasePrice,
    };
  }

  const acquisitionCosts = acquisitionCostInputs(value);
  const debt = resolveDebt(
    value,
    debtBasisForStrategy(strategy, value, purchasePrice, landCost, acquisitionBasis),
  );
  const acquisitionCashRequired =
    acquisitionBasis && isPositive(acquisitionBasis.input)
      ? appendAcquisitionBasisRows({
          rows,
          assumptions,
          basis: acquisitionBasis,
          acquisitionCosts,
          debt,
          depositPercent: value("depositPercent"),
          includeTotals: strategy !== "development_sell" && strategy !== "development_rent",
        })
      : null;
  const renovation = value("renovationBudget");
  if (isPositive(renovation)) {
    rows.push(moneyRow("renovation-cost", "Renovation cost", renovation.value, "User assumption"));
    assumptions.push(`Renovation budget: ${formatMoney(renovation.value)}`);
  }
  const build = value("buildCost");
  if (isPositive(build)) {
    rows.push(moneyRow("build-cost", "Build cost", build.value, "User assumption"));
    assumptions.push(`Build cost: ${formatMoney(build.value)}`);
  }

  if (debt.cashPurchase) {
    rows.push(
      moneyRow("monthly-bond-payment", "Monthly bond payment", 0, "Deterministic calculation"),
    );
  } else if (debt.bondResult) {
    rows.push(
      moneyRow(
        "monthly-bond-payment",
        "Monthly bond payment",
        debt.bondResult.monthlyBondPayment,
        "Deterministic calculation",
      ),
    );
  } else if (["bond", "buy_hold", "brrrr", "development_rent", "str_airbnb"].includes(strategy)) {
    rows.push(
      notCalculatedRow("monthly-bond-payment", "Monthly bond payment", "Deterministic calculation"),
    );
  }

  switch (strategy) {
    case "buy_hold": {
      const monthlyRent = requirePositive("monthly rental income", "monthlyRent");
      if (isPositive(monthlyRent)) {
        rows.push(
          moneyRow(
            "monthly-rental-income",
            "Monthly rental income",
            monthlyRent.value,
            "User assumption",
          ),
        );
      }
      if (debt.debtIntended && debt.missingFinanceInputs.length) {
        missing.push(...debt.missingFinanceInputs);
      }
      if (isPositive(purchasePrice) && isPositive(monthlyRent)) {
        const totalCashInvested = acquisitionCashRequired;
        const monthlyBondPayment = debt.monthlyBondPayment;
        rows.push(
          netYieldRow({
            purchasePrice: purchasePrice.value,
            monthlyRent: monthlyRent.value,
            otherIncome: value("otherIncome").value ?? 0,
            vacancyPercent: value("vacancyPercent").value ?? 0,
            monthlyRates: value("monthlyRates").value ?? 0,
            monthlyLevies: value("monthlyLevies").value ?? 0,
            insurance: value("insurance").value ?? 0,
            utilitiesPaidByOwner: value("utilitiesPaidByOwner").value ?? 0,
            capitalExpenditureReserve: value("maintenanceReserve").value ?? 0,
            maintenancePercent: 0,
            managementPercent: value("propertyManagementPercent").value ?? 0,
            otherMonthlyCosts:
              (value("security").value ?? 0) +
              (value("gardenPool").value ?? 0) +
              (value("otherMonthlyCosts").value ?? 0),
            monthlyBondPayment: monthlyBondPayment ?? 0,
            totalCashInvested: totalCashInvested ?? 0,
            loanAmount: debt.loanAmount ?? 0,
          }),
        );
        if (monthlyBondPayment != null && totalCashInvested && totalCashInvested > 0) {
          const result = buyHoldResult(
            value,
            purchasePrice.value,
            monthlyRent.value,
            monthlyBondPayment,
            totalCashInvested,
            debt.loanAmount ?? 0,
          );
          rows.push(
            percentRow(
              "cash-on-cash-return",
              "Cash-on-cash return",
              result.cashOnCashReturn,
              "Deterministic calculation",
            ),
          );
          rows.push(
            moneyRow(
              "cash-flow-after-debt",
              "Monthly cash flow after debt",
              result.cashFlowAfterDebt,
              "Deterministic calculation",
            ),
          );
          rows.push(
            moneyRow(
              "break-even-rent",
              "Break-even monthly rent",
              result.breakEvenRent,
              "Deterministic calculation",
            ),
          );
          calculationAvailable = true;
        }
      }
      needsMarket.push("rental");
      break;
    }
    case "flip": {
      const resale = requirePositive("projected exit value", "expectedResalePrice");
      const renovationRequired = requirePositive("renovation budget", "renovationBudget");
      if (isPositive(resale))
        rows.push(
          moneyRow("projected-exit-value", "Projected exit value", resale.value, "User assumption"),
        );
      if (isPositive(purchasePrice) && isPositive(resale) && isPositive(renovationRequired)) {
        const result = calculateFlip({
          purchasePrice: purchasePrice.value,
          acquisitionCosts: acquisitionCosts.value,
          renovationBudget: renovationRequired.value,
          contingencyPercent: value("contingencyPercent").value ?? 0,
          holdingMonths: value("holdingMonths").value ?? 0,
          monthlyHoldingCost: value("monthlyHoldingCost").value ?? 0,
          expectedResalePrice: resale.value,
          agentCommissionPercent: value("agentCommission").value ?? 0,
          sellingCosts: value("sellingCosts").value ?? 0,
          targetProfit: 0,
          targetRoiPercent: 20,
        });
        rows.push(
          moneyRow(
            "projected-profit",
            "Projected profit",
            result.profit,
            "Deterministic calculation",
          ),
        );
        rows.push(percentRow("roi", "ROI", result.roi, "Deterministic calculation"));
        calculationAvailable = true;
      }
      needsMarket.push("exit");
      break;
    }
    case "development_sell": {
      const buildCost = requirePositive("build cost", "buildCost");
      const sale = requirePositive("projected exit value", "expectedSaleValue");
      requireDevelopmentDurationIfHoldingCost(value, missing);
      if (isPositive(sale))
        rows.push(
          moneyRow("projected-exit-value", "Projected exit value", sale.value, "User assumption"),
        );
      if (isPositive(landCost) && isPositive(buildCost) && isPositive(sale)) {
        const result = calculateDevelopmentToSell({
          landCost: landCost.value,
          buildCost: buildCost.value,
          professionalFees: value("professionalFees").value ?? 0,
          municipalPlanningFees: value("municipalPlanningFees").value ?? 0,
          contingencyPercent: value("contingencyPercent").value ?? 0,
          developmentDurationMonths: value("developmentDurationMonths").value ?? 0,
          monthlyHoldingCost: value("monthlyHoldingCost").value ?? 0,
          exitSellingCosts:
            (value("exitSellingCosts").value ?? 0) + (value("sellingCosts").value ?? 0),
          expectedSaleValue: sale.value,
        });
        rows.push(
          moneyRow(
            "total-project-cost",
            "Total project cost",
            result.totalProjectCost,
            "Deterministic calculation",
          ),
        );
        rows.push(
          moneyRow(
            "projected-profit",
            "Projected profit",
            result.netProfit,
            "Deterministic calculation",
          ),
        );
        rows.push(
          percentRow("gross-margin", "Gross margin", result.margin, "Deterministic calculation"),
        );
        rows.push(
          percentRow(
            "return-on-cost",
            "Return on cost",
            result.returnOnCost,
            "Deterministic calculation",
          ),
        );
        rows.push(
          moneyRow(
            "break-even-sale-price",
            "Break-even sale price",
            result.breakEvenSalePrice,
            "Deterministic calculation",
          ),
        );
        calculationAvailable = true;
      }
      needsMarket.push("exit");
      break;
    }
    case "development_rent": {
      const buildCost = requirePositive("build cost", "buildCost");
      const rent = requirePositive("monthly rental income", "expectedMonthlyRent");
      requireDevelopmentDurationIfHoldingCost(value, missing);
      if (isPositive(rent))
        rows.push(
          moneyRow("monthly-rental-income", "Monthly rental income", rent.value, "User assumption"),
        );
      if (debt.debtIntended && debt.missingFinanceInputs.length) {
        missing.push(...debt.missingFinanceInputs);
      }
      if (isPositive(landCost) && isPositive(buildCost) && isPositive(rent)) {
        const result = calculateDevelopmentToRent({
          landCost: landCost.value,
          buildCost: buildCost.value,
          professionalFees: value("professionalFees").value ?? 0,
          municipalPlanningFees: value("municipalPlanningFees").value ?? 0,
          contingencyPercent: value("contingencyPercent").value ?? 0,
          developmentDurationMonths: value("developmentDurationMonths").value ?? 0,
          monthlyHoldingCost: value("monthlyHoldingCost").value ?? 0,
          expectedMonthlyRent: rent.value,
          vacancyPercent: value("vacancyPercent").value ?? 0,
          operatingExpenses: value("operatingExpenses").value ?? 0,
          bondPayment: debt.monthlyBondPayment ?? 0,
        });
        rows.push(
          moneyRow(
            "total-project-cost",
            "Total project cost",
            result.totalProjectCost,
            "Deterministic calculation",
          ),
        );
        rows.push(
          percentRow("net-yield", "Net yield", result.netYield, "Deterministic calculation"),
        );
        rows.push(
          moneyRow(
            "monthly-cash-flow",
            "Monthly cash flow",
            result.monthlyCashFlow,
            "Deterministic calculation",
          ),
        );
        rows.push(
          moneyRow(
            "break-even-rent",
            "Break-even monthly rent",
            result.breakEvenRent,
            "Deterministic calculation",
          ),
        );
        calculationAvailable = true;
      }
      needsMarket.push("rental");
      break;
    }
    case "str_airbnb": {
      const adr = requirePositive("average daily rate", "averageDailyRate");
      const occupancy = requirePositive("occupancy percentage", "occupancyPercent");
      if (isPositive(adr))
        rows.push(
          moneyRow("average-daily-rate", "Average daily rate", adr.value, "User assumption"),
        );
      if (isPositive(adr) && isPositive(occupancy)) {
        const result = calculateShortTermRental({
          averageDailyRate: adr.value,
          occupancyPercent: occupancy.value,
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
          bondPayment: debt.monthlyBondPayment ?? 0,
          cashInvested: acquisitionCashRequired ?? undefined,
        });
        rows.push(
          moneyRow(
            "monthly-str-revenue",
            "Monthly STR revenue",
            result.grossAccommodationRevenue,
            "Deterministic calculation",
          ),
        );
        rows.push(
          moneyRow(
            "monthly-str-costs",
            "Monthly STR costs",
            result.monthlyOperatingCost,
            "Deterministic calculation",
          ),
        );
        rows.push(
          moneyRow(
            "monthly-net-income",
            "Monthly net income",
            result.monthlyNetIncome,
            "Deterministic calculation",
          ),
        );
        rows.push(
          percentRow(
            "break-even-occupancy",
            "Break-even occupancy",
            result.breakEvenOccupancy,
            "Deterministic calculation",
          ),
        );
        if (acquisitionCashRequired != null && acquisitionCashRequired > 0) {
          rows.push(
            percentRow(
              "cash-on-cash-return",
              "Cash-on-cash return",
              result.cashOnCashReturn,
              "Deterministic calculation",
            ),
          );
        } else {
          rows.push(
            notCalculatedRow(
              "cash-on-cash-return",
              "Cash-on-cash return",
              "Deterministic calculation",
            ),
          );
        }
        calculationAvailable = true;
      }
      needsMarket.push("rental");
      break;
    }
    case "brrrr": {
      const rent = requirePositive("monthly rental income", "monthlyRent");
      const arv = requirePositive("after-repair value", "afterRepairValue");
      const rehabInputs = requirePositiveOneOf("renovation budget or all-in cost", [
        "renovationBudget",
        "allInCost",
      ]);
      const refinanceLtv = requirePositive("refinance LTV", "refinanceLtv");
      if (isPositive(rent))
        rows.push(
          moneyRow("monthly-rental-income", "Monthly rental income", rent.value, "User assumption"),
        );
      if (isPositive(arv))
        rows.push(
          moneyRow("after-repair-value", "After-repair value", arv.value, "User assumption"),
        );
      if (
        isPositive(purchasePrice) &&
        isPositive(rent) &&
        isPositive(arv) &&
        rehabInputs.some(isPositive) &&
        isPositive(refinanceLtv)
      ) {
        const result = calculateBrrrr({
          purchasePrice: purchasePrice.value,
          renovationBudget: value("renovationBudget").value ?? 0,
          allInCost: value("allInCost").value ?? 0,
          afterRepairValue: arv.value,
          refinanceLtv: refinanceLtv.value,
          refinanceFees: value("refinanceFees").value ?? 0,
          monthlyRent: rent.value,
          monthlyExpenses: value("monthlyExpenses").value ?? 0,
          monthlyDebtService: value("monthlyDebtService").value ?? debt.monthlyBondPayment ?? 0,
          targetDscr: value("targetDscr").value ?? 1.2,
        });
        rows.push(
          moneyRow(
            "cash-left-in-deal",
            "Cash left in deal",
            result.cashLeftInDeal,
            "Deterministic calculation",
          ),
        );
        rows.push(
          result.cashLeftInDeal > 0
            ? percentRow(
                "cash-on-cash-return",
                "Cash-on-cash return",
                result.cashOnCashReturn,
                "Deterministic calculation",
              )
            : notCalculatedRow(
                "cash-on-cash-return",
                "Cash-on-cash return",
                "Deterministic calculation",
              ),
        );
        if ((value("monthlyDebtService").value ?? debt.monthlyBondPayment ?? 0) > 0) {
          rows.push(numberRow("dscr", "DSCR", result.dscr.toFixed(2), "Deterministic calculation"));
        } else {
          rows.push(notCalculatedRow("dscr", "DSCR", "Deterministic calculation"));
        }
        calculationAvailable = true;
      }
      needsMarket.push("rental", "exit");
      break;
    }
    case "bond": {
      const explicitLoan = value("loanAmount");
      const depositPercent = value("depositPercent");
      const cashDeclaration =
        (explicitLoan.present && explicitLoan.value === 0) ||
        (depositPercent.present && depositPercent.value === 100);
      const loanSource =
        isPositive(explicitLoan) || cashDeclaration
          ? explicitLoan
          : isPositive(purchasePrice) && hasValidDepositPercent(depositPercent)
            ? purchasePrice
            : { present: false, value: null };
      const loanAmount = isPositive(explicitLoan)
        ? explicitLoan.value
        : isPositive(loanSource)
          ? derivedLoanAmountFromPurchase(loanSource.value, depositPercent)
          : cashDeclaration
            ? 0
            : null;
      if (!isPositive(loanSource) && !cashDeclaration) {
        missing.push("loan amount or purchase price with deposit percentage");
      }
      if (!isPositive(value("interestRate"))) missing.push("interest rate");
      if (!isPositive(value("termYears"))) missing.push("loan term");
      if (cashDeclaration && isPositive(value("interestRate")) && isPositive(value("termYears"))) {
        rows.push(
          moneyRow("monthly-bond-payment", "Monthly bond payment", 0, "Deterministic calculation"),
        );
        rows.push(
          moneyRow("annual-debt-service", "Annual debt service", 0, "Deterministic calculation"),
        );
        rows.push(moneyRow("total-interest", "Total interest", 0, "Deterministic calculation"));
        calculationAvailable = true;
      }
      if (
        loanAmount != null &&
        loanAmount > 0 &&
        isPositive(value("interestRate")) &&
        isPositive(value("termYears"))
      ) {
        const result = calculateBond({
          loanAmount,
          interestRate: value("interestRate").value ?? 0,
          termYears: value("termYears").value ?? 0,
          extraMonthlyPayment: value("extraMonthlyPayment").value ?? 0,
          monthlyNoi: value("monthlyNoi").value ?? 0,
          monthlyRent: value("monthlyRent").value ?? 0,
        });
        rows.push(
          moneyRow(
            "monthly-bond-payment",
            "Monthly bond payment",
            result.monthlyBondPayment,
            "Deterministic calculation",
          ),
        );
        rows.push(
          moneyRow(
            "annual-debt-service",
            "Annual debt service",
            result.annualDebtService,
            "Deterministic calculation",
          ),
        );
        rows.push(
          moneyRow(
            "total-interest",
            "Total interest",
            result.totalInterest,
            "Deterministic calculation",
          ),
        );
        if (isPositive(value("monthlyRent"))) {
          rows.push(
            percentRow(
              "break-even-occupancy",
              "Break-even occupancy",
              result.breakEvenOccupancy,
              "Deterministic calculation",
            ),
          );
        }
        if (isPositive(value("monthlyNoi"))) {
          rows.push(numberRow("dscr", "DSCR", result.dscr.toFixed(2), "Deterministic calculation"));
        }
        calculationAvailable = true;
      }
      break;
    }
    case "land_bank": {
      const futureValue = value("futureValue");
      const monthlyHoldingCost = value("monthlyHoldingCost");
      const holdingYears = value("annualHoldingYears");
      if (isPositive(futureValue)) {
        rows.push(
          moneyRow(
            "projected-exit-value",
            "Projected exit value",
            futureValue.value,
            "User assumption",
          ),
        );
        needsMarket.push("exit");
      }
      if (isPositive(monthlyHoldingCost) && isPositive(holdingYears)) {
        rows.push(
          moneyRow(
            "holding-cost",
            "Projected holding cost",
            monthlyHoldingCost.value * holdingYears.value * 12,
            "Deterministic calculation",
          ),
        );
        calculationAvailable = true;
      }
      break;
    }
    case "custom": {
      const meaningful = CUSTOM_MEANINGFUL_FIELDS.map(
        (key) => [key, scenario.inputs[key]] as const,
      ).filter(([key, raw]) => {
        const trimmed = String(raw ?? "").trim();
        if (!trimmed) return false;
        return key === "customNotes" || isPositive(parseInput(trimmed));
      });
      if (meaningful.length === 0) missing.push("at least one saved custom assumption");
      const customUpside = value("customUpside");
      if (isPositive(customUpside)) {
        rows.push(
          moneyRow("projected-profit", "Projected profit", customUpside.value, "User assumption"),
        );
        needsMarket.push("comparable");
      }
      assumptions.push(
        ...meaningful.slice(0, 4).map(([key, raw]) => `${labelFromKey(key)}: ${raw}`),
      );
      break;
    }
  }

  return {
    supportedStrategy: true,
    requiredInputsComplete: missing.length === 0,
    calculationAvailable,
    missingInputs: unique(missing),
    warnings: strategyWarnings(strategy, missing),
    rows: rows.length || strategy === "custom" ? rows : fallbackSummaryRows(scenario),
    assumptions,
    needsMarket: unique(needsMarket),
  };
}

function appendAcquisitionBasisRows(input: {
  rows: InvestorNumberRow[];
  assumptions: string[];
  basis: AcquisitionBasis;
  acquisitionCosts: { present: boolean; value: number };
  debt: DebtResolution;
  depositPercent: ParsedInput;
  includeTotals: boolean;
}) {
  const basis = input.basis;
  if (!isPositive(basis.input)) return null;
  input.rows.push(moneyRow(basis.id, basis.label, basis.input.value, "User assumption"));
  input.assumptions.push(`${basis.label}: ${formatMoney(basis.input.value)}`);
  if (!input.includeTotals) return null;

  input.rows.push(
    input.acquisitionCosts.present
      ? moneyRow(
          "acquisition-costs",
          "Acquisition and transfer costs",
          input.acquisitionCosts.value,
          "User assumption",
        )
      : missingRow("acquisition-costs", "Acquisition and transfer costs", "User assumption"),
  );

  input.rows.push(
    input.acquisitionCosts.present
      ? moneyRow(
          "total-acquisition-cost",
          "Total acquisition cost including purchase price",
          basis.input.value + input.acquisitionCosts.value,
          "Deterministic calculation",
        )
      : notCalculatedRow(
          "total-acquisition-cost",
          "Total acquisition cost including purchase price",
          "Deterministic calculation",
        ),
  );

  const totalCashRequired = totalCashRequiredFromSavedInputs(
    basis.input.value,
    input.acquisitionCosts,
    input.debt,
    input.depositPercent,
  );
  input.rows.push(
    totalCashRequired != null
      ? moneyRow(
          "total-cash-required",
          "Total cash required",
          totalCashRequired,
          "Deterministic calculation",
        )
      : notCalculatedRow("total-cash-required", "Total cash required", "Deterministic calculation"),
  );
  return totalCashRequired;
}

function totalCashRequiredFromSavedInputs(
  basisValue: number,
  acquisitionCosts: { present: boolean; value: number },
  debt: DebtResolution,
  depositPercent: ParsedInput,
) {
  if (!acquisitionCosts.present) return null;
  if (debt.cashPurchase) return basisValue + acquisitionCosts.value;
  if (debt.loanAmount != null && debt.loanAmount > 0) {
    return Math.max(0, basisValue - debt.loanAmount) + acquisitionCosts.value;
  }
  if (isPositive(depositPercent)) {
    return basisValue * (depositPercent.value / 100) + acquisitionCosts.value;
  }
  return null;
}

function debtBasisForStrategy(
  strategy: StrategyKind,
  value: (key: string) => ParsedInput,
  purchasePrice: ParsedInput,
  landCost: ParsedInput,
  acquisitionBasis: AcquisitionBasis | null,
) {
  switch (strategy) {
    case "buy_hold":
    case "flip":
    case "brrrr":
      return isPositive(purchasePrice) ? purchasePrice.value : null;
    case "development_rent":
      return isPositive(landCost) ? landCost.value : null;
    case "development_sell":
      return null;
    case "land_bank":
      return acquisitionBasis && isPositive(acquisitionBasis.input)
        ? acquisitionBasis.input.value
        : null;
    case "bond":
      return isPositive(purchasePrice) && hasValidDepositPercent(value("depositPercent"))
        ? purchasePrice.value
        : null;
    case "str_airbnb":
    case "custom":
      return null;
  }
}

function hasValidDepositPercent(depositPercent: ParsedInput) {
  return (
    depositPercent.present &&
    depositPercent.value != null &&
    depositPercent.value >= 0 &&
    depositPercent.value <= 100
  );
}

function derivedLoanAmountFromPurchase(purchasePrice: number, depositPercent: ParsedInput) {
  if (hasValidDepositPercent(depositPercent)) {
    return Math.max(0, purchasePrice * (1 - Number(depositPercent.value) / 100));
  }
  return null;
}

function buyHoldResult(
  value: (key: string) => ParsedInput,
  purchasePrice: number,
  monthlyRent: number,
  monthlyBondPayment: number,
  totalCashInvested: number,
  loanAmount: number,
) {
  return calculateBuyHold({
    purchasePrice,
    totalCashInvested,
    monthlyRent,
    otherIncome: value("otherIncome").value ?? 0,
    vacancyPercent: value("vacancyPercent").value ?? 0,
    monthlyRates: value("monthlyRates").value ?? 0,
    monthlyLevies: value("monthlyLevies").value ?? 0,
    insurance: value("insurance").value ?? 0,
    utilitiesPaidByOwner: value("utilitiesPaidByOwner").value ?? 0,
    capitalExpenditureReserve: value("maintenanceReserve").value ?? 0,
    maintenancePercent: 0,
    managementPercent: value("propertyManagementPercent").value ?? 0,
    otherMonthlyCosts:
      (value("security").value ?? 0) +
      (value("gardenPool").value ?? 0) +
      (value("otherMonthlyCosts").value ?? 0),
    monthlyBondPayment,
    holdingPeriodYears: value("annualHoldingYears").value ?? 0,
    sellingCostPercent: 6,
    loanAmount,
  });
}

function netYieldRow(input: Parameters<typeof calculateBuyHold>[0]) {
  const result = calculateBuyHold(input);
  return percentRow("net-yield", "Net yield", result.netYield, "Deterministic calculation");
}

function resolveDebt(
  value: (key: string) => ParsedInput,
  purchasePrice: number | null,
): DebtResolution {
  const explicitLoan = value("loanAmount");
  const depositPercent = value("depositPercent");
  const interestRate = value("interestRate");
  const termYears = value("termYears");
  const explicitMonthlyBond = value("monthlyBondPayment");
  const hasDebtTerms =
    isPositive(explicitLoan) ||
    explicitLoan.present ||
    isPositive(explicitMonthlyBond) ||
    (depositPercent.present && depositPercent.value != null && depositPercent.value < 100);

  if (explicitLoan.present && explicitLoan.value === 0) {
    return {
      loanAmount: 0,
      monthlyBondPayment: 0,
      bondResult: null,
      cashPurchase: true,
      debtIntended: false,
      missingFinanceInputs: [],
    };
  }
  if (depositPercent.present && depositPercent.value === 100) {
    return {
      loanAmount: 0,
      monthlyBondPayment: 0,
      bondResult: null,
      cashPurchase: true,
      debtIntended: false,
      missingFinanceInputs: [],
    };
  }
  if (isPositive(explicitMonthlyBond)) {
    return {
      loanAmount: isPositive(explicitLoan) ? explicitLoan.value : null,
      monthlyBondPayment: explicitMonthlyBond.value,
      bondResult: null,
      cashPurchase: false,
      debtIntended: true,
      missingFinanceInputs: [],
    };
  }

  const loanAmount = isPositive(explicitLoan)
    ? explicitLoan.value
    : purchasePrice != null && depositPercent.present
      ? derivedLoanAmountFromPurchase(purchasePrice, depositPercent)
      : null;
  if (loanAmount === 0) {
    return {
      loanAmount: 0,
      monthlyBondPayment: 0,
      bondResult: null,
      cashPurchase: true,
      debtIntended: false,
      missingFinanceInputs: [],
    };
  }
  if (loanAmount != null && loanAmount > 0 && isPositive(interestRate) && isPositive(termYears)) {
    const result = calculateBond({
      loanAmount,
      interestRate: interestRate.value,
      termYears: termYears.value,
      extraMonthlyPayment: value("extraMonthlyPayment").value ?? 0,
      monthlyNoi: value("monthlyNoi").value ?? 0,
      monthlyRent: value("monthlyRent").value ?? 0,
    });
    return {
      loanAmount,
      monthlyBondPayment: result.monthlyBondPayment,
      bondResult: result,
      cashPurchase: false,
      debtIntended: true,
      missingFinanceInputs: [],
    };
  }

  const missingFinanceInputs: string[] = [];
  if (hasDebtTerms) {
    if (loanAmount == null || loanAmount <= 0) missingFinanceInputs.push("loan amount");
    if (!isPositive(interestRate)) missingFinanceInputs.push("interest rate");
    if (!isPositive(termYears)) missingFinanceInputs.push("loan term");
  }
  return {
    loanAmount,
    monthlyBondPayment: null,
    bondResult: null,
    cashPurchase: false,
    debtIntended: hasDebtTerms,
    missingFinanceInputs,
  };
}

function acquisitionCostInputs(value: (key: string) => ParsedInput) {
  const parsed = ACQUISITION_COST_KEYS.map((key) => value(key));
  return {
    present: parsed.some((item) => item.present),
    value: parsed.reduce((sum, item) => sum + (item.value ?? 0), 0),
  };
}

function requireDevelopmentDurationIfHoldingCost(
  value: (key: string) => ParsedInput,
  missing: string[],
) {
  const monthlyHoldingCost = value("monthlyHoldingCost");
  const duration = value("developmentDurationMonths");
  if (isPositive(monthlyHoldingCost) && !isPositive(duration)) {
    missing.push("development duration");
  }
}

function parseInput(raw: string | undefined): ParsedInput {
  if (raw == null || raw.trim() === "") return { present: false, value: null };
  const parsed = Number(raw.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed)
    ? { present: true, value: parsed }
    : { present: false, value: null };
}

function isPositive(input: ParsedInput): input is { present: true; value: number } {
  return input.present && input.value != null && input.value > 0;
}

function moneyRow(
  id: string,
  label: string,
  value: number,
  provenance: InvestorNumberProvenance,
): InvestorNumberRow {
  if (!Number.isFinite(value)) return notCalculatedRow(id, label, provenance);
  return { id, label, value: formatMoney(value), provenance, state: "available" };
}

function percentRow(
  id: string,
  label: string,
  value: number,
  provenance: InvestorNumberProvenance,
): InvestorNumberRow {
  if (!Number.isFinite(value)) return notCalculatedRow(id, label, provenance);
  return {
    id,
    label,
    value: `${(value * 100).toFixed(1)}%`,
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
  }).format(Math.round(value));
}

function strategyWarnings(strategy: StrategyKind, missing: string[]) {
  const warnings = missing.map((item) => `Missing ${item}.`);
  if (strategy === "str_airbnb") warnings.push("Verify STR rules, seasonality and occupancy.");
  if (strategy.startsWith("development"))
    warnings.push("Verify zoning, services and buildability.");
  return warnings;
}

function buildMarketSupport(
  strategy: StrategyAnalysis,
  comps: SavedMarketEvidence[],
  subjectListing?: SavedMarketEvidence | null,
): MarketSupport {
  const pricedExitComparableCount = comps.filter((item) => (item.askingPrice ?? 0) > 0).length;
  const needsRentalSupport = strategy.needsMarket.includes("rental");
  const needsExitSupport = strategy.needsMarket.includes("exit");
  const needsComparableSupport = strategy.needsMarket.includes("comparable");
  const needsSubjectListing = strategy.needsMarket.includes("asking");
  const missingInputs: string[] = [];

  if (needsSubjectListing && !subjectListing) missingInputs.push("Add the active subject listing.");
  if (needsComparableSupport && comps.length < 3)
    missingInputs.push("Save comparable market evidence.");
  if (needsRentalSupport) {
    missingInputs.push("Rental support is not structurally verified.");
  }
  if (needsExitSupport && pricedExitComparableCount < 3) {
    missingInputs.push("Add exit-value market support.");
  }

  const insufficient =
    (needsSubjectListing && !subjectListing) ||
    (needsComparableSupport && comps.length < 3) ||
    needsRentalSupport ||
    (needsExitSupport && pricedExitComparableCount < 3);

  const parts = [
    `Subject listing: ${subjectListing ? "saved" : "not saved"}`,
    `Comparable evidence: ${comps.length} included item${comps.length === 1 ? "" : "s"}`,
  ];
  if (needsRentalSupport) parts.push("Rental support: not structurally verified");
  if (needsExitSupport) {
    parts.push(
      `Exit-value support: ${pricedExitComparableCount} priced comparable${pricedExitComparableCount === 1 ? "" : "s"}`,
    );
  }
  if (!needsRentalSupport && !needsExitSupport && !needsComparableSupport && !needsSubjectListing) {
    parts.push("Strategy does not require extra market support yet");
  }

  return {
    subjectListingSaved: Boolean(subjectListing),
    comparableCount: comps.length,
    pricedExitComparableCount,
    needsRentalSupport,
    needsExitSupport,
    needsComparableSupport,
    needsSubjectListing,
    insufficient,
    missingInputs,
    status: parts.join("; "),
  };
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

function supportingEvidence(report: ReportViewModel, marketSupport: MarketSupport) {
  const items = new Set<string>();
  if (report.identity.erfNumber || report.identity.lpi || report.identity.parcelKey) {
    items.add("Official parcel identifiers are available.");
  }
  if (report.identity.marketAddressLine) items.add("A user-confirmed Market address is saved.");
  if (marketSupport.subjectListingSaved)
    items.add("A subject active listing is saved for this erf.");
  if (marketSupport.comparableCount > 0) {
    items.add(
      `${marketSupport.comparableCount} comparable evidence item${marketSupport.comparableCount === 1 ? "" : "s"} saved.`,
    );
  }
  if (marketSupport.pricedExitComparableCount > 0) {
    items.add(
      `${marketSupport.pricedExitComparableCount} priced exit comparable${marketSupport.pricedExitComparableCount === 1 ? "" : "s"} saved.`,
    );
  }
  if (report.site.acceptedBuildEnvelope) {
    items.add("An indicative Site Potential build envelope has been accepted.");
  }
  if (report.documents.uploadedReportCount > 0)
    items.add("Paid report documents are uploaded for reference.");
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
  marketSupport: MarketSupport,
) {
  const risks = new Set<string>();
  if (marketSupport.insufficient)
    risks.add("Market support is weak, missing, or not structurally verified.");
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
  report: ReportViewModel;
  strategy: StrategyAnalysis;
  marketSupport: MarketSupport;
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
    if (/purchase|acquisition|land/.test(missing)) {
      actions.push({
        id: "confirm-acquisition-price",
        label: "Confirm the acquisition or land price",
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
  if (!input.marketSupport.subjectListingSaved) {
    actions.push({
      id: "add-subject-listing",
      label: "Add the active subject listing",
      body: "Attach the current active listing if this erf is listed for sale.",
      tab: "listings",
    });
  }
  if (input.marketSupport.needsRentalSupport) {
    actions.push({
      id: "save-rental-support",
      label: "Save rental support",
      body: "Add rental or STR-specific evidence before relying on rental assumptions.",
      tab: "listings",
    });
  }
  if (input.marketSupport.needsExitSupport && input.marketSupport.pricedExitComparableCount < 3) {
    actions.push({
      id: "save-exit-comps",
      label: "Save priced exit comparables",
      body: "Add priced comparable evidence for the selected exit strategy.",
      tab: "listings",
    });
  }
  if (input.marketSupport.needsComparableSupport && input.marketSupport.comparableCount < 3) {
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

function labelFromKey(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
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
