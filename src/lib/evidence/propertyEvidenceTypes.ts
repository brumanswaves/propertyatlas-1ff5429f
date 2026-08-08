import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import type { ResearchSource } from "@/lib/research/sourceTypes";
import type {
  ErfStrategyScenario,
  ErfStrategyWorkspace,
  ErfWorkspaceState,
} from "@/lib/workbench/erfWorkspaceState";
import type {
  ErfAsset,
  ErfAssetCategory,
  ErfAssetStatus,
} from "@/lib/workbench/erfFileVault";
import type {
  MarketAddressIntelligence,
  SavedMarketEvidence,
} from "@/features/marketEvidence/types";
import type { SitePotentialProject } from "@/lib/sitePotential/types";
import type { PropertyNotes } from "@/lib/workbench/propertyNotes";
import type { ParcelPlanningAssessment } from "@/lib/planning/municipalityPlanningTypes";

export type EvidenceDomain =
  | "identity"
  | "address"
  | "ownership"
  | "deeds"
  | "planning"
  | "valuation"
  | "transfers"
  | "market"
  | "environment"
  | "infrastructure"
  | "site"
  | "strategy"
  | "documents"
  | "notes";

export type EvidenceSourceKind =
  | "official_parcel"
  | "official_portal"
  | "municipal_portal"
  | "uploaded_document"
  | "uploaded_image"
  | "market_listing"
  | "user_note"
  | "user_confirmation"
  | "strategy_workspace"
  | "deterministic_calculator"
  | "site_potential"
  | "system_state";

export type EvidenceAuthorityType =
  | "official"
  | "municipal"
  | "paid_provider"
  | "user_supplied"
  | "market"
  | "calculation"
  | "ai_generated"
  | "system";

export type EvidenceSourceQuality =
  | "direct"
  | "strong"
  | "reference"
  | "untrusted_content"
  | "generated_search"
  | "unavailable";

export type EvidenceSourceStatus =
  | "not_opened"
  | "opened"
  | "reviewed"
  | "uploaded"
  | "ready"
  | "failed"
  | "unavailable"
  | "excluded";

export interface EvidenceLocator {
  fieldPath?: string;
  pageNumber?: number;
  pageLabel?: string;
  assetId?: string;
  sourceUrl?: string;
  excerpt?: string;
  metadataKey?: string;
}

export interface EvidenceSourceReference {
  id: string;
  parcelId: string;
  kind: EvidenceSourceKind;
  label: string;
  authorityType: EvidenceAuthorityType;
  sourceQuality: EvidenceSourceQuality;
  status: EvidenceSourceStatus;
  url?: string | null;
  assetId?: string | null;
  fileName?: string | null;
  sourcePortal?: string | null;
  capturedAt?: string | null;
  updatedAt?: string | null;
  locators: EvidenceLocator[];
  fragments: string[];
  asset?: EvidenceAssetMetadata;
  strategy?: EvidenceStrategyMetadata;
}

export interface EvidenceAssetMetadata {
  category: ErfAssetCategory;
  assetType: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string | null;
  storageStatus: ErfAssetStatus;
  extractionStatus: string | null;
  extractionWarning: string | null;
  pageCount: number | null;
  selectedSiteConcept: boolean;
  conceptName: string | null;
  conceptRationale: string | null;
}

export interface EvidenceStrategyMetadata {
  scenarioIds: string[];
  chosenScenarioId: string | null;
}

export type EvidenceClaimNature =
  | "fact"
  | "observation"
  | "assumption"
  | "calculation"
  | "interpretation"
  | "unknown";

export type EvidenceStatus =
  | "supported"
  | "partial"
  | "conflicting"
  | "missing"
  | "excluded"
  | "not_reviewed";

export type EvidenceConfidence = "high" | "medium" | "low" | "unverified";

export interface EvidenceClaim {
  id: string;
  parcelId: string;
  domain: EvidenceDomain;
  key: string;
  label: string;
  value: string | number | boolean | null;
  normalizedValue?: string | number | boolean | null;
  unit?: string | null;
  nature: EvidenceClaimNature;
  status: EvidenceStatus;
  confidence: EvidenceConfidence;
  confidenceReason: string;
  sourceIds: string[];
  locators: EvidenceLocator[];
  observedAt?: string | null;
  updatedAt?: string | null;
  userConfirmed: boolean;
  excluded: boolean;
  notes?: string | null;
  warning?: string | null;
}

export type EvidenceDomainState =
  | "supported"
  | "partial"
  | "missing"
  | "conflicting"
  | "not_reviewed"
  | "not_applicable";

export interface EvidenceDomainSummary {
  domain: EvidenceDomain;
  state: EvidenceDomainState;
  explanation: string;
  supportedClaimCount: number;
  missingClaimCount: number;
  conflictingClaimCount: number;
  sourceIds: string[];
  nextAction?: string | null;
}

export interface EvidenceContradiction {
  id: string;
  parcelId: string;
  title: string;
  severity: "low" | "medium" | "high";
  explanation: string;
  claimIds: string[];
  sourceIds: string[];
  displayedValues: string[];
  nextAction: string;
  targetTab?: string | null;
}

export interface EvidenceGap {
  id: string;
  parcelId: string;
  domain: EvidenceDomain;
  importance: "low" | "medium" | "high";
  title: string;
  explanation: string;
  basis: string;
  nextAction: string;
  targetTab?: string | null;
  blocking: boolean;
}

export interface EvidenceTimelineEvent {
  id: string;
  parcelId: string;
  occurredAt: string;
  label: string;
  detail: string;
  sourceIds: string[];
  domain: EvidenceDomain;
}

export interface PropertyEvidencePack {
  schemaVersion: 1;
  parcelId: string;
  builtAt: string;
  fingerprint: string;
  sourceUpdatedAt: string | null;
  sources: EvidenceSourceReference[];
  claims: EvidenceClaim[];
  domains: EvidenceDomainSummary[];
  contradictions: EvidenceContradiction[];
  gaps: EvidenceGap[];
  timeline: EvidenceTimelineEvent[];
  statistics: {
    sourceCount: number;
    claimCount: number;
    supportedClaimCount: number;
    assumptionCount: number;
    calculationCount: number;
    interpretationCount: number;
    missingCount: number;
    contradictionCount: number;
  };
}

export interface BuildPropertyEvidencePackInput {
  parcel: NormalizedOfficialParcel;
  workspaceState: ErfWorkspaceState;
  researchSources?: ResearchSource[];
  savedMarketEvidence?: SavedMarketEvidence[];
  marketAddressIntelligence?: MarketAddressIntelligence | null;
  assets?: ErfAsset[];
  propertyNotes?: PropertyNotes | null;
  strategyWorkspace?: ErfStrategyWorkspace | null;
  strategyScenarios?: ErfStrategyScenario[];
  chosenScenario?: ErfStrategyScenario | null;
  selectedSiteDesign?: ErfAsset | null;
  sitePotentialProject?: SitePotentialProject | null;
  siteBrief?: string | null;
  /** Canonical semantic planning state. assessedAt is deliberately not fingerprinted. */
  planningAssessment?: ParcelPlanningAssessment | null;
  now?: Date;
}

export interface EvidenceSelectionRequest {
  question?: string;
  domains?: EvidenceDomain[];
  /** Keep broad selections representative by taking one ranked claim per domain before filling. */
  diversifyDomains?: boolean;
  maxClaims?: number;
  maxSourceFragments?: number;
  maxTotalCharacters?: number;
}

export interface SelectedPropertyEvidence {
  parcelId: string;
  claims: EvidenceClaim[];
  sources: EvidenceSourceReference[];
  contradictions: EvidenceContradiction[];
  gaps: EvidenceGap[];
  text: string;
  truncated: boolean;
}
