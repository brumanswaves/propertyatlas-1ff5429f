import { describe, expect, it } from "vitest";
import type { Feature, Polygon } from "geojson";
import {
  SA_DEEDS_OFFICES,
  suggestedDeedsOfficeForProvince,
} from "@/lib/search/deedsOfficeRegistry";
import { buildOfficialParcelIndex } from "@/lib/search/officialParcelIndex";
import { deriveErfSearchContext } from "@/lib/search/erfSearchContext";

const seaVistaFeature: Feature<Polygon> = {
  type: "Feature",
  properties: {
    PARCEL_NO: "962",
    PORTION: "0",
    ID: "C03400140000096200000",
    MIN_REGION: "Sea Vista",
    MAJ_REGION: "St Francis Bay",
    MUNICIPALITY: "Kouga",
    PROVINCE: "Eastern Cape",
  },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [24.8308, -34.1722],
        [24.8322, -34.1722],
        [24.8322, -34.1712],
        [24.8308, -34.1712],
        [24.8308, -34.1722],
      ],
    ],
  },
};

describe("deeds office registry", () => {
  it("contains the standard South African deeds registries as selectable labels", () => {
    expect(SA_DEEDS_OFFICES).toHaveLength(11);
    expect(SA_DEEDS_OFFICES.map((office) => office.label)).toEqual(
      expect.arrayContaining([
        "Bloemfontein",
        "Cape Town",
        "Johannesburg",
        "King William's Town",
        "Mthatha",
        "Pretoria",
      ]),
    );
  });

  it("only suggests a deeds office from broad province context", () => {
    expect(suggestedDeedsOfficeForProvince("Eastern Cape")).toBe("King William's Town");
    expect(suggestedDeedsOfficeForProvince(undefined)).toBeUndefined();
  });
});

describe("erf search context", () => {
  it("derives township, municipality, province and loaded-area terms from official parcels", () => {
    const parcels = buildOfficialParcelIndex([{ layer: "csg-parcels", feature: seaVistaFeature }]);
    const context = deriveErfSearchContext(parcels);

    expect(context.suggestedTownship).toBe("Sea Vista");
    expect(context.suggestedDeedsOffice).toBe("King William's Town");
    expect(context.currentAreaLabel).toContain("Sea Vista");
    expect(context.townshipOptions).toContain("Sea Vista");
    expect(context.municipalityOptions).toContain("Kouga");
    expect(context.loadedAreaTerms).toEqual(expect.arrayContaining(["sea", "vista", "kouga"]));
  });
});
