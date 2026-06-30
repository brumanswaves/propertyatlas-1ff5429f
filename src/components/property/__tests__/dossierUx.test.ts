import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("official dossier UX guardrails", () => {
  it("uses a wider desktop official parcel panel and short scrollable tabs", () => {
    const panel = read("src/components/property/OfficialParcelPanel.tsx");

    expect(panel).toContain("md:w-[min(54vw,980px)]");
    expect(panel).toContain("md:min-w-[680px]");
    expect(panel).toContain('label: "Sources"');
    expect(panel).toContain('label: "Listings & Comps"');
    expect(panel).toContain('label: "Calc"');
    expect(panel).toContain("overflow-x-auto");
  });

  it("keeps mobile official parcel close and save controls visible", () => {
    const panel = read("src/components/property/OfficialParcelPanel.tsx");

    expect(panel).toContain("max-md:h-[100dvh]");
    expect(panel).toContain("max-md:pt-[calc(env(safe-area-inset-top)+0.75rem)]");
    expect(panel).toContain("Save erf");
    expect(panel).toContain("Back to map");
    expect(panel).toContain("min-h-11");
    expect(panel).toContain("sticky top-0 z-30");
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
    expect(tab).toContain("border-amber-200");
    expect(tab).toContain("text-stone-950");
    expect(tab).toContain("bg-[#fff8ec]");
  });
});
