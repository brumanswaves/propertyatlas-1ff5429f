/**
 * Site Potential planning-rule adapter.
 *
 * Single source of truth: this module NEVER invents a new rules store. It
 * reads the same `ParcelPlanningAssessment` that powers Zoning & Build and
 * maps it onto Site Potential's build-rule inputs, carrying the exact same
 * source / status / provenance wording.
 *
 * Honesty rules enforced here (see sprint brief):
 *  - "Zoning document" is only ever selected when a property-matched zoning
 *    document actually exists (`detection.method === "document_supported"`).
 *  - A published/`manual_candidate` rule pack from the municipal registry can
 *    only ever produce "Estimated", never "Verified".
 *  - When nothing usable exists, the adapter returns a single guided action
 *    instead of a rule source, and never a blank input where a structured
 *    rule already exists.
 */

import type { BuildEnvelopeRuleSource } from "./buildEnvelope";
import type {
  ParcelPlanningAssessment,
  PlanningAction,
  ZoningRule,
  ZoningRuleType,
} from "@/lib/planning/municipalityPlanningTypes";

export type SitePotentialProvenanceKind =
  | "property_specific"
  | "published_general"
  | "user_assumption";

export type SitePotentialVerificationState = "verified" | "estimated" | "unverified";

export interface SitePotentialFieldProvenance {
  /** Exact source title as shown in Zoning & Build. */
  sourceTitle: string;
  /** Section/page citation, when the source document states one. */
  citation: string | null;
  /** Status/version wording, matching Zoning & Build's `statusNote`. */
  statusNote: string | null;
  version: string | null;
  effectiveDate: string | null;
  verification: SitePotentialVerificationState;
  kind: SitePotentialProvenanceKind;
  /** Visible label shown to the user, e.g. "Published rule candidate…". */
  label: string;
}

export interface SitePotentialFieldPrefill<T> {
  value: T | null;
  provenance: SitePotentialFieldProvenance | null;
}

export type SitePotentialRuleSourceStatus =
  | "verified"
  | "estimated"
  | "more_information_required";

export interface SitePotentialGuidedAction {
  title: string;
  detail: string;
  actionLabel: string;
  actionTab: string;
}

export interface SitePotentialRulePrefill {
  ruleSource: BuildEnvelopeRuleSource | null;
  ruleSourceStatus: SitePotentialRuleSourceStatus;
  /** Visible label — never defaults to "Zoning document" without a match. */
  ruleSourceLabel: string;
  zone: SitePotentialFieldPrefill<string>;
  streetSetbackM: SitePotentialFieldPrefill<number>;
  sideSetbackM: SitePotentialFieldPrefill<number>;
  rearSetbackM: SitePotentialFieldPrefill<number>;
  maxCoveragePercent: SitePotentialFieldPrefill<number>;
  maxHeightM: SitePotentialFieldPrefill<number>;
  dwellingUnits: SitePotentialFieldPrefill<number>;
  additionalDwellingRule: SitePotentialFieldPrefill<string>;
  additionalDwellingRequiresConsent: boolean;
  /** Guideline / overlay notes carried over verbatim from the assessment. */
  guidelineNotes: string[];
  /** One next-best-action, taken from the same ranked list as Zoning & Build. */
  nextBestAction: SitePotentialGuidedAction | null;
}

function ruleOfType(rules: ZoningRule[], type: ZoningRuleType): ZoningRule | null {
  return rules.find((rule) => rule.ruleType === type) ?? null;
}

function sourceTitleFor(assessment: ParcelPlanningAssessment, rule: ZoningRule | null): string {
  if (!rule) return "Not available";
  const source = assessment.sources.find((candidate) => candidate.id === rule.sourceId);
  return source?.title ?? "Kouga Land Use Scheme 2021 and town zoning plans";
}

function statusNoteFor(rule: ZoningRule): string | null {
  if (rule.status === "manual_candidate") {
    return "Captured by hand and not yet confirmed against the official document. Review required.";
  }
  if (rule.status === "draft" || rule.status === "pending") {
    return `Document status: ${rule.status}. Not proved to be enforceable.`;
  }
  if (rule.status === "superseded") return "This document may have been superseded.";
  return null;
}

/**
 * Determines the honest rule source + status, matching A3:
 *  - property-matched zoning document -> "document" / verified
 *  - published/manual_candidate registry pack -> "registry" / estimated,
 *    with the exact visible label required by the brief
 *  - nothing usable -> null / more_information_required + one guided action
 */
function resolveRuleSource(assessment: ParcelPlanningAssessment): {
  ruleSource: BuildEnvelopeRuleSource | null;
  ruleSourceStatus: SitePotentialRuleSourceStatus;
  ruleSourceLabel: string;
  provenanceKind: SitePotentialProvenanceKind;
  verification: SitePotentialVerificationState;
} {
  const { detection, zone } = assessment;

  if (detection.method === "document_supported" && zone) {
    return {
      ruleSource: "document",
      ruleSourceStatus: "verified",
      ruleSourceLabel: "Zoning document attached to this erf",
      provenanceKind: "property_specific",
      verification: "verified",
    };
  }

  if (zone && zone.rules.length) {
    return {
      ruleSource: "registry",
      ruleSourceStatus: "estimated",
      ruleSourceLabel: "Published rule candidate — property zoning not confirmed.",
      provenanceKind: "published_general",
      verification: "estimated",
    };
  }

  return {
    ruleSource: null,
    ruleSourceStatus: "more_information_required",
    ruleSourceLabel: "No usable zoning or rule source found for this erf yet.",
    provenanceKind: "published_general",
    verification: "unverified",
  };
}

function guidedActionFrom(action: PlanningAction | undefined): SitePotentialGuidedAction | null {
  if (!action) return null;
  return {
    title: action.title,
    detail: action.detail,
    actionLabel: action.actionLabel,
    actionTab: action.actionTab,
  };
}

function fieldFromRule<T>(
  assessment: ParcelPlanningAssessment,
  rule: ZoningRule | null,
  provenanceKind: SitePotentialProvenanceKind,
  verification: SitePotentialVerificationState,
  ruleSourceLabel: string,
  value: T | null,
): SitePotentialFieldPrefill<T> {
  if (!rule || value == null) return { value: null, provenance: null };
  return {
    value,
    provenance: {
      sourceTitle: sourceTitleFor(assessment, rule),
      citation: rule.citation,
      statusNote: statusNoteFor(rule),
      version: null,
      effectiveDate: null,
      verification,
      kind: provenanceKind,
      label: ruleSourceLabel,
    },
  };
}

/**
 * Maps an existing `ParcelPlanningAssessment` onto Site Potential build-rule
 * inputs. Never generates numbers on its own — every value here traces back
 * to a rule already present in the assessment.
 */
export function buildSitePotentialRulePrefill(
  assessment: ParcelPlanningAssessment,
): SitePotentialRulePrefill {
  const { ruleSource, ruleSourceStatus, ruleSourceLabel, provenanceKind, verification } =
    resolveRuleSource(assessment);

  const rules = assessment.publishedRules;
  const streetRule = ruleOfType(rules, "street_building_line");
  const sideRule = ruleOfType(rules, "side_building_line");
  const rearRule = ruleOfType(rules, "rear_building_line");
  const coverageRule = ruleOfType(rules, "coverage");
  const heightRule = ruleOfType(rules, "height");
  const dwellingRule = ruleOfType(rules, "dwelling_units");

  const zoneField: SitePotentialFieldPrefill<string> =
    assessment.zone && ruleSource
      ? {
          value: assessment.zone.name,
          provenance: {
            sourceTitle: sourceTitleFor(assessment, streetRule ?? coverageRule ?? heightRule),
            citation: null,
            statusNote:
              assessment.zone.status === "manual_candidate"
                ? "Captured by hand and not yet confirmed against the official document. Review required."
                : null,
            version: null,
            effectiveDate: null,
            verification,
            kind: provenanceKind,
            label: ruleSourceLabel,
          },
        }
      : { value: null, provenance: null };

  const dwellingAllowanceLabel = dwellingRule
    ? dwellingRule.statement
    : null;

  const additionalDwellingRequiresConsent = Boolean(
    dwellingRule?.conditions.some((condition) =>
      condition.toLowerCase().includes("consent"),
    ),
  );

  const guidelineNotes = assessment.guidelines.map((guideline) => guideline.summary);

  const nextBestAction =
    ruleSource == null
      ? guidedActionFrom(
          assessment.actions.find((action) => action.id === "action-confirm-zoning") ??
            assessment.actions[0],
        )
      : guidedActionFrom(assessment.actions[0]);

  return {
    ruleSource,
    ruleSourceStatus,
    ruleSourceLabel,
    zone: zoneField,
    streetSetbackM: fieldFromRule(
      assessment,
      streetRule,
      provenanceKind,
      verification,
      ruleSourceLabel,
      streetRule?.value ?? null,
    ),
    sideSetbackM: fieldFromRule(
      assessment,
      sideRule,
      provenanceKind,
      verification,
      ruleSourceLabel,
      sideRule?.value ?? null,
    ),
    rearSetbackM: fieldFromRule(
      assessment,
      rearRule,
      provenanceKind,
      verification,
      ruleSourceLabel,
      rearRule?.value ?? null,
    ),
    maxCoveragePercent: fieldFromRule(
      assessment,
      coverageRule,
      provenanceKind,
      verification,
      ruleSourceLabel,
      coverageRule?.value ?? null,
    ),
    maxHeightM: fieldFromRule(
      assessment,
      heightRule,
      provenanceKind,
      verification,
      ruleSourceLabel,
      heightRule?.value ?? null,
    ),
    dwellingUnits: fieldFromRule(
      assessment,
      dwellingRule,
      provenanceKind,
      verification,
      ruleSourceLabel,
      dwellingRule?.value ?? null,
    ),
    additionalDwellingRule: fieldFromRule(
      assessment,
      dwellingRule,
      provenanceKind,
      verification,
      ruleSourceLabel,
      dwellingAllowanceLabel,
    ),
    additionalDwellingRequiresConsent,
    guidelineNotes,
    nextBestAction,
  };
}
