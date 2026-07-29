import type { BuildableEnvelope, PlanningConfidence, ZoningRule } from "./municipalityPlanningTypes";

export interface BuildableEnvelopeInput {
  erfAreaM2: number | null;
  /** Published (not verified) coverage rule for the matched zone. */
  coverageRule: ZoningRule | null;
  heightRule: ZoningRule | null;
  /** True only when a real parcel polygon is available. */
  hasParcelPolygon: boolean;
  /** True only when a reliable street-edge / orientation reference exists. */
  hasStreetEdgeReference: boolean;
  /** Extra known-missing constraints supplied by the assessment. */
  missingConstraints?: string[];
}

const CAVEAT =
  "Theoretical only. Title restrictions, servitudes, actual boundary geometry, topography, overlays, approved plans and departures may reduce what can be built.";

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Deterministic buildable-envelope calculation.
 *
 * The only figure this function will ever produce from area alone is the
 * theoretical ground-floor footprint (erf area x coverage). A setback
 * constrained area is NEVER synthesised from area; it requires both a parcel
 * polygon and a reliable street-edge reference.
 */
export function calculateBuildableEnvelope(input: BuildableEnvelopeInput): BuildableEnvelope {
  const missingConstraints = [...(input.missingConstraints ?? [])];
  const erfAreaM2 =
    typeof input.erfAreaM2 === "number" && Number.isFinite(input.erfAreaM2) && input.erfAreaM2 > 0
      ? input.erfAreaM2
      : null;

  const coveragePercent =
    input.coverageRule && typeof input.coverageRule.value === "number"
      ? input.coverageRule.value
      : null;
  const heightLimitM =
    input.heightRule && typeof input.heightRule.value === "number" ? input.heightRule.value : null;

  const theoreticalGroundFloorM2 =
    erfAreaM2 != null && coveragePercent != null
      ? round2((erfAreaM2 * coveragePercent) / 100)
      : null;

  if (erfAreaM2 == null) missingConstraints.push("Confirmed erf area");
  if (coveragePercent == null) missingConstraints.push("Published coverage rule");
  if (heightLimitM == null) missingConstraints.push("Published height rule");

  let setbackCalculationSkippedReason: string | null = null;
  if (!input.hasParcelPolygon) {
    setbackCalculationSkippedReason =
      "Setback-constrained envelope is not calculated: no parcel polygon geometry is available.";
    missingConstraints.push("Parcel polygon geometry");
  } else if (!input.hasStreetEdgeReference) {
    setbackCalculationSkippedReason =
      "Setback-constrained envelope is not calculated: the street edge and erf orientation are not established.";
    missingConstraints.push("Street edge / erf orientation");
  } else {
    setbackCalculationSkippedReason =
      "Setback-constrained envelope is not calculated in this version.";
  }

  // Published rules that are only review-required candidates can never carry
  // more than low confidence.
  const ruleStatuses = [input.coverageRule?.status, input.heightRule?.status].filter(Boolean);
  const hasUnconfirmedRule = ruleStatuses.some(
    (status) => status !== "active",
  );

  let confidence: PlanningConfidence = "unverified";
  if (theoreticalGroundFloorM2 != null) confidence = hasUnconfirmedRule ? "low" : "medium";

  return {
    erfAreaM2,
    coveragePercent,
    theoreticalGroundFloorM2,
    heightLimitM,
    setbackConstrainedM2: null,
    setbackCalculationSkippedReason,
    confidence,
    missingConstraints: Array.from(new Set(missingConstraints)),
    caveat: CAVEAT,
  };
}
