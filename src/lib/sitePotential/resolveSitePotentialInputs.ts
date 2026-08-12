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
import {
  normalizeAdditionalStreetEdgeIndexes,
  pickStreetEdgeIndexByLength,
} from "./buildEnvelope";
import type { StoredBuildEnvelopeInputs } from "./buildEnvelopeStore";
import type { PilotPlanningRecord } from "./pilotPlanningRecords";
import type { SitePotentialRulePrefill } from "./planningRuleAdapter";

export type SitePotentialFieldOrigin =
  | "document"
  | "user"
  | "map_road"
  | "pilot"
  | "registry"
  | "unknown";

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
  /**
   * Automatic street-frontage detection from real map road geometry. Ranks
   * above the prototype pilot record and below an explicit user confirmation.
   */
  detectedStreetEdge?: {
    edgeIndex: number | null;
    roadName: string | null;
    confidence: number;
  } | null;

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
    additionalStreetEdgeIndexes: ResolvedSitePotentialField<number[]>;
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

function validEdgeIndex(value: unknown, edgeCount?: number): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    (edgeCount == null || value < edgeCount)
    ? value
    : null;
}

/**
 * Keeps the existing envelope engine representation while treating every
 * confirmed street-facing edge as equivalent in the product UI. The retained
 * primary only gives the existing rear-edge calculation a deterministic anchor.
 */
export function resolveConfirmedStreetFrontages(
  selectedEdgeIndexes: Array<number | null | undefined>,
  previousStreetEdgeIndex: number | null | undefined,
  edgeCount?: number,
) {
  const selected = Array.from(
    new Set(
      selectedEdgeIndexes
        .map((edgeIndex) => validEdgeIndex(edgeIndex, edgeCount))
        .filter((edgeIndex): edgeIndex is number => edgeIndex != null),
    ),
  ).sort((a, b) => a - b);
  const previous = validEdgeIndex(previousStreetEdgeIndex, edgeCount);
  const streetEdgeIndex = previous != null && selected.includes(previous) ? previous : (selected[0] ?? null);

  return {
    selectedEdgeIndexes: selected,
    streetEdgeIndex,
    additionalStreetEdgeIndexes:
      streetEdgeIndex == null ? [] : selected.filter((edgeIndex) => edgeIndex !== streetEdgeIndex),
  };
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
  if (usable(packValue))
    return { value: packValue, origin: packOrigin, provenance: packProvenance };
  return { value: null, origin: "unknown", provenance: UNKNOWN_PROVENANCE };
}

export function resolveSitePotentialInputs(
  args: ResolveSitePotentialInputsArgs,
): ResolvedSitePotentialInputs {
  const stored = args.overrides ?? {};
  const prefill = args.prefill ?? null;
  const pilot = args.pilot ?? null;

  // (C)/(D) A stored "document" choice only survives with real document rules.
  const documentBacked = Boolean(args.documentRuleEvidence) && prefill?.ruleSource === "document";
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

  const pick = <T>(
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

  const detected = args.detectedStreetEdge ?? null;
  const edgeCount = args.edgeLengths?.length;
  const streetFrontageConfirmedByUser = stored.streetFrontageConfirmedByUser === true;
  const storedStreetEdgeIndex = validEdgeIndex(stored.streetEdgeIndex, edgeCount);
  const pilotStreetEdgeIndex =
    pilot?.streetFrontageLengthRangeM && args.edgeLengths?.length
      ? pickStreetEdgeIndexByLength(args.edgeLengths, pilot.streetFrontageLengthRangeM)
      : null;
  const detectedStreetEdgeIndex = validEdgeIndex(detected?.edgeIndex, edgeCount);
  // Map road evidence outranks the prototype record, so a stale pilot edge is
  // never retained once the rendered road points at a different boundary.
  const detectedProvenance = detected?.roadName
    ? `Likely street frontage detected from map road geometry (${detected.roadName}). Not confirmed by you.`
    : "Likely street frontage detected from map road geometry. Not confirmed by you.";
  const confirmedStreetFrontages = resolveConfirmedStreetFrontages(
    [
      stored.streetEdgeIndex,
      ...(stored.additionalStreetEdgeIndexes ?? []),
      stored.secondaryStreetEdgeIndex,
    ],
    stored.streetEdgeIndex,
    edgeCount,
  );
  const streetEdgeIndex = streetFrontageConfirmedByUser
    ? {
        value: confirmedStreetFrontages.streetEdgeIndex,
        origin: "user" as const,
        provenance:
          confirmedStreetFrontages.streetEdgeIndex != null
            ? USER_PROVENANCE
            : "You confirmed that no property boundary is currently treated as street-facing.",
      }
    : field<number>(
        null,
        documentProvenance,
        storedStreetEdgeIndex,
        detectedStreetEdgeIndex ?? validEdgeIndex(pilotStreetEdgeIndex, edgeCount),
        detectedStreetEdgeIndex != null
          ? detectedProvenance
          : pilot
            ? `Street boundary matched to the recorded ${pilot.streetName ?? "street"} frontage length.`
            : UNKNOWN_PROVENANCE,
        detectedStreetEdgeIndex != null ? "map_road" : "pilot",
      );
  const streetName = field<string>(
    null,
    documentProvenance,
    stored.streetName,
    detected?.roadName ?? pilot?.streetName ?? null,
    detected?.roadName ? detectedProvenance : (pilot?.provenanceLabel ?? UNKNOWN_PROVENANCE),
    detected?.roadName ? "map_road" : "pilot",
  );
  const additionalStreetEdgeIndexes = streetFrontageConfirmedByUser
    ? confirmedStreetFrontages.additionalStreetEdgeIndexes
    : normalizeAdditionalStreetEdgeIndexes(
        streetEdgeIndex.value,
        stored.additionalStreetEdgeIndexes,
        stored.secondaryStreetEdgeIndex,
        args.edgeLengths?.length,
      );
  const additionalStreetEdges = {
    value: additionalStreetEdgeIndexes,
    origin:
      streetFrontageConfirmedByUser || additionalStreetEdgeIndexes.length
        ? ("user" as const)
        : ("unknown" as const),
    provenance: additionalStreetEdgeIndexes.length
      ? USER_PROVENANCE
      : UNKNOWN_PROVENANCE,
  };

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
    additionalStreetEdgeIndexes: additionalStreetEdges,
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
    streetFrontageConfirmedByUser,
    streetEdgeIndex: streetEdgeIndex.value,
    additionalStreetEdgeIndexes,
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
