import { afterEach, expect, it, vi } from "vitest";
import { readPropertyJourneyLocation, writePropertyJourneyLocation } from "../propertyJourneyHistory";
import { buildSelectedOfficialParcelId } from "@/lib/parcels/officialParcelId";

afterEach(() => vi.unstubAllGlobals());
it("uses the canonical selected parcel identity for First Read, with distinct CSG, municipal and point fallbacks", () => {
  const selection = { layer: "csg-parcels", properties: { ID: "LPI-A", PRCL_KEY: "key-A" }, lngLat: [24, -34] as [number, number] };
  expect(buildSelectedOfficialParcelId(selection)).toBe("csg:lpi:lpi-a");
  expect(buildSelectedOfficialParcelId({ ...selection, properties: { PRCL_KEY: "key-B" } })).toBe("csg:parcel-key:key-b");
  expect(buildSelectedOfficialParcelId({ ...selection, properties: { PARCEL_NO: 42, PORTION: 0, MUNIC_NAME: "Kouga" } })).toBe("csg:erf:eastern-cape:kouga:42:0");
  expect(buildSelectedOfficialParcelId({ ...selection, layer: "kouga-zoning", properties: { ObjectID: 17 } })).toBe("kouga:kouga-zoning:17");
  expect(buildSelectedOfficialParcelId({ ...selection, properties: {} })).toBe("official:point:24.000000:-34.000000");
});
it("keeps map and step entries without replacing router state or exposing another account's journey", () => {
  const entries: Array<Record<string, unknown>> = [{ routerKey: "existing" }];
  const history = {
    get state() { return entries.at(-1); },
    replaceState(value: Record<string, unknown>) { entries[entries.length - 1] = value; },
    pushState(value: Record<string, unknown>) { entries.push(value); },
  };
  vi.stubGlobal("window", { history });
  const first = { userId: "A", parcelId: "parcel", selection: null, tab: "investigation", stepId: "zoning" };
  writePropertyJourneyLocation(first);
  expect(entries).toHaveLength(2);
  expect(entries[0]).toMatchObject({ routerKey: "existing", easyErfJourney: { parcelId: null } });
  writePropertyJourneyLocation(first);
  expect(entries).toHaveLength(2);
  writePropertyJourneyLocation({ ...first, tab: "calculators", stepId: "strategy", guidedReturnStepId: "strategy" });
  expect(readPropertyJourneyLocation("A")).toMatchObject({ tab: "calculators", guidedReturnStepId: "strategy" });
  expect(readPropertyJourneyLocation("B")).toBeNull();
  expect(history.state?.routerKey).toBe("existing");
});
