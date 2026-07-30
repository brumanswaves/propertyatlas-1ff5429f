import { formatAreaM2WithUnit } from "@/lib/evidence/parcelArea";
import type {
  ParcelPlanningAssessment,
  PlanningAction,
  PlanningRiskFlag,
  ZoningRule,
  ZoningRuleType,
} from "./municipalityPlanningTypes";

/**
 * Result-first presentation model for Zoning & Build.
 *
 * This module only *selects and formats* values that already exist in the
 * assessment. It never promotes a published general rule into a confirmed
 * parcel right, and it never invents a zone, a metric or a number.
 */

export type ZoningTrustStatus = "verified" | "estimated" | "more_information_required";

export interface ZoningSummaryMetric {
  id: ZoningRuleType;
  label: string;
  value: string;
  note: string | null;
}

export interface ZoningSummary {
  trustStatus: ZoningTrustStatus;
  trustLabel: string;
  /** Only present when the zone is actually supported by a selection or a document. */
  zoneLabel: string | null;
  zoneSourceLabel: string;
  metrics: ZoningSummaryMetric[];
  whatThisMeans: string;
  nextAction: PlanningAction | null;
  topRisks: PlanningRiskFlag[];
  riskCount: number;
  missingCount: number;
  /** One concise trust line. The long-form caveats stay in the disclosure. */
  trustLine: string;
}

const METRIC_ORDER: ZoningRuleType[] = [
  "coverage",
  "height",
  "street_building_line",
  "side_building_line",
  "rear_building_line",
  "dwelling_units",
  "floor_area_ratio",
];

const METRIC_LABEL: Record<string, string> = {
  coverage: "Coverage",
  height: "Height",
  street_building_line: "Street line",
  side_building_line: "Side line",
  rear_building_line: "Rear line",
  dwelling_units: "Dwellings",
  floor_area_ratio: "FAR",
};

const SEVERITY_WEIGHT = { high: 0, medium: 1, low: 2 } as const;

function formatRuleValue(rule: ZoningRule): string | null {
  if (rule.value == null) return null;
  if (rule.unit === "percent") return `${rule.value}%`;
  if (rule.unit === "m") return `${rule.value} m`;
  if (rule.unit === "units") return `${rule.value}`;
  if (rule.unit === "ratio") return `${rule.value}`;
  return `${rule.value}${rule.unit ? ` ${rule.unit}` : ""}`;
}

export function buildZoningSummary(assessment: ParcelPlanningAssessment): ZoningSummary {
  const { detection, envelope, publishedRules } = assessment;

  const supported =
    detection.method === "official_polygon" || detection.method === "document_supported";
  const trustStatus: ZoningTrustStatus =
    detection.method === "not_detected"
      ? "more_information_required"
      : supported
        ? "verified"
        : "estimated";

  const trustLabel =
    trustStatus === "verified"
      ? "Verified"
      : trustStatus === "estimated"
        ? "Estimated"
        : "More information required";

  const zoneLabel =
    detection.method === "not_detected" ? null : (detection.zoneName ?? detection.zoneCode ?? null);

  const metrics: ZoningSummaryMetric[] = [];
  for (const ruleType of METRIC_ORDER) {
    const rule = publishedRules.find((item) => item.ruleType === ruleType);
    if (!rule) continue;
    const value = formatRuleValue(rule);
    if (!value) continue;
    metrics.push({
      id: ruleType,
      label: METRIC_LABEL[ruleType] ?? rule.label,
      value,
      note:
        ruleType === "coverage" && envelope.theoreticalGroundFloorM2 != null
          ? `≈ ${formatAreaM2WithUnit(envelope.theoreticalGroundFloorM2)} ground floor`
          : null,
    });
  }

  const whatThisMeans =
    trustStatus === "more_information_required"
      ? "No zone is confirmed yet, so no build rule can be applied to this erf."
      : metrics.length
        ? "These are the published controls for the matched zone, not confirmed rights for this erf."
        : "A zone is matched, but no numeric build control is published for it here.";

  const sortedRisks = [...assessment.riskFlags].sort(
    (a, b) => SEVERITY_WEIGHT[a.severity] - SEVERITY_WEIGHT[b.severity],
  );

  return {
    trustStatus,
    trustLabel,
    zoneLabel,
    zoneSourceLabel: detection.suppliedBy,
    metrics,
    whatThisMeans,
    nextAction: assessment.actions[0] ?? null,
    topRisks: sortedRisks.slice(0, 2),
    riskCount: assessment.riskFlags.length,
    missingCount: assessment.missingEvidence.length,
    trustLine: assessment.headlineWarning,
  };
}
