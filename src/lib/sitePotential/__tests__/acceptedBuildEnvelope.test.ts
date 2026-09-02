import { describe, expect, it } from "vitest";
import {
  deriveAcceptedBuildEnvelope,
  deriveBuildEnvelopeCandidate,
} from "@/lib/sitePotential/acceptedBuildEnvelope";
import { buildParcelPlanningAssessment } from "@/lib/planning/parcelPlanningAssessment";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import type { StoredBuildEnvelopeOverrides } from "@/lib/sitePotential/buildEnvelopeStore";
import type { StoredStreetFrontageDetection } from "@/lib/sitePotential/streetFrontageStore";

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
    storedDetection: null,
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
        storedDetection: null,
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
      storedDetection: null,
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

    expect(candidate(staleAcceptance)?.acceptance.accepted).toBe(false);
    expect(
      deriveAcceptedBuildEnvelope({
        parcel,
        parcelRing: ring,
        planning,
        recordedAreaM2: 618.7,
        userId: "user-1",
        storedInputs: staleAcceptance,
        storedDetection: null,
      }),
    ).toBeNull();
  });

  it("replays stored map-road evidence when validating the accepted signature", () => {
    const storedDetection: StoredStreetFrontageDetection = {
      edgeIndex: 0,
      roadName: "Padrone Crescent",
      confidence: 0.94,
      method: "map_road_match",
      detectedAt: "2026-09-02T12:00:00.000Z",
    };
    const reviewable = deriveBuildEnvelopeCandidate({
      parcel,
      parcelRing: ring,
      planning,
      recordedAreaM2: 618.7,
      userId: "user-1",
      storedInputs: reviewedInputs,
      storedDetection,
    });

    expect(reviewable?.inputs.streetName).toBe("Padrone Crescent");
    expect(reviewable?.acceptance.eligible).toBe(true);

    const acceptedInputs = {
      ...reviewedInputs,
      acceptedInputSignature: reviewable!.acceptance.signature,
      acceptedAt: "2026-09-02T12:01:00.000Z",
    };
    const accepted = deriveAcceptedBuildEnvelope({
      parcel,
      parcelRing: ring,
      planning,
      recordedAreaM2: 618.7,
      userId: "user-1",
      storedInputs: acceptedInputs,
      storedDetection,
    });
    const missingDetection = deriveBuildEnvelopeCandidate({
      parcel,
      parcelRing: ring,
      planning,
      recordedAreaM2: 618.7,
      userId: "user-1",
      storedInputs: acceptedInputs,
      storedDetection: null,
    });

    expect(accepted).not.toBeNull();
    expect(missingDetection?.acceptance.accepted).toBe(false);
  });
});
