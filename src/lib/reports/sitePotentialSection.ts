/**
 * Site Potential report panel model.
 *
 * Site Potential now has one reportable job: show the accepted building-area
 * result when it exists. Legacy generated concept records can remain stored for
 * audit/history, but they no longer drive the guided journey or the report.
 */

import type { BuildEnvelopeResult } from "@/lib/sitePotential/buildEnvelope";

export type SitePotentialPanelMode = "both" | "capacity_only" | "concept_only" | "none";

export interface SitePotentialMetric {
  id: string;
  label: string;
  value: string;
  note?: string;
}

export interface SitePotentialReportPanel {
  mode: SitePotentialPanelMode;
  title: string;
  /** One short supporting line. No paragraphs. */
  lede: string;
  hasCapacity: boolean;
  hasConcept: boolean;
  capacityHeading: string;
  capacityCaption: string;
  conceptHeading: string;
  conceptCaption: string;
  conceptName: string | null;
  brief: string | null;
  metrics: SitePotentialMetric[];
  /** Single short trust line for the whole section. */
  disclaimer: string;
  emptyMessage: string | null;
}

export const SITE_POTENTIAL_REPORT_TITLE = "Approximate building area";

export const SITE_POTENTIAL_CAPACITY_CAPTION =
  "Calculated from parcel geometry and the planning inputs recorded for this erf. Unverified controls remain working assumptions, not official property rights.";

// Kept as an exported compatibility constant for older tests/imports. New
// report composition deliberately does not render a generated concept.
export const SITE_POTENTIAL_CONCEPT_CAPTION =
  "Legacy concept visualisations are not part of the current Easy Erf report workflow.";

function m2(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  return `${Math.round(value).toLocaleString("en-ZA")} m²`;
}

export function buildSitePotentialMetrics(
  envelope: BuildEnvelopeResult | null,
): SitePotentialMetric[] {
  if (!envelope) return [];
  const s = envelope.summary;
  const metrics: SitePotentialMetric[] = [];

  const coverageArea = m2(s.theoreticalGroundFloorM2);
  const estimatedRules = envelope.state !== "verified";
  if (coverageArea) {
    metrics.push({
      id: "coverage",
      label: estimatedRules ? "Coverage working assumption" : "Maximum verified coverage",
      value: coverageArea,
      note:
        s.maxCoveragePercent != null
          ? estimatedRules
            ? `Working assumption: ${s.maxCoveragePercent}% of erf. Property-specific planning controls not yet verified.`
            : `${s.maxCoveragePercent}% of erf`
          : undefined,
    });
  }
  const erfArea = m2(s.erfAreaM2);
  if (erfArea) {
    metrics.push({ id: "erf", label: "Erf extent", value: erfArea, note: s.erfAreaSourceLabel });
  }
  if (s.maxHeightM != null) {
    metrics.push({ id: "height", label: "Maximum height", value: `${s.maxHeightM} m` });
  }
  if (s.dwellingAllowance) {
    metrics.push({ id: "dwellings", label: "Dwellings", value: s.dwellingAllowance });
  }
  return metrics;
}

export function buildSitePotentialReportPanel(input: {
  envelope: BuildEnvelopeResult | null;
  /** Legacy field retained for call-site compatibility; generated concepts are ignored. */
  hasConceptImage: boolean;
  /** Legacy field retained for call-site compatibility. */
  conceptStyle?: string | null;
  /** Legacy field retained for call-site compatibility. */
  brief?: string | null;
  skipped: boolean;
  disclaimer: string;
}): SitePotentialReportPanel {
  const envelope =
    input.envelope && input.envelope.state !== "more_information_required" ? input.envelope : null;
  const metrics = buildSitePotentialMetrics(envelope);
  const hasCapacity = Boolean(envelope) && metrics.length > 0;

  return {
    mode: hasCapacity ? "capacity_only" : "none",
    title: SITE_POTENTIAL_REPORT_TITLE,
    lede: hasCapacity
      ? "The accepted building-area result currently attached to this erf."
      : "No accepted building-area result is attached to this erf yet.",
    hasCapacity,
    hasConcept: false,
    capacityHeading: "Accepted building-area result",
    capacityCaption: SITE_POTENTIAL_CAPACITY_CAPTION,
    conceptHeading: "",
    conceptCaption: SITE_POTENTIAL_CONCEPT_CAPTION,
    conceptName: null,
    brief: null,
    metrics,
    disclaimer: `Theoretical and estimated. Not approved plans. ${input.disclaimer}`.trim(),
    emptyMessage: hasCapacity
      ? null
      : input.skipped
        ? "Site Potential was skipped for this report."
        : "No accepted building-area map has been produced for this erf yet.",
  };
}