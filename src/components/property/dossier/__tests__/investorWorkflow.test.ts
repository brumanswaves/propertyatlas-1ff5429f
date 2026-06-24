import { describe, expect, it } from "vitest";

import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { buildPublicResearchSources } from "@/lib/research/publicSourceRegistry";
import { buildDueDiligenceProgress, buildNextBestStep } from "../investorWorkflow";

const baseParcel: NormalizedOfficialParcel = {
  id: "csg:lpi:c03400140000096200000",
  source: "csg",
  sourceLabel: "Chief Surveyor-General",
  layer: "csg-parcels",
  erfNumber: "962",
  portion: "0",
  lpi: "C03400140000096200000",
  parcelKey: "E108C034001400000962000000",
  municipality: "Kouga Local Municipality",
  province: "Eastern Cape",
  suburbOrArea: "St Francis Bay",
  coordinates: { lng: 24.83, lat: -34.16 },
  knownFields: [],
  missingFields: ["Ownership", "Valuation", "Transfers", "Rates and taxes"],
};

describe("investor dossier workflow", () => {
  it("recommends official CSG verification as the first next best step", () => {
    const sources = buildPublicResearchSources(baseParcel);
    const step = buildNextBestStep(baseParcel, sources);

    expect(step.title).toContain("official CSG parcel record");
    expect(step.primaryLabel).toBe("Open CSG Property Viewer");
    expect(step.primaryUrl).toContain("experiencebuilder");
    expect(step.secondaryView).toBe("research");
  });

  it("advances after the CSG source is completed in session state", () => {
    const sources = buildPublicResearchSources(baseParcel);
    const step = buildNextBestStep(baseParcel, sources, new Set(["csg-property-viewer"]));

    expect(step.primaryLabel).not.toBe("Open CSG Property Viewer");
    expect(step.title).not.toContain("official CSG parcel record");
  });

  it("marks unavailable investor diligence data honestly", () => {
    const sources = buildPublicResearchSources(baseParcel);
    const stages = buildDueDiligenceProgress(baseParcel, sources);
    const ownership = stages.find((stage) => stage.id === "ownership");
    const sales = stages.find((stage) => stage.id === "sales-history");
    const income = stages.find((stage) => stage.id === "income");

    expect(ownership?.status).toBe("Professional source required");
    expect(sales?.status).toBe("Professional source required");
    expect(income?.status).toBe("Estimate only");
  });

  it("uses source-link states for valuation, risk, and deal-flow research", () => {
    const sources = buildPublicResearchSources(baseParcel);
    const stages = buildDueDiligenceProgress(baseParcel, sources);
    const valuation = stages.find((stage) => stage.id === "valuation");
    const risk = stages.find((stage) => stage.id === "risk");
    const dealFlow = stages.find((stage) => stage.id === "deal-flow");

    expect(valuation?.status).toBe("Source link available");
    expect(risk?.status).toBe("Source link available");
    expect(dealFlow?.status).toBe("Source link available");
  });
});
