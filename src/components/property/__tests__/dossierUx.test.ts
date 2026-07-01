import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("official dossier UX guardrails", () => {
  it("keeps the map homepage hero readable and labels demo search results", () => {
    const home = read("src/routes/index.tsx");
    const search = read("src/components/map/SearchBar.tsx");

    expect(home).toContain("ErfStoep");
    expect(home).toContain("Every erf. All the facts.");
    expect(home).toContain("Research any South African erf.");
    expect(home).toContain("bg-[#fbf8f1]/94");
    expect(search).toContain("Search address, erf number, suburb, LPI, or parcel key");
    expect(search).toContain("Pilot demo examples");
    expect(search).toContain("not official parcel/address matches");
    expect(search).toContain("Demo");
  });

  it("renders locate me without storing precise user location", () => {
    const home = read("src/routes/index.tsx");
    const map = read("src/components/map/MapCanvas.tsx");

    expect(home).toContain("Locate me");
    expect(home).toContain("locateRequestId");
    expect(home).toContain("onLocateResult={setLocateMessage}");
    expect(map).toContain("navigator.geolocation.getCurrentPosition");
    expect(map).toContain(
      "Location permission was not granted. You can still search by address, suburb, erf number, LPI, or parcel key.",
    );
    expect(map).toContain("map.flyTo({ center: lngLat");
    expect(map).not.toContain("localStorage.setItem(\"userLocation");
    expect(map).not.toContain("supabase.from");
  });

  it("uses the left rail as the only primary workbench navigation", () => {
    const panel = read("src/components/property/OfficialParcelPanel.tsx");

    expect(panel).toContain("fixed inset-0");
    expect(panel).toContain("Workbench rail");
    expect(panel).toContain("Erf Workbench");
    expect(panel).toContain("Back to full map");
    expect(panel).toContain('label: "Overview"');
    expect(panel).toContain('label: "Market"');
    expect(panel).toContain('label: "Strategy"');
    expect(panel).toContain('label: "Sources"');
    expect(panel).toContain('label: "Reports"');
    expect(panel).toContain('label: "Notes"');
    expect(panel).toContain("WORKBENCH_NAV.map");
    expect(panel).not.toContain("TABS.map");
    expect(panel).not.toContain("overflow-x-auto");
    expect(panel).not.toContain("Listings & Comps</button>");
    expect(panel).toContain('tab === "research"');
    expect(panel).toContain('view="research"');
    expect(panel).toContain('tab === "listings"');
    expect(panel).toContain('view="listings"');
    expect(panel).toContain('tab === "reports"');
    expect(panel).toContain('view="reports"');
    expect(panel).toContain('tab === "calculators"');
    expect(panel).toContain('view="calculators"');
    expect(panel).toContain('tab === "notes"');
    expect(panel).toContain('view="notes"');
  });

  it("keeps mobile official parcel close and save controls visible", () => {
    const panel = read("src/components/property/OfficialParcelPanel.tsx");

    expect(panel).toContain("h-[100dvh]");
    expect(panel).toContain("max-md:pt-[calc(env(safe-area-inset-top)+0.75rem)]");
    expect(panel).toContain("Save erf");
    expect(panel).toContain("Back to map");
    expect(panel).toContain("Back to full map");
    expect(panel).toContain("min-h-11");
    expect(panel).toContain("sticky top-0 z-30");
  });

  it("surfaces ErfStoep intelligence immediately on official map click", () => {
    const panel = read("src/components/property/OfficialParcelPanel.tsx");

    expect(panel).toContain("Every erf. All the facts.");
    expect(panel).toContain("verified ownership, valuation, zoning, sales, slope, buildability");
    expect(panel).toContain("Ask Stoep");
    expect(panel).toContain("What do you want to understand first?");
    expect(panel).toContain("What is risky?");
    expect(panel).toContain("What should I verify?");
    expect(panel).toContain("Run the numbers");
    expect(panel).toContain("Recommended next step");
    expect(panel).toContain("Verify the official parcel identity first.");
    expect(panel).toContain("Check official source");
    expect(panel).toContain("Skip to Strategy Lab");
    expect(panel).toContain("Verify official records");
    expect(panel).toContain("Build market evidence");
    expect(panel).toContain("Run Strategy Lab");
    expect(panel).toContain("Add/upload evidence");
    expect(panel).toContain("Coming soon");
    expect(panel).toContain('["Identity", "Found"]');
    expect(panel).toContain('["Ownership", "Needs evidence"]');
    expect(panel).toContain('["Market value", "Needs evidence"]');
    expect(panel).toContain('["Strategy", "Not chosen"]');
    expect(panel).toContain("You can continue without buying a report");
    expect(panel).toContain("Stoep AI First Read");
    expect(panel).toContain("needs evidence");
    expect(panel).toContain("Ownership, valuation, zoning, sales history and GIS precision");
    expect(panel).not.toContain("Open full dossier");
    expect(panel).toContain('{tab === "overview" && null}');
    expect(panel).toContain("bg-[#FF6A00]");
    expect(panel).not.toContain("bg-[radial-gradient");
    expect(panel).toContain("selectWorkbenchTab");
    expect(panel).toContain("border-b border-[#0D1B2A]/10");
  });

  it("marks source actions checked in local session state", () => {
    const dossier = read("src/components/property/ErfResearchDossier.tsx");

    expect(dossier).toContain("completedSourceIds");
    expect(dossier).toContain("setCompletedSourceIds");
    expect(dossier).toContain("Next best action:");
    expect(dossier).toContain("Checked");
  });

  it("renders the listings and comps tab and BRRRR explanation", () => {
    const dossier = read("src/components/property/ErfResearchDossier.tsx");
    const marketEvidence = read("src/features/marketEvidence/components/MarketEvidenceTab.tsx");

    expect(dossier).toContain("Listings & Comps");
    expect(marketEvidence).toContain("Find listings and comps for this erf");
    expect(marketEvidence).toContain("Address Intelligence");
    expect(marketEvidence).toContain("Active Listing Radar");
    expect(marketEvidence).toContain("No confirmed street address yet");
    expect(marketEvidence).toContain("Fallback Search Tools");
    expect(marketEvidence).toContain("Saved Market Evidence");
    expect(marketEvidence).toContain("Market Thesis from saved evidence");
    expect(dossier).toContain("BRRRR means Buy, Rehab, Rent, Refinance, Repeat");
  });

  it("renders the ErfStoep intelligence dashboard shell without fake paid data", () => {
    const dossier = read("src/components/property/ErfResearchDossier.tsx");

    expect(dossier).toContain("Stoep AI First Read");
    expect(dossier).toContain("What is this property?");
    expect(dossier).toContain("Stoep Score placeholder");
    expect(dossier).toContain("Early signal:");
    expect(dossier).toContain("StoepSteps preview");
    expect(dossier).toContain("Property First Read");
    expect(dossier).toContain("Generate Stoep Report");
    expect(dossier).toContain("Strategy Lab preview");
    expect(dossier).toContain("Land Flip");
    expect(dossier).toContain("Build and Sell");
    expect(dossier).toContain("Hold vs Cash");
    expect(dossier).toContain("Max Offer");
    expect(dossier).toContain("Stoep Reports preview");
    expect(dossier).toContain("Report Vault / Upload PDF placeholder");
    expect(dossier).toContain("Purchase Lightstone");
    expect(dossier).toContain("Purchase WinDeed");
    expect(dossier).toContain("Paid reports are optional confidence upgrades");
  });

  it("hides empty market evidence/calculator dashboard sections and keeps run calculator action", () => {
    const dashboard = read("src/routes/dashboard.tsx");

    expect(dashboard).toContain("savedMarketEvidence(row).length > 0");
    expect(dashboard).not.toContain("No listing evidence saved yet");
    expect(dashboard).not.toContain("Calculators live inside each property dossier");
    expect(dashboard).toContain("Run calculator");
    expect(dashboard).toContain("tab=calc");
  });

  it("keeps saved comps storage compatible with saved market evidence", () => {
    const hook = read("src/features/marketEvidence/hooks/useSavedMarketEvidence.ts");
    const tab = read("src/features/marketEvidence/components/MarketEvidenceTab.tsx");

    expect(hook).toContain("savedMarketEvidence");
    expect(hook).toContain("propertyIdentity");
    expect(hook).toContain("marketAddressIntelligence");
    expect(tab).toContain("Saved Market Evidence");
    expect(tab).toContain("Save comp");
  });

  it("keeps Active Listing Radar primary and search tools as fallback", () => {
    const tab = read("src/features/marketEvidence/components/MarketEvidenceTab.tsx");

    expect(tab).toContain("Active Listing Radar");
    expect(tab).toContain("Find possible exact match");
    expect(tab).toContain("Search area listings");
    expect(tab).toContain("Run Area Radar");
    expect(tab).toContain("Run Exact Radar");
    expect(tab).toContain("Fallback Search Tools");
    expect(tab).toContain("ErfStoep does not scan portals live");
    expect(tab).toContain("Use these manual tools only when the radar has no candidates");
    expect(tab).not.toContain("Show hidden / weak candidates");
  });

  it("keeps manual address, candidate import and triage actions explicit", () => {
    const tab = read("src/features/marketEvidence/components/MarketEvidenceTab.tsx");

    expect(tab).toContain("Save market address");
    expect(tab).toContain(
      "Address autocomplete is skipped unless a Google Places service is available",
    );
    expect(tab).toContain("marketAddressIntelligence");
    expect(tab).toContain("No listing candidates have been added for this area yet.");
    expect(tab).toContain("No candidates matched this area/source/type filter.");
    expect(tab).toContain("Import listing candidate");
    expect(tab).toContain("Target property");
    expect(tab).toContain("Same street comp");
    expect(tab).toContain("Same node comp");
    expect(tab).toContain("Vacant land comp");
    expect(tab).toContain("Nearby comp");
    expect(tab).toContain("Broader comp");
    expect(tab).toContain("Dismiss");
  });

  it("uses warmer simple listings and comps surfaces", () => {
    const tab = read("src/features/marketEvidence/components/MarketEvidenceTab.tsx");

    expect(tab).toContain("from-[#fff8ec]");
    expect(tab).toContain("border-accent/20");
    expect(tab).toContain("text-stone-950");
    expect(tab).toContain("bg-[#fff8ec]");
  });
});
