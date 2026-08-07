import { resolveParcelArea } from "@/lib/evidence/parcelArea";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import type { ResolvedSitePotentialInputs } from "@/lib/sitePotential/resolveSitePotentialInputs";

export type StrategyInputState =
  | "verified_property"
  | "working_property"
  | "working_assumption"
  | "derived_from_working_assumption"
  | "concept_assumption"
  | "missing_value";

export interface StrategyInputFact {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  source: string;
  state: StrategyInputState;
  editable: boolean;
  evidence: string;
  warning: string | null;
  originalPropertyValue: number | null;
}

export interface SitePotentialStrategyDraftLike {
  source?: string;
  buildableSqm?: string | number | null;
  conceptTitle?: string | null;
  selectedDesignAssetId?: string | null;
}

function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function rounded(value: number | null): number | null {
  return value == null ? null : Math.round(value * 100) / 100;
}

function fact(input: StrategyInputFact): StrategyInputFact {
  return input;
}

export function buildStrategyPropertyInputFacts(input: {
  parcel: NormalizedOfficialParcel;
  resolvedSitePotentialInputs?: ResolvedSitePotentialInputs | null;
  sitePotentialDraft?: SitePotentialStrategyDraftLike | null;
}): StrategyInputFact[] {
  const area = resolveParcelArea(input.parcel.rawProperties as Record<string, unknown> | null);
  const areaSource =
    area?.sourceKind === "csg_geom_area"
      ? "Chief Surveyor-General GEOM_AREA"
      : area?.sourceKind === "verified_extent"
        ? "Uploaded verified extent"
        : area?.sourceKind === "explicit_m2"
          ? `Official parcel field ${area.sourceKey}`
          : area?.sourceKind === "shape_area_approximate"
            ? `Projected map geometry ${area.sourceKey}`
            : "No recorded parcel area";
  const areaState: StrategyInputState | null = area
    ? area.approximate
      ? "working_property"
      : "verified_property"
    : null;
  const facts: StrategyInputFact[] = [
    fact({
      key: "erfAreaM2",
      label: "Erf area",
      value: area?.areaM2 ?? null,
      unit: "m²",
      source: areaSource,
      state: areaState ?? "missing_value",
      editable: false,
      evidence: area
        ? `Canonical parcel area from ${area.sourceKey}.`
        : "No canonical parcel area is available.",
      warning: area?.warning ?? null,
      originalPropertyValue: area?.areaM2 ?? null,
    }),
  ];

  const resolvedCoverage = input.resolvedSitePotentialInputs?.fields.maxCoveragePercent ?? null;
  const coverage = numeric(resolvedCoverage?.value);
  const ruleStatus = input.resolvedSitePotentialInputs?.ruleStatus ?? "more_information_required";
  const ruleSource = input.resolvedSitePotentialInputs?.ruleSource ?? null;
  const coverageOrigin = resolvedCoverage?.origin ?? "unknown";
  const coverageState: StrategyInputState =
    ruleStatus === "verified" && coverageOrigin === "document" && ruleSource === "document"
      ? "verified_property"
      : coverage != null
        ? "working_assumption"
        : "missing_value";
  facts.push(
    fact({
      key: "coveragePercent",
      label: "Coverage",
      value: coverage,
      unit: "%",
      source:
        coverage == null
          ? "No coverage rule recorded"
          : resolvedCoverage?.provenance ??
            input.resolvedSitePotentialInputs?.ruleSourceLabel ??
            "Working planning assumption",
      state: coverageState,
      editable: true,
      evidence:
        coverage == null
          ? "Coverage must be added before Easy Erf can derive a footprint."
          : coverageState === "verified_property"
            ? "Coverage was recorded from a property-specific document."
            : "Property-specific planning controls are not yet verified.",
      warning:
        coverage != null && coverageState !== "verified_property"
          ? "Treat this as a working assumption, not an approved building right."
          : null,
      originalPropertyValue: coverage,
    }),
  );

  const theoreticalFootprint =
    area?.areaM2 != null && coverage != null ? rounded(area.areaM2 * (coverage / 100)) : null;
  facts.push(
    fact({
      key: "theoreticalFootprintM2",
      label: "Derived footprint",
      value: theoreticalFootprint,
      unit: "m²",
      source:
        theoreticalFootprint == null
          ? "Missing area or coverage"
          : `${areaSource} × ${coverage}% coverage`,
      state:
        theoreticalFootprint == null
          ? "missing_value"
          : coverageState === "verified_property"
            ? "working_property"
            : "derived_from_working_assumption",
      editable: false,
      evidence:
        theoreticalFootprint == null
          ? "No footprint can be calculated yet."
          : `${rounded(area?.areaM2 ?? null)} m² × ${coverage}% = ${theoreticalFootprint} m².`,
      warning:
        theoreticalFootprint != null && coverageState !== "verified_property"
          ? "Derived from unverified planning controls."
          : null,
      originalPropertyValue: theoreticalFootprint,
    }),
  );

  const conceptBuildable = numeric(input.sitePotentialDraft?.buildableSqm);
  facts.push(
    fact({
      key: "sitePotentialBuildAreaM2",
      label: "Site Potential build area",
      value: conceptBuildable,
      unit: "m²",
      source: conceptBuildable
        ? input.sitePotentialDraft?.conceptTitle
          ? `Selected Site Potential concept: ${input.sitePotentialDraft.conceptTitle}`
          : "Selected Site Potential concept"
        : "No selected concept build area",
      state: conceptBuildable ? "concept_assumption" : "missing_value",
      editable: true,
      evidence: conceptBuildable
        ? "Concept area is a financial assumption, not an approved plan."
        : "No Site Potential build-area assumption is available.",
      warning: conceptBuildable
        ? "Concepts are visual assumptions and do not override verified planning constraints."
        : null,
      originalPropertyValue: conceptBuildable,
    }),
  );

  return facts;
}

export function strategyDefaultsFromPropertyFacts(
  facts: StrategyInputFact[],
): Record<string, string> {
  const byKey = Object.fromEntries(facts.map((item) => [item.key, item]));
  const defaults: Record<string, string> = {};
  for (const key of ["erfAreaM2", "coveragePercent", "theoreticalFootprintM2"]) {
    const value = byKey[key]?.value;
    if (value != null) defaults[key] = String(value);
  }
  const buildArea =
    byKey.sitePotentialBuildAreaM2?.value ?? null;
  if (buildArea != null) {
    defaults.buildAreaM2 = String(buildArea);
    defaults.floorAreaM2 = String(buildArea);
  }
  return defaults;
}
