import { describe, expect, it } from "vitest";
import {
  ERF_EXTRACTION_MAX_QUOTE_CHARS,
  ERF_EXTRACTION_MAX_TEXT_CHARS,
  ERF_EXTRACTION_VERSION,
  matchDocumentIdentity,
  normalizeExtractedClaim,
  normalizeExtractedIdentity,
  parseCanonicalLpi,
  type ErfExpectedIdentity,
} from "../../../../supabase/functions/_shared/erfExtractionContract";
import { buildPropertyEvidencePack } from "../buildPropertyEvidencePack";
import {
  erfAssetExtractionLabel,
  erfAssetHasSearchableExtraction,
} from "../extractionMetadata";
import {
  EVIDENCE_TEST_NOW,
  evidenceAsset,
  evidenceParcel,
  evidenceWorkspace,
} from "./propertyEvidenceTestUtils";
import { createEmptyStrategyWorkspace } from "@/lib/workbench/erfWorkspaceState";

// Active parcel: Erf 1570, St Francis Bay, Eastern Cape.
const ERF_1570_PARCEL_ID = "csg:lpi:C03400140000157000000";

const expected1570: ErfExpectedIdentity = {
  parcelId: ERF_1570_PARCEL_ID,
  lpiCode: "C03400140000157000000",
  erfNumber: "1570",
  portionNumber: "0",
  municipality: "Kouga Local Municipality",
  province: "Eastern Cape",
  town: "St Francis Bay",
};

// The real quarantined sample: a Potchefstroom report uploaded against Erf 1570.
const potchefstroomIdentity = normalizeExtractedIdentity({
  erfNumber: "262",
  portionNumber: null,
  lpiCode: null,
  sgCode: null,
  streetAddress: "123 Street Name",
  suburbOrTown: "Potchefstroom",
  municipality: "Tlokwe",
  province: "North-West",
});

function pack(assets = [] as ReturnType<typeof evidenceAsset>[]) {
  return buildPropertyEvidencePack({
    parcel: evidenceParcel({
      id: ERF_1570_PARCEL_ID,
      erfNumber: 1570,
      lpi: "C03400140000157000000",
      rawProperties: { GEOM_AREA: 618.7 },
    }),
    workspaceState: evidenceWorkspace(),
    strategyWorkspace: createEmptyStrategyWorkspace(ERF_1570_PARCEL_ID),
    assets,
    savedMarketEvidence: [],
    now: EVIDENCE_TEST_NOW,
  });
}

function documentAsset(overrides: Record<string, unknown>) {
  return evidenceAsset({
    id: "asset-lightstone",
    parcel_id: ERF_1570_PARCEL_ID,
    asset_category: "paid_report",
    original_file_name: "lightstone-report.pdf",
    ...overrides,
  } as never);
}

describe("document-parcel identity gate", () => {
  it("parses the canonical LPI out of the parcel id", () => {
    expect(parseCanonicalLpi(ERF_1570_PARCEL_ID)).toBe("C03400140000157000000");
    expect(parseCanonicalLpi("manual:something")).toBeNull();
  });

  it("marks the Potchefstroom sample as a mismatch", () => {
    const result = matchDocumentIdentity(expected1570, potchefstroomIdentity);
    expect(result.status).toBe("mismatch");
    expect(result.reason).toMatch(/erf 262|different/i);
  });

  it("matches on an exact LPI", () => {
    const result = matchDocumentIdentity(
      expected1570,
      normalizeExtractedIdentity({ lpiCode: "C0340014 0000 1570 00000" }),
    );
    expect(result.status).toBe("matched");
  });

  it("matches on erf + portion plus an agreeing place", () => {
    const result = matchDocumentIdentity(
      expected1570,
      normalizeExtractedIdentity({ erfNumber: "1570", portionNumber: "0", suburbOrTown: "St Francis Bay" }),
    );
    expect(result.status).toBe("matched");
  });

  it("treats a document with too little identity as unverified", () => {
    const result = matchDocumentIdentity(expected1570, normalizeExtractedIdentity({ streetAddress: "Unit 4" }));
    expect(result.status).toBe("unverified");
  });

  it("treats a different portion of the same erf as a mismatch", () => {
    const result = matchDocumentIdentity(
      expected1570,
      normalizeExtractedIdentity({ erfNumber: "1570", portionNumber: "3", suburbOrTown: "St Francis Bay" }),
    );
    expect(result.status).toBe("mismatch");
  });
});

describe("evidence pack quarantine", () => {
  it("keeps a mismatched Potchefstroom report entirely out of the evidence", () => {
    const built = pack([
      documentAsset({
        metadata: {
          extractionStatus: "failed",
          identityMatchStatus: "mismatch",
          identityMatchReason: "Identity conflict: the document states erf 262, not erf 1570.",
          extractedIdentity: potchefstroomIdentity,
          extractedText: "",
          extractedClaims: [],
        },
      }),
    ]);

    expect(built.claims.some((claim) => claim.domain === "ownership")).toBe(false);
    expect(built.claims.some((claim) => claim.domain === "deeds")).toBe(false);
    expect(built.claims.some((claim) => claim.domain === "valuation")).toBe(false);
    expect(built.claims.some((claim) => claim.id.startsWith("claim-extracted-"))).toBe(false);
    expect(built.sources.find((source) => source.assetId === "asset-lightstone")?.fragments).toEqual([]);
    expect(built.contradictions.some((item) => item.id === "document-property-mismatch-asset-lightstone")).toBe(true);
    expect(built.gaps.some((item) => item.id === "document-wrong-property-asset-lightstone")).toBe(true);
  });

  it("excludes an unverified document but does not call it the wrong property", () => {
    const built = pack([
      documentAsset({
        metadata: {
          extractionStatus: "failed",
          identityMatchStatus: "unverified",
          extractedClaims: [],
          extractedText: "",
        },
      }),
    ]);
    expect(built.claims.some((claim) => claim.id.startsWith("claim-extracted-"))).toBe(false);
    expect(built.gaps.some((item) => item.id === "document-identity-unverified-asset-lightstone")).toBe(true);
    expect(built.contradictions.some((item) => item.id.startsWith("document-property-mismatch"))).toBe(false);
  });

  it("never claims a report is missing when an unusable one exists", () => {
    const built = pack([documentAsset({ metadata: { identityMatchStatus: "mismatch", extractionStatus: "failed" } })]);
    const gap = built.gaps.find((item) => item.id === "document-extraction-missing-asset-lightstone");
    expect(gap?.title).toBe("Uploaded document is for the wrong property");
    expect(gap?.explanation).toContain("lightstone-report.pdf");
  });

  it("ingests identity-matched claims as medium-confidence facts", () => {
    const built = pack([
      documentAsset({
        metadata: {
          extractionStatus: "ready",
          identityMatchStatus: "matched",
          extractedText: "Registered owner: J A Smith",
          extractedClaims: [
            {
              domain: "ownership",
              key: "registeredOwner",
              label: "Registered owner",
              value: "J A Smith",
              numericValue: null,
              unit: null,
              page: 2,
              quote: "Registered owner: J A Smith",
              confidence: "high",
            },
          ],
        },
      }),
    ]);
    const claim = built.claims.find((item) => item.key === "registeredOwner");
    expect(claim?.nature).toBe("fact");
    expect(claim?.confidence).toBe("medium");
    expect(claim?.confidenceReason).toBe(
      "Fact explicitly stated in an identity-matched uploaded report; verify against the issuing source for legal reliance.",
    );
  });
});

describe("canonical area precedence", () => {
  const extentClaim = (value: number) => ({
    domain: "identity",
    key: "areaM2",
    label: "Extent",
    value: `${value} m2`,
    numericValue: value,
    unit: "m2",
    page: 1,
    quote: `Extent: ${value} square metres`,
    confidence: "high",
  });

  it("lets a matched registered extent beat GEOM_AREA", () => {
    const built = pack([
      documentAsset({
        asset_category: "title_deed",
        metadata: {
          extractionStatus: "ready",
          identityMatchStatus: "matched",
          extractedText: "Extent 620 square metres",
          extractedClaims: [extentClaim(620)],
        },
      }),
    ]);
    const area = built.claims.find((claim) => claim.key === "areaM2" && claim.domain === "identity");
    expect(area?.normalizedValue).toBe(620);
  });

  it("ignores a mismatched document extent and keeps GEOM_AREA", () => {
    const built = pack([
      documentAsset({
        metadata: {
          extractionStatus: "failed",
          identityMatchStatus: "mismatch",
          extractedClaims: [extentClaim(262)],
        },
      }),
    ]);
    const area = built.claims.find((claim) => claim.key === "areaM2" && claim.domain === "identity");
    expect(area?.normalizedValue).toBe(618.7);
  });

  it("ignores an unverified document extent", () => {
    const built = pack([
      documentAsset({
        metadata: {
          extractionStatus: "failed",
          identityMatchStatus: "unverified",
          extractedClaims: [extentClaim(999)],
        },
      }),
    ]);
    const area = built.claims.find((claim) => claim.key === "areaM2" && claim.domain === "identity");
    expect(area?.normalizedValue).toBe(618.7);
  });
});

describe("extraction limits and metadata helpers", () => {
  it("caps text at 40k and quotes at 300 characters", () => {
    expect(ERF_EXTRACTION_MAX_TEXT_CHARS).toBe(40_000);
    expect(ERF_EXTRACTION_MAX_QUOTE_CHARS).toBe(300);
    const claim = normalizeExtractedClaim({
      domain: "ownership",
      key: "registeredOwner",
      label: "Owner",
      value: "J A Smith",
      quote: "x".repeat(900),
      confidence: "high",
    });
    expect(claim!.quote.length).toBe(300);
  });

  it("bumps the extraction version so old rows are reprocessed", () => {
    expect(ERF_EXTRACTION_VERSION).toBe(2);
  });

  it("only treats matched + ready assets as searchable", () => {
    expect(erfAssetHasSearchableExtraction({ metadata: { extractionStatus: "ready" } })).toBe(false);
    expect(
      erfAssetHasSearchableExtraction({ metadata: { extractionStatus: "ready", identityMatchStatus: "matched" } }),
    ).toBe(true);
    expect(erfAssetExtractionLabel({ metadata: { identityMatchStatus: "mismatch" } })).toBe("Wrong property report");
  });
});
