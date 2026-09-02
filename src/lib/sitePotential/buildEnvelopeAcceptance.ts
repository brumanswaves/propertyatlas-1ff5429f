import type { BuildEnvelopeInputs, BuildEnvelopeResult } from "@/lib/sitePotential/buildEnvelope";
import type { StoredBuildEnvelopeOverrides } from "@/lib/sitePotential/buildEnvelopeStore";

export interface BuildEnvelopeAcceptanceState {
  signature: string;
  eligible: boolean;
  accepted: boolean;
  acceptedAt: string | null;
}

function normalizedNumber(value: number | null) {
  return value == null || !Number.isFinite(value) ? null : Math.round(value * 1_000_000) / 1_000_000;
}

function normalizedText(value: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizedRing(ring: Array<[number, number]> | null) {
  if (!ring) return null;
  const points = ring
    .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]))
    .map(([lng, lat]) => [normalizedNumber(lng), normalizedNumber(lat)] as const);
  if (points.length > 1) {
    const first = points[0];
    const last = points[points.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) points.pop();
  }
  return points;
}

/**
 * Stable signature for the exact deterministic inputs the user reviewed.
 * It is intentionally not a security hash. Its job is to invalidate acceptance
 * whenever geometry, frontage or any planning assumption changes. A road label
 * is excluded because it does not alter the calculated envelope or its summary.
 */
export function buildEnvelopeAcceptanceSignature(
  inputs: BuildEnvelopeInputs,
  stored: StoredBuildEnvelopeOverrides | null,
) {
  return JSON.stringify({
    version: 2,
    parcelId: inputs.parcelId,
    ring: normalizedRing(inputs.ring),
    boundaryConfirmed: inputs.boundaryConfirmed,
    streetFrontageConfirmedByUser: stored?.streetFrontageConfirmedByUser === true,
    streetEdgeIndex: inputs.streetEdgeIndex,
    additionalStreetEdgeIndexes: [...(inputs.additionalStreetEdgeIndexes ?? [])].sort((a, b) => a - b),
    ruleSource: inputs.ruleSource,
    zoneLabel: normalizedText(inputs.zoneLabel),
    streetSetbackM: normalizedNumber(inputs.streetSetbackM),
    sideSetbackM: normalizedNumber(inputs.sideSetbackM),
    rearSetbackM: normalizedNumber(inputs.rearSetbackM),
    maxCoveragePercent: normalizedNumber(inputs.maxCoveragePercent),
    maxHeightM: normalizedNumber(inputs.maxHeightM),
    dwellingUnits: normalizedNumber(inputs.dwellingUnits),
    additionalDwellingRule: normalizedText(inputs.additionalDwellingRule),
    additionalDwellingRequiresConsent: inputs.additionalDwellingRequiresConsent,
    servitudeNotes: normalizedText(inputs.servitudeNotes),
    recordedAreaM2: normalizedNumber(inputs.recordedAreaM2),
  });
}

export function buildEnvelopeAcceptanceState(input: {
  inputs: BuildEnvelopeInputs;
  result: BuildEnvelopeResult;
  stored: StoredBuildEnvelopeOverrides | null;
}): BuildEnvelopeAcceptanceState {
  const signature = buildEnvelopeAcceptanceSignature(input.inputs, input.stored);
  const eligible =
    input.inputs.boundaryConfirmed &&
    input.stored?.streetFrontageConfirmedByUser === true &&
    (input.result.state === "verified" || input.result.state === "estimated") &&
    Boolean(input.result.envelopePolygon || input.result.coverageFootprint);
  const accepted = eligible && input.stored?.acceptedInputSignature === signature;
  const acceptedAt =
    accepted && typeof input.stored?.acceptedAt === "string" && input.stored.acceptedAt.trim()
      ? input.stored.acceptedAt
      : null;

  return {
    signature,
    eligible,
    accepted,
    acceptedAt,
  };
}
