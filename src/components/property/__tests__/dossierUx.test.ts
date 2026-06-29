import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("official dossier UX guardrails", () => {
  it("uses a wider desktop official parcel panel and short scrollable tabs", () => {
    const panel = read("src/components/property/OfficialParcelPanel.tsx");

    expect(panel).toContain("md:w-[min(54vw,980px)]");
    expect(panel).toContain("md:min-w-[680px]");
    expect(panel).toContain('label: "Sources"');
    expect(panel).toContain('label: "Market Evidence"');
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

  it("renders the market evidence tab and BRRRR explanation", () => {
    const dossier = read("src/components/property/ErfResearchDossier.tsx");
    const marketEvidence = read("src/features/marketEvidence/components/MarketEvidenceTab.tsx");

    expect(marketEvidence).toContain("Market Evidence");
    expect(marketEvidence).toContain("Asset Identity Card");
    expect(marketEvidence).toContain("Active Listing Radar");
    expect(marketEvidence).toContain("Candidate Triage");
    expect(marketEvidence).toContain("Search Ladder");
    expect(marketEvidence).toContain("Saved Market Evidence Ledger");
    expect(marketEvidence).toContain("Fallback Search Tools");
    expect(marketEvidence.indexOf("Active Listing Radar")).toBeLessThan(
      marketEvidence.indexOf("Search Ladder"),
    );
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

  it("keeps radar candidates separate from verified saved market evidence", () => {
    const hook = read("src/features/marketEvidence/hooks/useSavedMarketEvidence.ts");
    const tab = read("src/features/marketEvidence/components/MarketEvidenceTab.tsx");

    expect(hook).toContain("marketEvidenceCandidates");
    expect(hook).toContain("dismissedMarketEvidenceCandidateIds");
    expect(hook).toContain("savedMarketEvidence");
    expect(tab).toContain("Radar candidates are hypotheses");
    expect(tab).toContain("Market thesis from verified evidence");
  });

  it("guides radar empty states and weak candidate review", () => {
    const tab = read("src/features/marketEvidence/components/MarketEvidenceTab.tsx");

    expect(tab).toContain("No listing candidates are loaded for this area yet.");
    expect(tab).toContain("Active Listing Radar needs source-backed candidates to scan");
    expect(tab).toContain("Import candidate manually");
    expect(tab).toContain("Add candidate from URL");
    expect(tab).toContain("Open fallback search tools");
    expect(tab).toContain("No candidates cleared the radar threshold.");
    expect(tab).toContain("Show hidden / weak candidates");
    expect(tab).toContain("showWeakCandidates");
  });

  it("uses warmer premium market evidence surfaces", () => {
    const tab = read("src/features/marketEvidence/components/MarketEvidenceTab.tsx");

    expect(tab).toContain("from-[#fff8ec]");
    expect(tab).toContain("border-amber-200");
    expect(tab).toContain("text-stone-950");
    expect(tab).toContain("from-white to-[#fbf5ea]");
  });
});
