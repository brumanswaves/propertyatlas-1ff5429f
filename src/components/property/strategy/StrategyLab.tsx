import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Save } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth/useAuth";
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
import { cn } from "@/lib/utils";
import {
  mergeStrategyWorkspaces,
  getChosenStrategyScenario,
  readStrategyWorkspace,
  readStrategyScenarios,
  saveStrategyDraft,
  saveStrategyScenario,
  strategyWorkspaceFromUserData,
  writeStrategyWorkspace,
  type ErfStrategyWorkspace,
  type ErfStrategyScenario,
} from "@/lib/workbench/erfWorkspaceState";
import { supabase } from "@/integrations/supabase/client";

type StrategyType =
  | "buy_hold"
  | "flip"
  | "development_sell"
  | "development_rent"
  | "str_airbnb"
  | "brrrr"
  | "bond"
  | "land_bank"
  | "custom";

interface StrategyOption {
  id: StrategyType;
  label: string;
  description: string;
  bestFor: string;
  keyOutput: string;
}

interface SitePotentialStrategyDraft {
  source?: string;
  projectId?: string;
  selectedDesignAssetId?: string | null;
  conceptTitle?: string | null;
  buildableSqm?: string;
  notes?: string[];
}

const STRATEGY_OPTIONS: StrategyOption[] = [
  {
    id: "buy_hold",
    label: "Buy and hold rental",
    description: "Test rent, vacancy, costs, debt and long-term cash flow.",
    bestFor: "Long-term investors",
    keyOutput: "Cash flow, NOI and yield",
  },
  {
    id: "flip",
    label: "Flip / renovate and resell",
    description: "Check renovation, holding, contingency and resale assumptions.",
    bestFor: "Short-term resale plays",
    keyOutput: "Profit, ROI and annualised ROI",
  },
  {
    id: "development_sell",
    label: "Development to sell",
    description: "Model land, build, planning, holding, exit costs and resale value.",
    bestFor: "Build-and-sell projects",
    keyOutput: "Project cost, margin and break-even sale price",
  },
  {
    id: "development_rent",
    label: "Development to rent",
    description: "Model a completed rental asset after development costs and holding period.",
    bestFor: "Build-to-rent decisions",
    keyOutput: "NOI, cash flow and net yield",
  },
  {
    id: "str_airbnb",
    label: "STR / Airbnb",
    description: "Estimate nightly revenue, occupancy, platform fees and operating costs.",
    bestFor: "Short-term rental operators",
    keyOutput: "Booked nights, net income and break-even occupancy",
  },
  {
    id: "brrrr",
    label: "BRRRR",
    description: "Buy, renovate, rent, refinance and check cash left in the deal.",
    bestFor: "Refinance-led investors",
    keyOutput: "Cash returned, equity and cash-on-cash return",
  },
  {
    id: "bond",
    label: "Bond / finance scenario",
    description: "Check monthly bond payment, debt service and break-even occupancy.",
    bestFor: "Finance sensitivity",
    keyOutput: "Payment, DSCR and interest cost",
  },
  {
    id: "land_bank",
    label: "Land bank / hold vacant land",
    description: "Estimate holding costs while keeping vacant land for future optionality.",
    bestFor: "Vacant erf hold strategy",
    keyOutput: "Holding cost and future value gap",
  },
  {
    id: "custom",
    label: "Custom scenario / other",
    description: "Capture a simple custom strategy with your own key assumptions.",
    bestFor: "Unusual deals",
    keyOutput: "Cash required, upside and notes",
  },
];

function strategyDefaults(defaultPrice: number): Record<string, string> {
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

function toNumber(value: string | undefined) {
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRand(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(Math.round(Number.isFinite(value) ? value : 0));
}

function formatPercent(value: number) {
  return `${((Number.isFinite(value) ? value : 0) * 100).toFixed(1)}%`;
}

function optionFor(id: StrategyType) {
  return STRATEGY_OPTIONS.find((option) => option.id === id) ?? STRATEGY_OPTIONS[0];
}

function selectedStrategyId(scenario: ErfStrategyScenario | null): StrategyType {
  return STRATEGY_OPTIONS.some((option) => option.id === scenario?.strategy)
    ? (scenario?.strategy as StrategyType)
    : "buy_hold";
}

function readSitePotentialStrategyDraft(parcelId: string): SitePotentialStrategyDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`easyErf.sitePotential.strategyDraft.${parcelId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SitePotentialStrategyDraft;
    return parsed?.source === "site-potential" ? parsed : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function persistStrategyWorkspaceToCloud(
  userId: string,
  parcelId: string,
  workspace: ErfStrategyWorkspace,
) {
  const { data, error: readError } = await supabase
    .from("saved_properties")
    .select("user_data")
    .eq("user_id", userId)
    .eq("parcel_id", parcelId)
    .maybeSingle();
  if (readError) throw readError;

  const existingUserData = isRecord(data?.user_data) ? data.user_data : {};
  const userData = {
    ...existingUserData,
    normalizedParcelId: parcelId,
    strategyWorkspace: workspace,
    strategyWorkspaceUpdatedAt: new Date().toISOString(),
  };
  const { error } = await supabase.from("saved_properties").upsert(
    {
      user_id: userId,
      parcel_id: parcelId,
      user_data: userData as unknown as Record<string, unknown> as never,
    },
    { onConflict: "user_id,parcel_id" },
  );
  if (error) throw error;
}

export function StrategyLab({
  parcelId,
  defaultPrice,
  onOpenReport,
}: {
  parcelId: string;
  defaultPrice: number;
  onOpenReport?: () => void;
}) {
  const { user } = useAuth();
  const initialWorkspace = readStrategyWorkspace(parcelId);
  const [active, setActive] = useState<StrategyType>(() =>
    STRATEGY_OPTIONS.some((option) => option.id === initialWorkspace.activeStrategy)
      ? (initialWorkspace.activeStrategy as StrategyType)
      : "buy_hold",
  );
  const [values, setValues] = useState(() => ({
    ...strategyDefaults(defaultPrice),
    ...initialWorkspace.draftInputs,
  }));
  const [savedScenarios, setSavedScenarios] = useState(() => readStrategyScenarios(parcelId));
  const [chosenScenario, setChosenScenario] = useState(() => getChosenStrategyScenario(parcelId));
  const [showChosenState, setShowChosenState] = useState(Boolean(chosenScenario));
  const [sitePotentialDraft, setSitePotentialDraft] = useState(() =>
    readSitePotentialStrategyDraft(parcelId),
  );
  const defaultPriceRef = useRef(defaultPrice);
  const cloudSaveErrorShownRef = useRef(false);
  defaultPriceRef.current = defaultPrice;

  useEffect(() => {
    const workspace = readStrategyWorkspace(parcelId);
    const chosen = getChosenStrategyScenario(parcelId);
    setSavedScenarios(workspace.scenarios);
    setChosenScenario(chosen);
    setActive(
      STRATEGY_OPTIONS.some((option) => option.id === workspace.activeStrategy)
        ? (workspace.activeStrategy as StrategyType)
        : selectedStrategyId(chosen),
    );
    setValues({ ...strategyDefaults(defaultPriceRef.current), ...workspace.draftInputs });
    setShowChosenState(Boolean(chosen));
    setSitePotentialDraft(readSitePotentialStrategyDraft(parcelId));
    cloudSaveErrorShownRef.current = false;
  }, [parcelId]);

  useEffect(() => {
    let alive = true;
    if (!user) return () => {
      alive = false;
    };

    supabase
      .from("saved_properties")
      .select("user_data")
      .eq("user_id", user.id)
      .eq("parcel_id", parcelId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          console.warn("[Easy Erf] Strategy workspace cloud load failed", error.message);
          return;
        }
        const remote = strategyWorkspaceFromUserData(parcelId, data?.user_data);
        if (!remote) return;
        const merged = writeStrategyWorkspace(
          parcelId,
          mergeStrategyWorkspaces(parcelId, readStrategyWorkspace(parcelId), remote),
        );
        const chosen = getChosenStrategyScenario(parcelId);
        setSavedScenarios(merged.scenarios);
        setChosenScenario(chosen);
        setActive(
          STRATEGY_OPTIONS.some((option) => option.id === merged.activeStrategy)
            ? (merged.activeStrategy as StrategyType)
            : selectedStrategyId(chosen),
        );
        setValues({ ...strategyDefaults(defaultPriceRef.current), ...merged.draftInputs });
        setShowChosenState(Boolean(chosen));
      });

    return () => {
      alive = false;
    };
  }, [parcelId, user]);

  function persistWorkspace(workspace: ErfStrategyWorkspace) {
    if (!user) return;
    void persistStrategyWorkspaceToCloud(user.id, parcelId, workspace).catch((error) => {
      console.warn("[Easy Erf] Strategy workspace cloud save failed", error);
      if (!cloudSaveErrorShownRef.current) {
        cloudSaveErrorShownRef.current = true;
        toast.message("Strategy draft saved on this device. Cloud sync will retry on the next edit.");
      }
    });
  }

  function persistDraft(nextActive: StrategyType, nextValues: Record<string, string>) {
    const workspace = saveStrategyDraft(parcelId, {
      activeStrategy: nextActive,
      draftInputs: nextValues,
    });
    persistWorkspace(workspace);
    return workspace;
  }

  const n = (key: string) => toNumber(values[key]);
  const setValue = (key: string, value: string) =>
    setValues((current) => {
      const next = { ...current, [key]: value };
      persistDraft(active, next);
      setShowChosenState(false);
      return next;
    });

  const loanAmount =
    n("loanAmount") || Math.max(0, n("purchasePrice") * (1 - n("depositPercent") / 100));
  const monthlyBond =
    n("monthlyBondPayment") ||
    calculateBond({
      loanAmount,
      interestRate: n("interestRate"),
      termYears: n("termYears"),
      extraMonthlyPayment: 0,
      monthlyNoi: 0,
      monthlyRent: n("monthlyRent"),
    }).monthlyBondPayment;
  const acquisition = calculateAcquisition({
    purchasePrice: n("purchasePrice"),
    depositPercent: n("depositPercent"),
    transferDuty: n("transferDuty"),
    conveyancerFees: n("transferCosts") + n("attorneyFees"),
    bondRegistrationFees: n("bondCosts"),
    initiationFees: n("financeFees"),
    inspectionAllowance: n("inspectionCosts"),
    renovationBudget: n("renovationBudget"),
    furnitureBudget: n("furnishingSetupCost"),
    cashBuffer: n("otherAcquisitionCosts"),
  });
  const rental = calculateBuyHold({
    purchasePrice: n("purchasePrice"),
    totalCashInvested: acquisition.totalCashRequired || n("deposit"),
    monthlyRent: n("monthlyRent"),
    otherIncome: n("otherIncome"),
    vacancyPercent: n("vacancyPercent"),
    monthlyRates: n("monthlyRates"),
    monthlyLevies: n("monthlyLevies"),
    insurance: n("insurance"),
    utilitiesPaidByOwner: n("utilitiesPaidByOwner"),
    capitalExpenditureReserve: n("maintenanceReserve"),
    maintenancePercent: 0,
    managementPercent: n("propertyManagementPercent"),
    otherMonthlyCosts: n("security") + n("gardenPool") + n("otherMonthlyCosts"),
    monthlyBondPayment: monthlyBond,
    holdingPeriodYears: n("annualHoldingYears"),
    sellingCostPercent: 6,
    loanAmount,
  });
  const flip = calculateFlip({
    purchasePrice: n("purchasePrice"),
    acquisitionCosts:
      n("transferDuty") +
      n("transferCosts") +
      n("bondCosts") +
      n("attorneyFees") +
      n("inspectionCosts") +
      n("otherAcquisitionCosts"),
    renovationBudget: n("renovationBudget"),
    contingencyPercent: n("contingencyPercent"),
    holdingMonths: n("holdingMonths"),
    monthlyHoldingCost: n("monthlyHoldingCost"),
    expectedResalePrice: n("expectedResalePrice"),
    agentCommissionPercent: n("agentCommission"),
    sellingCosts: n("sellingCosts"),
    targetProfit: 0,
    targetRoiPercent: 20,
  });
  const developmentSell = calculateDevelopmentToSell({
    landCost: n("landCost"),
    buildCost: n("buildCost"),
    professionalFees: n("professionalFees"),
    municipalPlanningFees: n("municipalPlanningFees"),
    contingencyPercent: n("contingencyPercent"),
    developmentDurationMonths: n("developmentDurationMonths"),
    monthlyHoldingCost: n("monthlyHoldingCost"),
    exitSellingCosts: n("exitSellingCosts") + n("sellingCosts"),
    expectedSaleValue: n("expectedSaleValue"),
  });
  const developmentRent = calculateDevelopmentToRent({
    landCost: n("landCost"),
    buildCost: n("buildCost"),
    professionalFees: n("professionalFees"),
    municipalPlanningFees: n("municipalPlanningFees"),
    contingencyPercent: n("contingencyPercent"),
    developmentDurationMonths: n("developmentDurationMonths"),
    monthlyHoldingCost: n("monthlyHoldingCost"),
    expectedMonthlyRent: n("expectedMonthlyRent"),
    vacancyPercent: n("vacancyPercent"),
    operatingExpenses: n("operatingExpenses"),
    bondPayment: monthlyBond,
  });
  const str = calculateShortTermRental({
    averageDailyRate: n("averageDailyRate"),
    occupancyPercent: n("occupancyPercent"),
    nightsPerMonth: n("nightsPerMonth"),
    platformFeePercent: n("platformFeePercent"),
    cleaningRevenue: n("cleaningRevenue"),
    cleaningCost: n("cleaningCost"),
    utilities: n("utilities"),
    internet: n("internet"),
    linenLaundry: n("linenLaundry"),
    managementPercent: n("strManagementPercent"),
    maintenanceReserve: n("maintenanceReserve"),
    furnishingSetupCost: n("furnishingSetupCost"),
    bondPayment: monthlyBond,
    cashInvested: acquisition.totalCashRequired || n("furnishingSetupCost"),
  });
  const brrrr = calculateBrrrr({
    purchasePrice: n("purchasePrice"),
    renovationBudget: n("renovationBudget"),
    allInCost: n("allInCost"),
    afterRepairValue: n("afterRepairValue"),
    refinanceLtv: n("refinanceLtv"),
    refinanceFees: n("refinanceFees"),
    monthlyRent: n("monthlyRent"),
    monthlyExpenses: n("monthlyExpenses"),
    monthlyDebtService: n("monthlyDebtService") || monthlyBond,
    targetDscr: n("targetDscr"),
  });
  const bond = calculateBond({
    loanAmount,
    interestRate: n("interestRate"),
    termYears: n("termYears"),
    extraMonthlyPayment: 0,
    monthlyNoi: rental.monthlyNoi,
    monthlyRent: n("monthlyRent"),
  });
  const landBankHoldingCost =
    n("holdingMonths") * (n("monthlyHoldingCost") + n("monthlyRates") + n("monthlyLevies"));

  const summary = (() => {
    switch (active) {
      case "buy_hold":
        return [
          ["Monthly cash flow", formatRand(rental.cashFlowAfterDebt)],
          ["Net yield", formatPercent(rental.netYield)],
          ["Cash-on-cash", formatPercent(rental.cashOnCashReturn)],
          ["Break-even rent", formatRand(rental.breakEvenRent)],
        ];
      case "flip":
        return [
          ["Net profit", formatRand(flip.profit)],
          ["ROI", formatPercent(flip.roi)],
          ["Annualised ROI", formatPercent(flip.annualizedRoi)],
          ["Total project cost", formatRand(flip.totalProjectCost)],
        ];
      case "development_sell":
        return [
          ["Net profit", formatRand(developmentSell.netProfit)],
          ["Margin", formatPercent(developmentSell.margin)],
          ["Return on cost", formatPercent(developmentSell.returnOnCost)],
          ["Break-even sale price", formatRand(developmentSell.breakEvenSalePrice)],
        ];
      case "development_rent":
        return [
          ["Monthly cash flow", formatRand(developmentRent.monthlyCashFlow)],
          ["Net yield", formatPercent(developmentRent.netYield)],
          ["Project cost", formatRand(developmentRent.totalProjectCost)],
          ["Break-even rent", formatRand(developmentRent.breakEvenRent)],
        ];
      case "str_airbnb":
        return [
          ["Booked nights", `${str.bookedNights}`],
          ["Monthly net income", formatRand(str.monthlyNetIncome)],
          ["Cash flow", formatRand(str.monthlyCashFlow)],
          ["Break-even occupancy", formatPercent(str.breakEvenOccupancy)],
        ];
      case "brrrr":
        return [
          ["Cash returned", formatRand(brrrr.cashReturned)],
          ["Cash left in deal", formatRand(brrrr.cashLeftInDeal)],
          ["Cash-on-cash", formatPercent(brrrr.cashOnCashReturn)],
          ["Refinance DSCR", brrrr.dscr.toFixed(2)],
        ];
      case "bond":
        return [
          ["Monthly bond payment", formatRand(bond.monthlyBondPayment)],
          ["Annual debt service", formatRand(bond.annualDebtService)],
          ["Total interest", formatRand(bond.totalInterest)],
          ["Break-even occupancy", formatPercent(bond.breakEvenOccupancy)],
        ];
      case "land_bank":
        return [
          ["Holding cost", formatRand(landBankHoldingCost)],
          ["Monthly holding cost", formatRand(n("monthlyHoldingCost"))],
          ["Future value target", formatRand(n("futureValue"))],
          ["Cash required", formatRand(acquisition.totalCashRequired)],
        ];
      case "custom":
        return [
          ["Cash required", formatRand(acquisition.totalCashRequired)],
          ["Custom upside", formatRand(n("customUpside"))],
          ["Monthly rent", formatRand(n("monthlyRent"))],
          ["Bond payment", formatRand(monthlyBond)],
        ];
    }
  })();

  const missingAssumptions = [
    active === "development_sell" ? developmentSell.missingAssumptions : [],
    active === "development_rent" ? developmentRent.missingAssumptions : [],
    active === "str_airbnb" ? str.missingAssumptions : [],
    n("purchasePrice") > 0 || active.startsWith("development") ? [] : ["purchase price"],
  ].flat();
  const riskNotes = [
    "Adjust these assumptions before relying on the result.",
    "This is a planning scenario, not a valuation guarantee.",
    active === "str_airbnb"
      ? "Needs verification: short-term letting rules and seasonality."
      : null,
    active.startsWith("development")
      ? "Needs verification: zoning, services and buildability."
      : null,
  ].filter((note): note is string => Boolean(note));

  function chooseStrategy(id: StrategyType) {
    setActive(id);
    persistDraft(id, values);
    setShowChosenState(false);
  }

  function reset() {
    const next = strategyDefaults(defaultPrice);
    setValues(next);
    persistDraft(active, next);
    setShowChosenState(false);
  }

  function applySitePotentialDraft() {
    if (!sitePotentialDraft) return;
    const notes = [
      sitePotentialDraft.conceptTitle
        ? `Site Potential concept: ${sitePotentialDraft.conceptTitle}`
        : null,
      ...(sitePotentialDraft.notes ?? []),
      sitePotentialDraft.selectedDesignAssetId
        ? `Selected design asset: ${sitePotentialDraft.selectedDesignAssetId}`
        : null,
    ].filter((note): note is string => Boolean(note));
    const nextActive = "development_sell";
    setActive(nextActive);
    setValues((current) => {
      const next = {
      ...current,
      customNotes: [current.customNotes, ...notes].filter(Boolean).join("\n"),
      };
      persistDraft(nextActive, next);
      return next;
    });
    setShowChosenState(false);
    toast.success("Site Potential draft applied. Review the numbers before saving.");
  }

  function saveScenario() {
    const option = optionFor(active);
    const { scenario, scenarios } = saveStrategyScenario(parcelId, {
      label: `${option.label} scenario`,
      strategy: active,
      inputs: values,
      summary: summary.map(([label, value]) => ({ label, value })),
    });
    setSavedScenarios(scenarios);
    setChosenScenario(scenario);
    setShowChosenState(true);
    persistWorkspace(readStrategyWorkspace(parcelId));
    toast.success("Scenario chosen for this erf.");
  }

  const activeOption = optionFor(active);

  return (
    <div className="space-y-5">
      <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-[#F7FBFF] p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">
              Strategy Lab
            </div>
            <h3 className="mt-1 text-xl font-semibold tracking-tight text-[#0D1B2A]">
              Choose a strategy for this erf
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/68">
              Every input autosaves as a draft for this erf. Save a scenario only when you want that
              version to feed the Easy Erf Report.
            </p>
            <div className="mt-3 inline-flex rounded-full border border-[#0D1B2A]/10 bg-white px-3 py-1 text-[11px] font-semibold text-[#0D1B2A]/70">
              Autosaved draft separate from chosen report scenario
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-[#0D1B2A]/10 bg-white px-3 py-2 text-[11px] font-semibold text-[#0D1B2A] hover:bg-[#fbf8f1]"
            >
              Reset assumptions
            </button>
            <button
              type="button"
              onClick={saveScenario}
              className="rounded-full bg-[#FF6A00] px-4 py-2 text-[11px] font-semibold text-white hover:bg-[#ff7d1f]"
            >
              <Save className="mr-1 inline h-3.5 w-3.5" />
              Save scenario
            </button>
          </div>
        </div>
      </section>

      {sitePotentialDraft && (
        <section className="rounded-[1.5rem] border border-[#FF6A00]/25 bg-[#fff8ec] p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#B24A00]">
            Site Potential draft ready
          </div>
          <h4 className="mt-2 text-lg font-semibold text-[#0D1B2A]">
            Review concept assumptions before saving a strategy
          </h4>
          <p className="mt-1 text-sm leading-6 text-[#0D1B2A]/66">
            Easy Erf can copy the selected concept title and brief notes into a development
            scenario. It will not invent build costs, rental income or resale value.
          </p>
          <div className="mt-3 rounded-2xl border border-[#FF6A00]/15 bg-white p-3 text-xs leading-5 text-[#0D1B2A]/70">
            <div className="font-semibold text-[#0D1B2A]">
              {sitePotentialDraft.conceptTitle ?? "Selected Site Potential concept"}
            </div>
            {(sitePotentialDraft.notes ?? []).slice(0, 3).map((note) => (
              <div key={note}>{note}</div>
            ))}
          </div>
          <button
            type="button"
            onClick={applySitePotentialDraft}
            className="mt-3 rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#142941]"
          >
            Apply draft to Strategy
          </button>
        </section>
      )}

      {showChosenState && chosenScenario && (
        <section className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Scenario chosen
              </div>
              <h4 className="mt-3 text-lg font-semibold text-[#0D1B2A]">{chosenScenario.label}</h4>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {chosenScenario.summary.slice(0, 4).map((item) => (
                  <ResultTile key={item.label} label={item.label} value={item.value} />
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowChosenState(false)}
              className="rounded-full border border-emerald-700/20 bg-white px-4 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              Choose another scenario
            </button>
          </div>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {STRATEGY_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => chooseStrategy(option.id)}
            className={cn(
              "group rounded-[1.5rem] border p-5 text-left transition",
              active === option.id
                ? "border-[#FF6A00]/70 bg-[#0D1B2A] text-white shadow-[0_24px_60px_-38px_rgba(13,27,42,0.8)]"
                : "border-[#0D1B2A]/10 bg-white hover:border-[#FF6A00]/35 hover:shadow-[0_18px_45px_-38px_rgba(13,27,42,0.4)]",
            )}
          >
            <div
              className={cn(
                "inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]",
                active === option.id ? "bg-[#FF6A00] text-white" : "bg-[#FFF7ED] text-[#B24A00]",
              )}
            >
              {active === option.id ? "Drafting" : "Strategy option"}
            </div>
            <div
              className={cn(
                "mt-4 text-base font-semibold",
                active === option.id ? "text-white" : "text-[#0D1B2A]",
              )}
            >
              {option.label}
            </div>
            <p
              className={cn(
                "mt-2 text-sm leading-6",
                active === option.id ? "text-white/72" : "text-[#0D1B2A]/64",
              )}
            >
              {option.description}
            </p>
            <div
              className={cn(
                "mt-4 grid gap-2 rounded-2xl border px-3 py-2 text-[11px]",
                active === option.id
                  ? "border-white/10 bg-white/[0.06] text-white/70"
                  : "border-[#D9E6F2] bg-[#F7FBFF] text-[#0D1B2A]/60",
              )}
            >
              <span>Best for: {option.bestFor}</span>
              <span>Key output: {option.keyOutput}</span>
            </div>
          </button>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3 rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
              Assumptions
            </div>
            <h4 className="mt-1 text-lg font-semibold text-[#0D1B2A]">{activeOption.label}</h4>
            <p className="mt-1 text-sm leading-6 text-[#0D1B2A]/62">
              Adjust these assumptions before relying on the result.
            </p>
          </div>
          {fieldGroupsFor(active).map((group) => (
            <FieldGroup key={group.title} group={group} values={values} setValue={setValue} />
          ))}
        </div>

        <div className="space-y-3">
          <section className="rounded-[1.5rem] border border-[#FF6A00]/20 bg-[#fff8ec] p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">
              Output panel
            </div>
            <h4 className="mt-1 text-lg font-semibold text-[#0D1B2A]">Planning result</h4>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {summary.map(([label, value]) => (
                <ResultTile key={label} label={label} value={value} />
              ))}
            </div>
          </section>
          <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-4">
            <h4 className="text-sm font-semibold text-[#0D1B2A]">Needs verification</h4>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-[#0D1B2A]/66">
              {missingAssumptions.length ? (
                missingAssumptions.map((item) => <li key={item}>Add or verify {item}.</li>)
              ) : (
                <li>Core assumptions are present, but still need source verification.</li>
              )}
              {riskNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={saveScenario}
              className="mt-4 w-full rounded-full bg-[#0D1B2A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#142941]"
            >
              Save as chosen scenario
            </button>
          </section>
        </div>
      </section>

      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-3 text-[11px] text-muted-foreground">
        {savedScenarios.length > 0
          ? `${savedScenarios.length} saved strategy scenario${savedScenarios.length === 1 ? "" : "s"} on file. Only the chosen scenario feeds the Easy Erf Report.`
          : "Your draft is autosaved, but the Easy Erf Report waits for you to save a chosen scenario."}
        {savedScenarios.length > 0 && (
          <button
            type="button"
            onClick={onOpenReport}
            className="mt-3 inline-flex rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#142941]"
          >
            Continue to Easy Erf Report
          </button>
        )}
      </div>
    </div>
  );
}

interface FieldGroupModel {
  title: string;
  helper: string;
  fields: [string, string][];
}

function fieldGroupsFor(strategy: StrategyType): FieldGroupModel[] {
  const purchase: FieldGroupModel = {
    title: "Purchase / acquisition",
    helper: "Use your own purchase and transaction cost assumptions.",
    fields: [
      ["Purchase price", "purchasePrice"],
      ["Transfer duty", "transferDuty"],
      ["Transfer costs", "transferCosts"],
      ["Bond costs", "bondCosts"],
      ["Attorney / conveyancer fees", "attorneyFees"],
      ["Inspection / due diligence", "inspectionCosts"],
      ["Other acquisition costs", "otherAcquisitionCosts"],
    ],
  };
  const finance: FieldGroupModel = {
    title: "Finance",
    helper: "Override loan amount or bond payment if you already have a quote.",
    fields: [
      ["Deposit percent", "depositPercent"],
      ["Loan amount override", "loanAmount"],
      ["Interest rate", "interestRate"],
      ["Loan term years", "termYears"],
      ["Monthly bond payment override", "monthlyBondPayment"],
      ["Finance fees", "financeFees"],
    ],
  };
  const holding: FieldGroupModel = {
    title: "Holding costs",
    helper: "Add monthly ownership costs and the expected hold period.",
    fields: [
      ["Monthly rates / taxes", "monthlyRates"],
      ["Monthly levies", "monthlyLevies"],
      ["Insurance", "insurance"],
      ["Security", "security"],
      ["Garden / pool", "gardenPool"],
      ["Monthly holding cost", "monthlyHoldingCost"],
      ["Holding period months", "holdingMonths"],
    ],
  };

  switch (strategy) {
    case "buy_hold":
      return [
        purchase,
        finance,
        {
          title: "Long-term rental",
          helper: "Vacancy, management and maintenance reserves drive the real cash flow.",
          fields: [
            ["Monthly rent", "monthlyRent"],
            ["Other monthly income", "otherIncome"],
            ["Vacancy percent", "vacancyPercent"],
            ["Property management percent", "propertyManagementPercent"],
            ["Maintenance reserve", "maintenanceReserve"],
            ["Utilities paid by owner", "utilitiesPaidByOwner"],
            ["Other monthly costs", "otherMonthlyCosts"],
            ["Holding period years", "annualHoldingYears"],
          ],
        },
      ];
    case "flip":
      return [
        purchase,
        holding,
        {
          title: "Flip / resale",
          helper: "Renovation, contingency and exit costs decide whether the flip is worth it.",
          fields: [
            ["Renovation budget", "renovationBudget"],
            ["Contingency percent", "contingencyPercent"],
            ["Expected resale value", "expectedResalePrice"],
            ["Agent commission percent", "agentCommission"],
            ["Selling costs", "sellingCosts"],
          ],
        },
      ];
    case "development_sell":
      return [
        {
          title: "Development",
          helper: "Model land, build, professional, municipal and holding assumptions.",
          fields: [
            ["Land cost", "landCost"],
            ["Build cost", "buildCost"],
            ["Professional fees", "professionalFees"],
            ["Municipal / planning fees", "municipalPlanningFees"],
            ["Contingency percent", "contingencyPercent"],
            ["Development duration months", "developmentDurationMonths"],
            ["Monthly holding cost", "monthlyHoldingCost"],
            ["Exit / selling costs", "exitSellingCosts"],
            ["Expected sale value", "expectedSaleValue"],
          ],
        },
      ];
    case "development_rent":
      return [
        {
          title: "Development",
          helper: "Include development duration and monthly holding cost before rent starts.",
          fields: [
            ["Land cost", "landCost"],
            ["Build cost", "buildCost"],
            ["Professional fees", "professionalFees"],
            ["Municipal / planning fees", "municipalPlanningFees"],
            ["Contingency percent", "contingencyPercent"],
            ["Development duration months", "developmentDurationMonths"],
            ["Monthly holding cost", "monthlyHoldingCost"],
          ],
        },
        {
          title: "Completed rental",
          helper: "Do not rely on the rent until it is supported by evidence.",
          fields: [
            ["Expected monthly rent", "expectedMonthlyRent"],
            ["Vacancy percent", "vacancyPercent"],
            ["Operating expenses", "operatingExpenses"],
            ["Bond payment override", "monthlyBondPayment"],
          ],
        },
      ];
    case "str_airbnb":
      return [
        purchase,
        {
          title: "STR / Airbnb",
          helper:
            "Seasonality, rules and actual occupancy need verification before relying on this.",
          fields: [
            ["Average daily rate", "averageDailyRate"],
            ["Occupancy percent", "occupancyPercent"],
            ["Nights per month", "nightsPerMonth"],
            ["Cleaning fee income", "cleaningRevenue"],
            ["Platform fee percent", "platformFeePercent"],
            ["Cleaning cost", "cleaningCost"],
            ["Utilities", "utilities"],
            ["Internet", "internet"],
            ["Linen / laundry", "linenLaundry"],
            ["Management percent", "strManagementPercent"],
            ["Maintenance reserve", "maintenanceReserve"],
            ["Furnishing / setup cost", "furnishingSetupCost"],
            ["Bond payment override", "monthlyBondPayment"],
          ],
        },
      ];
    case "brrrr":
      return [
        purchase,
        finance,
        {
          title: "BRRRR",
          helper: "Check all-in cost, refinance value and rent after renovation.",
          fields: [
            ["Renovation cost", "renovationBudget"],
            ["All-in cost override", "allInCost"],
            ["After repair value", "afterRepairValue"],
            ["Refinance LTV", "refinanceLtv"],
            ["Refinance fees", "refinanceFees"],
            ["Monthly rent", "monthlyRent"],
            ["Monthly expenses", "monthlyExpenses"],
            ["Monthly debt service", "monthlyDebtService"],
            ["Target DSCR", "targetDscr"],
          ],
        },
      ];
    case "bond":
      return [
        purchase,
        finance,
        {
          title: "Rental stress test",
          helper: "Use rent and NOI to check whether debt service is comfortable.",
          fields: [
            ["Monthly rent", "monthlyRent"],
            ["Monthly rates / taxes", "monthlyRates"],
            ["Monthly levies", "monthlyLevies"],
            ["Insurance", "insurance"],
            ["Other monthly costs", "otherMonthlyCosts"],
          ],
        },
      ];
    case "land_bank":
      return [
        purchase,
        holding,
        {
          title: "Future optionality",
          helper: "Land banking needs a clear reason for tying up cash.",
          fields: [
            ["Future value target", "futureValue"],
            ["Annual hold years", "annualHoldingYears"],
            ["Custom upside", "customUpside"],
          ],
        },
      ];
    case "custom":
      return [
        purchase,
        finance,
        {
          title: "Custom scenario",
          helper: "Capture the key assumptions without pretending the model knows the strategy.",
          fields: [
            ["Monthly rent", "monthlyRent"],
            ["Expected resale value", "expectedResalePrice"],
            ["Renovation / build budget", "renovationBudget"],
            ["Custom upside", "customUpside"],
            ["Notes amount / risk allowance", "otherMonthlyCosts"],
          ],
        },
      ];
  }
}

function FieldGroup({
  group,
  values,
  setValue,
}: {
  group: FieldGroupModel;
  values: Record<string, string>;
  setValue: (key: string, value: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-3">
      <h5 className="text-sm font-semibold text-[#0D1B2A]">{group.title}</h5>
      <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/58">{group.helper}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {group.fields.map(([label, key]) => (
          <label key={key} className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
              {label}
            </span>
            <input
              inputMode="decimal"
              value={values[key] ?? ""}
              onChange={(event) => setValue(key, event.target.value)}
              placeholder="0"
              className="mt-1 w-full rounded-lg border border-[#D9E6F2] bg-white px-3 py-2 text-sm text-[#0D1B2A] outline-none focus:border-[#FF6A00]/60"
            />
          </label>
        ))}
      </div>
    </section>
  );
}

function ResultTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#D9E6F2] bg-white p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold tabular-nums text-[#0D1B2A]">{value}</div>
    </div>
  );
}
