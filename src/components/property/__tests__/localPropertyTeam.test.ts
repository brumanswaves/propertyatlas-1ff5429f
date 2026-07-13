import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("local property team", () => {
  it("appears only after the Easy Erf Report through the report wrapper", () => {
    const wrapper = read("src/components/property/ErfResearchDossierWithLocalTeam.tsx");
    const vite = read("vite.config.ts");

    expect(wrapper).toContain('props.view !== "stoep-report"');
    expect(wrapper).toContain("<BaseErfResearchDossier {...props} />");
    expect(wrapper).toContain("<LocalPropertyTeam parcel={props.parcel} />");
    expect(vite).toContain("easy-erf-local-property-team-report-wrapper");
    expect(vite).toContain('source === "./ErfResearchDossier"');
    expect(vite).toContain("OfficialParcelPanel.tsx");
  });

  it("keeps Google results honest and advertising visibly separated", () => {
    const team = read("src/components/property/dossier/LocalPropertyTeam.tsx");

    expect(team).toContain("Local Property Team");
    expect(team).toContain("Google place result");
    expect(team).toContain("not vetted, ranked, or endorsed by Easy Erf");
    expect(team).toContain("maxResultCount: 3");
    expect(team).toContain("VITE_GOOGLE_MAPS_API_KEY");
    expect(team).toContain("Place.searchByText");
    expect(team).toContain("Search Google Maps");
    expect(team).toContain("Save provider");
    expect(team).toContain("Advertising safeguard");
    expect(team).toContain("clearly marked Sponsored");
    expect(team).toContain("Easy Erf Verified");
    expect(team).not.toContain("trusted provider");
  });

  it("covers the first useful local service categories", () => {
    const team = read("src/components/property/dossier/LocalPropertyTeam.tsx");

    for (const label of [
      "Land surveyors",
      "Architects and draughtspersons",
      "Builders and contractors",
      "Insurance brokers",
      "Security companies",
      "Electricians and plumbers",
      "Internet and fibre",
      "TV and DStv installers",
      "Water and utility specialists",
      "Estate agents",
      "Conveyancers and property attorneys",
      "Inspectors and property managers",
    ]) {
      expect(team).toContain(label);
    }
  });
});
