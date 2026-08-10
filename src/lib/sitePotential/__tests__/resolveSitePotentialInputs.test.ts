import { describe, expect, it } from "vitest";
import {
  calculateBuildEnvelope,
  localPolygonToWgs84,
  pickStreetEdgeIndexByLength,
  projectRingToLocalMetres,
  ringProjection,
} from "@/lib/sitePotential/buildEnvelope";
import { findPilotPlanningRecord } from "@/lib/sitePotential/pilotPlanningRecords";
import { resolveSitePotentialInputs } from "@/lib/sitePotential/resolveSitePotentialInputs";
import type { SitePotentialRulePrefill } from "@/lib/sitePotential/planningRuleAdapter";

function prefillField<T>(value: T | null) {
  return { value, provenance: null };
}

function registryPrefill(
  overrides: Partial<SitePotentialRulePrefill> = {},
): SitePotentialRulePrefill {
  return {
    ruleSource: "registry",
    ruleSourceStatus: "estimated",
    ruleSourceLabel: "Published municipal rule candidate — property zoning not confirmed.",
    zone: prefillField("Residential 1"),
    streetSetbackM: prefillField(4.5),
    sideSetbackM: prefillField(2),
    rearSetbackM: prefillField(2),
    maxCoveragePercent: prefillField(60),
    maxHeightM: prefillField(9),
    dwellingUnits: prefillField(1),
    additionalDwellingRule: prefillField("One additional dwelling"),
    additionalDwellingRequiresConsent: true,
    guidelineNotes: [],
    nextBestAction: null,
    ...overrides,
  };
}

/** Rectangle with a 17.5 m short edge and ~619 m² extent (Erf 1570 shape). */
function erf1570Ring(): Array<[number, number]> {
  const lat0 = -34.17;
  const lng0 = 24.84;
  const m = 111_320;
  const cos = Math.cos((lat0 * Math.PI) / 180);
  const w = 17.5;
  const h = 619 / 17.5;
  const dLng = (x: number) => lng0 + x / (m * cos);
  const dLat = (y: number) => lat0 + y / m;
  return [
    [dLng(0), dLat(0)],
    [dLng(w), dLat(0)],
    [dLng(w), dLat(h)],
    [dLng(0), dLat(h)],
    [dLng(0), dLat(0)],
  ];
}

function edgeLengthsOf(ring: Array<[number, number]>) {
  const polygon = projectRingToLocalMetres(ring);
  return polygon.map((a, index) => {
    const b = polygon[(index + 1) % polygon.length];
    return Math.hypot(b.x - a.x, b.y - a.y);
  });
}

describe("Site Potential input precedence", () => {
  it("never lets a stored blank overwrite a registry prefill", () => {
    const resolved = resolveSitePotentialInputs({
      overrides: { streetSetbackM: null, maxCoveragePercent: undefined } as never,
      prefill: registryPrefill(),
    });
    expect(resolved.answers.streetSetbackM).toBe(4.5);
    expect(resolved.answers.maxCoveragePercent).toBe(60);
    expect(resolved.fields.streetSetbackM.origin).toBe("registry");
  });

  it("prefers an explicit user override over the rule pack", () => {
    const resolved = resolveSitePotentialInputs({
      overrides: { streetSetbackM: 6 },
      prefill: registryPrefill(),
    });
    expect(resolved.answers.streetSetbackM).toBe(6);
    expect(resolved.fields.streetSetbackM.origin).toBe("user");
  });

  it("retains a distinct user-confirmed second frontage without treating it as planning evidence", () => {
    const resolved = resolveSitePotentialInputs({
      overrides: { streetEdgeIndex: 0, secondaryStreetEdgeIndex: 3 },
      prefill: registryPrefill(),
    });

    expect(resolved.answers.streetEdgeIndex).toBe(0);
    expect(resolved.answers.secondaryStreetEdgeIndex).toBe(3);
    expect(resolved.fields.secondaryStreetEdgeIndex.origin).toBe("user");
    expect(resolved.ruleStatus).toBe("estimated");
  });

  it("drops a duplicate second frontage when it matches the primary edge", () => {
    const resolved = resolveSitePotentialInputs({
      overrides: { streetEdgeIndex: 2, secondaryStreetEdgeIndex: 2 },
      prefill: registryPrefill(),
    });

    expect(resolved.answers.secondaryStreetEdgeIndex).toBeNull();
  });

  it("prefers a matched zoning document over both user and pack values", () => {
    const documentPrefill = registryPrefill({
      ruleSource: "document",
      ruleSourceLabel: "Zoning certificate matched to this erf.",
    });
    const resolved = resolveSitePotentialInputs({
      overrides: { streetSetbackM: 6 },
      prefill: documentPrefill,
      documentRuleEvidence: true,
    });
    expect(resolved.answers.streetSetbackM).toBe(4.5);
    expect(resolved.fields.streetSetbackM.origin).toBe("document");
    expect(resolved.ruleStatus).toBe("verified");
  });

  it("invalidates a stored document rule source when no document supplied rules", () => {
    const resolved = resolveSitePotentialInputs({
      overrides: { ruleSource: "document" },
      prefill: registryPrefill(),
      documentRuleEvidence: false,
    });
    expect(resolved.invalidatedStoredDocumentSource).toBe(true);
    expect(resolved.ruleSource).toBe("registry");
    expect(resolved.ruleStatus).toBe("estimated");
  });

  it("prefers the property-specific pilot record over the generic rule pack", () => {
    const pilot = findPilotPlanningRecord({ parcelId: "csg:lpi:C03400140000157000000" });
    const resolved = resolveSitePotentialInputs({
      overrides: {},
      prefill: registryPrefill(),
      pilot,
    });
    expect(resolved.answers.streetSetbackM).toBe(3);
    expect(resolved.answers.maxCoveragePercent).toBe(50);
    expect(resolved.ruleStatus).toBe("estimated");
  });
});

describe("Erf 1570 pilot accuracy", () => {
  const pilot = findPilotPlanningRecord({ lpiCode: "C03400140000157000000", parcelId: null });

  it("matches only the exact pilot parcel", () => {
    expect(pilot).not.toBeNull();
    expect(findPilotPlanningRecord({ parcelId: "csg:erf:1570" })).toBeNull();
  });

  it("produces the approved prototype build numbers", () => {
    const ring = erf1570Ring();
    const resolved = resolveSitePotentialInputs({
      overrides: { boundaryConfirmed: true },
      pilot,
      edgeLengths: edgeLengthsOf(ring),
      recordedAreaM2: 619,
    });
    const result = calculateBuildEnvelope({
      ...resolved.answers,
      parcelId: "csg:lpi:C03400140000157000000",
      ring,
    });

    expect(result.summary.erfAreaM2).toBe(619);
    expect(result.summary.maxCoveragePercent).toBe(50);
    expect(result.summary.theoreticalGroundFloorM2).toBe(309.5);
    expect(result.summary.maxHeightM).toBe(8.5);
    expect(result.envelopePolygon).not.toBeNull();
    expect(result.state).toBe("estimated");
  });

  it("selects the short Padrone Crescent frontage as the street edge", () => {
    const lengths = edgeLengthsOf(erf1570Ring());
    const index = pickStreetEdgeIndexByLength(lengths, [17, 18.6]);
    expect(index).not.toBeNull();
    expect(lengths[index as number]).toBeCloseTo(17.5, 1);
  });

  it("returns null rather than guessing when no edge matches the frontage", () => {
    expect(pickStreetEdgeIndexByLength([40, 40, 40, 40], [17, 18.6])).toBeNull();
  });
});

describe("Map overlay georeferencing", () => {
  it("round-trips deterministic geometry back to the original coordinates", () => {
    const ring = erf1570Ring();
    const projection = ringProjection(ring);
    expect(projection).not.toBeNull();
    const back = localPolygonToWgs84(projectRingToLocalMetres(ring), projection!);
    back.forEach((point, index) => {
      expect(point[0]).toBeCloseTo(ring[index][0], 9);
      expect(point[1]).toBeCloseTo(ring[index][1], 9);
    });
  });

  it("emits a projection only when real geometry exists", () => {
    const empty = calculateBuildEnvelope({
      parcelId: "x",
      ring: null,
      boundaryConfirmed: false,
      streetEdgeIndex: null,
      streetName: null,
      ruleSource: null,
      zoneLabel: null,
      streetSetbackM: null,
      sideSetbackM: null,
      rearSetbackM: null,
      maxCoveragePercent: null,
      maxHeightM: null,
      dwellingUnits: null,
      additionalDwellingRule: null,
      additionalDwellingRequiresConsent: true,
      servitudeNotes: null,
      recordedAreaM2: null,
    });
    expect(empty.projection).toBeNull();
    expect(empty.parcelPolygon).toHaveLength(0);
  });
});
