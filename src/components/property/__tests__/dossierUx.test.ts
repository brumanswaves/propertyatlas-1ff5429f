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
    expect(marketEvidence).toContain("Portal Reality Check");
    expect(marketEvidence).toContain("Search Ladder");
    expect(marketEvidence).toContain("Saved Market Evidence Ledger");
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
});
