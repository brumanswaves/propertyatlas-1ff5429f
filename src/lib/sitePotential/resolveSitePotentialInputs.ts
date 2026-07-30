/**
 * Deterministic Site Potential input resolution.
 *
 * One resolved model, one precedence order, per-field provenance:
 *
 *   1. Property-specific matched/extracted control for this erf
 *      (a zoning document that actually supplied the number)
 *   2. Explicit, non-empty user override for that field
 *   3. Property-specific pilot record, else the selected zone's municipal
 *      published rule pack  -> Estimated
 *   4. Unknown
 *
 * A stored null, empty string, absent key or stale rule-source choice can
 * never overwrite a populated planning value, and `ruleSource: "document"` is
 * invalidated unless a matched zoning document genuinely supplied controls.
 */

import type { BuildEnvelopeRuleSource } from "./buildEnvelope";
import { pickStreetEdgeIndexByLength } from "./buildEnvelope";
import type { StoredBuildEnvelopeInputs } from "./buildEnvelopeStore";
import type { PilotPlanningRecord } from "./pilotPlanningRecords";
import type { SitePotentialRulePrefill } from "./planningRuleAdapter";

export type SitePotentialFieldOrigin = "document" | "user" | "pilot" | "registry" | "unknown";

export interface ResolvedSitePotentialField<T> {
  value: T | null;
  origin: SitePotentialFieldOrigin;
  /** Visible provenance sentence for this specific field. */
  provenance: string;
}

export type SitePotentialRuleStatus = "verified" | "estimated" | "more_information_required";

export interface ResolveSitePotentialInputsArgs {
  /** Stored user answers. Only non-null, non-empty entries count as overrides. */
  overrides?: Partial<StoredBuildEnvelopeInputs> | null;
  /** Prefill derived from the same planning assessment as Zoning & Build. */
  prefill?: SitePotentialRulePrefill | null;
  /** Property-specific pilot record for this exact parcel, when one exists. */
  pilot?: PilotPlanningRecord | null;
  /**
   * True only when a property-matched zoning document actually supplied the
   * zone and numeric controls. A file on its own is zoning evidence, not a
   * rule source.
   */
  documentRuleEvidence?: boolean;
  /** Edge lengths of the real parcel ring, used for street-edge selection. */
  edgeLengths?: number[];
  recordedAreaM2?: number | null;
}

export interface ResolvedSitePotentialInputs {
  answers: StoredBuildEnvelopeInputs;
  fields: {
    zoneLabel: ResolvedSitePotentialField<string>;
    streetSetbackM: ResolvedSitePotentialField<number>;
    sideSetbackM: ResolvedSitePotentialField<number>;
    rearSetbackM: ResolvedSitePotentialField<number>;
    maxCoveragePercent: ResolvedSitePotentialField<number>;
    maxHeightM: ResolvedSitePotentialField<number>;
    dwellingUnits: ResolvedSitePotentialField<number>;
    additionalDwellingRule: ResolvedSitePotentialField<string>;
    streetEdgeIndex: ResolvedSitePotentialField<number>;
    streetName: ResolvedSitePotentialField<string>;
  };
  ruleSource: BuildEnvelopeRuleSource | null;
  ruleStatus: SitePotentialRuleStatus;
  ruleSourceLabel: string;
  /** True when the stored rule source said "document" but nothing backed it. */
  invalidatedStoredDocumentSource: boolean;
}

const UNKNOWN_PROVENANCE = "Not recorded yet.";
const USER_PROVENANCE = "Entered by you. Treated as your own assumption, not an official rule.";

function usable<T>(value: T | null | undefined): value is T {
  if (value == null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number") return Number.isFinite(value);
  return true;
}

function field<T>(
  documentValue: T | null | undefined,
  documentProvenance: string,
  userValue: T | null | undefined,
  packValue: T | null | undefined,
  packProvenance: string,
  packOrigin: SitePotentialFieldOrigin,
): ResolvedSitePotentialField<T> {
  if (usable(documentValue)) {
    return { value: documentValue, origin: "document", provenance: documentProvenance };
  }
  if (usable(userValue)) return { value: userValue, origin: "user", provenance: USER_PROVENANCE };
  if (usable(packValue)) return { value: packValue, origin: packOrigin, provenance: packProvenance };
  return { value: null, origin: "unknown", provenance: UNKNOWN_PROVENANCE };
}

export function resolveSitePotentialInputs(
  args: ResolveSitePotentialInputsArgs,
): ResolvedSitePotentialInputs {
  const stored = args.overrides ?? {};
  const prefill = args.prefill ?? null;
  const pilot = args.pilot ?? null;

  // (C)/(D) A stored "document" choice only survives with real document rules.
  const documentBacked =
    Boolean(args.documentRuleEvidence) && prefill?.ruleSource === "document";
  const invalidatedStoredDocumentSource = stored.ruleSource === "document" && !documentBacked;

  const documentProvenance = prefill?.ruleSourceLabel ?? "Zoning document attached to this erf.";
  const packProvenance = pilot
    ? pilot.provenanceLabel
    : (prefill?.ruleSourceLabel ??
      "Published municipal rule candidate — property zoning not confirmed.");
  const packOrigin: SitePotentialFieldOrigin = pilot ? "pilot" : "registry";

  const doc = documentBacked ? prefill : null;
  // The registry pack is only usable as a fallback when it is not the document.
  const pack = prefill && prefill.ruleSource ? prefill : null;

  const pick = <T,>(
    docValue: T | null | undefined,
    userValue: T | null | undefined,
    pilotValue: T | null | undefined,
    registryValue: T | null | undefined,
  ) =>
    field(
      docValue,
      documentProvenance,
      userValue,
      pilot && usable(pilotValue) ? pilotValue : registryValue,
      pilot && usable(pilotValue) ? pilot.provenanceLabel : packProvenance,
      pilot && usable(pilotValue) ? "pilot" : packOrigin,
    );

  const zoneLabel = pick(
    doc?.zone.value ?? null,
    stored.zoneLabel,
    pilot?.zoneLabel ?? null,
    pack?.zone.value ?? null,
  );
  const streetSetbackM = pick(
    doc?.streetSetbackM.value ?? null,
    stored.streetSetbackM,
    pilot?.streetSetbackM ?? null,
    pack?.streetSetbackM.value ?? null,
  );
  const sideSetbackM = pick(
    doc?.sideSetbackM.value ?? null,
    stored.sideSetbackM,
    pilot?.sideSetbackM ?? null,
    pack?.sideSetbackM.value ?? null,
  );
  const rearSetbackM = pick(
    doc?.rearSetbackM.value ?? null,
    stored.rearSetbackM,
    pilot?.rearSetbackM ?? null,
    pack?.rearSetbackM.value ?? null,
  );
  const maxCoveragePercent = pick(
    doc?.maxCoveragePercent.value ?? null,
    stored.maxCoveragePercent,
    pilot?.maxCoveragePercent ?? null,
    pack?.maxCoveragePercent.value ?? null,
  );
  const maxHeightM = pick(
    doc?.maxHeightM.value ?? null,
    stored.maxHeightM,
    pilot?.maxHeightM ?? null,
    pack?.maxHeightM.value ?? null,
  );
  const dwellingUnits = pick(
    doc?.dwellingUnits.value ?? null,
    stored.dwellingUnits,
    pilot?.dwellingUnits ?? null,
    pack?.dwellingUnits.value ?? null,
  );
  const additionalDwellingRule = pick(
    doc?.additionalDwellingRule.value ?? null,
    stored.additionalDwellingRule,
    pilot?.additionalDwellingRule ?? null,
    pack?.additionalDwellingRule.value ?? null,
  );

  const pilotStreetEdgeIndex =
    pilot?.streetFrontageLengthRangeM && args.edgeLengths?.length
      ? pickStreetEdgeIndexByLength(args.edgeLengths, pilot.streetFrontageLengthRangeM)
      : null;
  const streetEdgeIndex = field<number>(
    null,
    documentProvenance,
    stored.streetEdgeIndex,
    pilotStreetEdgeIndex,
    pilot
      ? `Street boundary matched to the recorded ${pilot.streetName ?? "street"} frontage length.`
      : UNKNOWN_PROVENANCE,
    "pilot",
  );
  const streetName = field<string>(
    null,
    documentProvenance,
    stored.streetName,
    pilot?.streetName ?? null,
    pilot?.provenanceLabel ?? UNKNOWN_PROVENANCE,
    "pilot",
  );

  const resolvedFields = {
    zoneLabel,
    streetSetbackM,
    sideSetbackM,
    rearSetbackM,
    maxCoveragePercent,
    maxHeightM,
    dwellingUnits,
    additionalDwellingRule,
    streetEdgeIndex,
    streetName,
  };

  const origins = Object.values(resolvedFields).map((entry) => entry.origin);
  const hasControls =
    usable(streetSetbackM.value) &&
    usable(sideSetbackM.value) &&
    usable(rearSetbackM.value) &&
    usable(maxCoveragePercent.value) &&
    usable(maxHeightM.value);

  let ruleSource: BuildEnvelopeRuleSource | null = null;
  let ruleStatus: SitePotentialRuleStatus = "more_information_required";
  let ruleSourceLabel = "No usable zoning or rule source has been resolved for this erf yet.";

  if (hasControls && origins.includes("document")) {
    ruleSource = "document";
    ruleStatus = "verified";
    ruleSourceLabel = documentProvenance;
  } else if (hasControls && (origins.includes("pilot") || origins.includes("registry"))) {
    ruleSource = "registry";
    ruleStatus = "estimated";
    ruleSourceLabel = pilot ? pilot.provenanceLabel : packProvenance;
  } else if (hasControls) {
    ruleSource = "manual";
    ruleStatus = "estimated";
    ruleSourceLabel = USER_PROVENANCE;
  }

  const additionalDwellingRequiresConsent =
    typeof stored.additionalDwellingRequiresConsent === "boolean"
      ? stored.additionalDwellingRequiresConsent
      : pilot
        ? pilot.additionalDwellingRequiresConsent
        : (prefill?.additionalDwellingRequiresConsent ?? true);

  const answers: StoredBuildEnvelopeInputs = {
    boundaryConfirmed: stored.boundaryConfirmed === true,
    streetEdgeIndex: streetEdgeIndex.value,
    streetName: streetName.value,
    ruleSource,
    zoneLabel: zoneLabel.value,
    streetSetbackM: streetSetbackM.value,
    sideSetbackM: sideSetbackM.value,
    rearSetbackM: rearSetbackM.value,
    maxCoveragePercent: maxCoveragePercent.value,
    maxHeightM: maxHeightM.value,
    dwellingUnits: dwellingUnits.value,
    additionalDwellingRule: additionalDwellingRule.value,
    additionalDwellingRequiresConsent,
    servitudeNotes: usable(stored.servitudeNotes) ? stored.servitudeNotes : null,
    recordedAreaM2: args.recordedAreaM2 ?? pilot?.siteAreaM2 ?? null,
  };

  return {
    answers,
    fields: resolvedFields,
    ruleSource,
    ruleStatus,
    ruleSourceLabel,
    invalidatedStoredDocumentSource,
  };
}
