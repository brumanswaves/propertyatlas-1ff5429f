import { describe, expect, it } from "vitest";
import { evidenceFingerprint } from "../evidenceFingerprint";
import {
  buildEvidencePackFixture,
  evidenceMarket,
  evidenceScenario,
} from "./propertyEvidenceTestUtils";

describe("evidenceFingerprint", () => {
  it("returns deterministic output for identical evidence", () => {
    expect(buildEvidencePackFixture().fingerprint).toBe(buildEvidencePackFixture().fingerprint);
  });

  it("excludes builtAt from the pack fingerprint", () => {
    const first = buildEvidencePackFixture({ now: new Date("2026-07-23T10:00:00Z") });
    const second = buildEvidencePackFixture({ now: new Date("2026-07-24T10:00:00Z") });

    expect(first.fingerprint).toBe(second.fingerprint);
  });

  it("excludes signed URLs from generic fingerprints", () => {
    expect(evidenceFingerprint({ signedUrl: "https://signed/a", value: 1 })).toBe(
      evidenceFingerprint({ signedUrl: "https://signed/b", value: 1 }),
    );
  });

  it("changes when a material market claim changes", () => {
    const first = buildEvidencePackFixture();
    const second = buildEvidencePackFixture({
      savedMarketEvidence: [evidenceMarket({ askingPrice: 1_400_000 })],
    });

    expect(first.fingerprint).not.toBe(second.fingerprint);
  });

  it("changes when a Strategy assumption changes", () => {
    const scenario = evidenceScenario({ id: "scenario-changed", inputs: { landCost: "1300000" } });
    const first = buildEvidencePackFixture();
    const second = buildEvidencePackFixture({
      chosenScenario: scenario,
      strategyScenarios: [scenario],
    });

    expect(first.fingerprint).not.toBe(second.fingerprint);
  });

  it("normalizes irrelevant object-key ordering", () => {
    expect(evidenceFingerprint({ b: 2, a: { y: 2, x: 1 } })).toBe(
      evidenceFingerprint({ a: { x: 1, y: 2 }, b: 2 }),
    );
  });
});
