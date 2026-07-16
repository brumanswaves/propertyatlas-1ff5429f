import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import type {
  ErfWorkspaceState,
  ErfStrategyScenario,
} from "@/lib/workbench/erfWorkspaceState";
import type {
  MarketAddressIntelligence,
  SavedMarketEvidence,
  MarketEvidenceSummary,
  AddressCandidate,
} from "@/features/marketEvidence/types";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";
import { calculateMarketEvidenceSummary } from "@/features/marketEvidence/calculateMarketEvidenceSummary";

/**
 * Evidence-based readiness — never a subjective "quality" score.
 * Every category is one of: confirmed | partial | missing | not_reviewed.
 */
export type ReadinessState = "confirmed" | "partial" | "missing" | "not_reviewed";

export type EvidenceBadge =
  | "official"
  | "uploaded_report"
  | "user_confirmed"
  | "listing"
  | "ai_interpretation"
  | "assumption"
  | "missing";

export interface ReadinessCategory {
  id:
    | "identity"
    | "planning"
    | "ownership"
    | "market"
    | "risk"
    | "strategy"
    | "documents";
  label: string;
  state: ReadinessState;
  explanation: string;
}

export interface ReportSectionMeta {
  id: string;
  label: string;
  anchorId: string;
}

export const REPORT_SECTIONS: ReportSectionMeta[] = [
  { id: "brief", label: "Decision Brief", anchorId: "report-brief" },
  { id: "identity", label: "Property Identity", anchorId: "report-identity" },
  { id: "ownership", label: "Ownership & Deeds", anchorId: "report-ownership" },
  { id: "planning", label: "Land & Planning", anchorId: "report-planning" },
  { id: "market", label: "Market Evidence", anchorId: "report-market" },
  { id: "risk", label: "Risk Register", anchorId: "report-risk" },
  { id: "site", label: "Site Potential", anchorId: "report-site" },
  { id: "strategy", label: "Strategy Scenarios", anchorId: "report-strategy" },
  { id: "documents", label: "Evidence & Documents", anchorId: "report-documents" },
  { id: "recommendations", label: "Recommendations", anchorId: "report-recommendations" },
];

export interface RiskItem {
  id: string;
  title: string;
  severity: "low" | "medium" | "high";
  why: string;
  evidence: string;
  nextAction: string;
  actionTab?: string;
}

export interface RecommendationItem {
  id: string;
  order: number;
  title: string;
  detail: string;
  actionLabel: string;
  actionTab?: string;
}

export interface PropertyIdentityDisplay {
  displayName: string;
  officialLine: string | null;
  marketAddressLine: string | null;
  addressAndOfficialMismatch: boolean;
  municipality: string | null;
  province: string | null;
  erfNumber: string | null;
  portion: string | null;
  lpi: string | null;
  parcelKey: string | null;
  sourceLabel: string | null;
  coordinates: { lng: number; lat: number } | null;
  areaM2: number | null;
}

export interface OwnershipView {
  hasUploadedReport: boolean;
  uploadedReportNames: string[];
  isVerified: false; // always false in Phase 1 — never fabricate ownership
  message: string;
}

export interface PlanningField {
  label: string;
  value: string | null;
  badge: EvidenceBadge;
}

export interface MarketView {
  evidenceCount: number;
  includedCount: number;
  subjectListing: SavedMarketEvidence | null;
  strongest: SavedMarketEvidence[];
  summary: MarketEvidenceSummary;
  canShowIndicativeValue: boolean;
  askingCount: number;
  soldCount: number;
  latestUpdatedAt: string | null;
}

export interface SiteView {
  selectedDesign: ErfAsset | null;
  conceptCount: number;
  skipped: boolean;
  hasBrief: boolean;
  disclaimer: string;
}

export interface StrategyView {
  chosen: ErfStrategyScenario | null;
  scenarioCount: number;
  hasSaved: boolean;
}

export interface DocumentsView {
  assetCount: number;
  savedEvidenceCount: number;
  sgDiagramCount: number;
  uploadedReportCount: number;
  completenessPercent: number;
}

export interface DecisionBrief {
  positives: string[];
  attention: string[];
  nextActions: Array<{ label: string; tab?: string }>;
  readinessPercent: number;
  categories: ReadinessCategory[];
}

export interface ReportViewModel {
  parcelId: string;
  generatedAt: string;
  identity: PropertyIdentityDisplay;
  ownership: OwnershipView;
  planning: PlanningField[];
  market: MarketView;
  site: SiteView;
  strategy: StrategyView;
  documents: DocumentsView;
  risks: RiskItem[];
  recommendations: RecommendationItem[];
  brief: DecisionBrief;
  heroImage: { src: string; caption: string; source: EvidenceBadge } | null;
}

export interface BuildReportInput {
  parcel: NormalizedOfficialParcel;
  workspaceState: ErfWorkspaceState;
  savedEvidence: SavedMarketEvidence[];
  marketAddress: MarketAddressIntelligence | null;
  assets: ErfAsset[];
  chosenScenario: ErfStrategyScenario | null;
  strategyScenarios: ErfStrategyScenario[];
  selectedSiteDesign: ErfAsset | null;
  siteBrief?: string | null;
  now?: Date;
  disclaimer?: string;
}

const DEFAULT_DISCLAIMER =
  "AI-generated concept visualisation. Not an architectural plan, municipal approval, quotation or representation of what may legally be built.";

function pickConfirmedAddress(address: MarketAddressIntelligence | null): AddressCandidate | null {
  if (!address) return null;
  if (address.userConfirmedAddress) return address.userConfirmedAddress;
  const id = address.selectedAddressId;
  if (id) return address.candidates.find((c) => c.id === id) ?? null;
  return null;
}

function parcelDisplayName(parcel: NormalizedOfficialParcel, marketAddr: AddressCandidate | null) {
  if (marketAddr?.formattedAddress) return marketAddr.formattedAddress;
  if (parcel.erfNumber != null) {
    const portionSuffix = parcel.portion != null && String(parcel.portion) !== "0" ? ` / ${parcel.portion}` : "";
    return `Erf ${parcel.erfNumber}${portionSuffix}`;
  }
  return "Selected parcel";
}

function parcelAreaM2(parcel: NormalizedOfficialParcel): number | null {
  const raw = parcel.rawProperties ?? {};
  const candidates = ["SHAPE_Area", "AREA", "AREA_M2", "area", "shape_area", "AREAM2"];
  for (const key of candidates) {
    const value = (raw as Record<string, unknown>)[key];
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return null;
}

function buildIdentity(
  parcel: NormalizedOfficialParcel,
  marketAddr: AddressCandidate | null,
): PropertyIdentityDisplay {
  const officialParts: string[] = [];
  if (parcel.erfNumber != null) officialParts.push(`Erf ${parcel.erfNumber}`);
  if (parcel.portion != null && String(parcel.portion) !== "0") officialParts.push(`Portion ${parcel.portion}`);
  if (parcel.municipality) officialParts.push(parcel.municipality);
  if (parcel.province) officialParts.push(parcel.province);
  const officialLine = officialParts.length ? officialParts.join(" / ") : null;

  const marketAddressLine = marketAddr?.formattedAddress ?? null;
  const mismatch = Boolean(
    marketAddr &&
      officialLine &&
      // simple heuristic: municipality mismatch when both defined
      parcel.municipality &&
      marketAddr.municipality &&
      normalize(parcel.municipality) !== normalize(marketAddr.municipality),
  );

  return {
    displayName: parcelDisplayName(parcel, marketAddr),
    officialLine,
    marketAddressLine,
    addressAndOfficialMismatch: mismatch,
    municipality: parcel.municipality ?? null,
    province: parcel.province ?? null,
    erfNumber: parcel.erfNumber != null ? String(parcel.erfNumber) : null,
    portion: parcel.portion != null ? String(parcel.portion) : null,
    lpi: parcel.lpi ?? null,
    parcelKey: parcel.parcelKey ?? null,
    sourceLabel: parcel.sourceLabel ?? null,
    coordinates: parcel.coordinates ?? null,
    areaM2: parcelAreaM2(parcel),
  };
}

function normalize(v: string) {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function buildOwnership(assets: ErfAsset[]): OwnershipView {
  const uploaded = assets.filter((a) => a.asset_category === "paid_report");
  return {
    hasUploadedReport: uploaded.length > 0,
    uploadedReportNames: uploaded.map((a) => a.original_file_name),
    isVerified: false,
    message: uploaded.length
      ? "Ownership is not verified by Easy Erf. Uploaded reports are stored for reference; open them to check owner details yourself."
      : "Ownership, bonds and transfer history are not verified. Purchase a Lightstone or WinDeed report, or open a title deed, to confirm ownership.",
  };
}

function buildPlanning(parcel: NormalizedOfficialParcel): PlanningField[] {
  const raw = parcel.rawProperties ?? {};
  const zoningVal = firstStr(raw, [
    "ZONING",
    "Zoning",
    "ZONE",
    "ZONE_NAME",
    "ZONING_DESCRIPTION",
    "LU_DESC",
  ]);
  const areaM2 = parcelAreaM2(parcel);
  return [
    {
      label: "Zoning",
      value: zoningVal,
      badge: zoningVal ? "official" : "missing",
    },
    {
      label: "Erf size (m²)",
      value: areaM2 != null ? areaM2.toLocaleString() : null,
      badge: areaM2 != null ? "official" : "missing",
    },
    { label: "Coverage %", value: null, badge: "missing" },
    { label: "FAR", value: null, badge: "missing" },
    { label: "Height limit", value: null, badge: "missing" },
    { label: "Setbacks", value: null, badge: "missing" },
    { label: "Density", value: null, badge: "missing" },
    { label: "Permitted uses", value: null, badge: "missing" },
  ];
}

function firstStr(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

function buildMarket(evidence: SavedMarketEvidence[]): MarketView {
  const summary = calculateMarketEvidenceSummary(evidence);
  const subject = evidence.find((e) => e.listingRole === "subject_active_listing") ?? null;
  const comps = evidence.filter(
    (e) =>
      e.listingRole !== "subject_active_listing" &&
      e.includeInSummary &&
      e.relationship !== "not_related" &&
      e.confidence !== "excluded",
  );
  const strongest = comps
    .slice()
    .sort((a, b) => confRank(b.confidence) - confRank(a.confidence))
    .slice(0, 3);

  const askingCount = comps.filter((c) => c.askingPrice && c.askingPrice > 0).length;
  const soldCount = 0; // We do not currently distinguish sold. Never invent sold facts.

  return {
    evidenceCount: evidence.length,
    includedCount: summary.includedEvidence,
    subjectListing: subject,
    strongest,
    summary,
    // Only surface indicative summary if there are at least 3 included comps with prices
    canShowIndicativeValue:
      summary.includedEvidence >= 3 && typeof summary.medianAskingPrice === "number",
    askingCount,
    soldCount,
    latestUpdatedAt: summary.lastUpdated ?? null,
  };
}

function confRank(c: SavedMarketEvidence["confidence"]) {
  return c === "high" ? 3 : c === "medium" ? 2 : c === "low" ? 1 : 0;
}

function buildSite(
  workspaceState: ErfWorkspaceState,
  selectedDesign: ErfAsset | null,
  siteBrief?: string | null,
): SiteView {
  return {
    selectedDesign,
    conceptCount: workspaceState.sitePotential.conceptCount,
    skipped:
      workspaceState.sitePotential.skipped ||
      workspaceState.sitePotential.progressState === "skipped" ||
      workspaceState.sitePotential.mode === "skipped",
    hasBrief: Boolean(siteBrief && siteBrief.trim().length > 0),
    disclaimer: DEFAULT_DISCLAIMER,
  };
}

function buildStrategy(
  chosen: ErfStrategyScenario | null,
  scenarios: ErfStrategyScenario[],
): StrategyView {
  return {
    chosen,
    scenarioCount: scenarios.length,
    hasSaved: scenarios.length > 0,
  };
}

function buildDocuments(
  assets: ErfAsset[],
  workspaceState: ErfWorkspaceState,
  savedEvidence: SavedMarketEvidence[],
): DocumentsView {
  const sg = assets.filter((a) => a.asset_category === "sg_diagram").length;
  const paid = assets.filter((a) => a.asset_category === "paid_report").length;
  // Completeness: fraction of 6 evidence buckets that have any input.
  const buckets = [
    workspaceState.identityStatus !== "none",
    workspaceState.reviewedSourceIds.length > 0 || sg > 0,
    savedEvidence.length > 0 || workspaceState.marketAddressSaved,
    workspaceState.strategyScenarioCount > 0,
    workspaceState.sitePotential.selectedDesignAssetId != null || workspaceState.sitePotential.skipped,
    paid > 0,
  ];
  const filled = buckets.filter(Boolean).length;
  return {
    assetCount: assets.length,
    savedEvidenceCount: savedEvidence.length,
    sgDiagramCount: sg,
    uploadedReportCount: paid,
    completenessPercent: Math.round((filled / buckets.length) * 100),
  };
}

function buildReadinessCategories(input: BuildReportInput, market: MarketView, docs: DocumentsView, ownership: OwnershipView): ReadinessCategory[] {
  const ws = input.workspaceState;
  const identityState: ReadinessState =
    ws.identityStatus === "uncertain"
      ? "partial"
      : ws.identityStatus === "checked" || ws.identityStatus === "looks_correct"
        ? "confirmed"
        : ws.identityStatus === "none"
          ? input.parcel.knownFields.length > 0
            ? "not_reviewed"
            : "missing"
          : "not_reviewed";

  const planningVals = buildPlanning(input.parcel).filter((p) => p.value);
  const planningState: ReadinessState =
    planningVals.length >= 5 ? "confirmed" : planningVals.length >= 2 ? "partial" : planningVals.length ? "partial" : "missing";

  const ownershipState: ReadinessState = ownership.hasUploadedReport ? "partial" : "missing";

  const marketState: ReadinessState =
    market.includedCount >= 3 ? "confirmed" : market.evidenceCount > 0 || ws.marketAddressSaved ? "partial" : "missing";

  const strategyState: ReadinessState =
    ws.chosenScenarioId ? "confirmed" : ws.strategyScenarioCount > 0 ? "partial" : ws.calculatorStarted ? "not_reviewed" : "missing";

  const documentsState: ReadinessState =
    docs.completenessPercent >= 80 ? "confirmed" : docs.completenessPercent >= 40 ? "partial" : docs.completenessPercent > 0 ? "not_reviewed" : "missing";

  // Risk review = user has actively reviewed sources and identity
  const riskState: ReadinessState =
    ws.reviewedSourceIds.length >= 2 && identityState === "confirmed"
      ? "confirmed"
      : ws.reviewedSourceIds.length > 0
        ? "partial"
        : "not_reviewed";

  return [
    { id: "identity", label: "Identity", state: identityState, explanation: "Confirmed when the user has checked official parcel identity and marked it correct." },
    { id: "planning", label: "Planning", state: planningState, explanation: "Confirmed when zoning, size and at least three planning controls are populated from official sources." },
    { id: "ownership", label: "Ownership", state: ownershipState, explanation: "Never confirmed automatically. Requires a Lightstone, WinDeed or title-deed document you have uploaded." },
    { id: "market", label: "Market", state: marketState, explanation: "Confirmed when at least three included comparables are saved for this erf." },
    { id: "risk", label: "Risk review", state: riskState, explanation: "Confirmed when identity is checked and at least two official sources have been reviewed." },
    { id: "strategy", label: "Strategy", state: strategyState, explanation: "Confirmed when a Strategy Lab scenario has been chosen." },
    { id: "documents", label: "Documents", state: documentsState, explanation: "Percentage of evidence buckets that contain at least one saved input." },
  ];
}

function buildRisks(input: BuildReportInput, market: MarketView, ownership: OwnershipView, identity: PropertyIdentityDisplay): RiskItem[] {
  const ws = input.workspaceState;
  const risks: RiskItem[] = [];

  if (identity.addressAndOfficialMismatch) {
    risks.push({
      id: "identity-mismatch",
      title: "Possible address / erf mismatch",
      severity: "high",
      why: "The saved market address municipality does not match the official parcel municipality. Every downstream decision depends on the correct erf.",
      evidence: "Address municipality and official municipality differ.",
      nextAction: "Recheck the official identity and the market address.",
      actionTab: "research",
    });
  }

  if (ws.identityStatus === "none" || ws.identityStatus === "uncertain") {
    risks.push({
      id: "identity-unchecked",
      title: "Official identity not checked",
      severity: "high",
      why: "Reports and calculators can point at the wrong erf if identity is not confirmed by a human.",
      evidence: "No identity confirmation has been saved.",
      nextAction: "Open the Sources verification centre and confirm identity.",
      actionTab: "research",
    });
  }

  if (!ownership.hasUploadedReport) {
    risks.push({
      id: "ownership-missing",
      title: "Ownership and deeds not verified",
      severity: "medium",
      why: "Bonds, transfers and current registered owner are unknown until an official deeds report is obtained.",
      evidence: "No Lightstone, WinDeed or title-deed PDF uploaded.",
      nextAction: "Purchase or upload a Lightstone / WinDeed report.",
      actionTab: "reports",
    });
  }

  const planningFilled = buildPlanning(input.parcel).filter((p) => p.value).length;
  if (planningFilled < 3) {
    risks.push({
      id: "planning-partial",
      title: "Zoning and building controls not fully known",
      severity: "medium",
      why: "Development, subdivision and use assumptions can be wrong if planning controls are not verified.",
      evidence: `${planningFilled} of 8 planning controls populated from official data.`,
      nextAction: "Verify zoning, coverage, FAR, height and setbacks with the municipality.",
      actionTab: "research",
    });
  }

  if (market.includedCount < 3) {
    risks.push({
      id: "market-weak",
      title: "Market evidence is thin",
      severity: market.includedCount === 0 ? "high" : "medium",
      why: "An indicative value cannot be responsibly calculated without at least three included comparables.",
      evidence: `${market.includedCount} included market evidence item(s).`,
      nextAction: "Import additional listings or comparables.",
      actionTab: "listings",
    });
  }

  if (
    !ws.sitePotential.selectedDesignAssetId &&
    !ws.sitePotential.skipped &&
    ws.sitePotential.conceptCount === 0
  ) {
    risks.push({
      id: "site-not-reviewed",
      title: "Site and environment not reviewed",
      severity: "low",
      why: "Slope, access, orientation and site constraints can materially change value and buildability.",
      evidence: "No Site Potential concept generated or explicit skip recorded.",
      nextAction: "Explore Site Potential or mark it not relevant.",
      actionTab: "site-potential",
    });
  }

  if (!ws.chosenScenarioId) {
    risks.push({
      id: "strategy-unconfirmed",
      title: "Strategy assumptions not confirmed",
      severity: "low",
      why: "Without a chosen strategy scenario, ROI and offer numbers are not grounded in your own assumptions.",
      evidence: `${ws.strategyScenarioCount} saved scenario(s), none chosen.`,
      nextAction: "Choose a scenario in Strategy Lab.",
      actionTab: "calculators",
    });
  }

  return risks;
}

function buildRecommendations(risks: RiskItem[]): RecommendationItem[] {
  const priority: Record<RiskItem["severity"], number> = { high: 0, medium: 1, low: 2 };
  const ordered = risks.slice().sort((a, b) => priority[a.severity] - priority[b.severity]);
  return ordered.map((r, i) => ({
    id: `rec-${r.id}`,
    order: i + 1,
    title: r.nextAction,
    detail: r.why,
    actionLabel: openLabelFor(r.actionTab),
    actionTab: r.actionTab,
  }));
}

function openLabelFor(tab?: string): string {
  switch (tab) {
    case "research":
      return "Open Sources";
    case "reports":
      return "Open Reports";
    case "listings":
      return "Open Market";
    case "site-potential":
      return "Open Site Potential";
    case "calculators":
      return "Open Strategy Lab";
    default:
      return "Open workbench";
  }
}

function buildBrief(
  categories: ReadinessCategory[],
  input: BuildReportInput,
  market: MarketView,
  identity: PropertyIdentityDisplay,
  risks: RiskItem[],
  recs: RecommendationItem[],
): DecisionBrief {
  const stateWeight: Record<ReadinessState, number> = {
    confirmed: 1,
    partial: 0.5,
    not_reviewed: 0.15,
    missing: 0,
  };
  const readinessPercent = Math.round(
    (categories.reduce((sum, c) => sum + stateWeight[c.state], 0) / categories.length) * 100,
  );

  const positives: string[] = [];
  const attention: string[] = [];

  if (categories.find((c) => c.id === "identity")?.state === "confirmed") {
    positives.push("Official identity checked by the user.");
  }
  if (identity.officialLine) {
    positives.push(`Official identifiers on file: ${identity.officialLine}.`);
  }
  if (market.includedCount >= 3) {
    positives.push(`${market.includedCount} included market evidence items available.`);
  }
  if (input.workspaceState.chosenScenarioId) {
    positives.push("A strategy scenario has been chosen.");
  }
  if (input.workspaceState.sitePotential.selectedDesignAssetId) {
    positives.push("A Site Potential concept has been selected.");
  }
  if (positives.length === 0) {
    positives.push("Report shell created for this erf. Add evidence to strengthen it.");
  }

  for (const r of risks) {
    if (r.severity === "high") attention.push(r.title);
  }
  if (attention.length === 0) {
    for (const r of risks) {
      if (r.severity === "medium") attention.push(r.title);
      if (attention.length >= 3) break;
    }
  }
  if (attention.length === 0) {
    attention.push("No critical gaps detected in current evidence.");
  }

  const nextActions = recs.slice(0, 3).map((r) => ({ label: r.title, tab: r.actionTab }));

  return {
    positives: positives.slice(0, 4),
    attention: attention.slice(0, 4),
    nextActions,
    readinessPercent,
    categories,
  };
}

function buildHero(input: BuildReportInput, site: SiteView): ReportViewModel["heroImage"] {
  if (site.selectedDesign?.storage_path) {
    return {
      src: "",
      caption: "Selected Site Potential concept — AI-generated visualisation.",
      source: "ai_interpretation",
    };
  }
  const subject = input.savedEvidence.find((e) => e.listingRole === "subject_active_listing");
  if (subject) {
    return {
      src: "",
      caption: `Saved listing image — ${subject.sourcePortal}.`,
      source: "listing",
    };
  }
  return null;
}

export function buildReportViewModel(input: BuildReportInput): ReportViewModel {
  const marketAddr = pickConfirmedAddress(input.marketAddress);
  const identity = buildIdentity(input.parcel, marketAddr);
  const ownership = buildOwnership(input.assets);
  const planning = buildPlanning(input.parcel);
  const market = buildMarket(input.savedEvidence);
  const site = buildSite(input.workspaceState, input.selectedSiteDesign, input.siteBrief);
  const strategy = buildStrategy(input.chosenScenario, input.strategyScenarios);
  const documents = buildDocuments(input.assets, input.workspaceState, input.savedEvidence);
  const categories = buildReadinessCategories(input, market, documents, ownership);
  const risks = buildRisks(input, market, ownership, identity);
  const recommendations = buildRecommendations(risks);
  const brief = buildBrief(categories, input, market, identity, risks, recommendations);
  const heroImage = buildHero(input, site);
  const now = input.now ?? new Date();

  return {
    parcelId: input.parcel.id,
    generatedAt: now.toISOString(),
    identity,
    ownership,
    planning,
    market,
    site,
    strategy,
    documents,
    risks,
    recommendations,
    brief,
    heroImage,
  };
}
