import { describe, expect, it } from "vitest";
import {
  buildEvidencePackFixture,
  evidenceAsset,
  evidenceMarket,
  evidenceParcel,
  evidenceScenario,
  evidenceWorkspace,
} from "./propertyEvidenceTestUtils";

describe("PropertyEvidencePack gaps", () => {
  it("creates an ownership verification gap even when a paid report is uploaded", () => {
    const pack = buildEvidencePackFixture({
      assets: [evidenceAsset({ asset_category: "paid_report", original_file_name: "lightstone.pdf" })],
    });

    expect(pack.gaps.map((gap) => gap.id)).toContain("ownership-not-verified");
    expect(pack.domains.find((domain) => domain.domain === "ownership")?.state).not.toBe(
      "supported",
    );
  });

  it("identifies exact missing planning controls", () => {
    const pack = buildEvidencePackFixture({
      parcel: evidenceParcel({ rawProperties: {} }),
    });

    expect(pack.gaps.map((gap) => gap.id)).toEqual(
      expect.arrayContaining([
        "missing-zoning",
        "missing-coverage",
        "missing-far",
        "missing-height",
        "missing-setbacks",
        "missing-permittedUses",
      ]),
    );
  });

  it("creates a market gap below three included comparable items", () => {
    const pack = buildEvidencePackFixture({
      savedMarketEvidence: [evidenceMarket({ id: "one" }), evidenceMarket({ id: "two" })],
    });

    expect(pack.gaps.map((gap) => gap.id)).toContain("fewer-than-three-comps");
  });

  it("clears the comparable-count gap at three usable comps", () => {
    const pack = buildEvidencePackFixture({
      savedMarketEvidence: [
        evidenceMarket({ id: "one" }),
        evidenceMarket({ id: "two" }),
        evidenceMarket({ id: "three" }),
      ],
    });

    expect(pack.gaps.map((gap) => gap.id)).not.toContain("fewer-than-three-comps");
  });

  it("strengthens planning requirements for development strategies", () => {
    const pack = buildEvidencePackFixture({
      parcel: evidenceParcel({ rawProperties: { SHAPE_Area: 900 } }),
      chosenScenario: evidenceScenario({ strategy: "development_sell" }),
    });

    expect(pack.gaps.map((gap) => gap.id)).toContain(
      "development-planning-controls-unverified",
    );
  });

  it("does not require Site Potential for a non-development strategy", () => {
    const buyHold = evidenceScenario({ strategy: "buy_hold" });
    const pack = buildEvidencePackFixture({
      chosenScenario: buyHold,
      strategyScenarios: [buyHold],
      selectedSiteDesign: null,
      assets: [evidenceAsset()],
    });

    expect(pack.gaps.map((gap) => gap.id)).not.toContain(
      "selected-site-potential-concept-missing",
    );
  });

  it("uses accepted deterministic envelopes and explicit skips instead of generated concepts", () => {
    const development = evidenceScenario({ strategy: "development_sell" });
    const base = { chosenScenario: development, strategyScenarios: [development] };
    const pending = buildEvidencePackFixture(base);
    const gapId = "selected-site-potential-concept-missing";
    const gap = pending.gaps.find((item) => item.id === gapId);
    expect(gap?.nextAction).toContain("build envelope");
    expect(gap?.nextAction).not.toContain("Generate");
    expect(gap?.blocking).toBe(false);
    // The default fixture includes a legacy selected concept. It is not acceptance.
    expect(gap).toBeDefined();
    const accepted = buildEvidencePackFixture({ ...base, sitePotentialAccepted: true });
    const workspace = evidenceWorkspace();
    const skipped = buildEvidencePackFixture({ ...base, workspaceState: {
      ...workspace, sitePotential: { ...workspace.sitePotential, skipped: true },
    } });
    for (const pack of [accepted, skipped]) {
      expect(pack.gaps.some((item) => item.id === gapId)).toBe(false);
      expect(pack.gaps.some((item) => item.id === "development-planning-controls-unverified")).toBe(true);
    }
  });

  it("creates document extraction gaps for critical documents without ready text", () => {
    const pack = buildEvidencePackFixture({
      assets: [
        evidenceAsset({
          id: "critical",
          asset_category: "sg_diagram",
          metadata: { extractionStatus: "processing", extractedText: "Hidden until ready" },
        }),
      ],
    });

    expect(pack.gaps.map((gap) => gap.id)).toContain(
      "document-extraction-missing-critical",
    );
    expect(pack.sources.flatMap((source) => source.fragments).join(" ")).not.toContain(
      "Hidden until ready",
    );
  });

  it("turns user questions into unresolved gaps", () => {
    const pack = buildEvidencePackFixture();

    expect(pack.gaps.map((gap) => gap.id)).toContain("unresolved-user-question-1");
  });
});
