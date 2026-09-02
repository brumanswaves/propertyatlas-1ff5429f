import { describe, expect, it } from "vitest";
import {
  deriveAcceptedBuildEnvelope,
  deriveBuildEnvelopeCandidate,
} from "@/lib/sitePotential/acceptedBuildEnvelope";
import { buildEnvelopeAcceptanceSignature } from "@/lib/sitePotential/buildEnvelopeAcceptance";
import { buildParcelPlanningAssessment } from "@/lib/planning/parcelPlanningAssessment";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import type { StoredBuildEnvelopeOverrides } from "@/lib/sitePotential/buildEnvelopeStore";

const parcel = {
  id: "parcel:accepted-envelope",
  source: "csg",
  sourceLabel: "Kouga SG",
  erfNumber: 1570,
  portion: 0,
  lpi: "C03400140000157000000",
  parcelKey: "E108C034001400001570000000",
  municipality: "Kouga Local Municipality",
  province: "Eastern Cape",
  knownFields: [],
  missingFields: [],
  rawProperties: { SHAPE_Area: 618.7 },
  coordinates: { lng: 24.83, lat: -34.17 },
} as NormalizedOfficialParcel;

const planning = buildParcelPlanningAssessment({
  parcelId: parcel.id,
  municipality: parcel.municipality ?? null,
  locationHints: ["Sea Vista"],
  erfAreaM2: 618.7,
  manualZoneCode: "RES1",
  hasParcelPolygon: true,
  now: new Date("2026-08-13T10:00:00Z"),
});

const ring: Array<[number, number]> = [
  [24.83, -34.17],
  [24.831, -34.17],
  [24.831, -34.171],
  [24.83, -34.171],
];

const reviewedInputs: StoredBuildEnvelopeOverrides = {
  boundaryConfirmed: true,
  streetFrontageConfirmedByUser: true,
  streetEdgeIndex: 0,
};

function candidate(storedInputs: StoredBuildEnvelopeOverrides = reviewedInputs) {
  return deriveBuildEnvelopeCandidate({
    parcel,
    parcelRing: ring,
    planning,
    recordedAreaM2: 618.7,
    userId: "user-1",
    storedInputs,
  });
}

describe("deriveAcceptedBuildEnvelope", () => {
  it("does not expose a reportable envelope before final Site Potential acceptance", () => {
    const reviewable = candidate();

    expect(reviewable?.acceptance.eligible).toBe(true);
    expect(reviewable?.acceptance.accepted).toBe(false);
    expect(
      deriveAcceptedBuildEnvelope({
        parcel,
        parcelRing: ring,
        planning,
        recordedAreaM2: 618.7,
        userId: "user-1",
        storedInputs: reviewedInputs,
      }),
    ).toBeNull();
  });

  it("returns the same accepted envelope projection for Guided and report consumers", () => {
    const reviewable = candidate();
    expect(reviewable).not.toBeNull();

    const acceptedInputs = {
      ...reviewedInputs,
      acceptedInputSignature: reviewable!.acceptance.signature,
      acceptedAt: "2026-09-02T12:00:00.000Z",
    };
    const result = deriveAcceptedBuildEnvelope({
      parcel,
      parcelRing: ring,
      planning,
      recordedAreaM2: 618.7,
      userId: "user-1",
      storedInputs: acceptedInputs,
    });

    expect(result?.summary.erfAreaM2).toBe(618.7);
    expect(result?.coverageFootprint ?? result?.envelopePolygon).not.toBeNull();
  });

  it("invalidates an accepted envelope when a deterministic input changes", () => {
    const reviewable = candidate();
    expect(reviewable).not.toBeNull();

    const staleAcceptance = {
      ...reviewedInputs,
      acceptedInputSignature: reviewable!.acceptance.signature,
      acceptedAt: "2026-09-02T12:00:00.000Z",
      streetSetbackM: 4,
    };
    const staleCandidate = candidate(staleAcceptance);

    expect(staleCandidate?.acceptance.accepted).toBe(false);
    expect(staleCandidate?.acceptance.acceptedAt).toBeNull();
    expect(
      deriveAcceptedBuildEnvelope({
        parcel,
        parcelRing: ring,
        planning,
        recordedAreaM2: 618.7,
        userId: "user-1",
        storedInputs: staleAcceptance,
      }),
    ).toBeNull();
  });

  it("does not bind the deterministic envelope acceptance to a road label", () => {
    const reviewable = candidate();
    expect(reviewable).not.toBeNull();

    const withDetectedRoadName = buildEnvelopeAcceptanceSignature(
      { ...reviewable!.inputs, streetName: "Padrone Crescent" },
      reviewedInputs,
    );
    const withoutDetectedRoadName = buildEnvelopeAcceptanceSignature(
      { ...reviewable!.inputs, streetName: null },
      reviewedInputs,
    );

    expect(withDetectedRoadName).toBe(withoutDetectedRoadName);
  });
});
