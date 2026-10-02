import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SharedInvestigationReport } from "@/components/humanReview/SharedInvestigationReport";
import { assembleInvestigation, type InvestigationSnapshot } from "../sharedInvestigation";
import { validateRecoveredGeometry } from "../sharedParcelGeometry";
import { canonicalAreaM2, resolveParcelArea } from "@/lib/evidence/parcelArea";
import type { PublicDataResult } from "@/lib/providers/publicDataClient";
import { evidenceAsset } from "@/lib/evidence/__tests__/propertyEvidenceTestUtils";
import { mkdirSync, writeFileSync } from "node:fs";

const id = "csg:lpi:c00000000000990100000";
const ring = [
  [24, -34],
  [24.001, -34],
  [24.001, -34.001],
  [24, -34.001],
  [24, -34],
];
function fixture(): InvestigationSnapshot {
  return {
    schemaVersion: 1,
    parcelId: id,
    revision: 60,
    assets: [],
    siteProject: null,
    userData: {
      normalizedParcel: {
        id,
        source: "csg",
        layer: "csg-parcels",
        sourceLabel: "Synthetic cadastral source",
        knownFields: [],
        missingFields: [],
      },
      parcelRing: structuredClone(ring),
      latitude: 1,
      longitude: 2,
      buildEnvelopeInputs: { streetEdgeIndex: 2, boundaryConfirmed: false },
    },
  };
}
const result = (properties: Record<string, unknown>): PublicDataResult => ({
  type: "FeatureCollection",
  layer: "csg-parcels",
  official: true,
  sourceLabel: "Synthetic cadastral source",
  fallbackUsed: "direct",
  fetchedAt: "2026-10-01",
  attempts: [],
  features: [
    {
      type: "Feature",
      properties: { ID: id.slice(8), ...properties },
      geometry: { type: "Polygon", coordinates: [ring] },
    },
  ],
});
afterEach(() => vi.unstubAllGlobals());

describe("saved boundary shared report projection", () => {
  it("renders boundary-present wording without fabricating point, area, approval or writes", () => {
    const snapshot = fixture();
    const before = structuredClone(snapshot);
    const fetch = vi.fn(() => {
      throw new Error("Provider access forbidden");
    });
    const setItem = vi.fn(() => {
      throw new Error("Persistence forbidden");
    });
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("localStorage", { getItem: vi.fn(() => null), setItem, removeItem: setItem });
    const assembly = assembleInvestigation(snapshot);
    expect(assembly.ring).toEqual(ring);
    expect(assembly.report.identity.coordinates).toBeNull();
    expect(canonicalAreaM2(assembly.parcel.rawProperties)).toBeNull();
    expect(assembly.envelope).toBeNull();
    for (const printOnly of [false, true]) {
      const html = renderToStaticMarkup(
        <SharedInvestigationReport assembly={assembly} openingControls={{ printOnly }} />,
      );
      expect(html).toContain("A saved parcel boundary is available.");
      expect(html).toContain("Representative point metadata is unavailable");
      expect(html).not.toContain("No parcel geometry is available");
      expect(html).not.toContain("1.00000, 2.00000");
      expect(html).toContain("Not human reviewed");
      if (process.env.EE_BOUNDARY_EVIDENCE_DIR) {
        mkdirSync(process.env.EE_BOUNDARY_EVIDENCE_DIR, { recursive: true });
        writeFileSync(
          `${process.env.EE_BOUNDARY_EVIDENCE_DIR}/${printOnly ? "print" : "normal"}.html`,
          html,
        );
      }
    }
    expect(snapshot).toEqual(before);
    expect(fetch).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });
  it.each([
    undefined,
    [],
    [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
    [
      [181, 0],
      [1, 0],
      [1, 1],
    ],
  ])("does not announce invalid or absent boundary %j", (value) => {
    const snapshot = fixture();
    snapshot.userData.parcelRing = value;
    const assembly = assembleInvestigation(snapshot);
    expect(assembly.ring).toBeNull();
    const html = renderToStaticMarkup(<SharedInvestigationReport assembly={assembly} />);
    expect(html).toContain("No validated parcel boundary or representative point");
    expect(html).not.toContain("A saved parcel boundary is available.");
  });
  it("rejects cross-parcel binding and does not reuse a ring without normalized identity", () => {
    const snapshot = fixture();
    snapshot.parcelId = "csg:lpi:other";
    expect(() => assembleInvestigation(snapshot)).toThrow("does not match");
    delete snapshot.userData.normalizedParcel;
    expect(assembleInvestigation(snapshot).ring).toBeNull();
  });
  it.each([618.7, "618.7", null, -1, 0, "invalid", true, Infinity])(
    "future exact recovery retains only admissible area metadata %j",
    (area) => {
      const snapshot = fixture();
      const before = structuredClone(snapshot);
      const parcel = assembleInvestigation(snapshot).parcel;
      const recovered = validateRecoveredGeometry(
        parcel,
        result({ GEOM_AREA: area, ZONING: "Business", HEIGHT: 50 }),
      );
      expect(recovered).not.toBeNull();
      const assembly = assembleInvestigation({
        ...snapshot,
        userData: { ...snapshot.userData, ...recovered },
      });
      expect(canonicalAreaM2(assembly.parcel.rawProperties)).toBe(
        (typeof area === "number" && area === 618.7) || area === "618.7" ? 618.7 : null,
      );
      expect(assembly.parcel.rawProperties).not.toHaveProperty("ZONING");
      expect(assembly.parcel.rawProperties).not.toHaveProperty("HEIGHT");
      expect(assembly.parcel.coordinates).toBeNull();
      expect(snapshot).toEqual(before);
      expect(assembly.envelope).toBeNull();
    },
  );
  it("keeps projected area approximate and preserves existing valid same-source metadata", () => {
    const parcel = assembleInvestigation(fixture()).parcel;
    const recovered = validateRecoveredGeometry(
      { ...parcel, rawProperties: { GEOM_AREA: 700 } },
      result({ GEOM_AREA: null }),
    );
    expect(canonicalAreaM2(recovered?.normalizedParcel.rawProperties)).toBe(700);
    expect(
      resolveParcelArea(
        validateRecoveredGeometry(parcel, result({ Shape__Area: 900 }))?.normalizedParcel
          .rawProperties,
      )?.approximate,
    ).toBe(true);
  });
  it("keeps document extent and its unverified discrepancy through future recovery and report rendering", () => {
    const snapshot = fixture();
    snapshot.assets = [
      evidenceAsset({
        parcel_id: id,
        asset_category: "paid_report",
        metadata: {
          extractionStatus: "ready",
          identityMatchStatus: "unverified",
          identityBinding: "user_confirmed",
          identityUserConfirmedParcelId: id,
          extractedClaims: [
            {
              domain: "identity",
              key: "registeredExtent",
              label: "Registered extent",
              value: "600 m2",
              numericValue: 600,
              scope: "subject",
              page: 2,
            },
          ],
        },
      }),
    ];
    const before = structuredClone(snapshot);
    const recovered = validateRecoveredGeometry(
      assembleInvestigation(snapshot).parcel,
      result({ GEOM_AREA: 900 }),
    );
    const assembly = assembleInvestigation({
      ...snapshot,
      userData: { ...snapshot.userData, ...recovered },
    });
    const warning = assembly.pack.contradictions.find(
      (c) => c.id === "official-area-vs-registered-extent",
    )!;
    expect(warning.displayedValues).toEqual([
      "Official cadastral area: 900 m2",
      "Registered extent: 600 m2",
    ]);
    expect(warning.explanation).toContain("identity has not been independently matched");
    for (const printOnly of [false, true]) {
      const html = renderToStaticMarkup(
        <SharedInvestigationReport assembly={assembly} openingControls={{ printOnly }} />,
      );
      expect(html).toContain("identity has not been independently matched");
      expect(html).toContain("Registered extent");
    }
    expect(snapshot).toEqual(before);
  });
  it("does not promote previous manual area/coordinates during official source transition", () => {
    const parcel = assembleInvestigation(fixture()).parcel;
    const recovered = validateRecoveredGeometry(
      {
        ...parcel,
        source: "manual",
        coordinates: { lng: 2, lat: 1 },
        rawProperties: { GEOM_AREA: 602 },
      },
      result({}),
    );
    expect(recovered?.normalizedParcel.coordinates).toBeNull();
    expect(canonicalAreaM2(recovered?.normalizedParcel.rawProperties)).toBeNull();
  });
});
