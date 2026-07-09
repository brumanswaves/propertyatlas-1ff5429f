import { describe, expect, it } from "vitest";
import { buildPublicParcelIdentityWhere } from "../publicDataClient";

describe("publicDataClient identity search", () => {
  it("builds a broad official CSG erf lookup that is not tied to loaded map viewport", () => {
    const where = buildPublicParcelIdentityWhere({
      erfNumber: "1021",
      portion: "0",
      areaText: "Sea Vista",
      limit: 25,
    });

    expect(where).toContain("(PARCEL_NO=1021 OR TAG_VALUE='1021')");
    expect(where).toContain("(PORTION=0 OR PORTION='0')");
    expect(where).not.toMatch(/Sea Vista|MIN_REGION|MAJ_REGION|viewport/i);
  });

  it("supports exact LPI and parcel key lookups without fabricating geometry", () => {
    expect(
      buildPublicParcelIdentityWhere({
        lpi: "C03400140000102100000",
        parcelKey: "E108C034001400001021000000",
      }),
    ).toBe("ID='C03400140000102100000' AND PRCL_KEY='E108C034001400001021000000'");
  });
});
