import { describe, expect, it, vi } from "vitest";
import type { Polygon } from "geojson";
import type { OfficialFeatureSelection } from "@/components/map/MapCanvas";
import type { PublicDataResult } from "@/lib/providers/publicDataClient";
import { hasParcelBoundary, loadSelectedParcelBoundary } from "../selectedParcelBoundary";

const geometry: Polygon = { type: "Polygon", coordinates: [[[24, -34], [24.001, -34], [24.001, -34.001], [24, -34]]] };
const selection: OfficialFeatureSelection = {
  source: "Chief Surveyor-General", layer: "csg-parcels", properties: { ID: "LPI-A" },
  geometry: null, lngLat: [24, -34],
};
const result = (features: PublicDataResult["features"], official = true): PublicDataResult => ({
  type: "FeatureCollection", layer: "csg-parcels", sourceLabel: "Official", official,
  fallbackUsed: "edge", fetchedAt: "", attempts: [], features,
});
const feature = (id: string, shape = geometry) => ({
  type: "Feature" as const, properties: { ID: id }, geometry: shape,
});

describe("selected parcel boundary", () => {
  it("loads the exact public polygon without relying on the visible map extent", async () => {
    const load = vi.fn().mockResolvedValue(result([feature("NEIGHBOUR"), feature("LPI-A")]));
    expect(await loadSelectedParcelBoundary(selection, load)).toEqual(geometry);
    expect(load).toHaveBeenCalledWith("csg-parcels", [23.998, -34.002, 24.002, -33.998], 400);
    expect(selection.geometry).toBeNull();
    expect(selection.properties).toEqual({ ID: "LPI-A" });
  });
  it("never substitutes a nearby erf or an unproven result", async () => {
    expect(await loadSelectedParcelBoundary(selection, vi.fn().mockResolvedValue(result([feature("B")])))).toBeNull();
    expect(await loadSelectedParcelBoundary(selection, vi.fn().mockResolvedValue(result([feature("LPI-A")], false)))).toBeNull();
    expect(await loadSelectedParcelBoundary(selection, vi.fn().mockResolvedValue({ ...result([feature("LPI-A")]), fallbackUsed: "test" }))).toBeNull();
  });
  it("rejects ambiguous outlines but accepts identical duplicate features", async () => {
    const other: Polygon = { ...geometry, coordinates: [[[25, -34], [25.001, -34], [25.001, -34.001], [25, -34]]] };
    expect(await loadSelectedParcelBoundary(selection, vi.fn().mockResolvedValue(result([feature("LPI-A"), feature("LPI-A", other)])))).toBeNull();
    expect(await loadSelectedParcelBoundary(selection, vi.fn().mockResolvedValue(result([feature("LPI-A"), feature("LPI-A")])))).toEqual(geometry);
  });
  it("keeps existing geometry and leaves missing/failed sources honestly absent", async () => {
    const load = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await loadSelectedParcelBoundary({ ...selection, geometry }, load)).toEqual(geometry);
    expect(load).not.toHaveBeenCalled();
    expect(await loadSelectedParcelBoundary(selection, load)).toBeNull();
  });
  it("requires a stable parcel identifier and valid coordinates", async () => {
    const load = vi.fn();
    expect(await loadSelectedParcelBoundary({ ...selection, properties: { PARCEL_NO: 1570 } }, load)).toBeNull();
    expect(await loadSelectedParcelBoundary({ ...selection, lngLat: [NaN, -34] }, load)).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });
  it("uses an exact parcel key when no LPI exists", async () => {
    const load = vi.fn().mockResolvedValue(result([{ ...feature("unused"), properties: { PRCL_KEY: "KEY-A" } }]));
    expect(await loadSelectedParcelBoundary({ ...selection, properties: { PRCL_KEY: "KEY-A" } }, load)).toEqual(geometry);
  });
  it("rejects points, malformed rings, non-finite and out-of-range geometry", () => {
    expect(hasParcelBoundary({ type: "Point", coordinates: [24, -34] })).toBe(false);
    expect(hasParcelBoundary({ type: "Polygon", coordinates: [] })).toBe(false);
    expect(hasParcelBoundary({ type: "Polygon", coordinates: [[[NaN, -34], [24, -34], [24, -34], [NaN, -34]]] })).toBe(false);
    expect(hasParcelBoundary({ type: "Polygon", coordinates: [[[240, -34], [24, -34], [24, -34], [240, -34]]] })).toBe(false);
    expect(hasParcelBoundary({ type: "MultiPolygon", coordinates: [geometry.coordinates] })).toBe(true);
  });
});
