import { describe, expect, it } from "vitest";

import {
  buildSavedParcelMapSearch,
  buildOfficialParcelId,
  clearSavedOfficialReopenSearch,
  isDemoParcelId,
  isOfficialParcelId,
  normalizeParcelIdPart,
  officialFeatureMatchesSavedParcelId,
  parseOfficialParcelReopenSearch,
  parseOfficialParcelSearch,
  shouldShowOfficialParcelReopenFallback,
} from "../officialParcelId";

describe("official parcel ids", () => {
  it("keeps existing demo parcel ids unchanged", () => {
    expect(buildOfficialParcelId({ source: "demo", demoId: "parcel-123" })).toBe("parcel-123");
    expect(isDemoParcelId("parcel-123")).toBe(true);
    expect(isOfficialParcelId("parcel-123")).toBe(false);
  });

  it("uses CSG id priority before display-like fields", () => {
    expect(
      buildOfficialParcelId({
        source: "csg",
        lpi: "C01900000000007480000",
        parcelKey: "PK-1",
        erfNumber: "748",
        portion: 0,
        municipality: "Kouga Local Municipality",
        province: "Eastern Cape",
      }),
    ).toBe("csg:lpi:c01900000000007480000");

    expect(
      buildOfficialParcelId({
        source: "csg",
        parcelKey: "PK 1/2",
        erfNumber: "748",
        portion: 0,
        municipality: "Kouga Local Municipality",
        province: "Eastern Cape",
      }),
    ).toBe("csg:parcel-key:pk-1-2");
  });

  it("uses erf identity only when the full erf context is present", () => {
    expect(
      buildOfficialParcelId({
        source: "csg",
        erfNumber: "748",
        portion: 0,
        municipality: "Kouga Local Municipality",
        province: "Eastern Cape",
      }),
    ).toBe("csg:erf:eastern-cape:kouga-local-municipality:748:0");
  });

  it("uses Kouga layer and object id for zoning-only features", () => {
    expect(buildOfficialParcelId({ source: "kouga", layer: "kouga-zoning", objectId: 42 })).toBe(
      "kouga:kouga-zoning:42",
    );
  });

  it("falls back to rounded coordinates only as a last resort", () => {
    expect(buildOfficialParcelId({ source: "csg", lng: 24.8301234, lat: -34.1689876 })).toBe(
      "official:point:24.830123:-34.168988",
    );
  });

  it("normalizes url-safe parts deterministically", () => {
    expect(normalizeParcelIdPart(" Kouga Local Municipality / Ward 1 ")).toBe(
      "kouga-local-municipality-ward-1",
    );
  });

  it("keeps demo saved parcel reopen URLs on the parcel query param", () => {
    expect(buildSavedParcelMapSearch("parcel-123")).toEqual({ parcel: "parcel-123" });
  });

  it("uses the officialParcel query param for saved official dossiers", () => {
    expect(buildSavedParcelMapSearch("csg:lpi:c03400140000096200000")).toEqual({
      officialParcel: "csg:lpi:c03400140000096200000",
      fromSaved: "1",
    });
  });

  it("adds saved official parcel location and identity hints when available", () => {
    expect(
      buildSavedParcelMapSearch("csg:lpi:c03400140000096200000", {
        title: "Erf 962 Harbour Road",
        erf: 962,
        portion: 0,
        municipality: "Kouga",
        province: "Eastern Cape",
        lng: "24.830123",
        lat: "-34.168988",
        zoom: 18,
      }),
    ).toEqual({
      officialParcel: "csg:lpi:c03400140000096200000",
      fromSaved: "1",
      title: "Erf 962 Harbour Road",
      erf: "962",
      portion: "0",
      municipality: "Kouga",
      province: "Eastern Cape",
      lng: "24.830123",
      lat: "-34.168988",
      zoom: "18",
    });
  });

  it("does not add invalid official parcel coordinates", () => {
    expect(
      buildSavedParcelMapSearch("csg:lpi:c03400140000096200000", {
        lng: "999",
        lat: "-34.168988",
      }),
    ).toEqual({
      officialParcel: "csg:lpi:c03400140000096200000",
      fromSaved: "1",
    });
  });

  it("parses official parcel reopen query params only for official ids", () => {
    expect(parseOfficialParcelSearch("?officialParcel=csg:lpi:c03400140000096200000")).toBe(
      "csg:lpi:c03400140000096200000",
    );
    expect(parseOfficialParcelSearch("?officialParcel=parcel-123")).toBeNull();
  });

  it("parses saved official parcel reopen metadata", () => {
    expect(
      parseOfficialParcelReopenSearch(
        "?officialParcel=csg:lpi:c03400140000096200000&fromSaved=1&title=Erf+962&erf=962&portion=0&municipality=Kouga&province=Eastern+Cape&lng=24.830123&lat=-34.168988&zoom=18",
      ),
    ).toEqual({
      id: "csg:lpi:c03400140000096200000",
      fromSaved: true,
      title: "Erf 962",
      erf: "962",
      portion: "0",
      municipality: "Kouga",
      province: "Eastern Cape",
      lng: 24.830123,
      lat: -34.168988,
      zoom: 18,
    });
  });

  it("does not treat stale officialParcel params as saved reopen intent", () => {
    expect(
      parseOfficialParcelReopenSearch("?officialParcel=csg:lpi:c03400140000096200000"),
    ).toBeNull();
    expect(
      shouldShowOfficialParcelReopenFallback(
        "?officialParcel=csg:parcel-key:e108c034001400000962000000",
        false,
      ),
    ).toBe(false);
  });

  it("clears saved official reopen URL state without dropping unrelated params", () => {
    expect(
      clearSavedOfficialReopenSearch(
        "?officialParcel=csg:lpi:c03400140000096200000&fromSaved=1&lat=-34.1&lng=24.8&zoom=17&title=Erf+962&erf=962&portion=0&municipality=Kouga&province=Eastern+Cape&theme=dark",
      ),
    ).toBe("?theme=dark");
  });

  it("shows unresolved official reopen fallback without fabricating a selection", () => {
    expect(
      shouldShowOfficialParcelReopenFallback(
        "?officialParcel=csg:parcel-key:e108c034001400000962000000&fromSaved=1",
        false,
      ),
    ).toBe(true);
    expect(
      shouldShowOfficialParcelReopenFallback(
        "?officialParcel=csg:parcel-key:e108c034001400000962000000&fromSaved=1",
        true,
      ),
    ).toBe(false);
  });

  it("matches rendered CSG features by exact LPI for saved official reopen", () => {
    expect(
      officialFeatureMatchesSavedParcelId("csg:lpi:c03400140000096200000", "csg-parcels", {
        id: "C03400140000096200000",
        prcl_key: "E108C034001400000962000000",
        PARCEL_NO: "962",
        PORTION: "0",
      }),
    ).toBe(true);
  });

  it("matches rendered CSG features by exact parcel key for saved official reopen", () => {
    expect(
      officialFeatureMatchesSavedParcelId(
        "csg:parcel-key:e108c034001400000962000000",
        "csg-parcels",
        {
          ID: "C03400140000096200000",
          PRCL_KEY: "E108C034001400000962000000",
          PARCEL_NO: "962",
          PORTION: "0",
        },
      ),
    ).toBe(true);
  });

  it("matches rendered CSG erf ids only when location context also matches", () => {
    expect(
      officialFeatureMatchesSavedParcelId(
        "csg:erf:eastern-cape:kouga-local-municipality:962:0",
        "csg-parcels",
        {
          PARCEL_NO: "962",
          PORTION: "0",
          PROVINCE: "Eastern Cape",
          MUNICIPALITY: "Kouga Local Municipality",
        },
      ),
    ).toBe(true);

    expect(
      officialFeatureMatchesSavedParcelId(
        "csg:erf:eastern-cape:kouga-local-municipality:962:0",
        "csg-parcels",
        {
          PARCEL_NO: "962",
          PORTION: "0",
          PROVINCE: "Western Cape",
          MUNICIPALITY: "City of Cape Town",
        },
      ),
    ).toBe(false);
  });

  it("matches rendered Kouga zoning features by layer and object id", () => {
    expect(
      officialFeatureMatchesSavedParcelId("kouga:kouga-zoning:42", "kouga-zoning", {
        objectid: 42,
      }),
    ).toBe(true);
  });

  it("does not match point fallback ids without a real rendered-feature query", () => {
    expect(
      officialFeatureMatchesSavedParcelId("official:point:24.830123:-34.168988", "csg-parcels", {
        ID: "C03400140000096200000",
      }),
    ).toBe(false);
  });
});
