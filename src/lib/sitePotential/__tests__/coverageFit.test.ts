import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  calculateBuildEnvelope,
  coverageAllocationFor,
  fitCoveragePolygonInEnvelope,
  polygonAreaM2,
  type LocalPoint,
} from "@/lib/sitePotential/buildEnvelope";
import { findPilotPlanningRecord } from "@/lib/sitePotential/pilotPlanningRecords";
import { resolveSitePotentialInputs } from "@/lib/sitePotential/resolveSitePotentialInputs";

/** Rotated (non axis-aligned) rectangle, so orientation can be verified. */
function rotatedEnvelope(width: number, height: number, angleRad: number): LocalPoint[] {
  const base: LocalPoint[] = [
    { x: -width / 2, y: -height / 2 },
    { x: width / 2, y: -height / 2 },
    { x: width / 2, y: height / 2 },
    { x: -width / 2, y: height / 2 },
  ];
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return base.map((p) => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }));
}

function pointInPolygon(point: LocalPoint, polygon: LocalPoint[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Erf 1570 shape: 17.5 m frontage, ~619 m² extent, off-axis orientation. */
function erf1570Ring(rotationDeg = 23): Array<[number, number]> {
  const lat0 = -34.17;
  const lng0 = 24.84;
  const m = 111_320;
  const cos = Math.cos((lat0 * Math.PI) / 180);
  const w = 17.5;
  const h = 619 / 17.5;
  const theta = (rotationDeg * Math.PI) / 180;
  const corners: Array<[number, number]> = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  return corners.map(([x, y]) => {
    const rx = x * Math.cos(theta) - y * Math.sin(theta);
    const ry = x * Math.sin(theta) + y * Math.cos(theta);
    return [lng0 + rx / (m * cos), lat0 + ry / m] as [number, number];
  });
}

describe("coverage polygon fitting", () => {
  it("hits the target area when the setback envelope is larger", () => {
    const envelope = rotatedEnvelope(30, 20, 0.4);
    const fitted = fitCoveragePolygonInEnvelope(envelope, 300);
    expect(fitted).not.toBeNull();
    expect(polygonAreaM2(fitted as LocalPoint[])).toBeCloseTo(300, 3);
  });

  it("keeps every vertex inside the setback envelope", () => {
    const envelope = rotatedEnvelope(30, 20, 0.4);
    const fitted = fitCoveragePolygonInEnvelope(envelope, 300) as LocalPoint[];
    fitted.forEach((point) => {
      expect(pointInPolygon(point, envelope)).toBe(true);
    });
  });

  it("follows the envelope orientation rather than an axis-aligned bounding box", () => {
    const envelope = rotatedEnvelope(30, 20, 0.4);
    const fitted = fitCoveragePolygonInEnvelope(envelope, 300) as LocalPoint[];
    const edgeAngle = (poly: LocalPoint[]) =>
      Math.atan2(poly[1].y - poly[0].y, poly[1].x - poly[0].x);
    expect(edgeAngle(fitted)).toBeCloseTo(edgeAngle(envelope), 6);
    // An axis-aligned box would have at least one perfectly horizontal edge.
    const hasAxisAlignedEdge = fitted.some((p, i) => {
      const q = fitted[(i + 1) % fitted.length];
      return Math.abs(p.y - q.y) < 1e-9;
    });
    expect(hasAxisAlignedEdge).toBe(false);
  });

  it("caps the footprint at the setback envelope when coverage exceeds it", () => {
    const envelope = rotatedEnvelope(10, 10, 0.2);
    const fitted = fitCoveragePolygonInEnvelope(envelope, 5_000) as LocalPoint[];
    expect(polygonAreaM2(fitted)).toBeCloseTo(polygonAreaM2(envelope), 6);
  });

  it("never lets the illustrative second dwelling exceed the maximum coverage", () => {
    for (const area of [40, 120, 309.35, 900]) {
      const allocation = coverageAllocationFor(area);
      expect(allocation.totalM2).toBeLessThanOrEqual(area + 0.01);
      expect(allocation.additionalM2).toBeGreaterThan(0);
      expect(allocation.mainM2).toBeGreaterThan(0);
    }
  });
});

describe("Erf 1570 fixture through the generic engine", () => {
  it("produces a fitted coverage polygon inside the setback envelope", () => {
    const ring = erf1570Ring();
    const pilot = findPilotPlanningRecord({ lpiCode: "C03400140000157000000", parcelId: null });
    const resolved = resolveSitePotentialInputs({
      overrides: { boundaryConfirmed: true, streetEdgeIndex: 0 },
      pilot,
      recordedAreaM2: 619,
    });
    const result = calculateBuildEnvelope({
      ...resolved.answers,
      parcelId: "csg:lpi:C03400140000157000000",
      ring,
    });

    expect(result.summary.theoreticalGroundFloorM2).toBe(309.5);
    expect(result.envelopePolygon).not.toBeNull();
    const envelopeArea = polygonAreaM2(result.envelopePolygon as LocalPoint[]);
    expect(envelopeArea).toBeGreaterThan(400);
    expect(result.coverageFootprint).not.toBeNull();
    const coverage = result.coverageFootprint!;
    expect(polygonAreaM2(coverage.polygon)).toBeCloseTo(coverage.areaM2, 1);
    expect(coverage.areaM2).toBeLessThanOrEqual(Math.round(envelopeArea * 100) / 100);
    coverage.polygon.forEach((point) => {
      expect(pointInPolygon(point, result.envelopePolygon as LocalPoint[])).toBe(true);
    });
    expect(coverage.allocation.totalM2).toBeLessThanOrEqual(coverage.areaM2 + 0.01);
  });
});

describe("satellite map frame", () => {
  const source = readFileSync("src/components/property/sitePotential/SatelliteParcelMap.tsx", "utf8");

  it("fills the frame with the canvas and reserves no internal legend/footer space", () => {
    expect(source).toMatch(/absolute inset-0 h-full w-full/);
    expect(source).toMatch(/h-\[380px\][^"]*sm:h-\[520px\]/);
    expect(source).not.toMatch(/h-\[340px\]/);
    // Only the import plus the single fallback render — no footer diagram.
    expect(source.match(/BuildEnvelopeDiagram/g)?.length).toBe(3);

  });

  it("keeps a clean deterministic diagram fallback when satellite fails", () => {
    expect(source).toMatch(/mapFailed/);
    expect(source).toMatch(/showFallback[\s\S]*BuildEnvelopeDiagram/);
  });

  it("resizes the map on mount, load and container resize", () => {
    expect(source).toMatch(/ResizeObserver/);
    expect(source).toMatch(/map\.resize\(\)/);
  });
});
