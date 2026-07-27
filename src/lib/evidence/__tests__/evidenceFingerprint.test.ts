import { describe, expect, it } from "vitest";
import { evidenceFingerprint } from "../evidenceFingerprint";
import {
  buildEvidencePackFixture,
  evidenceAsset,
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

  it("does not change when asset input order changes", () => {
    const assets = [
      evidenceAsset({ id: "asset-a", original_file_name: "a.pdf" }),
      evidenceAsset({ id: "asset-b", original_file_name: "b.pdf" }),
    ];

    expect(buildEvidencePackFixture({ assets }).fingerprint).toBe(
      buildEvidencePackFixture({ assets: assets.slice().reverse() }).fingerprint,
    );
  });

  it("includes material structured asset metadata in the pack fingerprint", () => {
    const first = buildEvidencePackFixture({
      assets: [evidenceAsset({ id: "asset-a", checksum_sha256: "sha256-a" })],
    });
    const second = buildEvidencePackFixture({
      assets: [evidenceAsset({ id: "asset-a", checksum_sha256: "sha256-b" })],
    });

    expect(first.fingerprint).not.toBe(second.fingerprint);
  });

  it("does not change when market evidence input order changes", () => {
    const evidence = [
      evidenceMarket({ id: "market-a", askingPrice: 1_100_000 }),
      evidenceMarket({ id: "market-b", askingPrice: 1_200_000 }),
    ];

    expect(buildEvidencePackFixture({ savedMarketEvidence: evidence }).fingerprint).toBe(
      buildEvidencePackFixture({ savedMarketEvidence: evidence.slice().reverse() }).fingerprint,
    );
  });

  it("does not change when strategy scenario input order changes", () => {
    const chosen = evidenceScenario({ id: "scenario-a", inputs: { landCost: "1200000" } });
    const other = evidenceScenario({ id: "scenario-b", inputs: { landCost: "1300000" }, selected: false });

    expect(buildEvidencePackFixture({ chosenScenario: chosen, strategyScenarios: [chosen, other] }).fingerprint).toBe(
      buildEvidencePackFixture({ chosenScenario: chosen, strategyScenarios: [other, chosen] }).fingerprint,
    );
  });

  it("canonicalizes source ID ordering", () => {
    expect(evidenceFingerprint({ sourceIds: ["b", "a"], value: 1 })).toBe(
      evidenceFingerprint({ sourceIds: ["a", "b"], value: 1 }),
    );
  });
});
