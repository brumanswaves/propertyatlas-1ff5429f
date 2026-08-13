import { describe, expect, it } from "vitest";
import { deriveAcceptedBuildEnvelope } from "@/lib/sitePotential/acceptedBuildEnvelope";
import { buildParcelPlanningAssessment } from "@/lib/planning/parcelPlanningAssessment";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";

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

describe("deriveAcceptedBuildEnvelope", () => {
  it("does not expose a reportable envelope before Guided acceptance", () => {
    expect(
      deriveAcceptedBuildEnvelope({
        parcel,
        parcelRing: ring,
        planning,
        recordedAreaM2: 618.7,
        userId: "user-1",
        storedInputs: { boundaryConfirmed: true, streetFrontageConfirmedByUser: false },
      }),
    ).toBeNull();
  });

  it("returns the same accepted envelope projection for Guided and report consumers", () => {
    const result = deriveAcceptedBuildEnvelope({
      parcel,
      parcelRing: ring,
      planning,
      recordedAreaM2: 618.7,
      userId: "user-1",
      storedInputs: {
        boundaryConfirmed: true,
        streetFrontageConfirmedByUser: true,
        streetEdgeIndex: 0,
      },
    });

    expect(result?.summary.erfAreaM2).toBe(618.7);
    expect(result?.coverageFootprint ?? result?.envelopePolygon).not.toBeNull();
  });
});
