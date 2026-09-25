import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertSharedGeometryReadback,
  exactGeometryQuery,
  recoverSharedParcelGeometry,
  validateRecoveredGeometry,
} from "../sharedParcelGeometry";
import { isValidParcelRing } from "@/lib/sitePotential/parcelRing";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import type { PublicDataResult } from "@/lib/providers/publicDataClient";
import type { OrderInvestigation } from "../sharedInvestigation";

const id = "csg:lpi:c00000000000990100000";
const parcel: NormalizedOfficialParcel = {
  id,
  source: "manual",
  sourceLabel: "Saved",
  knownFields: [],
  missingFields: [],
};
const ring: Array<[number, number]> = [
  [24, -34],
  [24.001, -34],
  [24.001, -34.001],
  [24, -34.001],
  [24, -34],
];
const result: PublicDataResult = {
  type: "FeatureCollection",
  layer: "csg-parcels",
  official: true,
  sourceLabel: "Synthetic public source",
  fallbackUsed: "direct",
  fetchedAt: "2026-09-25",
  attempts: [],
  features: [
    {
      type: "Feature",
      properties: { ID: id.slice(8).toUpperCase() },
      geometry: { type: "Polygon", coordinates: [ring] },
    },
  ],
};
afterEach(() => vi.unstubAllGlobals());
describe("shared exact public geometry", () => {
  it("queries only exact LPI or parcel key, never broad erf", () => {
    expect(exactGeometryQuery(id)).toEqual({ lpi: "C00000000000990100000", limit: 2 });
    expect(exactGeometryQuery("csg:parcel-key:abc")).toEqual({ parcelKey: "ABC", limit: 2 });
    expect(exactGeometryQuery("csg:erf:ec:kouga:9901:0")).toBeNull();
  });
  it("retains canonical identity and extracts the public polygon", () => {
    expect(validateRecoveredGeometry(parcel, result)).toMatchObject({
      parcelRing: ring,
      normalizedParcel: { id, source: "csg", lpi: id.slice(8) },
    });
  });
  it.each(["wrong", "ambiguous", "malformed", "unofficial"])(
    "rejects %s without a candidate",
    (kind) => {
      const data = structuredClone(result);
      if (kind === "wrong") data.features[0].properties = { ID: "WRONG" };
      if (kind === "ambiguous") data.features.push(data.features[0]);
      if (kind === "malformed")
        data.features[0].geometry = {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [1, 1],
              [2, 2],
              [0, 0],
            ],
          ],
        };
      if (kind === "unofficial") data.official = false;
      expect(validateRecoveredGeometry(parcel, data)).toBeNull();
    },
  );
  it.each([
    null,
    [],
    [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
    [
      [0, 0],
      [1, 0],
      [181, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [0, NaN],
    ],
    [[0, 0], null, [1, 1]],
  ])("rejects invalid saved ring %j", (value) => expect(isValidParcelRing(value)).toBe(false));
  it("uses one GET and passes cancellation through the existing public source", async () => {
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(result)));
    vi.stubGlobal("fetch", fetcher);
    const abort = new AbortController();
    expect(await recoverSharedParcelGeometry(parcel, abort.signal)).not.toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(new URL(url).searchParams.get("where")).toBe("ID='C00000000000990100000'");
    expect(init.method).toBeUndefined();
    abort.abort();
    expect(init.signal.aborted).toBe(true);
  });
  it("does not retry a public failure", async () => {
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    const fetcher = vi.fn().mockRejectedValue(new Error("unavailable"));
    vi.stubGlobal("fetch", fetcher);
    expect(await recoverSharedParcelGeometry(parcel, new AbortController().signal)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("ignores a response arriving after cancellation", async () => {
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    const abort = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        abort.abort();
        return new Response(JSON.stringify(result));
      }),
    );
    expect(await recoverSharedParcelGeometry(parcel, abort.signal)).toBeNull();
  });
  it("requires persisted ring, identity, scope and advanced revision on readback", () => {
    const geometry = validateRecoveredGeometry(parcel, result)!;
    const before = {
      orderId: "order-a",
      customerId: "customer-a",
      parcelId: id,
      revision: 7,
    } as OrderInvestigation;
    const after = { ...before, revision: 8, userData: geometry } as unknown as OrderInvestigation;
    expect(() => assertSharedGeometryReadback(before, after, geometry)).not.toThrow();
    for (const patch of [
      { orderId: "order-b" },
      { customerId: "customer-b" },
      { parcelId: "other" },
      { revision: 7 },
      { userData: {} },
    ]) {
      expect(() =>
        assertSharedGeometryReadback(before, { ...after, ...patch }, geometry),
      ).toThrow();
    }
  });
});
