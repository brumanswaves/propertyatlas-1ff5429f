import { describe, expect, it, vi } from "vitest";

import {
  NO_PAID_DESIGN_PACK_ID,
  pinLatestPaidDesignPackRequest,
} from "../../../../supabase/functions/site-potential-api/latestPaidPack";

describe("latest paid Site Potential pack routing", () => {
  it("pins an implicit latest pack-status request to the latest paid pack", async () => {
    const resolve = vi.fn(async () => "paid-pack-1");
    const request = new Request(
      "https://easyerf.supabase.co/functions/v1/site-potential-api/pack-status?parcelId=parcel-1&siteProjectId=project-1",
      { headers: { Authorization: "Bearer test-token" } },
    );

    const routed = await pinLatestPaidDesignPackRequest(request, resolve);
    const url = new URL(routed.url);

    expect(resolve).toHaveBeenCalledWith("parcel-1", "project-1");
    expect(url.searchParams.get("designPackId")).toBe("paid-pack-1");
    expect(routed.headers.get("Authorization")).toBe("Bearer test-token");
  });

  it("preserves an explicitly requested pack without consulting latest-pack selection", async () => {
    const resolve = vi.fn(async () => "paid-pack-2");
    const request = new Request(
      "https://easyerf.supabase.co/functions/v1/site-potential-api/pack-status?parcelId=parcel-1&siteProjectId=project-1&designPackId=explicit-pack",
    );

    const routed = await pinLatestPaidDesignPackRequest(request, resolve);

    expect(resolve).not.toHaveBeenCalled();
    expect(new URL(routed.url).searchParams.get("designPackId")).toBe("explicit-pack");
  });

  it("pins to a non-existent sentinel when no paid pack exists so refunded packs cannot become latest", async () => {
    const request = new Request(
      "https://easyerf.supabase.co/functions/v1/site-potential-api/pack-status?parcelId=parcel-1&siteProjectId=project-1",
    );

    const routed = await pinLatestPaidDesignPackRequest(request, async () => null);

    expect(new URL(routed.url).searchParams.get("designPackId")).toBe(NO_PAID_DESIGN_PACK_ID);
  });
});
