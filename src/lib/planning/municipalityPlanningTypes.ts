/**
 * Zoning & Build intelligence — type model.
 *
 * Trust separation is structural, not cosmetic. Every value in this module is
 * one of five clearly separated kinds:
 *
 *  1. published_rule      — a general rule published by the authority
 *  2. verified_right      — a property-specific right proved by evidence
 *  3. possible_restriction— something that MAY reduce the published rule
 *  4. missing_evidence    — a known unknown
 *  5. ai_interpretation   — a cautious reading, never a legal conclusion
 *
 * A published rule NEVER becomes a parcel right. Nothing in this module may
 * emit a sentence asserting that a specific erf can definitely be built to a
 * published control.
 */

export type PlanningSourceType =
  | "zoning_map"
  | "land_use_scheme"
  | "architectural_guideline"
  | "by_law"
  | "overlay"
  | "planning_register"
  | "national_legislation";

/**
 * `manual_candidate` = values captured by hand from a brief or secondary
 * summary and NOT yet confirmed against the official document. They are shown
 * as review-required candidates and never as active official rules.
 */
export type PlanningSourceStatus =
  | "active"
  | "pending"
  | "draft"
  | "superseded"
  | "manual_candidate"
  | "unknown";

export type PlanningJurisdiction = "national" | "provincial" | "municipal" | "private";

export type PlanningGuidelineAuthority = "municipal" | "hoa" | "estate" | "guidance";

export interface MunicipalityPlanningSource {
  id: string;
  municipality: string;
  title: string;
  sourceType: PlanningSourceType;
  url: string;
  jurisdiction: PlanningJurisdiction;
  status: PlanningSourceStatus;
  /** Version label or notice reference, when the document states one. */
  version: string | null;
  /** ISO date the document became effective, when published. */
  effectiveDate: string | null;
  /** ISO date the document was published/adopted, when published. */
  publishedDate: string | null;
  /** ISO date an Easy Erf maintainer last verified this entry. */
  lastVerifiedAt: string | null;
  /** Planning areas the source applies to. Empty = whole municipality. */
  planningAreas: string[];
  notes: string;
}

export type ZoningRuleType =
  | "height"
  | "coverage"
  | "street_building_line"
  | "side_building_line"
  | "rear_building_line"
  | "dwelling_units"
  | "floor_area_ratio"
  | "density"
  | "parking";

export type ZoningRuleUnit = "m" | "percent" | "ratio" | "units" | "units_per_ha" | "bays";

export interface ZoningRule {
  id: string;
  ruleType: ZoningRuleType;
  label: string;
  /** Numeric value where the rule is numeric; null for narrative rules. */
  value: number | null;
  unit: ZoningRuleUnit | null;
  /** Verbatim-ish short statement of the rule as published. */
  statement: string;
  /** Conditions/qualifiers published alongside the rule. */
  conditions: string[];
  sourceId: string;
  /** Section or page citation inside the source document, when known. */
  citation: string | null;
  /** Inherited from the source unless the rule itself is weaker. */
  status: PlanningSourceStatus;
  /** Cautious plain-language reading. Never a parcel-specific conclusion. */
  interpretation: string;
}

export interface ZoneDefinition {
  code: string;
  name: string;
  municipality: string;
  permittedUses: string[];
  consentUses: string[];
  rules: ZoningRule[];
  /** Source of the zone definition itself. */
  sourceId: string;
  status: PlanningSourceStatus;
  summary: string;
}

export interface LocalDesignGuideline {
  id: string;
  municipality: string;
  planningAreas: string[];
  title: string;
  summary: string;
  authority: PlanningGuidelineAuthority;
  sourceId: string;
  citation: string | null;
  status: PlanningSourceStatus;
  confidence: PlanningConfidence;
}

export type PlanningConfidence = "high" | "medium" | "low" | "unverified";

export interface MunicipalityPlanningRegistryEntry {
  municipality: string;
  /** Lowercase aliases accepted when matching parcel/address municipality text. */
  municipalityAliases: string[];
  planningAreas: string[];
  sources: MunicipalityPlanningSource[];
  zones: ZoneDefinition[];
  guidelines: LocalDesignGuideline[];
  /**
   * Adapter endpoint for a future official zoning FeatureServer. `null` means
   * no dependable official zoning polygon service has been confirmed, so
   * automatic detection must not be attempted or implied.
   */
  zoningPolygonAdapter: ZoningPolygonAdapter | null;
}

export interface ZoningPolygonAdapter {
  id: string;
  serviceUrl: string;
  zoneCodeField: string;
  /** Never true until an official service has been verified end to end. */
  verified: boolean;
}

/* ------------------------------------------------------------------ */
/* Parcel assessment                                                    */
/* ------------------------------------------------------------------ */

export type ZoningDetectionMethod =
  | "official_polygon"
  | "manual_selection"
  | "document_supported"
  | "not_detected";

export interface ZoningDetection {
  method: ZoningDetectionMethod;
  zoneCode: string | null;
  zoneName: string | null;
  confidence: PlanningConfidence;
  /** Who or what supplied the value, e.g. "Selected by user". */
  suppliedBy: string;
  /** Asset id when a document supports the zoning. */
  supportingAssetId: string | null;
  statement: string;
}

export interface VerifiedParcelRight {
  id: string;
  label: string;
  value: string;
  evidenceLabel: string;
  assetId: string | null;
}

export interface PossibleRestriction {
  id: string;
  label: string;
  detail: string;
}

export type PlanningRiskSeverity = "low" | "medium" | "high";

export interface PlanningRiskFlag {
  id: string;
  title: string;
  severity: PlanningRiskSeverity;
  why: string;
  nextAction: string;
}

export type PlanningChecklistStatus =
  | "verified"
  | "published_general_rule"
  | "detected"
  | "uploaded"
  | "requested"
  | "missing"
  | "conflict"
  | "needs_professional_confirmation";

export interface PlanningChecklistItem {
  id: string;
  label: string;
  status: PlanningChecklistStatus;
  detail: string;
}

export interface PlanningAction {
  id: string;
  order: number;
  title: string;
  detail: string;
  actionLabel: string;
  /** Workbench tab id used by the existing workflow router. */
  actionTab: string;
  completed: boolean;
}

export interface BuildableEnvelope {
  erfAreaM2: number | null;
  coveragePercent: number | null;
  /** erfArea x coverage. Theoretical only. */
  theoreticalGroundFloorM2: number | null;
  heightLimitM: number | null;
  /** Only ever non-null with parcel polygon AND reliable street-edge data. */
  setbackConstrainedM2: number | null;
  setbackCalculationSkippedReason: string | null;
  confidence: PlanningConfidence;
  missingConstraints: string[];
  caveat: string;
}

export interface ParcelPlanningAssessment {
  parcelId: string;
  municipality: string | null;
  planningArea: string | null;
  registryMatched: boolean;
  detection: ZoningDetection;
  zone: ZoneDefinition | null;
  publishedRules: ZoningRule[];
  verifiedRights: VerifiedParcelRight[];
  possibleRestrictions: PossibleRestriction[];
  guidelines: LocalDesignGuideline[];
  overlays: string[];
  envelope: BuildableEnvelope;
  riskFlags: PlanningRiskFlag[];
  checklist: PlanningChecklistItem[];
  actions: PlanningAction[];
  missingEvidence: string[];
  sources: MunicipalityPlanningSource[];
  permittedUseSummary: string;
  headlineWarning: string;
  assessedAt: string;
}
