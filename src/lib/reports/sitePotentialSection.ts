/**
 * Site Potential report panel model.
 *
 * The report tells one connected story: what the rules calculate as site
 * capacity, and — separately — what a saved AI concept imagines. Both are
 * shown when both exist. Neither is ever invented.
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

export const SITE_POTENTIAL_REPORT_TITLE = "What could potentially be built here?";

export const SITE_POTENTIAL_CAPACITY_CAPTION =
  "Calculated from official parcel geometry and the planning rules recorded for this erf.";

export const SITE_POTENTIAL_CONCEPT_CAPTION =
  "AI concept visualisation saved to this erf. An interpretation, not a photograph or approved plan.";

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
  if (coverageArea) {
    metrics.push({
      id: "coverage",
      label: "Maximum coverage",
      value: coverageArea,
      note: s.maxCoveragePercent != null ? `${s.maxCoveragePercent}% of erf` : undefined,
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
  hasConceptImage: boolean;
  conceptStyle?: string | null;
  brief?: string | null;
  skipped: boolean;
  disclaimer: string;
}): SitePotentialReportPanel {
  const envelope =
    input.envelope && input.envelope.state !== "more_information_required" ? input.envelope : null;
  const metrics = buildSitePotentialMetrics(envelope);
  const hasCapacity = Boolean(envelope) && metrics.length > 0;
  const hasConcept = input.hasConceptImage;

  const mode: SitePotentialPanelMode =
    hasCapacity && hasConcept
      ? "both"
      : hasCapacity
        ? "capacity_only"
        : hasConcept
          ? "concept_only"
          : "none";

  return {
    mode,
    title: SITE_POTENTIAL_REPORT_TITLE,
    lede:
      mode === "both"
        ? "Calculated site capacity, alongside the concept saved for this erf."
        : mode === "capacity_only"
          ? "Calculated site capacity from the rules recorded for this erf."
          : mode === "concept_only"
            ? "The concept saved for this erf. Site capacity has not been calculated yet."
            : "Nothing has been calculated or saved for this erf yet.",
    hasCapacity,
    hasConcept,
    capacityHeading: "Calculated site capacity",
    capacityCaption: SITE_POTENTIAL_CAPACITY_CAPTION,
    conceptHeading: "Concept visualisation",
    conceptCaption: SITE_POTENTIAL_CONCEPT_CAPTION,
    conceptName: hasConcept
      ? input.conceptStyle
        ? `Selected concept — ${input.conceptStyle}`
        : "Selected property concept"
      : null,
    brief: hasConcept ? (input.brief?.trim() || null) : null,
    metrics,
    disclaimer: `Theoretical and estimated. Not approved plans. ${input.disclaimer}`.trim(),
    emptyMessage:
      mode !== "none"
        ? null
        : input.skipped
          ? "Site Potential was skipped for this report."
          : "No build envelope or concept has been produced for this erf yet.",
  };
}
