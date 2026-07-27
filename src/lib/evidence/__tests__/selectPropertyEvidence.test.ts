import { describe, expect, it } from "vitest";
import { selectPropertyEvidence } from "../selectPropertyEvidence";
import {
  buildEvidencePackFixture,
  evidenceAsset,
  evidenceMarket,
  evidenceNotes,
} from "./propertyEvidenceTestUtils";

describe("selectPropertyEvidence", () => {
  it("retrieves identity claims for identity questions", () => {
    const result = selectPropertyEvidence(buildEvidencePackFixture(), {
      question: "What is the erf LPI and official parcel key?",
      domains: ["identity"],
    });

    expect(result.claims.map((claim) => claim.key)).toEqual(
      expect.arrayContaining(["lpi", "parcelKey"]),
    );
  });

  it("retrieves ownership sources and gaps for ownership questions", () => {
    const result = selectPropertyEvidence(
      buildEvidencePackFixture({
        assets: [
          evidenceAsset({
            id: "paid",
            asset_category: "paid_report",
            original_file_name: "windeed.pdf",
          }),
        ],
      }),
      { question: "Is ownership verified?", domains: ["ownership", "deeds", "documents"] },
    );

    expect(result.sources.some((source) => source.fileName === "windeed.pdf")).toBe(true);
    expect(result.gaps.map((gap) => gap.id)).toContain("ownership-not-verified");
  });

  it("returns compact asset metadata without raw File Vault metadata or signed URLs", () => {
    const result = selectPropertyEvidence(
      buildEvidencePackFixture({
        assets: [
          evidenceAsset({
            id: "doc-compact",
            asset_category: "paid_report",
            original_file_name: "lightstone.pdf",
            metadata: {
              extractionStatus: "processing",
              extractionWarning: "Pending OCR",
              signedUrl: "https://signed.example/doc",
              extractedText: "Should not be returned while processing",
            },
          }),
        ],
      }),
      { question: "paid report document", domains: ["documents", "deeds"] },
    );

    const source = result.sources.find((item) => item.assetId === "doc-compact");
    expect(source?.asset).toMatchObject({
      category: "paid_report",
      mimeType: "application/pdf",
      extractionStatus: "processing",
      extractionWarning: "Pending OCR",
    });
    expect(JSON.stringify(source)).not.toContain("signed.example");
    expect(JSON.stringify(source)).not.toContain("extractedText");
  });

  it("retrieves planning claims and missing controls", () => {
    const result = selectPropertyEvidence(buildEvidencePackFixture(), {
      question: "What zoning and FAR evidence do we have?",
      domains: ["planning"],
    });

    expect(result.claims.some((claim) => claim.key === "zoning")).toBe(true);
    expect(result.claims.some((claim) => claim.key === "far")).toBe(true);
    expect(result.gaps.some((gap) => gap.id === "missing-height")).toBe(true);
  });

  it("retrieves relevant market comps without returning every source", () => {
    const result = selectPropertyEvidence(
      buildEvidencePackFixture({
        savedMarketEvidence: [
          evidenceMarket({ id: "near", title: "Near comparable", notes: "Strong local comp" }),
          evidenceMarket({ id: "weak", title: "Weak broader comp", relationship: "weak_comp" }),
        ],
      }),
      { question: "local comparable market evidence", domains: ["market"], maxClaims: 5 },
    );

    expect(result.claims.every((claim) => claim.domain === "market")).toBe(true);
    expect(result.claims.length).toBeLessThanOrEqual(5);
  });

  it("enforces the character budget", () => {
    const result = selectPropertyEvidence(buildEvidencePackFixture(), {
      question: "planning market ownership",
      maxTotalCharacters: 240,
    });

    expect(result.text.length).toBeLessThanOrEqual(240);
    expect(result.truncated).toBe(true);
  });

  it("ranks direct official evidence above unrelated notes", () => {
    const result = selectPropertyEvidence(
      buildEvidencePackFixture({
        propertyNotes: evidenceNotes({ personal: "Random unrelated gardening note" }),
      }),
      { question: "official LPI parcel identity", maxClaims: 4 },
    );

    expect(result.claims[0]?.sourceIds).toContain("official-parcel-record");
  });

  it("keeps assumptions and AI interpretations labelled in selected text", () => {
    const result = selectPropertyEvidence(buildEvidencePackFixture(), {
      question: "strategy assumption and site concept",
      domains: ["strategy", "site"],
      maxTotalCharacters: 2000,
    });

    expect(result.text).toMatch(/assumption/);
    expect(result.text).toMatch(/interpretation/);
  });

  it("includes relevant contradictions and gaps without leaking another parcel", () => {
    const pack = buildEvidencePackFixture({
      savedMarketEvidence: [
        evidenceMarket({
          id: "subject",
          listingRole: "subject_active_listing",
          relationship: "target_asset",
          landSizeM2: 1200,
        }),
      ],
    });
    const result = selectPropertyEvidence(pack, {
      question: "market area contradiction",
      domains: ["market"],
    });

    expect(result.parcelId).toBe("parcel-a");
    expect(result.contradictions.some((item) => item.id.includes("subject-land-size"))).toBe(
      true,
    );
    expect(result.claims.every((claim) => claim.parcelId === "parcel-a")).toBe(true);
  });

  it("treats maxSourceFragments as a total limit across all selected sources", () => {
    const result = selectPropertyEvidence(
      buildEvidencePackFixture({
        assets: [
          evidenceAsset({ id: "doc-a", metadata: { extractionStatus: "ready", extractedText: "Planning fragment A" } }),
          evidenceAsset({ id: "doc-b", metadata: { extractionStatus: "ready", extractedText: "Planning fragment B" } }),
          evidenceAsset({ id: "doc-c", metadata: { extractionStatus: "ready", extractedText: "Planning fragment C" } }),
        ],
      }),
      {
        question: "planning fragment document evidence",
        domains: ["documents"],
        maxSourceFragments: 2,
        maxTotalCharacters: 2_000,
      },
    );
    const fragmentCount = result.sources.reduce((sum, source) => sum + source.fragments.length, 0);

    expect(fragmentCount).toBeLessThanOrEqual(2);
  });

  it("returns structured sources only when their fragments are rendered", () => {
    const result = selectPropertyEvidence(buildEvidencePackFixture(), {
      question: "SG diagram document text",
      domains: ["documents"],
      maxSourceFragments: 1,
      maxTotalCharacters: 1_200,
    });

    for (const source of result.sources) {
      for (const fragment of source.fragments) {
        expect(result.text).toContain(fragment);
      }
    }
  });

  it("excludes unrelated gaps from a focused question", () => {
    const result = selectPropertyEvidence(buildEvidencePackFixture(), {
      question: "zoning and planning controls",
      domains: ["planning"],
      maxTotalCharacters: 2_000,
    });

    expect(result.gaps.every((gap) => gap.domain === "planning" || /planning|zoning/i.test(`${gap.title} ${gap.explanation}`))).toBe(true);
    expect(result.gaps.map((gap) => gap.id)).not.toContain("ownership-not-verified");
  });

  it("pulls sources that support a relevant contradiction", () => {
    const result = selectPropertyEvidence(
      buildEvidencePackFixture({
        savedMarketEvidence: [
          evidenceMarket({
            id: "subject",
            listingRole: "subject_active_listing",
            relationship: "target_asset",
            landSizeM2: 1200,
          }),
        ],
      }),
      {
        question: "subject listing land size mismatch",
        domains: ["market", "identity"],
        maxSourceFragments: 4,
        maxTotalCharacters: 2_000,
      },
    );

    expect(result.contradictions.map((item) => item.id)).toContain("subject-land-size-mismatch-subject");
    expect(result.sources.map((source) => source.id)).toEqual(
      expect.arrayContaining(["official-parcel-record", "market-subject"]),
    );
  });

  it("returns a deterministic blank-question fallback", () => {
    const first = selectPropertyEvidence(buildEvidencePackFixture(), { maxClaims: 4, maxSourceFragments: 2 });
    const second = selectPropertyEvidence(buildEvidencePackFixture(), { maxClaims: 4, maxSourceFragments: 2 });

    expect(first.text).toBe(second.text);
    expect(first.gaps.map((gap) => gap.id)).toEqual(second.gaps.map((gap) => gap.id));
    expect(first.contradictions.map((item) => item.id)).toEqual(second.contradictions.map((item) => item.id));
  });
});
