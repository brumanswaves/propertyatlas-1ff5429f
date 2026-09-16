import { afterEach, expect, it, vi } from "vitest";
import { readPropertyJourneyLocation, writePropertyJourneyLocation } from "../propertyJourneyHistory";

afterEach(() => vi.unstubAllGlobals());
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
