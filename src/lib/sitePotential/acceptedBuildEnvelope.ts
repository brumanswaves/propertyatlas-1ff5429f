/**
 * Accepted Site Potential output shared by Guided Investigation and the report.
 *
 * A calculated envelope only becomes a reportable output after the user has
 * confirmed the parcel boundary, reviewed street-facing boundaries and
 * explicitly accepted the exact deterministic inputs represented by the map.
 */
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import type { ParcelPlanningAssessment } from "@/lib/planning/municipalityPlanningTypes";
import {
  calculateBuildEnvelope,
  projectRingToLocalMetres,
  type BuildEnvelopeInputs,
  type BuildEnvelopeResult,
} from "@/lib/sitePotential/buildEnvelope";
import { buildEnvelopeAcceptanceState } from "@/lib/sitePotential/buildEnvelopeAcceptance";
import {
  readStoredBuildEnvelopeInputs,
  type StoredBuildEnvelopeOverrides,
} from "@/lib/sitePotential/buildEnvelopeStore";
import { findPilotPlanningRecord } from "@/lib/sitePotential/pilotPlanningRecords";
import { buildSitePotentialRulePrefill } from "@/lib/sitePotential/planningRuleAdapter";
import { resolveSitePotentialInputs } from "@/lib/sitePotential/resolveSitePotentialInputs";
import type { BrowserPersistenceUserId } from "@/lib/workbench/erfWorkspaceState";

export function deriveAcceptedBuildEnvelope(input: {
  parcel: NormalizedOfficialParcel;
  parcelRing: Array<[number, number]> | null | undefined;
  planning: ParcelPlanningAssessment;
  recordedAreaM2: number | null;
  userId: BrowserPersistenceUserId;
  /** Test-only override; production reads the parcel-scoped browser record. */
  storedInputs?: StoredBuildEnvelopeOverrides | null;
}): BuildEnvelopeResult | null {
  const { parcel, parcelRing, planning, recordedAreaM2, userId } = input;
  const stored =
    input.storedInputs === undefined
      ? readStoredBuildEnvelopeInputs(parcel.id, userId)
      : input.storedInputs;
  if (
    !parcelRing ||
    parcelRing.length < 3 ||
    !stored?.boundaryConfirmed ||
    !stored.streetFrontageConfirmedByUser
  ) {
    return null;
  }

  const polygon = projectRingToLocalMetres(parcelRing);
  const edgeLengths = polygon.map((point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    return Math.hypot(next.x - point.x, next.y - point.y);
  });
  const resolved = resolveSitePotentialInputs({
    overrides: stored,
    prefill: buildSitePotentialRulePrefill(planning),
    pilot: findPilotPlanningRecord({ parcelId: parcel.id, lpiCode: parcel.lpi ?? null }),
    documentRuleEvidence: planning.detection.method === "document_supported",
    edgeLengths,
    recordedAreaM2,
  });
  const inputs: BuildEnvelopeInputs = {
    ...resolved.answers,
    parcelId: parcel.id,
    ring: parcelRing,
    recordedAreaM2: resolved.answers.recordedAreaM2 ?? recordedAreaM2,
  };
  const result = calculateBuildEnvelope(inputs);
  const acceptance = buildEnvelopeAcceptanceState({ inputs, result, stored });

  return acceptance.accepted ? result : null;
}
