import { describe, expect, it } from "vitest";

import { BRAND, SITE_URL } from "../brand";

describe("Easy Erf customer domain", () => {
  it("keeps the canonical customer URL on easyerf.co.za", () => {
    expect(SITE_URL).toBe("https://easyerf.co.za");
    expect(BRAND.url).toBe("https://easyerf.co.za");
  });
});
