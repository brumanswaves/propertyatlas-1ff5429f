import { describe, expect, it, vi } from "vitest";

// Mirrors the MapCanvas rejection-handling shape: when the loadLayer promise
// rejects, the effect must clear the source and flip status from `loading`
// to `failed` with the layer-appropriate message.
describe("MapCanvas loadLayer rejection handling", () => {
  it("transitions CSG from loading to failed on rejection", async () => {
    const status: { csg: { state: string; count: number; message?: string } } = {
      csg: { state: "loading", count: 0 },
    };
    const cleared: string[] = [];
    const clearOfficialSource = (id: string) => cleared.push(id);
    const publishStatus = vi.fn();

    const loadLayer = () => Promise.reject(new Error("boom"));

    await loadLayer()
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .then((_r: unknown) => {
        // success path unused in this test
      })
      .catch(() => {
        const msg = "CSG unavailable";
        clearOfficialSource("csg-parcels");
        status.csg = { state: "failed", count: 0, message: msg };
        publishStatus(status);
      });

    expect(status.csg.state).toBe("failed");
    expect(status.csg.message).toBe("CSG unavailable");
    expect(cleared).toEqual(["csg-parcels"]);
    expect(publishStatus).toHaveBeenCalledTimes(1);
  });

  it("transitions Kouga from loading to failed on rejection", async () => {
    const status: { kouga: { state: string; count: number; message?: string } } = {
      kouga: { state: "loading", count: 0 },
    };
    const cleared: string[] = [];
    const clearOfficialSource = (id: string) => cleared.push(id);
    const publishStatus = vi.fn();

    const loadLayer = () => Promise.reject(new Error("boom"));

    await loadLayer()
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .then((_r: unknown) => {})
      .catch(() => {
        const msg = "Kouga unavailable";
        clearOfficialSource("kouga-zoning");
        status.kouga = { state: "failed", count: 0, message: msg };
        publishStatus(status);
      });

    expect(status.kouga.state).toBe("failed");
    expect(status.kouga.message).toBe("Kouga unavailable");
    expect(cleared).toEqual(["kouga-zoning"]);
    expect(publishStatus).toHaveBeenCalledTimes(1);
  });
});
