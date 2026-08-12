import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Save } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth/useAuth";
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
  calculatePricePerM2,
  calculateResidualLandValue,
  calculateShortTermRental,
} from "@/lib/research/calculators";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { canonicalAreaM2 } from "@/lib/evidence/parcelArea";
import {
  findMunicipalityPlanningRegistry,
  findZone,
} from "@/lib/planning/municipalityPlanningRegistry";
import { buildParcelPlanningAssessment } from "@/lib/planning/parcelPlanningAssessment";
import { derivePlanningEvidenceSignals } from "@/lib/planning/planningEvidenceSignals";
import {
  PLANNING_ZONE_UPDATED_EVENT,
  readStoredPlanningZone,
} from "@/lib/planning/storedPlanningZone";
import { isUsableSubjectZoningDocument } from "@/lib/planning/zoningEvidence";
import {
  buildStrategyPropertyInputFacts,
  strategyDefaultsFromPropertyFacts,
  type StrategyInputFact,
} from "@/lib/research/strategyInputs";
import { readStoredBuildEnvelopeInputs } from "@/lib/sitePotential/buildEnvelopeStore";
import { findPilotPlanningRecord } from "@/lib/sitePotential/pilotPlanningRecords";
import { buildSitePotentialRulePrefill } from "@/lib/sitePotential/planningRuleAdapter";
import { resolveSitePotentialInputs } from "@/lib/sitePotential/resolveSitePotentialInputs";
import {
  readSitePotentialStrategyDraft,
  type SitePotentialStrategyDraft,
} from "@/lib/sitePotential/sitePotentialStrategyDraftStore";
import { cn } from "@/lib/utils";
import { useErfFileVault } from "@/lib/workbench/useErfFileVault";
import type { SavedMarketEvidence } from "@/features/marketEvidence/types";
import {
  createEmptyStrategyWorkspace,
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
import { patchSavedPropertyUserData } from "@/lib/workbench/savedPropertyUserData";
import {
  createStrategyCloudSaveQueue,
  type StrategyCloudSaveQueue,
} from "@/lib/workbench/strategyCloudSaveQueue";
import { useSavedMarketEvidence } from "@/features/marketEvidence/hooks/useSavedMarketEvidence";

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

interface DealSnapshotModel {
  eyebrow: string;
  summary: string;
  uncertainty: string;
  items: [string, string][];
  emphasis: [string, string][];
}

type StrategySaveStatus =
  | "idle"
  | "loading"
  | "saving"
  | "saved"
  | "failed"
  | "offline"
  | "cloud-restored"
  | "migrated";

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

function strategyDefaults(
  defaultPrice: number,
  propertyDefaults: Record<string, string> = {},
): Record<string, string> {
  const price = defaultPrice > 0 ? String(defaultPrice) : "";
  return {
    ...propertyDefaults,
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
    buildAreaM2: propertyDefaults.buildAreaM2 ?? "",
    buildCostPerM2: "",
    floorAreaM2: propertyDefaults.floorAreaM2 ?? propertyDefaults.buildAreaM2 ?? "",
    numberOfFloors: "1",
    professionalFees: "",
    municipalPlanningFees: "",
    developmentDurationMonths: "12",
    exitSellingCosts: "",
    expectedSaleValue: "",
    requiredProfit: "",
    targetReturnPercent: "15",
    targetMarginPercent: "",
    downsideBuildCostPercent: "15",
    downsideGdvPercent: "10",
    downsideDurationMonths: "3",
    upsideBuildCostPercent: "5",
    upsideGdvPercent: "10",
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

function formatRandOrMissing(value: number) {
  return Number.isFinite(value) && value > 0 ? formatRand(value) : "Missing";
}

function formatPercent(value: number) {
  return `${((Number.isFinite(value) ? value : 0) * 100).toFixed(1)}%`;
}

function formatPercentOrMissing(value: number) {
  return Number.isFinite(value) && value > 0 ? formatPercent(value) : "Missing";
}

function formatNumber(value: number, suffix = "") {
  if (!Number.isFinite(value) || value <= 0) return "Missing";
  const formatted = value.toLocaleString("en-ZA", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  });
  return `${formatted}${suffix}`;
}

function formatSaveTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function saveStatusCopy(status: StrategySaveStatus, lastSavedAt: string | null) {
  switch (status) {
    case "loading":
      return "Loading saved Strategy";
    case "saving":
      return "Saving draft";
    case "saved":
      return formatSaveTime(lastSavedAt)
        ? `Draft saved at ${formatSaveTime(lastSavedAt)}`
        : "Draft saved";
    case "failed":
      return "Save failed";
    case "offline":
      return "Offline draft saved in this browser";
    case "cloud-restored":
      return "Cloud draft restored";
    case "migrated":
      return "Local draft moved to your account";
    default:
      return "Draft saved";
  }
}

function optionFor(id: StrategyType) {
  return STRATEGY_OPTIONS.find((option) => option.id === id) ?? STRATEGY_OPTIONS[0];
}

const INPUT_STATE_LABEL: Record<StrategyInputFact["state"], string> = {
  verified_property: "Verified / official",
  working_property: "Working property value",
  working_assumption: "Working assumption",
  derived_from_working_assumption: "Derived from working assumption",
  concept_assumption: "Concept assumption",
  missing_value: "Missing",
};

const INPUT_STATE_TONE: Record<StrategyInputFact["state"], string> = {
  verified_property: "border-emerald-200 bg-emerald-50 text-emerald-800",
  working_property: "border-sky-200 bg-sky-50 text-sky-800",
  working_assumption: "border-amber-200 bg-amber-50 text-amber-800",
  derived_from_working_assumption: "border-amber-200 bg-amber-50 text-amber-800",
  concept_assumption: "border-purple-200 bg-purple-50 text-purple-800",
  missing_value: "border-slate-200 bg-slate-50 text-slate-600",
};

function selectedStrategyId(scenario: ErfStrategyScenario | null): StrategyType {
  return STRATEGY_OPTIONS.some((option) => option.id === scenario?.strategy)
    ? (scenario?.strategy as StrategyType)
    : "buy_hold";
}

// eslint-disable-next-line react-refresh/only-export-components
export function deriveStrategyBuildAreaM2(input: {
  explicitBuildAreaM2: number;
  explicitFloorAreaM2: number;
  coverageFootprintM2: number;
  numberOfFloors: number;
}) {
  const derivedTotalFloorAreaM2 =
    input.coverageFootprintM2 > 0 && input.numberOfFloors > 0
      ? input.coverageFootprintM2 * input.numberOfFloors
      : 0;
  return {
    coverageFootprintM2: input.coverageFootprintM2,
    derivedTotalFloorAreaM2,
    buildAreaM2:
      input.explicitBuildAreaM2 || input.explicitFloorAreaM2 || derivedTotalFloorAreaM2,
    method: input.explicitBuildAreaM2
      ? "explicit_build_area"
      : input.explicitFloorAreaM2
        ? "explicit_floor_area"
        : derivedTotalFloorAreaM2
          ? "coverage_footprint_x_floors"
          : "missing",
  };
}

// eslint-disable-next-line react-refresh/only-export-components
export function buildDealSnapshot(input: {
  active: StrategyType;
  rental: ReturnType<typeof calculateBuyHold>;
  flip: ReturnType<typeof calculateFlip>;
  developmentSell: ReturnType<typeof calculateDevelopmentToSell>;
  developmentRent: ReturnType<typeof calculateDevelopmentToRent>;
  str: ReturnType<typeof calculateShortTermRental>;
  brrrr: ReturnType<typeof calculateBrrrr>;
  bond: ReturnType<typeof calculateBond>;
  landBankHoldingCost: number;
  acquisition: ReturnType<typeof calculateAcquisition>;
  buildCostModel: ReturnType<typeof calculateBuildCost>;
  maximumOffer: ReturnType<typeof calculateMaximumOffer>;
  residualLandValue: ReturnType<typeof calculateResidualLandValue>;
  developmentSensitivity: ReturnType<typeof calculateDevelopmentSensitivity>;
  developmentCashRequired: number;
  biggestUncertainty: string;
}): DealSnapshotModel {
  switch (input.active) {
    case "buy_hold":
      return {
        eyebrow: "Rental hold",
        summary: "Cash flow, NOI and yield from the saved rental assumptions.",
        uncertainty: "rent support, vacancy and operating costs",
        items: [
          ["Monthly cash flow", formatRand(input.rental.cashFlowAfterDebt)],
          ["Monthly NOI", formatRand(input.rental.monthlyNoi)],
          ["Net yield", formatPercent(input.rental.netYield)],
          ["Cash-on-cash", formatPercent(input.rental.cashOnCashReturn)],
          ["Break-even rent", formatRand(input.rental.breakEvenRent)],
          ["Loan amount", formatRand(input.acquisition.loanAmount)],
        ],
        emphasis: [["Cash required", formatRandOrMissing(input.acquisition.totalCashRequired)]],
      };
    case "flip":
      return {
        eyebrow: "Flip / resale",
        summary: "Renovation, holding and resale outputs for a short-term project.",
        uncertainty: "renovation budget, holding duration and resale evidence",
        items: [
          ["Net profit", formatRand(input.flip.profit)],
          ["Return on cost", formatPercent(input.flip.roi)],
          ["Annualised ROI", formatPercent(input.flip.annualizedRoi)],
          ["Project cost", formatRand(input.flip.totalProjectCost)],
          ["Delay sensitivity", formatRand(input.flip.delaySensitivity)],
          ["Required resale for target", formatRand(input.flip.requiredResalePriceForTargetProfit)],
        ],
        emphasis: [["Cash required", formatRandOrMissing(input.acquisition.totalCashRequired)]],
      };
    case "development_sell":
      return {
        eyebrow: "Development to sell",
        summary: "Land, build, GDV, max-offer and sensitivity outputs.",
        uncertainty: input.biggestUncertainty,
        items: [
          ["Land / purchase price", formatRandOrMissing(input.developmentSell.costStack.landCost)],
          ["Acquisition costs", formatRandOrMissing(input.developmentSell.costStack.acquisitionCosts)],
          ["Build cost", formatRandOrMissing(input.buildCostModel.selectedBuildCost)],
          ["Professional fees", formatRandOrMissing(input.developmentSell.costStack.professionalFees)],
          ["Municipal / planning fees", formatRandOrMissing(input.developmentSell.costStack.municipalPlanningFees)],
          ["Contingency", formatRandOrMissing(input.developmentSell.costStack.contingencyAmount)],
          ["Finance / holding", formatRandOrMissing(input.developmentSell.costStack.holdingCost)],
          ["Exit / selling costs", formatRandOrMissing(input.developmentSell.costStack.sellingCosts)],
          ["Total project cost", formatRandOrMissing(input.developmentSell.totalProjectCost)],
          ["Expected GDV", formatRandOrMissing(input.developmentSell.breakEvenSalePrice + input.developmentSell.netProfit)],
          ["Profit", formatRand(input.developmentSell.netProfit)],
          ["Return on cost", formatPercentOrMissing(input.developmentSell.returnOnCost)],
          ["Margin", formatPercentOrMissing(input.developmentSell.margin)],
          ["Break-even sale price", formatRandOrMissing(input.developmentSell.breakEvenSalePrice)],
          ["Cash required", formatRandOrMissing(input.developmentCashRequired)],
          ["Downside profit", formatRand(input.developmentSensitivity.downside.netProfit)],
        ],
        emphasis: [
          ["Maximum justified offer", formatRand(input.maximumOffer.maximumPurchasePrice)],
          ["Residual land value", formatRand(input.residualLandValue.residualLandValue)],
        ],
      };
    case "development_rent":
      return {
        eyebrow: "Development to rent",
        summary: "Completed rental yield and cash flow after development costs.",
        uncertainty: "rent support, operating costs and development cost evidence",
        items: [
          ["Project cost", formatRand(input.developmentRent.totalProjectCost)],
          ["Monthly NOI", formatRand(input.developmentRent.monthlyNetOperatingIncome)],
          ["Monthly cash flow", formatRand(input.developmentRent.monthlyCashFlow)],
          ["Gross yield", formatPercent(input.developmentRent.grossYield)],
          ["Net yield", formatPercent(input.developmentRent.netYield)],
          ["Break-even rent", formatRand(input.developmentRent.breakEvenRent)],
        ],
        emphasis: [["Holding cost", formatRand(input.developmentRent.totalHoldingCost)]],
      };
    case "str_airbnb":
      return {
        eyebrow: "Short-term rental",
        summary: "Booked nights, revenue, costs and occupancy stress points.",
        uncertainty: "seasonality, letting rules and actual occupancy",
        items: [
          ["Booked nights", String(input.str.bookedNights)],
          ["Accommodation revenue", formatRand(input.str.grossAccommodationRevenue)],
          ["Operating cost", formatRand(input.str.monthlyOperatingCost)],
          ["Monthly net income", formatRand(input.str.monthlyNetIncome)],
          ["Cash flow", formatRand(input.str.monthlyCashFlow)],
          ["Break-even occupancy", formatPercent(input.str.breakEvenOccupancy)],
        ],
        emphasis: [["Cash-on-cash", formatPercent(input.str.cashOnCashReturn)]],
      };
    case "brrrr":
      return {
        eyebrow: "BRRRR",
        summary: "Refinance proceeds, cash left in the deal and rental debt coverage.",
        uncertainty: "after-repair value, refinance LTV and stabilised rent",
        items: [
          ["Refinance loan", formatRand(input.brrrr.refinanceLoanAmount)],
          ["Cash returned", formatRand(input.brrrr.cashReturned)],
          ["Cash left in deal", formatRand(input.brrrr.cashLeftInDeal)],
          ["Equity created", formatRand(input.brrrr.equityCreated)],
          ["DSCR", input.brrrr.dscr.toFixed(2)],
        ],
        emphasis: [["Cash-on-cash", formatPercent(input.brrrr.cashOnCashReturn)]],
      };
    case "bond":
      return {
        eyebrow: "Bond / finance",
        summary: "Debt service, interest cost and rental stress points.",
        uncertainty: "interest rate, loan amount and reliable NOI",
        items: [
          ["Monthly bond payment", formatRand(input.bond.monthlyBondPayment)],
          ["Annual debt service", formatRand(input.bond.annualDebtService)],
          ["Total interest", formatRand(input.bond.totalInterest)],
          ["DSCR", input.bond.dscr.toFixed(2)],
          ["Break-even occupancy", formatPercent(input.bond.breakEvenOccupancy)],
        ],
        emphasis: [["Loan amount", formatRandOrMissing(input.acquisition.loanAmount)]],
      };
    case "land_bank":
      return {
        eyebrow: "Land bank",
        summary: "Holding cost and future-value target for vacant-land optionality.",
        uncertainty: "holding period, future planning rights and exit demand",
        items: [
          ["Holding cost", formatRand(input.landBankHoldingCost)],
          ["Cash required", formatRandOrMissing(input.acquisition.totalCashRequired)],
        ],
        emphasis: [["Future value target", "Set in assumptions"]],
      };
    case "custom":
      return {
        eyebrow: "Custom scenario",
        summary: "Custom assumptions are saved for the report without pretending the model knows the strategy.",
        uncertainty: "custom assumptions need manual review",
        items: [
          ["Cash required", formatRandOrMissing(input.acquisition.totalCashRequired)],
        ],
        emphasis: [["Custom upside", "Set in assumptions"]],
      };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function persistStrategyWorkspaceToCloud(
  parcelId: string,
  workspace: ErfStrategyWorkspace,
) {
  await patchSavedPropertyUserData(parcelId, {
    normalizedParcelId: parcelId,
    strategyWorkspace: workspace,
    strategyWorkspaceUpdatedAt: workspace.draftUpdatedAt ?? new Date().toISOString(),
  });
}

async function activeSupabaseUserMatches(expectedUserId: string | null) {
  if (!expectedUserId) return false;
  const { data, error } = await supabase.auth.getUser();
  if (error) return false;
  return data.user?.id === expectedUserId;
}

export function completeGuidedStrategyScenario<T>(
  saveChosenScenario: () => T,
  onContinue: () => void,
) {
  const scenario = saveChosenScenario();
  onContinue();
  return scenario;
}

export function strategyLabActionAvailability(isGuided: boolean) {
  return {
    showExpertScenarioManagement: !isGuided,
    showDirectReport: !isGuided,
  };
}

export function StrategyLab({
  parcel,
  parcelId,
  defaultPrice,
  onOpenReport,
  guidedReturn,
}: {
  parcel: NormalizedOfficialParcel;
  parcelId: string;
  defaultPrice: number;
  onOpenReport?: () => void;
  guidedReturn?: {
    onBack: () => void;
    onContinue: () => void;
  };
}) {
  const isGuided = Boolean(guidedReturn);
  const actionAvailability = strategyLabActionAvailability(isGuided);
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { assets } = useErfFileVault(parcelId);
  const [manualZoneCode, setManualZoneCode] = useState<string | null>(() =>
    typeof window === "undefined" ? null : readStoredPlanningZone(parcelId, userId),
  );
  useEffect(() => {
    const sync = (event?: Event) => {
      const detail = (event as CustomEvent<{ parcelId?: string; userId?: string | null }> | undefined)
        ?.detail;
      if (detail?.parcelId && detail.parcelId !== parcelId) return;
      if ((detail?.userId ?? null) !== userId) return;
      setManualZoneCode(readStoredPlanningZone(parcelId, userId));
    };
    sync();
    window.addEventListener(PLANNING_ZONE_UPDATED_EVENT, sync);
    return () => window.removeEventListener(PLANNING_ZONE_UPDATED_EVENT, sync);
  }, [parcelId, userId]);

  const initialWorkspace = readStrategyWorkspace(parcelId, undefined, userId);
  const initialSitePotentialDraft = readSitePotentialStrategyDraft(parcelId, userId);
  const initialBuildEnvelopeOverrides = readStoredBuildEnvelopeInputs(parcelId, userId);
  const initialResolvedSitePotentialInputs = resolveSitePotentialInputs({
    overrides: initialBuildEnvelopeOverrides,
    pilot: findPilotPlanningRecord({ parcelId, lpiCode: parcel.lpi ?? null }),
    recordedAreaM2: canonicalAreaM2(parcel.rawProperties),
  });
  const initialPropertyFacts = buildStrategyPropertyInputFacts({
    parcel,
    resolvedSitePotentialInputs: initialResolvedSitePotentialInputs,
    sitePotentialDraft: initialSitePotentialDraft,
  });
  const initialPropertyDefaults = strategyDefaultsFromPropertyFacts(initialPropertyFacts);
  const [active, setActive] = useState<StrategyType>(() =>
    STRATEGY_OPTIONS.some((option) => option.id === initialWorkspace.activeStrategy)
      ? (initialWorkspace.activeStrategy as StrategyType)
      : "buy_hold",
  );
  const [values, setValues] = useState(() => ({
    ...strategyDefaults(defaultPrice, initialPropertyDefaults),
    ...initialWorkspace.draftInputs,
  }));
  const [savedScenarios, setSavedScenarios] = useState(() =>
    readStrategyScenarios(parcelId, undefined, userId),
  );
  const [chosenScenario, setChosenScenario] = useState(() =>
    getChosenStrategyScenario(parcelId, undefined, userId),
  );
  const [showChosenState, setShowChosenState] = useState(Boolean(chosenScenario));
  const [sitePotentialDraft, setSitePotentialDraft] = useState(() =>
    initialSitePotentialDraft,
  );
  const [buildEnvelopeOverrides, setBuildEnvelopeOverrides] = useState(
    () => initialBuildEnvelopeOverrides,
  );
  const [saveStatus, setSaveStatus] = useState<StrategySaveStatus>(userId ? "loading" : "offline");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const defaultPriceRef = useRef(defaultPrice);
  const cloudSaveQueueRef = useRef<StrategyCloudSaveQueue | null>(null);
  const latestWorkspaceRef = useRef(initialWorkspace);
  defaultPriceRef.current = defaultPrice;
  const { evidence: savedMarketEvidence } = useSavedMarketEvidence(parcelId);
  const planningRegistry = useMemo(
    () => findMunicipalityPlanningRegistry(parcel.municipality ?? null),
    [parcel.municipality],
  );
  const selectedZone = useMemo(
    () => (planningRegistry ? findZone(planningRegistry, manualZoneCode) : null),
    [manualZoneCode, planningRegistry],
  );
  const documentZone = useMemo(
    () =>
      selectedZone
        ? (assets.find((asset) => isUsableSubjectZoningDocument(asset, selectedZone)) ?? null)
        : null,
    [assets, selectedZone],
  );
  const planningSignals = useMemo(
    () =>
      derivePlanningEvidenceSignals(assets, {
        zoningCertificateUploaded: Boolean(documentZone),
      }),
    [assets, documentZone],
  );
  const planningAssessment = useMemo(
    () =>
      buildParcelPlanningAssessment({
        parcelId,
        municipality: parcel.municipality ?? null,
        locationHints: [parcel.suburbOrArea, parcel.town, parcel.municipality, parcel.province],
        erfAreaM2: canonicalAreaM2(parcel.rawProperties),
        manualZoneCode,
        documentZoneCode: documentZone && manualZoneCode ? manualZoneCode : null,
        documentZoneAssetId: documentZone?.id ?? null,
        observedZoneLabel:
          typeof parcel.rawProperties?.ZONING_DES === "string"
            ? parcel.rawProperties.ZONING_DES
            : typeof parcel.rawProperties?.ZONING === "string"
              ? parcel.rawProperties.ZONING
              : null,
        hasParcelPolygon: Boolean(parcel.rawProperties),
        hasStreetEdgeReference: false,
        evidence: planningSignals,
      }),
    [documentZone, manualZoneCode, parcel, parcelId, planningSignals],
  );
  const sitePotentialRulePrefill = useMemo(
    () => buildSitePotentialRulePrefill(planningAssessment),
    [planningAssessment],
  );
  const pilotPlanningRecord = useMemo(
    () => findPilotPlanningRecord({ parcelId, lpiCode: parcel.lpi ?? null }),
    [parcel.lpi, parcelId],
  );
  const resolvedSitePotentialInputs = useMemo(
    () =>
      resolveSitePotentialInputs({
        overrides: buildEnvelopeOverrides,
        prefill: sitePotentialRulePrefill,
        pilot: pilotPlanningRecord,
        documentRuleEvidence: Boolean(documentZone),
        recordedAreaM2: canonicalAreaM2(parcel.rawProperties),
      }),
    [
      buildEnvelopeOverrides,
      documentZone,
      parcel.rawProperties,
      pilotPlanningRecord,
      sitePotentialRulePrefill,
    ],
  );
  const propertyInputFacts = useMemo(
    () =>
      buildStrategyPropertyInputFacts({
        parcel,
        resolvedSitePotentialInputs,
        sitePotentialDraft,
      }),
    [parcel, resolvedSitePotentialInputs, sitePotentialDraft],
  );
  const propertyDefaults = useMemo(
    () => strategyDefaultsFromPropertyFacts(propertyInputFacts),
    [propertyInputFacts],
  );

  useLayoutEffect(() => {
    const workspace = readStrategyWorkspace(parcelId, undefined, userId);
    const chosen = getChosenStrategyScenario(parcelId, undefined, userId);
    const nextSitePotentialDraft = readSitePotentialStrategyDraft(parcelId, userId);
    const nextBuildEnvelopeOverrides = readStoredBuildEnvelopeInputs(parcelId, userId);
    const nextPropertyDefaults = strategyDefaultsFromPropertyFacts(
      buildStrategyPropertyInputFacts({
        parcel,
        resolvedSitePotentialInputs: resolveSitePotentialInputs({
          overrides: nextBuildEnvelopeOverrides,
          prefill: sitePotentialRulePrefill,
          pilot: pilotPlanningRecord,
          documentRuleEvidence: Boolean(documentZone),
          recordedAreaM2: canonicalAreaM2(parcel.rawProperties),
        }),
        sitePotentialDraft: nextSitePotentialDraft,
      }),
    );
    setSavedScenarios(workspace.scenarios);
    setChosenScenario(chosen);
    setActive(
      STRATEGY_OPTIONS.some((option) => option.id === workspace.activeStrategy)
        ? (workspace.activeStrategy as StrategyType)
        : selectedStrategyId(chosen),
    );
    setValues({
      ...strategyDefaults(defaultPriceRef.current, nextPropertyDefaults),
      ...workspace.draftInputs,
    });
    setShowChosenState(Boolean(chosen));
    setSitePotentialDraft(nextSitePotentialDraft);
    setBuildEnvelopeOverrides(nextBuildEnvelopeOverrides);
    latestWorkspaceRef.current = workspace;
    setSaveError(null);
    setLastSavedAt(null);
    setSaveStatus(userId ? "loading" : "offline");
  }, [documentZone, parcel, parcelId, pilotPlanningRecord, sitePotentialRulePrefill, userId]);

  useEffect(() => {
    setValues((current) => {
      let changed = false;
      const next = { ...current };
      for (const [key, value] of Object.entries(propertyDefaults)) {
        if (next[key]?.trim()) continue;
        next[key] = value;
        changed = true;
      }
      return changed ? next : current;
    });
  }, [propertyDefaults]);

  useEffect(() => {
    const queue = createStrategyCloudSaveQueue({
      parcelId,
      userId,
      canPersist: () => activeSupabaseUserMatches(userId),
      persist: (workspace) => persistStrategyWorkspaceToCloud(parcelId, workspace),
    });
    cloudSaveQueueRef.current = queue;
    const unsubscribe = queue.subscribe((snapshot) => {
      setSaveStatus(snapshot.status);
      setLastSavedAt(snapshot.lastSavedAt);
      setSaveError(snapshot.error);
    });

    return () => {
      unsubscribe();
      void queue.flush();
      queue.dispose();
      if (cloudSaveQueueRef.current === queue) cloudSaveQueueRef.current = null;
    };
  }, [parcelId, userId]);

  const queueCloudSave = useCallback(
    (workspace: ErfStrategyWorkspace, immediate = false) => {
      latestWorkspaceRef.current = workspace;
      if (!userId) {
        setSaveStatus("offline");
        return;
      }
      cloudSaveQueueRef.current?.schedule(workspace);
      if (immediate) {
        void cloudSaveQueueRef.current?.flush();
      }
    },
    [userId],
  );

  const flushStrategySave = useCallback(() => {
    void cloudSaveQueueRef.current?.flush();
  }, []);

  useEffect(() => {
    let alive = true;
    if (!userId) {
      setSaveStatus("offline");
      return () => {
        alive = false;
      };
    }

    setSaveStatus("loading");
    supabase
      .from("saved_properties")
      .select("user_data")
      .eq("user_id", userId)
      .eq("parcel_id", parcelId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          console.warn("[Easy Erf] Strategy workspace cloud load failed", error.message);
          setSaveStatus("failed");
          setSaveError(error.message);
          return;
        }
        const remote = strategyWorkspaceFromUserData(parcelId, data?.user_data);
        const local = readStrategyWorkspace(parcelId, undefined, userId);
        const merged = writeStrategyWorkspace(
          parcelId,
          mergeStrategyWorkspaces(parcelId, local, remote),
          undefined,
          userId,
        );
        const chosen = getChosenStrategyScenario(parcelId, undefined, userId);
        setSavedScenarios(merged.scenarios);
        setChosenScenario(chosen);
        setActive(
          STRATEGY_OPTIONS.some((option) => option.id === merged.activeStrategy)
            ? (merged.activeStrategy as StrategyType)
            : selectedStrategyId(chosen),
        );
        setValues({
          ...strategyDefaults(defaultPriceRef.current, propertyDefaults),
          ...merged.draftInputs,
        });
        setShowChosenState(Boolean(chosen));
        latestWorkspaceRef.current = merged;
        const cloudMissing = !remote && Boolean(local.draftUpdatedAt || local.scenarios.length);
        const localHadNewer =
          JSON.stringify(merged) !== JSON.stringify(remote ?? createEmptyStrategyWorkspace(parcelId));
        if (cloudMissing || localHadNewer) {
          queueCloudSave(merged, true);
          setSaveStatus(cloudMissing ? "migrated" : "saving");
        } else {
          setSaveStatus("cloud-restored");
        }
      });

    return () => {
      alive = false;
    };
  }, [parcelId, propertyDefaults, queueCloudSave, userId]);

  function persistDraft(nextActive: StrategyType, nextValues: Record<string, string>, immediate = false) {
    const workspace = saveStrategyDraft(
      parcelId,
      {
        activeStrategy: nextActive,
        draftInputs: nextValues,
      },
      undefined,
      userId,
    );
    queueCloudSave(workspace, immediate);
    return workspace;
  }

  const n = (key: string) => toNumber(values[key]);
  const setValue = (key: string, value: string) => {
    const next = { ...values, [key]: value };
    setValues(next);
    persistDraft(active, next);
    setShowChosenState(false);
  };

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
  const acquisitionCostsExcludingPurchase =
    n("transferDuty") +
    n("transferCosts") +
    n("bondCosts") +
    n("attorneyFees") +
    n("inspectionCosts") +
    n("financeFees") +
    n("otherAcquisitionCosts");
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
  const coverageFootprintM2 = n("theoreticalFootprintM2");
  const buildArea = deriveStrategyBuildAreaM2({
    explicitBuildAreaM2: n("buildAreaM2"),
    explicitFloorAreaM2: n("floorAreaM2"),
    coverageFootprintM2,
    numberOfFloors: n("numberOfFloors"),
  });
  const buildAreaM2 = buildArea.buildAreaM2;
  const buildCostModel = calculateBuildCost({
    directBuildCost: n("buildCost"),
    buildAreaM2,
    buildRatePerM2: n("buildCostPerM2"),
  });
  const effectiveBuildCost = buildCostModel.selectedBuildCost;
  const developmentContingencyAmount = effectiveBuildCost * (n("contingencyPercent") / 100);
  const developmentHoldingCost = n("developmentDurationMonths") * n("monthlyHoldingCost");
  const developmentCashRequired =
    calculateDevelopmentCashRequired({
      landCost: n("landCost"),
      acquisitionCostsExcludingPurchase,
      buildCost: effectiveBuildCost,
      professionalFees: n("professionalFees"),
      municipalPlanningFees: n("municipalPlanningFees"),
      contingency: developmentContingencyAmount,
      holdingFinanceCosts: developmentHoldingCost,
    });
  const developmentSell = calculateDevelopmentToSell({
    landCost: n("landCost"),
    buildCost: effectiveBuildCost,
    professionalFees: n("professionalFees"),
    municipalPlanningFees: n("municipalPlanningFees"),
    contingencyPercent: n("contingencyPercent"),
    developmentDurationMonths: n("developmentDurationMonths"),
    monthlyHoldingCost: n("monthlyHoldingCost"),
    exitSellingCosts: n("exitSellingCosts") + n("sellingCosts"),
    expectedSaleValue: n("expectedSaleValue"),
    acquisitionCosts: acquisitionCostsExcludingPurchase,
    cashInvested: developmentCashRequired,
    buildAreaM2,
  });
  const maximumOffer = calculateMaximumOffer({
    expectedSaleValue: n("expectedSaleValue"),
    sellingCosts: n("exitSellingCosts") + n("sellingCosts"),
    buildCosts: effectiveBuildCost,
    professionalFees: n("professionalFees"),
    municipalPlanningFees: n("municipalPlanningFees"),
    holdingFinanceCosts: developmentSell.totalHoldingCost,
    acquisitionCostsExcludingPurchase,
    contingency: developmentSell.contingencyAmount,
    requiredProfit: n("requiredProfit"),
    targetReturnOnCostPercent: n("targetReturnPercent"),
    targetMarginOnRevenuePercent: n("targetMarginPercent"),
  });
  const residualLandValue = calculateResidualLandValue({
    expectedGdv: n("expectedSaleValue"),
    sellingCosts: n("exitSellingCosts") + n("sellingCosts"),
    requiredDeveloperProfit: maximumOffer.requiredProfit || n("requiredProfit"),
    constructionCost: effectiveBuildCost,
    professionalFees: n("professionalFees"),
    municipalPlanningCosts: n("municipalPlanningFees"),
    contingency: developmentSell.contingencyAmount,
    financeHoldingCosts: developmentSell.totalHoldingCost,
    otherDevelopmentCosts: acquisitionCostsExcludingPurchase,
  });
  const pricePerM2 = calculatePricePerM2({
    landPurchasePrice: n("landCost") || n("purchasePrice"),
    erfAreaM2: n("erfAreaM2"),
    buildCost: effectiveBuildCost,
    buildAreaM2,
    completedValue: n("expectedSaleValue") || n("expectedResalePrice"),
    completedAreaM2: n("floorAreaM2") || buildAreaM2,
  });
  const developmentSensitivity = calculateDevelopmentSensitivity({
    landCost: n("landCost"),
    buildCost: effectiveBuildCost,
    professionalFees: n("professionalFees"),
    municipalPlanningFees: n("municipalPlanningFees"),
    contingencyPercent: n("contingencyPercent"),
    developmentDurationMonths: n("developmentDurationMonths"),
    monthlyHoldingCost: n("monthlyHoldingCost"),
    exitSellingCosts: n("exitSellingCosts") + n("sellingCosts"),
    expectedSaleValue: n("expectedSaleValue"),
    acquisitionCosts: acquisitionCostsExcludingPurchase,
    buildAreaM2,
    cashInvested: developmentCashRequired,
    buildCostDownsidePercent: n("downsideBuildCostPercent"),
    gdvDownsidePercent: n("downsideGdvPercent"),
    durationDownsideMonths: n("downsideDurationMonths"),
    buildCostUpsidePercent: n("upsideBuildCostPercent"),
    gdvUpsidePercent: n("upsideGdvPercent"),
  });
  const developmentRent = calculateDevelopmentToRent({
    landCost: n("landCost"),
    buildCost: effectiveBuildCost,
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
  const comparableEvidence = savedMarketEvidence.filter(
    (item) =>
      item.includeInSummary &&
      item.listingRole !== "subject_active_listing" &&
      item.relationship !== "target_asset",
  );
  const subjectListing = savedMarketEvidence.find(
    (item) => item.listingRole === "subject_active_listing",
  );
  const averageComparablePrice =
    comparableEvidence.length > 0
      ? comparableEvidence.reduce((sum, item) => sum + (item.askingPrice ?? 0), 0) /
        comparableEvidence.length
      : 0;
  const biggestUncertainty =
    developmentSell.missingAssumptions[0] ??
    buildCostModel.missingAssumptions[0] ??
    maximumOffer.missingAssumptions[0] ??
    "market support, planning controls and cost evidence";
  const dealSnapshot = buildDealSnapshot({
    active,
    rental,
    flip,
    developmentSell,
    developmentRent,
    str,
    brrrr,
    bond,
    landBankHoldingCost,
    acquisition,
    buildCostModel,
    maximumOffer,
    residualLandValue,
    developmentSensitivity,
    developmentCashRequired,
    biggestUncertainty,
  });

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
          ["Return on cost", formatPercent(developmentSell.returnOnCost)],
          ["Margin on revenue", formatPercent(developmentSell.margin)],
          ["Break-even sale price", formatRand(developmentSell.breakEvenSalePrice)],
          ["Maximum justified offer", formatRand(maximumOffer.maximumPurchasePrice)],
          ["Residual land value", formatRand(residualLandValue.residualLandValue)],
          ["Downside profit", formatRand(developmentSensitivity.downside.netProfit)],
          ["Build cost method", buildCostModel.method === "calculated" ? "Area x rate" : "Direct input"],
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
    const next = strategyDefaults(defaultPrice, propertyDefaults);
    setValues(next);
    persistDraft(active, next);
    setShowChosenState(false);
  }

  function applySitePotentialDraft() {
    if (!sitePotentialDraft) return;
    const conceptBuildable = toNumber(sitePotentialDraft.buildableSqm);
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
    const next = {
      ...values,
      ...(conceptBuildable > 0
        ? {
            buildAreaM2: String(conceptBuildable),
            floorAreaM2: String(conceptBuildable),
          }
        : {}),
      customNotes: [values.customNotes, ...notes].filter(Boolean).join("\n"),
    };
    setValues(next);
    persistDraft(nextActive, next, true);
    setShowChosenState(false);
    toast.success("Site Potential draft applied. Review the numbers before saving.");
  }

  function saveScenario(asNew = false) {
    const option = optionFor(active);
    const { scenario, scenarios, workspace } = saveStrategyScenario(
      parcelId,
      {
        label: `${option.label} scenario`,
        strategy: active,
        inputs: values,
        summary: summary.map(([label, value]) => ({ label, value })),
      },
      { asNew, userId },
    );
    setSavedScenarios(scenarios);
    setChosenScenario(scenario);
    setShowChosenState(true);
    queueCloudSave(workspace, true);
    toast.success("Scenario chosen for this erf.");
    return scenario;
  }

  function saveGuidedScenarioAndContinue() {
    if (!guidedReturn) return;
    completeGuidedStrategyScenario(() => saveScenario(), guidedReturn.onContinue);
  }

  const activeOption = optionFor(active);
  const guidedAssumptionGroups = isGuided ? splitGuidedAssumptionGroups(active) : null;

  return (
    <div className="space-y-5">
      <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-[#F7FBFF] p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">
              {isGuided ? "Guided Investigation / Strategy" : "Strategy Lab"}
            </div>
            <h3 className="mt-1 text-xl font-semibold tracking-tight text-[#0D1B2A]">
              {isGuided ? "1. Choose a strategy" : "Choose a strategy for this erf"}
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/68">
              {isGuided
                ? "Choose how you would approach this property, then review the assumptions and results before saving one report scenario."
                : "Every input autosaves as a draft for this erf. Save a scenario only when you want that version to feed the Easy Erf Report."}
            </p>
            <div className="mt-3 inline-flex rounded-full border border-[#0D1B2A]/10 bg-white px-3 py-1 text-[11px] font-semibold text-[#0D1B2A]/70">
              {isGuided
                ? "Choose strategy -> Assumptions -> Results"
                : "Autosaved draft separate from chosen report scenario"}
            </div>
          </div>
          {actionAvailability.showExpertScenarioManagement && (
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
              onClick={() => saveScenario()}
              className="rounded-full bg-[#FF6A00] px-4 py-2 text-[11px] font-semibold text-white hover:bg-[#ff7d1f]"
            >
              <Save className="mr-1 inline h-3.5 w-3.5" />
              Use this scenario in report
            </button>
            <button
              type="button"
              onClick={() => saveScenario(true)}
              className="rounded-full border border-[#0D1B2A]/10 bg-white px-3 py-2 text-[11px] font-semibold text-[#0D1B2A] hover:bg-[#fbf8f1]"
            >
              Save as a new scenario
            </button>
            </div>
          )}
        </div>
      </section>

      {isGuided ? (
        <section className="rounded-[1.25rem] border border-[#FF6A00]/25 bg-[#fff8ec] p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#B24A00]">
            Guided Strategy
          </div>
          <h4 className="mt-2 text-lg font-semibold text-[#0D1B2A]">
            One report-ready scenario
          </h4>
          <p className="mt-1 text-sm leading-6 text-[#0D1B2A]/70">
            Your working inputs autosave as a draft. The completion action below intentionally
            chooses the current scenario for the Easy Erf Report.
          </p>
          <div className="mt-3 text-xs font-semibold text-[#0D1B2A]/72">
            {chosenScenario
              ? `Current report scenario saved: ${chosenScenario.label}.`
              : "No report scenario is chosen yet. Your draft remains editable."}
          </div>
        </section>
      ) : null}

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

      {actionAvailability.showExpertScenarioManagement && showChosenState && chosenScenario && (
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

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <PropertyInputFactsPanel facts={propertyInputFacts} values={values} />
        <MarketContextPanel
          subjectListing={subjectListing}
          comparableCount={comparableEvidence.length}
          averageComparablePrice={averageComparablePrice}
        />
      </section>

      <section className={cn("grid gap-4", !isGuided && "xl:grid-cols-[1.1fr_0.9fr]")}>
        <div className="space-y-3 rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
              {isGuided ? "2. Review assumptions" : "Assumptions"}
            </div>
            <h4 className="mt-1 text-lg font-semibold text-[#0D1B2A]">{activeOption.label}</h4>
            <div
              className={cn(
                "mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold",
                saveStatus === "failed"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : saveStatus === "saved" ||
                      saveStatus === "cloud-restored" ||
                      saveStatus === "migrated"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-[#D9E6F2] bg-white text-[#0D1B2A]/68",
              )}
            >
              {saveStatusCopy(saveStatus, lastSavedAt)}
              {saveStatus === "failed" && (
                <button
                  type="button"
                  onClick={flushStrategySave}
                  className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white"
                >
                  Retry
                </button>
              )}
            </div>
            {saveError && saveStatus === "failed" && (
              <p className="mt-1 text-xs text-red-700">Cloud save failed. Your browser draft is still kept locally.</p>
            )}
            <p className="mt-1 text-sm leading-6 text-[#0D1B2A]/62">
              Adjust these assumptions before relying on the result.
            </p>
            </div>
            {isGuided && (
              <button
                type="button"
                onClick={reset}
                className="text-xs font-semibold text-[#0D1B2A]/60 underline decoration-[#0D1B2A]/25 underline-offset-4 hover:text-[#0D1B2A]"
              >
                Reset assumptions
              </button>
            )}
          </div>
          {(guidedAssumptionGroups?.primary ?? fieldGroupsFor(active)).map((group) => (
            <FieldGroup
              key={group.title}
              group={group}
              values={values}
              setValue={setValue}
              onBlur={flushStrategySave}
            />
          ))}
          {guidedAssumptionGroups && guidedAssumptionGroups.advanced.length > 0 && (
            <details className="rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-3">
              <summary className="cursor-pointer text-sm font-semibold text-[#0D1B2A]">
                Advanced assumptions
              </summary>
              <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/58">
                Detailed costs, finance overrides and sensitivity inputs use the same draft values.
              </p>
              <div className="mt-3 space-y-3">
                {guidedAssumptionGroups.advanced.map((group) => (
                  <FieldGroup
                    key={group.title}
                    group={group}
                    values={values}
                    setValue={setValue}
                    onBlur={flushStrategySave}
                  />
                ))}
              </div>
            </details>
          )}
        </div>

        <div className="space-y-3">
          {isGuided && (
            <DealSnapshotPanel
              activeLabel={activeOption.label}
              snapshot={dealSnapshot}
              guidedStepLabel="3. Review the result"
            />
          )}
          <section className="rounded-[1.5rem] border border-[#FF6A00]/20 bg-[#fff8ec] p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">
              {isGuided ? "Detailed outputs" : "Output panel"}
            </div>
            <h4 className="mt-1 text-lg font-semibold text-[#0D1B2A]">
              {isGuided ? `${activeOption.label} outputs` : "Planning result"}
            </h4>
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
            {actionAvailability.showExpertScenarioManagement && (
              <button
                type="button"
                onClick={() => saveScenario()}
                className="mt-4 w-full rounded-full bg-[#0D1B2A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#142941]"
              >
                Use this scenario in report
              </button>
            )}
          </section>
          {active === "development_sell" && (
            <>
              <SensitivityPanel sensitivity={developmentSensitivity} />
              <FormulaPanel
                buildCostModel={buildCostModel}
                maximumOffer={maximumOffer}
                residualLandValue={residualLandValue}
                pricePerM2={pricePerM2}
              />
            </>
          )}
        </div>
      </section>

      {!isGuided && <DealSnapshotPanel activeLabel={activeOption.label} snapshot={dealSnapshot} />}

      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-3 text-[11px] text-muted-foreground">
        {savedScenarios.length > 0
          ? `${savedScenarios.length} saved strategy scenario${savedScenarios.length === 1 ? "" : "s"} on file. Only the chosen scenario feeds the Easy Erf Report.`
          : "Your draft is autosaved, but the Easy Erf Report waits for you to save a chosen scenario."}
        {actionAvailability.showDirectReport && savedScenarios.length > 0 && (
          <button
            type="button"
            onClick={onOpenReport}
            className="mt-3 inline-flex rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#142941]"
          >
            Continue to Easy Erf Report
          </button>
        )}
      </div>
      {isGuided ? (
        <section className="rounded-[1.25rem] border border-[#FF6A00]/25 bg-[#fff8ec] p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#B24A00]">
            Guided completion · Strategy
          </div>
          <h4 className="mt-2 text-lg font-semibold text-[#0D1B2A]">
            Use this scenario and continue
          </h4>
          <p className="mt-1 text-sm leading-6 text-[#0D1B2A]/70">
            This saves the current assumptions as the scenario used in your Easy Erf Report, then
            continues to Site Potential.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => guidedReturn?.onBack()}
              className="inline-flex min-h-10 items-center rounded-full border border-[#0D1B2A]/14 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A] hover:border-[#FF6A00]/35"
            >
              Back to Investigation
            </button>
            <button
              type="button"
              onClick={saveGuidedScenarioAndContinue}
              className="inline-flex min-h-10 items-center rounded-full bg-[#FF6A00] px-4 py-2 text-xs font-semibold text-white hover:bg-[#FF7D1F]"
            >
              Use this scenario and continue
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

interface FieldGroupModel {
  title: string;
  helper: string;
  fields: [string, string][];
}

const GUIDED_ADVANCED_ASSUMPTION_KEYS = new Set([
  "transferDuty",
  "transferCosts",
  "bondCosts",
  "attorneyFees",
  "inspectionCosts",
  "otherAcquisitionCosts",
  "loanAmount",
  "monthlyBondPayment",
  "financeFees",
  "otherIncome",
  "utilitiesPaidByOwner",
  "otherMonthlyCosts",
  "security",
  "gardenPool",
  "agentCommission",
  "sellingCosts",
  "requiredProfit",
  "targetReturnPercent",
  "targetMarginPercent",
  "downsideBuildCostPercent",
  "downsideGdvPercent",
  "downsideDurationMonths",
  "upsideBuildCostPercent",
  "upsideGdvPercent",
]);

export function splitGuidedAssumptionGroups(strategy: StrategyType) {
  const primary: FieldGroupModel[] = [];
  const advanced: FieldGroupModel[] = [];

  for (const group of fieldGroupsFor(strategy)) {
    const primaryFields = group.fields.filter(([, key]) => !GUIDED_ADVANCED_ASSUMPTION_KEYS.has(key));
    const advancedFields = group.fields.filter(([, key]) => GUIDED_ADVANCED_ASSUMPTION_KEYS.has(key));

    if (primaryFields.length > 0) {
      primary.push({ ...group, fields: primaryFields });
    }
    if (advancedFields.length > 0) {
      advanced.push({ ...group, fields: advancedFields });
    }
  }

  return { primary, advanced };
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
          title: "Property and build envelope",
          helper:
            "Area and coverage may be prefilled from evidence, but editable draft values remain assumptions.",
          fields: [
            ["Erf area m2", "erfAreaM2"],
            ["Coverage percent", "coveragePercent"],
            ["Derived footprint m2", "theoreticalFootprintM2"],
            ["Build area m2", "buildAreaM2"],
            ["Floor area m2", "floorAreaM2"],
            ["Number of floors", "numberOfFloors"],
          ],
        },
        {
          title: "Development costs",
          helper: "Use either a direct build cost or build area x rate, plus professional and planning costs.",
          fields: [
            ["Land cost", "landCost"],
            ["Direct build cost", "buildCost"],
            ["Build cost per m2", "buildCostPerM2"],
            ["Professional fees", "professionalFees"],
            ["Municipal / planning fees", "municipalPlanningFees"],
            ["Contingency percent", "contingencyPercent"],
            ["Transfer duty", "transferDuty"],
            ["Transfer costs", "transferCosts"],
            ["Bond costs", "bondCosts"],
            ["Attorney / conveyancer fees", "attorneyFees"],
          ],
        },
        {
          title: "Timing, sale and target",
          helper: "Set the resale value, exit costs and the return hurdle for max-offer and residual land value.",
          fields: [
            ["Development duration months", "developmentDurationMonths"],
            ["Monthly holding cost", "monthlyHoldingCost"],
            ["Exit / selling costs", "exitSellingCosts"],
            ["Expected sale value", "expectedSaleValue"],
            ["Required profit", "requiredProfit"],
            ["Target return on cost percent", "targetReturnPercent"],
            ["Target margin on revenue percent", "targetMarginPercent"],
          ],
        },
        {
          title: "Sensitivity",
          helper: "Stress the deal with build-cost, value and duration changes.",
          fields: [
            ["Downside build cost percent", "downsideBuildCostPercent"],
            ["Downside GDV percent", "downsideGdvPercent"],
            ["Downside duration months", "downsideDurationMonths"],
            ["Upside build cost percent", "upsideBuildCostPercent"],
            ["Upside GDV percent", "upsideGdvPercent"],
          ],
        },
      ];
    case "development_rent":
      return [
        {
          title: "Property and build envelope",
          helper:
            "Use verified area where available, and keep unverified coverage/build area as assumptions.",
          fields: [
            ["Erf area m2", "erfAreaM2"],
            ["Coverage percent", "coveragePercent"],
            ["Derived footprint m2", "theoreticalFootprintM2"],
            ["Build area m2", "buildAreaM2"],
            ["Floor area m2", "floorAreaM2"],
          ],
        },
        {
          title: "Development",
          helper: "Include development duration and monthly holding cost before rent starts.",
          fields: [
            ["Land cost", "landCost"],
            ["Direct build cost", "buildCost"],
            ["Build cost per m2", "buildCostPerM2"],
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

function DealSnapshotPanel({
  activeLabel,
  snapshot,
  guidedStepLabel,
}: {
  activeLabel: string;
  snapshot: DealSnapshotModel;
  guidedStepLabel?: string;
}) {
  return (
    <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-4 shadow-[0_18px_60px_-48px_rgba(13,27,42,0.55)]">
      {guidedStepLabel && (
        <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">
          {guidedStepLabel}
        </div>
      )}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">
            Deal Snapshot
          </div>
          <h4 className="mt-1 text-lg font-semibold text-[#0D1B2A]">
            {activeLabel} decision frame
          </h4>
          <p className="mt-1 text-sm leading-6 text-[#0D1B2A]/64">
            {snapshot.summary} Inputs remain editable assumptions until supported by evidence.
            Easy Erf does the arithmetic here; it does not let AI invent financial figures.
          </p>
        </div>
        <div className="rounded-2xl border border-[#FF6A00]/20 bg-[#FFF7ED] px-4 py-3 text-xs text-[#7C2D12]">
          <div className="font-bold uppercase tracking-[0.14em]">Biggest uncertainty</div>
          <div className="mt-1 text-sm font-semibold normal-case tracking-normal text-[#0D1B2A]">
            {snapshot.uncertainty}
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {snapshot.items.map(([label, value]) => (
          <ResultTile key={label} label={label} value={value} />
        ))}
      </div>
      {snapshot.emphasis.length > 0 && (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {snapshot.emphasis.map(([label, value]) => (
            <ResultTile key={label} label={label} value={value} />
          ))}
        </div>
      )}
    </section>
  );
}

function PropertyInputFactsPanel({
  facts,
  values,
}: {
  facts: StrategyInputFact[];
  values: Record<string, string>;
}) {
  return (
    <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
        Property-derived inputs
      </div>
      <h4 className="mt-1 text-lg font-semibold text-[#0D1B2A]">
        What Easy Erf can safely prefill
      </h4>
      <p className="mt-1 text-sm leading-6 text-[#0D1B2A]/64">
        These values come from the selected parcel, planning assumptions or a selected Site
        Potential concept. User edits stay as Strategy draft assumptions and do not overwrite the
        official parcel record.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {facts.map((fact) => {
          const draftValue = values[fact.key];
          const draftChanged =
            draftValue?.trim() &&
            fact.originalPropertyValue != null &&
            Number(draftValue) !== fact.originalPropertyValue;
          return (
            <article key={fact.key} className="rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[#0D1B2A]">{fact.label}</div>
                  <div className="mt-1 text-xl font-bold tabular-nums text-[#0D1B2A]">
                    {fact.value == null ? "Not yet verified" : formatNumber(fact.value, ` ${fact.unit}`)}
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]",
                    INPUT_STATE_TONE[fact.state],
                  )}
                >
                  {INPUT_STATE_LABEL[fact.state]}
                </span>
              </div>
              <div className="mt-3 text-xs leading-5 text-[#0D1B2A]/62">
                <div>Source: {fact.source}</div>
                <div>{fact.evidence}</div>
                {draftChanged && (
                  <div className="mt-1 font-semibold text-[#B24A00]">
                    Draft override: {draftValue} {fact.unit}
                  </div>
                )}
                {fact.warning && (
                  <div className="mt-1 font-semibold text-[#B24A00]">{fact.warning}</div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MarketContextPanel({
  subjectListing,
  comparableCount,
  averageComparablePrice,
}: {
  subjectListing: SavedMarketEvidence | undefined;
  comparableCount: number;
  averageComparablePrice: number;
}) {
  return (
    <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-[#F7FBFF] p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
        Market context
      </div>
      <h4 className="mt-1 text-lg font-semibold text-[#0D1B2A]">
        Saved evidence, not an automatic valuation
      </h4>
      <div className="mt-4 grid gap-2">
        <ResultTile
          label="Active listing for this erf"
          value={subjectListing?.askingPrice ? formatRand(subjectListing.askingPrice) : "Not saved"}
        />
        <ResultTile label="Comparable evidence" value={`${comparableCount} saved`} />
        <ResultTile
          label="Average comparable asking price"
          value={averageComparablePrice > 0 ? formatRand(averageComparablePrice) : "Not enough data"}
        />
      </div>
      <p className="mt-3 text-xs leading-5 text-[#0D1B2A]/60">
        Asking prices and comparable evidence help frame the decision, but they are not verified
        valuations. Save supporting evidence before relying on market outputs.
      </p>
    </section>
  );
}

function SensitivityPanel({
  sensitivity,
}: {
  sensitivity: ReturnType<typeof calculateDevelopmentSensitivity>;
}) {
  return (
    <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
        Sensitivity
      </div>
      <h4 className="mt-1 text-sm font-semibold text-[#0D1B2A]">Red / base / green outcome</h4>
      <div className="mt-3 grid gap-2">
        <ResultTile label="Downside profit" value={formatRand(sensitivity.downside.netProfit)} />
        <ResultTile label="Base profit" value={formatRand(sensitivity.base.netProfit)} />
        <ResultTile label="Upside profit" value={formatRand(sensitivity.upside.netProfit)} />
      </div>
      <p className="mt-3 text-xs leading-5 text-[#0D1B2A]/60">
        Downside: {sensitivity.assumptions.downside}. Upside: {sensitivity.assumptions.upside}.
      </p>
    </section>
  );
}

function FormulaPanel({
  buildCostModel,
  maximumOffer,
  residualLandValue,
  pricePerM2,
}: {
  buildCostModel: ReturnType<typeof calculateBuildCost>;
  maximumOffer: ReturnType<typeof calculateMaximumOffer>;
  residualLandValue: ReturnType<typeof calculateResidualLandValue>;
  pricePerM2: ReturnType<typeof calculatePricePerM2>;
}) {
  return (
    <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
        Formula details
      </div>
      <h4 className="mt-1 text-sm font-semibold text-[#0D1B2A]">How the core figures are derived</h4>
      <div className="mt-3 space-y-2 text-xs leading-5 text-[#0D1B2A]/66">
        <p>{buildCostModel.equation}</p>
        <p>
          Maximum offer subtracts build, professional, planning, holding, acquisition, contingency
          and required profit from expected sale proceeds.
        </p>
        <p>
          Residual land value: GDV less selling costs, target profit, build and other development
          costs = {formatRand(residualLandValue.residualLandValue)}.
        </p>
      </div>
      <div className="mt-3 grid gap-2">
        <ResultTile label="Land price / erf m2" value={formatRand(pricePerM2.landPricePerErfM2)} />
        <ResultTile label="Build cost / build m2" value={formatRand(pricePerM2.buildCostPerBuildM2)} />
        <ResultTile
          label="Completed value / m2"
          value={formatRand(pricePerM2.completedValuePerM2)}
        />
        <ResultTile
          label="Fixed costs before land"
          value={formatRand(maximumOffer.fixedCostsBeforeLand)}
        />
      </div>
    </section>
  );
}

function FieldGroup({
  group,
  values,
  setValue,
  onBlur,
}: {
  group: FieldGroupModel;
  values: Record<string, string>;
  setValue: (key: string, value: string) => void;
  onBlur: () => void;
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
              onBlur={onBlur}
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
