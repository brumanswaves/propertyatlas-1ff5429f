import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const reportOpening = source("src/components/property/dossier/ReportOpening.tsx");
const reportMap = source("src/components/property/dossier/ReportBuildableAreaVisual.tsx");
const reportHero = source("src/lib/reports/reportHero.ts");
const sitePotential = source("src/components/property/sitePotential/VacantLandBuildEnvelope.tsx");
const sitePotentialTab = source("src/components/property/dossier/SitePotentialTab.tsx");
const guidedSitePotential = source("src/components/property/investigation/GuidedSitePotentialStep.tsx");
const acceptedEnvelope = source("src/lib/sitePotential/acceptedBuildEnvelope.ts");

describe("report and investigation coherence guardrails", () => {
  it("places the report lens before Ask Easy Erf and Ask before the decision evidence", () => {
    const modeIndex = reportOpening.indexOf('id="report-view-mode"');
    const askIndex = reportOpening.indexOf('id="report-ask"');
    const decisionIndex = reportOpening.indexOf('id="report-decision"');

    expect(modeIndex).toBeGreaterThan(-1);
    expect(askIndex).toBeGreaterThan(modeIndex);
    expect(decisionIndex).toBeGreaterThan(askIndex);
  });

  it("keeps the Guided Investigation free of the large Ask Easy Erf report panel", () => {
    const guidedDirectory = resolve(process.cwd(), "src/components/property/investigation");
    const guidedSources = readdirSync(guidedDirectory)
      .filter((name) => name.endsWith(".tsx"))
      .map((name) => source(`src/components/property/investigation/${name}`))
      .join("\n");

    expect(guidedSources).not.toContain("AskEasyErfPanel");
  });

  it("uses the accepted deterministic envelope for Guided and report consumers", () => {
    expect(sitePotential).toContain("Accept this Site Potential");
    expect(sitePotential).toContain("acceptedInputSignature: acceptance.signature");
    expect(sitePotential).toContain('data-site-potential-acceptance={acceptance.accepted ? "accepted" : "pending"}');
    expect(acceptedEnvelope).toContain("candidate?.acceptance.accepted");
    expect(sitePotentialTab).toContain("deriveBuildEnvelopeCandidate");
    expect(sitePotentialTab).toContain("candidate?.acceptance.accepted");
    expect(sitePotentialTab).toContain("disabled={!acceptedEnvelope}");
    expect(guidedSitePotential).toContain("acceptedBuildEnvelope");
    expect(guidedSitePotential).toContain("Accepted building area map");
  });

  it("renders a real parcel map in the web report and a deterministic print fallback", () => {
    expect(reportMap).toContain("<SatelliteParcelMap");
    expect(reportMap).toContain("<BuildEnvelopeDiagram");
    expect(reportMap).toContain("if (printOnly)");
    expect(reportMap).not.toContain(".data");
    expect(reportMap).not.toMatch(/generated[_ -]?design|image generation|ai render/i);
    expect(reportHero).toContain('kind: "site_potential"');
    expect(reportHero).toContain('kind: "parcel_overview"');
    expect(reportHero).toContain('kind: "neutral_card"');
  });

  it("keeps Site Potential limited to map and street-side build lines", () => {
    expect(sitePotential).toContain("<SatelliteParcelMap");
    expect(sitePotentialTab).toContain("<StreetSideBuildEnvelope");
    expect(sitePotential).not.toMatch(/generate (a )?house|architectural concept|ai-generated/i);
    expect(guidedSitePotential).toMatch(
      /It does not generate a house\s+or architectural concept\./,
    );
  });
});
