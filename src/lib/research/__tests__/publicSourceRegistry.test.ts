import { describe, expect, it } from "vitest";

import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import {
  CSG_VIEWER_URL,
  DFFE_EGIS_URL,
  GOVZA_DEEDS_GUIDANCE_URL,
  SANBI_BGIS_URL,
} from "@/lib/external-urls";
import { REPORT_CATALOG } from "@/lib/reports/catalog";
import { buildMarketEvidenceWorkflow } from "../links";
import { buildPublicResearchSources } from "../publicSourceRegistry";
import { matchesErf962HarbourRoad } from "../seedParcels/erf962HarbourRoad";

const baseParcel: NormalizedOfficialParcel = {
  id: "csg:lpi:c01900000000007480000",
  source: "csg",
  sourceLabel: "Chief Surveyor-General",
  layer: "csg-parcels",
  erfNumber: "748",
  portion: "0",
  lpi: "C01900000000007480000",
  parcelKey: "PK-748",
  municipality: "Kouga Local Municipality",
  province: "Eastern Cape",
  suburbOrArea: "St Francis Bay",
  coordinates: { lng: 24.83, lat: -34.16 },
  knownFields: [],
  missingFields: [],
};

const erf962Parcel: NormalizedOfficialParcel = {
  ...baseParcel,
  id: "csg:lpi:c03400140000096200000",
  erfNumber: "962",
  portion: "0",
  lpi: "C03400140000096200000",
  parcelKey: "E108C034001400000962000000",
  suburbOrArea: "Santareme / St Francis Bay / Sea Vista",
  knownFields: [{ label: "Address", value: "8 Harbour Road", source: "Seed fixture" }],
};

describe("public source registry", () => {
  it("generates search urls from known parcel fields", () => {
    const sources = buildPublicResearchSources(baseParcel);
    const planning = sources.find((source) => source.id === "planning-public-notices");

    expect(planning?.status).toBe("open-search");
    expect(planning?.url).toContain("google.com/search");
    expect(decodeURIComponent(planning?.url ?? "")).toContain("Erf 748");
    expect(decodeURIComponent(planning?.url ?? "")).toContain("Kouga Local Municipality");
  });

  it("returns manual check state when required fields are missing", () => {
    const sources = buildPublicResearchSources({
      ...baseParcel,
      erfNumber: null,
      municipality: null,
    });
    const planning = sources.find((source) => source.id === "planning-public-notices");

    expect(planning?.status).toBe("manual-check");
    expect(planning?.url).toBeNull();
    expect(planning?.missingFields).toEqual(["erfNumber", "municipality"]);
  });

  it("does not attach paid provider urls or fake paid data", () => {
    const sources = buildPublicResearchSources(baseParcel);
    const paid = sources.find((source) => source.id === "paid-report-slots");

    expect(paid?.status).toBe("paid-report");
    expect(paid?.url).toBeNull();
    expect(paid?.complianceNote).toContain("not yet attached");
  });

  it("uses tested official entry URLs for key source cards", () => {
    const sources = buildPublicResearchSources(baseParcel);

    expect(sources.find((source) => source.id === "csg-property-viewer")?.url).toBe(CSG_VIEWER_URL);
    expect(sources.find((source) => source.id === "dffe-environmental-gis")?.url).toBe(
      DFFE_EGIS_URL,
    );
    expect(sources.find((source) => source.id === "sanbi-bgis")?.url).toBe(SANBI_BGIS_URL);
    expect(sources.find((source) => source.id === "govza-deeds-guidance")?.url).toBe(
      GOVZA_DEEDS_GUIDANCE_URL,
    );
  });

  it("generates unverified listing research URLs when enough fields exist", () => {
    const sources = buildPublicResearchSources(baseParcel);
    const listingIds = [
      "property24-search",
      "private-property-search",
      "google-listing-search",
      "google-images-market-evidence",
      "google-maps-listing-context",
    ];

    for (const id of listingIds) {
      const source = sources.find((item) => item.id === id);

      expect(source?.status).toBe("open-search");
      expect(source?.complianceNote.toLowerCase()).toContain("verif");
      expect(source?.userUsefulness).toBe("hidden_by_default");
    }
  });

  it("uses direct portal buttons for visible market evidence workflow", () => {
    const workflow = buildMarketEvidenceWorkflow({
      erf: "962",
      area: "Santareme",
      town: "St Francis Bay",
      province: "Eastern Cape",
    });

    expect(workflow.searchPhrase).toContain("Erf 962");
    expect(workflow.exactSearch).toContain("Erf 962");
    expect(workflow.areaSearch).toContain("St Francis Bay");
    expect(workflow.broadSearch).toContain("Cape St Francis property for sale");
    expect(workflow.portals.map((portal) => portal.href)).toEqual([
      "https://www.property24.com/",
      "https://www.privateproperty.co.za/",
      "https://www.pamgolding.co.za/",
      "https://www.seeff.com/",
      "https://www.remax.co.za/",
      "https://www.rawson.co.za/",
      "https://www.google.com/maps/search/St%20Francis%20Bay%20property%20for%20sale%20OR%20Cape%20St%20Francis%20property%20for%20sale%20OR%20Sea%20Vista%20property%20for%20sale%20OR%20Humansdorp%20property%20for%20sale",
      "https://www.google.com/search?q=St%20Francis%20Bay%20property%20for%20sale%20OR%20Cape%20St%20Francis%20property%20for%20sale%20OR%20Sea%20Vista%20property%20for%20sale%20OR%20Humansdorp%20property%20for%20sale",
    ]);
    expect(workflow.portals.some((portal) => portal.id === "google-web")).toBe(true);
  });

  it("detects Erf 962 Harbour Road and includes parcel-specific evidence", () => {
    const sources = buildPublicResearchSources(erf962Parcel);
    const valuation = sources.find((source) => source.id === "erf-962-kouga-valuation-roll-2014");

    expect(matchesErf962HarbourRoad(erf962Parcel)).toBe(true);
    expect(valuation?.parcelSpecific).toBe(true);
    expect(valuation?.confidence).toBe("confirmed_for_parcel");
    expect(valuation?.sourceQuality).toBe("direct_parcel_link");
    expect(valuation?.userUsefulness).toBe("primary");
    expect(valuation?.fieldsFound).toContain("Historic municipal value: R1,700,000");
    expect(valuation?.complianceNote).toContain("not current market value");
  });

  it("matches Erf 962 by exact LPI", () => {
    expect(
      matchesErf962HarbourRoad({
        ...baseParcel,
        erfNumber: null,
        lpi: "C03400140000096200000",
        parcelKey: null,
        suburbOrArea: null,
        knownFields: [],
      }),
    ).toBe(true);
  });

  it("matches Erf 962 by exact parcel key", () => {
    expect(
      matchesErf962HarbourRoad({
        ...baseParcel,
        erfNumber: null,
        lpi: null,
        parcelKey: "E108C034001400000962000000",
        suburbOrArea: null,
        knownFields: [],
      }),
    ).toBe(true);
  });

  it("matches Erf 962 by 8 Harbour Road text", () => {
    expect(
      matchesErf962HarbourRoad({
        ...baseParcel,
        erfNumber: null,
        lpi: null,
        parcelKey: null,
        suburbOrArea: null,
        knownFields: [{ label: "Address", value: "8 Harbour Road", source: "Test" }],
      }),
    ).toBe(true);
  });

  it("matches Erf 962 portion 0 only with supporting location context", () => {
    expect(
      matchesErf962HarbourRoad({
        ...baseParcel,
        erfNumber: "962",
        portion: "0",
        lpi: null,
        parcelKey: null,
        municipality: "Kouga Local Municipality",
        province: "Eastern Cape",
        suburbOrArea: "Santareme",
        knownFields: [],
      }),
    ).toBe(true);
  });

  it("does not match Erf 962 portion 0 without location context", () => {
    expect(
      matchesErf962HarbourRoad({
        ...baseParcel,
        erfNumber: "962",
        portion: "0",
        lpi: null,
        parcelKey: null,
        municipality: null,
        province: null,
        suburbOrArea: null,
        town: null,
        knownFields: [],
      }),
    ).toBe(false);
  });

  it("does not match another municipality/province Erf 962 portion 0", () => {
    expect(
      matchesErf962HarbourRoad({
        ...baseParcel,
        erfNumber: "962",
        portion: "0",
        lpi: null,
        parcelKey: null,
        municipality: "City of Cape Town",
        province: "Western Cape",
        suburbOrArea: "Claremont",
        town: "Cape Town",
        knownFields: [],
      }),
    ).toBe(false);
  });

  it("adds Erf 962 generated searches", () => {
    const sources = buildPublicResearchSources(erf962Parcel);
    const queries = sources
      .filter((source) => source.dossierGroup === "generated-searches")
      .map((source) => source.name);

    expect(queries).toContain(`"8 Harbour Road" "St Francis Bay"`);
    expect(queries).toContain(`"SEA VISTA" "00000962"`);
    expect(queries).toContain(`site:airbnb.com "8 Harbour Road" "Saint Francis Bay"`);
  });

  it("groups sources for the dossier library", () => {
    const sources = buildPublicResearchSources(erf962Parcel);

    expect(sources.some((source) => source.dossierGroup === "official-parcel-identity")).toBe(true);
    expect(sources.some((source) => source.dossierGroup === "municipal-evidence")).toBe(true);
    expect(sources.some((source) => source.dossierGroup === "rental-tourism")).toBe(true);
    expect(sources.some((source) => source.dossierGroup === "paid-reports")).toBe(true);
  });

  it("classifies source quality and primary usefulness for premium dossier actions", () => {
    const sources = buildPublicResearchSources(baseParcel);
    const csgViewer = sources.find((source) => source.id === "csg-property-viewer");
    const valuationRoll = sources.find((source) => source.id === "municipal-valuation-roll");
    const paidReports = sources.find((source) => source.id === "paid-report-slots");

    expect(csgViewer?.sourceQuality).toBe("official_portal");
    expect(csgViewer?.userUsefulness).toBe("primary");
    expect(csgViewer?.actionInstruction).toContain("confirm LPI");
    expect(valuationRoll?.sourceQuality).toBe("municipal_source");
    expect(valuationRoll?.userUsefulness).toBe("primary");
    expect(valuationRoll?.url).toBe("https://www.kouga.gov.za/municipalvaluationrollavail");
    expect(paidReports?.sourceQuality).toBe("paid_provider");
    expect(paidReports?.actionInstruction).toContain("verified paid report");
  });

  it("separates direct or strong sources from weak sources hidden by default", () => {
    const sources = buildPublicResearchSources(baseParcel);
    const primaryIds = sources
      .filter((source) => source.userUsefulness === "primary")
      .map((source) => source.id);
    const moreSourceIds = sources
      .filter((source) => source.userUsefulness === "hidden_by_default")
      .map((source) => source.id);

    expect(primaryIds).toContain("csg-property-viewer");
    expect(primaryIds).toContain("municipal-valuation-roll");
    expect(primaryIds).not.toContain("property24-search");
    expect(primaryIds).not.toContain("private-property-search");
    expect(moreSourceIds).toContain("opendataza-csg-listing");
    expect(moreSourceIds).toContain("google-listing-search");
  });

  it("keeps weak generated searches hidden when parcel context is too thin", () => {
    const sources = buildPublicResearchSources({
      ...baseParcel,
      erfNumber: null,
      lpi: null,
      parcelKey: null,
      municipality: null,
      province: null,
      suburbOrArea: null,
      knownFields: [],
    });
    const generatedSearches = sources.filter(
      (source) => source.dossierGroup === "generated-searches",
    );

    expect(generatedSearches.length).toBeGreaterThan(0);
    expect(generatedSearches.every((source) => source.userUsefulness === "hidden_by_default")).toBe(
      true,
    );
  });

  it("generates generic official parcel source actions without fabricating data", () => {
    const sources = buildPublicResearchSources(baseParcel);
    const sgDocuments = sources.find((source) => source.id === "sg-document-list");
    const deedsGuidance = sources.find((source) => source.id === "govza-deeds-guidance");

    expect(sgDocuments?.sourceQuality).toBe("direct_parcel_link");
    expect(sgDocuments?.actionInstruction).toContain("registration division");
    expect(deedsGuidance?.sourceQuality).toBe("official_portal");
    expect(deedsGuidance?.reveals.toLowerCase()).not.toContain("owner name");
  });

  it("keeps generic municipal valuation searches secondary when no direct municipal URL is known", () => {
    const sources = buildPublicResearchSources({
      ...baseParcel,
      municipality: "City of Cape Town",
      province: "Western Cape",
      suburbOrArea: "Claremont",
      town: "Cape Town",
    });
    const valuationRoll = sources.find((source) => source.id === "municipal-valuation-roll");

    expect(valuationRoll?.url).toContain("google.com/search");
    expect(valuationRoll?.sourceQuality).toBe("generated_search");
    expect(valuationRoll?.userUsefulness).toBe("secondary");
    expect(valuationRoll?.actionInstruction).toContain("municipal valuation source");
  });

  it("applies source link health safeguards", () => {
    const sources = buildPublicResearchSources(baseParcel);
    const actionableSources = sources.filter(
      (source) =>
        source.status !== "paid-report" &&
        source.status !== "unavailable" &&
        source.missingFields.length === 0,
    );
    const primaryUrls = sources
      .filter((source) => source.userUsefulness === "primary" && source.url)
      .map((source) => source.url);

    expect(actionableSources.every((source) => source.url && source.url !== "#")).toBe(true);
    expect(new Set(primaryUrls).size).toBe(primaryUrls.length);
    expect(
      sources.some(
        (source) =>
          source.userUsefulness === "primary" && source.url?.includes("google.com/search"),
      ),
    ).toBe(false);
    expect(
      sources.some(
        (source) =>
          source.sourceQuality === "weak_or_deprecated" &&
          source.userUsefulness !== "hidden_by_default",
      ),
    ).toBe(false);
    expect(
      sources.some(
        (source) =>
          source.sourceType === "paid-provider" &&
          source.status !== "paid-report" &&
          source.complianceNote.toLowerCase().includes("public data"),
      ),
    ).toBe(false);
  });

  it("keeps only one Lightstone and one WinDeed normal report action", () => {
    const names = REPORT_CATALOG.map((report) => report.name);

    expect(names.filter((name) => /Lightstone/i.test(name))).toEqual([
      "Lightstone Property Report",
    ]);
    expect(names.filter((name) => /WinDeed/i.test(name))).toEqual(["WinDeed Property Report"]);
    expect(names).not.toContain("Lightstone sample property report");
    expect(names).not.toContain("WinDeed Automated Valuation Report");
  });

  it("does not add Erf 962 evidence to other parcels", () => {
    const sources = buildPublicResearchSources(baseParcel);

    expect(
      sources.find((source) => source.id === "erf-962-kouga-valuation-roll-2014"),
    ).toBeUndefined();
  });

  it("does not fabricate owner names or current valuation fields", () => {
    const sources = buildPublicResearchSources(erf962Parcel);
    const foundFields = sources.flatMap((source) => source.fieldsFound ?? []);

    expect(foundFields.some((field) => /owner/i.test(field))).toBe(false);
    expect(foundFields.some((field) => /current (market )?value/i.test(field))).toBe(false);
  });
});
