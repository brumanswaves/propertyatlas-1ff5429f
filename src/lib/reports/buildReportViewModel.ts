import { canonicalAreaM2, formatAreaM2Value } from "@/lib/evidence/parcelArea";
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
import { buildPropertyEvidencePack } from "@/lib/evidence/buildPropertyEvidencePack";
import type {
  BuildPropertyEvidencePackInput,
  EvidenceClaim,
  EvidenceDomain,
  EvidenceDomainState,
  EvidenceGap,
  PropertyEvidencePack,
} from "@/lib/evidence/propertyEvidenceTypes";
import { buildPublicResearchSources } from "@/lib/research/publicSourceRegistry";
import {
  claimNumericValue,
  deedExtentClaim,
  isActualUploadedOwnershipSource,
  redactPersonalIdentifiers,
} from "@/lib/reports/reportFindings";

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
  { id: "identity", label: "Property Identity", anchorId: "report-identity" },
  { id: "ownership", label: "Ownership & Deeds", anchorId: "report-ownership" },
  { id: "sg-evidence", label: "SG & Lineage", anchorId: "report-sg-evidence" },
  { id: "buildings", label: "Buildings & Compliance", anchorId: "report-buildings" },
  { id: "planning", label: "Zoning & Buildability", anchorId: "report-planning" },
  { id: "site", label: "Site Potential", anchorId: "report-site" },
  { id: "market", label: "Market Evidence", anchorId: "report-market" },
  { id: "strategy", label: "Strategy & Financials", anchorId: "report-strategy" },
  { id: "site-risk", label: "Site & Environmental Risk", anchorId: "report-site-risk" },
  { id: "municipal", label: "Services & Costs", anchorId: "report-municipal" },
  { id: "location", label: "Location & Lifestyle", anchorId: "report-location" },
  { id: "brief", label: "Decision Detail", anchorId: "report-brief" },
  { id: "risk", label: "Risk & Actions", anchorId: "report-risk" },
  { id: "documents", label: "Evidence Appendix", anchorId: "report-documents" },
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
  /**
   * Registered/deed extent read off a document. Kept distinct from the
   * official cadastral area so one can never silently replace the other.
   */
  registeredExtent: { value: string; numericM2: number | null; sourceIds: string[] } | null;
  /**
   * Cadastral identifiers read off an uploaded Surveyor-General diagram
   * (diagram number, general plan, parent lineage, stated extent). Empty when
   * no diagram has been read, so nothing is ever implied.
   */
  cadastral: Array<{ label: string; value: string; badge: EvidenceBadge }>;
}

export interface OwnershipDetail {
  label: string;
  value: string;
  sourceIds: string[];
  pageNumbers: number[];
}

export type OwnershipEvidenceState =
  | "supported"
  | "uploaded_not_searchable"
  | "wrong_property"
  | "missing";

export interface OwnershipView {
  hasUploadedReport: boolean;
  uploadedReportNames: string[];
  isVerified: false; // Easy Erf never certifies ownership.
  /** Supported owner/share values read from an identity-matched document. */
  owners: OwnershipDetail[];
  /** Title deed values when a deed document supports them. */
  titleDeed: OwnershipDetail[];
  state: OwnershipEvidenceState;
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
  evidencePack?: PropertyEvidencePack;
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
  evidencePack?: PropertyEvidencePack;
  researchSources?: BuildPropertyEvidencePackInput["researchSources"];
  propertyNotes?: BuildPropertyEvidencePackInput["propertyNotes"];
  strategyWorkspace?: BuildPropertyEvidencePackInput["strategyWorkspace"];
  sitePotentialProject?: BuildPropertyEvidencePackInput["sitePotentialProject"];
  siteBrief?: string | null;
  planningAssessment?: BuildPropertyEvidencePackInput["planningAssessment"];
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
  // Canonical resolver — shared with the Property Evidence Pack so the two never drift.
  return canonicalAreaM2(parcel.rawProperties as Record<string, unknown> | null | undefined);
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
    registeredExtent: null,
    cadastral: [],
  };
}

/** Cadastral identity rows an SG diagram can supply, in reading order. */
const SG_IDENTITY_ROWS: Array<{ key: string; label: string }> = [
  { key: "diagramNumber", label: "SG diagram number" },
  { key: "generalPlanNumber", label: "General plan" },
  { key: "parentErfNumber", label: "Parent erf" },
  { key: "parentPortionNumber", label: "Parent portion" },
  { key: "registeredExtent", label: "Registered extent (as stated)" },
];

function buildIdentityFromPack(
  pack: PropertyEvidencePack,
  parcel: NormalizedOfficialParcel,
): PropertyIdentityDisplay {
  const identityClaim = (key: string) => firstSupportedOrObservedClaim(pack, "identity", key);
  const addressClaim = (key: string) => supportedClaim(pack, "address", key);
  const erfNumber = identityClaim("erfNumber")?.value ?? parcel.erfNumber ?? null;
  const portion = identityClaim("portion")?.value ?? parcel.portion ?? null;
  const municipality = stringOrNull(identityClaim("municipality")?.value ?? parcel.municipality);
  const province = stringOrNull(identityClaim("province")?.value ?? parcel.province);
  const marketAddressLine = stringOrNull(addressClaim("marketAddress")?.value);
  const officialParts: string[] = [];
  if (erfNumber != null) officialParts.push(`Erf ${erfNumber}`);
  if (portion != null && String(portion) !== "0") officialParts.push(`Portion ${portion}`);
  if (municipality) officialParts.push(municipality);
  if (province) officialParts.push(province);
  const areaClaim = firstSupportedOrObservedClaim(pack, "identity", "areaM2");
  // Cadastral lineage only ever comes from a document that was actually read.
  const cadastral = SG_IDENTITY_ROWS.flatMap(({ key, label }) => {
    const claim = firstSupportedOrObservedClaim(pack, "identity", key);
    const value = stringOrNull(claim?.value);
    return claim && value ? [{ label, value, badge: badgeForClaim(claim) }] : [];
  });
  return {
    displayName: marketAddressLine ?? parcelDisplayName(parcel, null),
    officialLine: officialParts.length ? officialParts.join(" / ") : null,
    marketAddressLine,
    addressAndOfficialMismatch: pack.contradictions.some(
      (item) => item.id === "market-address-municipality-mismatch" || item.id === "market-address-province-mismatch",
    ),
    municipality,
    province,
    erfNumber: erfNumber != null ? String(erfNumber) : null,
    portion: portion != null ? String(portion) : null,
    lpi: stringOrNull(identityClaim("lpi")?.value ?? parcel.lpi),
    parcelKey: stringOrNull(identityClaim("parcelKey")?.value ?? parcel.parcelKey),
    sourceLabel: parcel.sourceLabel ?? null,
    coordinates: parcel.coordinates ?? null,
    areaM2: numberOrNull(areaClaim?.normalizedValue ?? areaClaim?.value) ?? parcelAreaM2(parcel),
    registeredExtent: buildRegisteredExtent(pack),
    cadastral,
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
    owners: [],
    titleDeed: [],
    state: uploaded.length ? "uploaded_not_searchable" : "missing",
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
      value: formatAreaM2Value(areaM2),
      badge: formatAreaM2Value(areaM2) != null ? "official" : "missing",
    },
    { label: "Coverage %", value: null, badge: "missing" },
    { label: "FAR", value: null, badge: "missing" },
    { label: "Height limit", value: null, badge: "missing" },
    { label: "Setbacks", value: null, badge: "missing" },
    { label: "Density", value: null, badge: "missing" },
    { label: "Permitted uses", value: null, badge: "missing" },
  ];
}

function buildPlanningFromPack(pack: PropertyEvidencePack, parcel: NormalizedOfficialParcel): PlanningField[] {
  const area = supportedClaim(pack, "identity", "areaM2");
  const field = (key: string, label: string): PlanningField => {
    const claim = reportPlanningClaim(pack, key);
    return {
      label,
      value: displayClaimValue(claim),
      badge: claim ? badgeForClaim(claim) : "missing",
    };
  };
  return [
    field("zoning", "Zoning"),
    {
      label: "Erf size (m²)",
      value: formatAreaM2Value(numberOrNull(area?.normalizedValue ?? area?.value) ?? parcelAreaM2(parcel)),
      badge:
        formatAreaM2Value(numberOrNull(area?.normalizedValue ?? area?.value) ?? parcelAreaM2(parcel)) != null
          ? area
            ? badgeForClaim(area)
            : "official"
          : "missing",
    },
    field("coverage", "Coverage %"),
    field("far", "FAR"),
    field("height", "Height limit"),
    field("setbacks", "Setbacks"),
    // Printed on an SG diagram when present; missing until a document states it.
    field("buildingLines", "Building lines"),
    field("noBuildArea", "No-build / reserve"),
    { label: "Density", value: null, badge: "missing" },
    field("permittedUses", "Permitted uses"),

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

/** Owner/deed keys that may be surfaced. Identity numbers are never extracted. */
const OWNERSHIP_DISPLAY_KEYS = ["registeredOwner", "ownerType", "ownershipShare", "coOwners"];
const DEED_DISPLAY_KEYS = ["titleDeedNumber", "registrationDate", "conditionsOfTitle"];

function ownershipDetails(pack: PropertyEvidencePack, domain: EvidenceDomain, keys: string[]): OwnershipDetail[] {
  return pack.claims
    .filter(
      (claim) =>
        claim.domain === domain &&
        keys.includes(claim.key) &&
        claim.status === "supported" &&
        !claim.excluded,
    )
    .map((claim) => ({
      label: claim.label,
      value: redactPersonalIdentifiers(String(claim.value ?? "")),
      sourceIds: claim.sourceIds,
      pageNumbers: claim.locators
        .map((locator) => locator.pageNumber)
        .filter((page): page is number => typeof page === "number"),
    }))
    .filter((detail) => detail.value.length > 0);
}

function buildRegisteredExtent(pack: PropertyEvidencePack): PropertyIdentityDisplay["registeredExtent"] {
  const claim = deedExtentClaim(pack);
  if (!claim) return null;
  return {
    value: String(claim.value ?? ""),
    numericM2: claimNumericValue(claim),
    sourceIds: claim.sourceIds,
  };
}

function buildOwnershipFromPack(pack: PropertyEvidencePack, fallbackAssets: ErfAsset[]): OwnershipView {
  const uploaded = pack.sources.filter(isActualUploadedOwnershipSource);
  const owners = ownershipDetails(pack, "ownership", OWNERSHIP_DISPLAY_KEYS);
  const titleDeed = ownershipDetails(pack, "deeds", DEED_DISPLAY_KEYS);
  const wrongProperty = pack.contradictions.some((item) => item.id.startsWith("document-property-mismatch-"));
  const state: OwnershipEvidenceState = owners.length
    ? "supported"
    : wrongProperty
      ? "wrong_property"
      : uploaded.length
        ? "uploaded_not_searchable"
        : "missing";
  const message =
    state === "supported"
      ? "Owner details below were read from a document matched to this erf. Easy Erf does not certify ownership — a conveyancer must confirm it before any legal reliance."
      : state === "wrong_property"
        ? "An uploaded ownership report describes a different property, so none of its contents are used. Upload the correct report for this erf."
        : state === "uploaded_not_searchable"
          ? "Ownership is not verified. An ownership report is stored for this erf, but no ownership value has been read and matched to it yet."
          : `Ownership is not verified and has not been established for this erf. ${
              pack.domains.find((domain) => domain.domain === "ownership")?.nextAction ??
              "Add a title deed, WinDeed or Lightstone report to establish ownership."
            }`;
  return {
    hasUploadedReport: uploaded.length > 0,
    uploadedReportNames: uploaded.map((source) => source.fileName ?? source.label),
    isVerified: false,
    owners,
    titleDeed,
    state,
    message,
  };
}


function buildMarketFromPack(pack: PropertyEvidencePack, fallbackEvidence: SavedMarketEvidence[]): MarketView {
  const marketIds = new Set(
    pack.sources
      .filter((source) => source.kind === "market_listing")
      .map((source) => source.id.replace(/^market-/, "")),
  );
  return buildMarket(fallbackEvidence.filter((item) => marketIds.has(item.id)));
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

function buildSiteFromPack(
  pack: PropertyEvidencePack,
  workspaceState: ErfWorkspaceState,
  selectedDesign: ErfAsset | null,
  siteBrief?: string | null,
): SiteView {
  const selectedClaim = firstSupportedOrObservedClaim(pack, "site", "selectedSitePotentialConcept");
  const countClaim = firstSupportedOrObservedClaim(pack, "site", "sitePotentialConceptCount");
  return {
    ...buildSite(workspaceState, selectedClaim || !selectedDesign?.parcel_id ? selectedDesign : null, siteBrief),
    conceptCount: numberOrNull(countClaim?.normalizedValue ?? countClaim?.value) ?? workspaceState.sitePotential.conceptCount,
    hasBrief:
      Boolean(siteBrief && siteBrief.trim().length > 0) ||
      pack.sources.some((source) => source.id.startsWith("site-project-") && source.fragments.length > 0),
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

function buildStrategyFromPack(
  pack: PropertyEvidencePack,
  chosen: ErfStrategyScenario | null,
  scenarios: ErfStrategyScenario[],
): StrategyView {
  const strategySource = pack.sources.find((source) => source.id === "strategy-workspace");
  const scenarioIds = new Set(strategySource?.strategy?.scenarioIds ?? []);
  const chosenScenarioId = strategySource?.strategy?.chosenScenarioId ?? null;
  const inputScenarios = scenarios ?? [];
  const parcelScenarios = inputScenarios.filter(
    (scenario) => scenario.parcelId === pack.parcelId && scenarioIds.has(scenario.id),
  );
  const selected = parcelScenarios.find((scenario) => scenario.id === chosenScenarioId) ?? null;
  const rawChosenIsPackSelected =
    chosen?.parcelId === pack.parcelId &&
    chosen.id === chosenScenarioId &&
    scenarioIds.has(chosen.id);
  return {
    chosen: selected ?? (rawChosenIsPackSelected ? chosen : null),
    scenarioCount: scenarioIds.size,
    hasSaved: scenarioIds.size > 0 || strategySource?.status === "ready",
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

function buildDocumentsFromPack(
  pack: PropertyEvidencePack,
  workspaceState: ErfWorkspaceState,
  savedEvidence: SavedMarketEvidence[],
): DocumentsView {
  const assetSources = pack.sources.filter((source) => source.kind === "uploaded_document" || source.kind === "uploaded_image");
  const assets = assetSources.flatMap((source) => (source.asset ? [source.asset] : []));
  const supportedDomains = new Set(
    pack.domains
      .filter((domain) => domain.state === "supported" || domain.state === "partial")
      .map((domain) => domain.domain),
  );
  const buckets = ["identity", "documents", "market", "strategy", "site", "deeds"].map((domain) =>
    supportedDomains.has(domain as EvidenceDomain),
  );
  const filled = buckets.filter(Boolean).length;
  return {
    assetCount: assets.length,
    savedEvidenceCount: pack.sources.filter((source) => source.kind === "market_listing").length || savedEvidence.length,
    sgDiagramCount: assets.filter((asset) => asset.category === "sg_diagram").length,
    uploadedReportCount: assets.filter((asset) => asset.category === "paid_report").length,
    completenessPercent: Math.round((filled / buckets.length) * 100) || buildDocuments([], workspaceState, savedEvidence).completenessPercent,
  };
}

function buildReadinessCategories(
  input: BuildReportInput,
  market: MarketView,
  docs: DocumentsView,
  ownership: OwnershipView,
  pack?: PropertyEvidencePack,
): ReadinessCategory[] {
  if (pack) return buildReadinessCategoriesFromPack(pack);
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

function buildReadinessCategoriesFromPack(pack: PropertyEvidencePack): ReadinessCategory[] {
  const categories: Array<{ id: ReadinessCategory["id"]; label: string; domains: EvidenceDomain[] }> = [
    { id: "identity", label: "Identity", domains: ["identity", "address"] },
    { id: "planning", label: "Planning", domains: ["planning", "environment", "infrastructure"] },
    { id: "ownership", label: "Ownership", domains: ["ownership", "deeds", "transfers"] },
    { id: "market", label: "Market", domains: ["market", "valuation"] },
    { id: "risk", label: "Risk review", domains: ["identity", "planning", "market", "documents"] },
    { id: "strategy", label: "Strategy", domains: ["strategy", "site"] },
    { id: "documents", label: "Documents", domains: ["documents"] },
  ];
  return categories.map((category) => {
    const domains = category.domains
      .map((domain) => pack.domains.find((item) => item.domain === domain))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const state = readinessFromDomainStates(domains.map((domain) => domain.state));
    const nextAction = domains.find((domain) => domain.nextAction)?.nextAction;
    return {
      id: category.id,
      label: category.label,
      state,
      explanation:
        nextAction ??
        domains.find((domain) => domain.explanation)?.explanation ??
        "Derived from the canonical Property Evidence Pack.",
    };
  });
}

function readinessFromDomainStates(states: EvidenceDomainState[]): ReadinessState {
  if (states.includes("conflicting")) return "partial";
  if (states.every((state) => state === "supported" || state === "not_applicable")) return "confirmed";
  if (states.includes("supported") || states.includes("partial")) return "partial";
  if (states.includes("missing")) return "missing";
  if (states.includes("not_reviewed")) return "not_reviewed";
  return "missing";
}

function buildRisks(input: BuildReportInput, market: MarketView, ownership: OwnershipView, identity: PropertyIdentityDisplay, pack?: PropertyEvidencePack): RiskItem[] {
  if (pack) return buildRisksFromPack(pack);
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

function buildRisksFromPack(pack: PropertyEvidencePack): RiskItem[] {
  const contradictionRisks: RiskItem[] = pack.contradictions.map((item) => ({
    id: item.id,
    title: item.title,
    severity: item.severity,
    why: item.explanation,
    evidence: item.displayedValues.join("; ") || "Canonical evidence records disagree.",
    nextAction: item.nextAction,
    actionTab: item.targetTab ?? undefined,
  }));
  const gapRisks: RiskItem[] = pack.gaps
    .filter((gap) => gap.blocking || gap.importance !== "low")
    .map((gap) => ({
      id: gap.id,
      title: gap.title,
      severity: gap.importance,
      why: gap.explanation,
      evidence: gap.basis,
      nextAction: gap.nextAction,
      actionTab: gap.targetTab ?? undefined,
    }));
  return [...contradictionRisks, ...gapRisks];
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
  const evidencePack =
    input.evidencePack ??
    buildPropertyEvidencePack({
      parcel: input.parcel,
      workspaceState: input.workspaceState,
      researchSources: input.researchSources ?? buildPublicResearchSources(input.parcel),
      savedMarketEvidence: input.savedEvidence,
      marketAddressIntelligence: input.marketAddress,
      assets: input.assets,
      propertyNotes: input.propertyNotes,
      strategyWorkspace: input.strategyWorkspace,
      strategyScenarios: input.strategyScenarios,
      chosenScenario: input.chosenScenario,
      selectedSiteDesign: input.selectedSiteDesign,
      sitePotentialProject: input.sitePotentialProject,
      siteBrief: input.siteBrief,
      planningAssessment: input.planningAssessment,
      now: input.now,
    });
  const identity = buildIdentityFromPack(evidencePack, input.parcel);
  const ownership = buildOwnershipFromPack(evidencePack, input.assets);
  const planning = buildPlanningFromPack(evidencePack, input.parcel);
  const market = buildMarketFromPack(evidencePack, input.savedEvidence);
  const site = buildSiteFromPack(evidencePack, input.workspaceState, input.selectedSiteDesign, input.siteBrief);
  const strategy = buildStrategyFromPack(evidencePack, input.chosenScenario, input.strategyScenarios);
  const documents = buildDocumentsFromPack(evidencePack, input.workspaceState, input.savedEvidence);
  const categories = buildReadinessCategories(input, market, documents, ownership, evidencePack);
  const risks = buildRisks(input, market, ownership, identity, evidencePack);
  const recommendations = buildRecommendations(risks);
  const brief = buildBrief(categories, input, market, identity, risks, recommendations);
  const heroImage = buildHero(input, site);
  const now = input.now ?? new Date();

  return {
    parcelId: input.parcel.id,
    generatedAt: now.toISOString(),
    evidencePack,
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

function supportedClaim(pack: PropertyEvidencePack, domain: EvidenceDomain, key: string): EvidenceClaim | null {
  return pack.claims.find((claim) => claim.domain === domain && claim.key === key && claim.status === "supported" && !claim.excluded) ?? null;
}

/**
 * Planning controls can be supported by a document, recorded as an explicit
 * user working conclusion, or retained as an unconfirmed working assumption.
 * The report preserves that provenance rather than hiding recorded work or
 * relabelling it as municipal confirmation.
 */
function reportPlanningClaim(pack: PropertyEvidencePack, key: string): EvidenceClaim | null {
  const candidates = pack.claims.filter(
    (claim) =>
      claim.domain === "planning" &&
      claim.key === key &&
      !claim.excluded &&
      claim.status !== "missing" &&
      claim.value != null &&
      String(claim.value).trim() !== "",
  );
  return (
    candidates.find((claim) => claim.status === "supported") ??
    candidates.find((claim) => claim.userConfirmed) ??
    candidates.find((claim) => claim.status === "not_reviewed") ??
    null
  );
}

function firstSupportedOrObservedClaim(pack: PropertyEvidencePack, domain: EvidenceDomain, key: string): EvidenceClaim | null {
  return pack.claims.find(
    (claim) =>
      claim.domain === domain &&
      claim.key === key &&
      !claim.excluded &&
      (claim.status === "supported" || claim.status === "conflicting" || claim.status === "not_reviewed"),
  ) ?? null;
}

function displayClaimValue(claim: EvidenceClaim | null): string | null {
  if (!claim || claim.value == null || claim.value === "") return null;
  const value = typeof claim.value === "number" ? claim.value.toLocaleString() : String(claim.value);
  return claim.unit ? `${value}` : value;
}

function stringOrNull(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function numberOrNull(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function badgeForClaim(claim: EvidenceClaim): EvidenceBadge {
  if (claim.domain === "planning" && claim.key !== "zoning" && claim.nature === "assumption") {
    return "assumption";
  }
  if (claim.userConfirmed) return "user_confirmed";
  if (claim.nature === "assumption") return "assumption";
  if (claim.nature === "calculation") return "assumption";
  if (claim.nature === "interpretation") return "ai_interpretation";
  if (claim.sourceIds.some((sourceId) => sourceId.startsWith("market-"))) return "listing";
  if (claim.sourceIds.some((sourceId) => sourceId.startsWith("asset-"))) return "uploaded_report";
  return "official";
}
