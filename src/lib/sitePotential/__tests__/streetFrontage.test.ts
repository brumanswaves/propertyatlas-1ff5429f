import { describe, expect, it } from "vitest";
import {
  detectStreetFrontage,
  normalizeStreetName,
  selectRoadLayerIds,
  streetNamesMatch,
} from "../streetFrontage";
import { calculateBuildEnvelope, type BuildEnvelopeInputs } from "../buildEnvelope";

/** Base point near Jeffreys Bay so the local projection stays realistic. */
const LAT0 = -34.0489;
const LNG0 = 24.9187;
const M_PER_DEG_LAT = 111320;
const M_PER_DEG_LNG = 111320 * Math.cos((LAT0 * Math.PI) / 180);

function at(eastM: number, northM: number): [number, number] {
  return [LNG0 + eastM / M_PER_DEG_LNG, LAT0 + northM / M_PER_DEG_LAT];
}

/** Simple 30 m x 20 m rectangle: edge 0 = south, 1 = east, 2 = north, 3 = west. */
function rectangleRing(): Array<[number, number]> {
  return [at(0, 0), at(30, 0), at(30, 20), at(0, 20), at(0, 0)];
}

/**
 * Erf 1570 shaped fixture: a quadrilateral whose LOWER-LEFT boundary is a
 * diagonal edge with Padrone Crescent running just outside it, and whose
 * longest boundary is the opposite rear edge with no road at all.
 */
function erf1570Ring(): Array<[number, number]> {
  return [
    at(0, 6), // lower-left diagonal starts here
    at(14, 0), // ...and ends here  (edge 0 = street-facing diagonal)
    at(40, 12), // edge 1 = side
    at(34, 34), // edge 2 = long rear edge (longest, no road)
    at(2, 24), // edge 3 = side
    at(0, 6),
  ];
}

function padroneCrescent() {
  // Runs parallel to the lower-left diagonal, 6 m outside the parcel.
  return {
    name: "Padrone Crescent",
    layerId: "road-street",
    coordinates: [at(-8, 1), at(6, -5), at(16, -6)] as Array<[number, number]>,
  };
}

describe("normalizeStreetName", () => {
  it("normalizes case, punctuation and street-type abbreviations", () => {
    expect(normalizeStreetName("Padrone Cres.")).toBe(normalizeStreetName("padrone crescent"));
    expect(normalizeStreetName("  Da Gama  Rd ")).toBe(normalizeStreetName("Da Gama Road"));
  });

  it("matches exact and abbreviated saved street names", () => {
    expect(streetNamesMatch("Padrone Crescent", "Padrone Crescent")).toBe(true);
    expect(streetNamesMatch("Padrone Cres", "Padrone Crescent")).toBe(true);
    expect(streetNamesMatch("Marina Martinique Drive", "Padrone Crescent")).toBe(false);
    expect(streetNamesMatch(null, "Padrone Crescent")).toBe(false);
  });
});

describe("selectRoadLayerIds", () => {
  it("keeps road line layers and excludes parcel, water, contour and admin lines", () => {
    const ids = selectRoadLayerIds([
      { id: "road-street", type: "line", "source-layer": "road" },
      { id: "road-service-case", type: "line", "source-layer": "road" },
      { id: "waterway-line", type: "line", "source-layer": "waterway" },
      { id: "contour-line", type: "line", "source-layer": "contour" },
      { id: "admin-1-boundary", type: "line", "source-layer": "admin" },
      { id: "site-potential-parcel-line", type: "line" },
      { id: "road-label", type: "symbol", "source-layer": "road" },
    ]);

    expect(ids).toContain("road-street");
    expect(ids).toContain("road-service-case");
    expect(ids).not.toContain("waterway-line");
    expect(ids).not.toContain("contour-line");
    expect(ids).not.toContain("admin-1-boundary");
    expect(ids).not.toContain("site-potential-parcel-line");
    expect(ids).not.toContain("road-label");
  });
});

describe("detectStreetFrontage", () => {
  it("picks the closest parallel edge to a name-matched road", () => {
    const detection = detectStreetFrontage({
      ring: rectangleRing(),
      savedStreetName: "Padrone Crescent",
      roads: [
        {
          name: "Padrone Crescent",
          layerId: "road-street",
          coordinates: [at(-10, -5), at(40, -5)],
        },
      ],
    });

    expect(detection.method).toBe("map_road_match");
    expect(detection.edgeIndex).toBe(0);
    expect(detection.requiresConfirmation).toBe(false);
    expect(detection.roadName).toBe("Padrone Crescent");
  });

  it("accepts an abbreviated road name as the same street", () => {
    const detection = detectStreetFrontage({
      ring: rectangleRing(),
      savedStreetName: "Padrone Crescent",
      roads: [
        { name: "Padrone Cres", layerId: "road-street", coordinates: [at(-10, -5), at(40, -5)] },
      ],
    });

    expect(detection.edgeIndex).toBe(0);
    expect(detection.candidates[0].nameMatch).toBe(true);
  });

  it("does not pick the longest edge when the road is beside a shorter one", () => {
    const detection = detectStreetFrontage({
      ring: rectangleRing(),
      savedStreetName: "Padrone Crescent",
      roads: [
        // Road beside the SHORT western edge (index 3), 5 m out.
        { name: "Padrone Crescent", layerId: "road-street", coordinates: [at(-5, -8), at(-5, 28)] },
      ],
    });

    expect(detection.edgeIndex).toBe(3);
    const longest = [...detection.candidates].sort((a, b) => b.lengthM - a.lengthM)[0];
    expect(longest.edgeIndex).not.toBe(detection.edgeIndex);
  });

  it("returns confirmation-required for an ambiguous corner parcel", () => {
    const detection = detectStreetFrontage({
      ring: rectangleRing(),
      savedStreetName: null,
      roads: [
        { name: "First Road", layerId: "road-street", coordinates: [at(-8, -5), at(38, -5)] },
        { name: "Second Road", layerId: "road-street", coordinates: [at(-5, -8), at(-5, 28)] },
      ],
    });

    expect(detection.edgeIndex).toBeNull();
    expect(detection.requiresConfirmation).toBe(true);
    expect(detection.method).toBe("none");
  });

  it("returns confirmation-required rather than a guess when no road geometry exists", () => {
    const detection = detectStreetFrontage({ ring: rectangleRing(), roads: [] });

    expect(detection.edgeIndex).toBeNull();
    expect(detection.method).toBe("none");
    expect(detection.requiresConfirmation).toBe(true);
    expect(detection.reason).toMatch(/no road geometry/i);
  });

  it("lets a user confirmation override automatic detection", () => {
    const detection = detectStreetFrontage({
      ring: rectangleRing(),
      savedStreetName: "Padrone Crescent",
      confirmedEdgeIndex: 2,
      roads: [
        { name: "Padrone Crescent", layerId: "road-street", coordinates: [at(-10, -5), at(40, -5)] },
      ],
    });

    expect(detection.edgeIndex).toBe(2);
    expect(detection.method).toBe("user_confirmed");
    expect(detection.confidence).toBe(1);
  });

  it("chooses the lower-left Padrone Crescent edge for the Erf 1570 fixture", () => {
    const detection = detectStreetFrontage({
      ring: erf1570Ring(),
      savedStreetName: "Padrone Crescent",
      roads: [padroneCrescent()],
    });

    expect(detection.edgeIndex).toBe(0);
    expect(detection.method).toBe("map_road_match");
    const ranked = [...detection.candidates].sort((a, b) => b.score - a.score);
    expect(ranked[0].edgeIndex).toBe(0);
    // The long rear edge must never win on length alone.
    expect(ranked[0].lengthM).toBeLessThan(Math.max(...detection.candidates.map((c) => c.lengthM)));
  });
});

describe("frontage changes recompute setbacks", () => {
  it("moves the street setback when the street edge index changes", () => {
    const base: Omit<BuildEnvelopeInputs, "streetEdgeIndex"> = {
      parcelId: "erf-1570",
      ring: erf1570Ring(),
      boundaryConfirmed: true,
      streetName: "Padrone Crescent",
      ruleSource: "registry",
      zoneLabel: "Residential 1",
      streetSetbackM: 3,
      sideSetbackM: 2,
      rearSetbackM: 3,
      maxCoveragePercent: 50,
      maxHeightM: 8,
      dwellingUnits: 1,
      additionalDwellingRule: null,
      additionalDwellingRequiresConsent: false,
      servitudeNotes: null,
      recordedAreaM2: 619,
    };

    const onEdgeZero = calculateBuildEnvelope({ ...base, streetEdgeIndex: 0 });
    const onEdgeTwo = calculateBuildEnvelope({ ...base, streetEdgeIndex: 2 });

    expect(onEdgeZero.streetEdge).not.toBeNull();
    expect(onEdgeTwo.streetEdge).not.toBeNull();
    expect(JSON.stringify(onEdgeZero.streetEdge)).not.toBe(JSON.stringify(onEdgeTwo.streetEdge));
    expect(JSON.stringify(onEdgeZero.envelopePolygon)).not.toBe(
      JSON.stringify(onEdgeTwo.envelopePolygon),
    );
  });
});
