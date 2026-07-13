import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calculateMarketEvidenceSummary } from "@/features/marketEvidence/calculateMarketEvidenceSummary";
import type { SavedMarketEvidence } from "@/features/marketEvidence/types";
import { handleListingImportRequest } from "@/routes/api/listings.import";
import { importListing } from "../importListing";
import { extractProperty24ListingId } from "../providers/property24";
import { isBlockedHost } from "../security";
import { canonicaliseListingUrl, detectListingPortal, validateImportUrl } from "../url";

const fixture = readFileSync(
  "src/lib/listingImport/__fixtures__/property24-basic.html",
  "utf8",
);

function htmlFetch(html = fixture, init?: { status?: number; headers?: HeadersInit }): typeof fetch {
  return async () =>
    new Response(html, {
      status: init?.status ?? 200,
      headers: init?.headers ?? { "content-type": "text/html; charset=utf-8" },
    });
}

const fixedNow = () => new Date("2026-07-01T10:00:00.000Z");

const realProperty24Shape = `
<!doctype html>
<html>
  <head>
    <title>3 Bedroom House for Sale in St Francis Bay Village</title>
    <meta property="og:title" content="3 Bedroom House for Sale in St Francis Bay Village" />
    <meta property="og:description" content="New release! BEACH VILLAGE - looking for something different." />
    <meta property="og:image" content="https://images.property24.com/example/117377049.jpg" />
  </head>
  <body>
    <main>
      <h1>3 Bedroom House for Sale in St Francis Bay Village</h1>
      <nav>Property for Sale &gt; Eastern Cape &gt; St Francis Bay &gt; St Francis Bay Village &gt; 117377049</nav>
      <section>
        <p>Three bedrooms all en-suite and guest toilet, open plan studio type living area.</p>
      </section>
      <section>
        Property Overview
        Listing Number 117377049
        Type of Property House
        Description Freestanding
        Lifestyle Coastal/Beach
        Listing Date 03 July 2026
        Erf Size 1&nbsp;007 m&#xB2;
        Rates and Taxes R 2 308
        Pets Allowed Yes
        Rooms Bedrooms 3 Bathrooms 3.5 Kitchens 1
        External Features Parking 2 Garden Yes Pool Yes
      </section>
      <section>
        By continuing I understand and agree with Property24's Terms & Conditions and Privacy Policy.
        Paul Davis Show Contact Number WhatsApp Agent
        RE/MAX On Sea - St Francis Bay Paul Davis Show Contact Number WhatsApp Agent
      </section>
    </main>
  </body>
</html>`;

describe("listing import URL and security", () => {
  it("accepts and canonicalises Property24 URLs", () => {
    const url = validateImportUrl(
      "https://www.property24.com/for-sale/cape-st-francis/eastern-cape/123/115555555?utm_source=x#gallery",
    );

    expect(detectListingPortal(url)).toBe("property24");
    expect(canonicaliseListingUrl(url)).toBe(
      "https://www.property24.com/for-sale/cape-st-francis/eastern-cape/123/115555555",
    );
  });

  it("rejects unsupported and unsafe URLs", () => {
    expect(() => detectListingPortal(new URL("https://example.com/listing"))).toThrow(
      /Property24 URLs/,
    );
    expect(() => validateImportUrl("file:///etc/passwd")).toThrow(/http/);
    expect(() => validateImportUrl("ftp://property24.com/listing")).toThrow(/http/);
    expect(() => validateImportUrl("http://localhost/listing")).toThrow(/not allowed/);
    expect(() => validateImportUrl("http://127.0.0.1/listing")).toThrow(/not allowed/);
    expect(() => validateImportUrl("http://192.168.1.1/listing")).toThrow(/not allowed/);
    expect(isBlockedHost("10.0.0.5")).toBe(true);
    expect(isBlockedHost("www.property24.com")).toBe(false);
  });

  it("extracts Property24 listing ids from URL or HTML", () => {
    expect(
      extractProperty24ListingId(
        new URL("https://www.property24.com/for-sale/cape-st-francis/eastern-cape/123/115555555"),
      ),
    ).toBe("115555555");
    expect(
      extractProperty24ListingId(new URL("https://www.property24.com/listing"), fixture),
    ).toBe("115555555");
  });
});

describe("Property24 import pipeline", () => {
  it("returns a typed listing review object from deterministic fixture extraction", async () => {
    const result = await importListing(
      {
        url: "https://www.property24.com/for-sale/cape-st-francis/eastern-cape/123/115555555",
        selectedParcelId: "csg:erf:eastern-cape:kouga:1021:0",
      },
      { fetcher: htmlFetch(), now: fixedNow },
    );

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.error.message);

    const listing = result.listing;
    expect(listing.source.portal).toBe("Property24");
    expect(listing.source.listingId).toBe("115555555");
    expect(listing.source.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(listing.property.askingPrice).toBe(5_495_000);
    expect(listing.property.bedrooms).toBe(4);
    expect(listing.property.bathrooms).toBe(3.5);
    expect(listing.property.garages).toBe(2);
    expect(listing.property.parkingSpaces).toBe(3);
    expect(listing.property.erfSizeM2).toBe(1042);
    expect(listing.property.floorSizeM2).toBe(310);
    expect(listing.property.ratesMonthly).toBe(2450);
    expect(listing.property.leviesMonthly).toBe(850);
    expect(listing.property.streetAddress).toBeNull();
    expect(listing.property.erfNumber).toBeNull();
    expect(listing.property.suburb).toBe("Cape St Francis");
    expect(listing.property.province).toBe("Eastern Cape");
    expect(listing.listing.description).toContain("Spacious coastal home");
    expect(listing.listing.features).toContain("Sea views");
    expect(listing.listing.imageUrls.length).toBeGreaterThan(0);
    expect(listing.evidence.some((item) => item.field === "property.askingPrice")).toBe(true);
    expect(listing.evidence.some((item) => item.field === "property.erfSizeM2")).toBe(true);
    expect(listing.warnings.join(" ")).toContain("No street address");
    expect(listing.warnings.join(" ")).toContain("No erf number");
    expect(listing.match.status).toBe("unmatched");
    expect(listing.match.reasons?.join(" ")).toContain("suburb or town alone is not enough");
    expect(listing.importStatus).toBe("needs_verification");
  });

  it("keeps missing fields null instead of inventing address or erf number", async () => {
    const result = await importListing(
      { url: "https://www.property24.com/for-sale/cape-st-francis/eastern-cape/123/115555555" },
      { fetcher: htmlFetch(), now: fixedNow },
    );

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.error.message);
    expect(result.listing.property.streetAddress).toBeNull();
    expect(result.listing.property.erfNumber).toBeNull();
    expect(result.listing.property.floorSizeM2).not.toBe(result.listing.property.erfSizeM2);
  });

  it("returns typed errors for unsupported URLs and fetch failures", async () => {
    const unsupported = await importListing(
      { url: "https://privateproperty.co.za/listing/123" },
      { fetcher: htmlFetch(), now: fixedNow },
    );
    const failed = await importListing(
      { url: "https://www.property24.com/for-sale/cape-st-francis/eastern-cape/123/115555555" },
      {
        fetcher: (async () => new Response("not found", { status: 404, headers: { "content-type": "text/html" } })) as typeof fetch,
        now: fixedNow,
      },
    );

    expect(unsupported.success).toBe(false);
    if (!unsupported.success) expect(unsupported.error.code).toBe("UNSUPPORTED_URL");
    expect(failed.success).toBe(false);
    if (!failed.success) expect(failed.error.code).toBe("FETCH_FAILED");
  });

  it("does not update Market Thesis before imported listing is saved as evidence", async () => {
    const result = await importListing(
      { url: "https://www.property24.com/for-sale/cape-st-francis/eastern-cape/123/115555555" },
      { fetcher: htmlFetch(), now: fixedNow },
    );
    expect(result.success).toBe(true);

    expect(calculateMarketEvidenceSummary([]).includedEvidence).toBe(0);

    const saved: SavedMarketEvidence = {
      id: "saved",
      parcelId: "parcel",
      sourceUrl: result.success ? result.listing.source.url : "",
      sourcePortal: "Property24",
      title: "Imported comp",
      askingPrice: result.success ? result.listing.property.askingPrice : null,
      propertyType: "House",
      beds: 4,
      baths: 3.5,
      landSizeM2: 1042,
      buildingSizeM2: 310,
      relationship: "same_suburb_comp",
      confidence: "medium",
      includeInSummary: true,
      savedAt: "2026-07-01T10:00:00.000Z",
      updatedAt: "2026-07-01T10:00:00.000Z",
    };

    const summary = calculateMarketEvidenceSummary([saved]);
    expect(summary.includedEvidence).toBe(1);
    expect(summary.averageLandPricePerM2).toBe(5274);
  });

  it("keeps live Property24-style labels bounded and preserves the submitted URL", async () => {
    const submittedUrl =
      "https://www.property24.com/for-sale/st-francis-bay-village/st-francis-bay/eastern-cape/18330/117377049?plId=2511177&plt=2";
    const result = await importListing(
      { url: submittedUrl, selectedParcelId: "csg:erf:eastern-cape:kouga:1021:0" },
      { fetcher: htmlFetch(realProperty24Shape), now: fixedNow },
    );

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.error.message);

    expect(result.listing.source.url).toBe(submittedUrl);
    expect(result.listing.source.listingId).toBe("117377049");
    expect(result.listing.property.askingPrice).toBeNull();
    expect(result.listing.property.erfSizeM2).toBe(1007);
    expect(result.listing.property.floorSizeM2).toBeNull();
    expect(result.listing.property.parkingSpaces).toBe(2);
    expect(result.listing.property.garages).toBeNull();
    expect(result.listing.property.suburb).toBe("St Francis Bay Village");
    expect(result.listing.property.town).toBe("St Francis Bay");
    expect(result.listing.property.province).toBe("Eastern Cape");
    expect(result.listing.property.streetAddress).toBeNull();
    expect(result.listing.property.erfNumber).toBeNull();
    expect(result.listing.listing.listingDate).toBe("03 July 2026");
    expect(result.listing.property.occupationDate).toBeNull();
    expect(result.listing.agent.name).toBe("Paul Davis");
    expect(result.listing.agent.agency).toBe("RE/MAX On Sea - St Francis Bay");
    expect(result.listing.match.status).toBe("unmatched");
    expect(result.listing.match.reasons?.join(" ")).toContain("suburb or town alone is not enough");
    expect(result.listing.evidence.find((item) => item.field === "listing.listingDate")?.sourceText).toBe(
      "03 July 2026",
    );
  });
});

describe("listing import API handler", () => {
  it("returns typed success for a mocked Property24 import", async () => {
    const response = await handleListingImportRequest(
      new Request("http://test.local/api/listings/import", {
        method: "POST",
        body: JSON.stringify({
          url: "https://www.property24.com/for-sale/cape-st-francis/eastern-cape/123/115555555",
        }),
      }),
      { fetcher: htmlFetch(), now: fixedNow },
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.listing.source.portal).toBe("Property24");
  });

  it("returns typed API errors without leaking internals", async () => {
    const response = await handleListingImportRequest(
      new Request("http://test.local/api/listings/import", {
        method: "POST",
        body: JSON.stringify({ url: "https://example.com/listing" }),
      }),
      { fetcher: htmlFetch(), now: fixedNow },
    );
    const json = await response.json();

    expect(response.status).toBe(415);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("UNSUPPORTED_URL");
    expect(JSON.stringify(json)).not.toContain("<html");
  });
});
