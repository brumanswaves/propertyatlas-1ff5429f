import { describe, expect, it } from "vitest";
import {
  buildEvidencePackFixture,
  evidenceAddress,
  evidenceMarket,
  evidenceParcel,
  evidenceScenario,
} from "./propertyEvidenceTestUtils";

describe("PropertyEvidencePack contradictions", () => {
  it("detects confirmed market-address municipality mismatch", () => {
    const pack = buildEvidencePackFixture({
      marketAddressIntelligence: evidenceAddress({
        userConfirmedAddress: {
          ...evidenceAddress().userConfirmedAddress!,
          municipality: "City of Cape Town",
        },
      }),
    });

    expect(pack.contradictions.map((item) => item.id)).toContain(
      "market-address-municipality-mismatch",
    );
  });

  it("detects confirmed market-address province mismatch", () => {
    const pack = buildEvidencePackFixture({
      marketAddressIntelligence: evidenceAddress({
        userConfirmedAddress: {
          ...evidenceAddress().userConfirmedAddress!,
          province: "Western Cape",
        },
      }),
    });

    expect(pack.contradictions.map((item) => item.id)).toContain(
      "market-address-province-mismatch",
    );
  });

  it("detects conflicting official area aliases", () => {
    const pack = buildEvidencePackFixture({
      parcel: evidenceParcel({ rawProperties: { SHAPE_Area: 900, AREA_M2: 1200 } }),
    });

    expect(pack.contradictions.map((item) => item.id)).toContain(
      "official-area-alias-conflict",
    );
  });

  it("detects conflicting official zoning aliases", () => {
    const pack = buildEvidencePackFixture({
      parcel: evidenceParcel({
        rawProperties: { ZONING: "Residential 1", ZONE: "Business 1" },
      }),
    });

    expect(pack.contradictions.map((item) => item.id)).toContain(
      "official-zoning-alias-conflict",
    );
  });

  it("detects listing land size materially above the official area threshold", () => {
    const pack = buildEvidencePackFixture({
      savedMarketEvidence: [
        evidenceMarket({
          id: "subject",
          listingRole: "subject_active_listing",
          relationship: "target_asset",
          landSizeM2: 991,
        }),
      ],
    });

    expect(pack.contradictions.map((item) => item.id)).toContain(
      "subject-land-size-mismatch-subject",
    );
  });

  it("does not flag listing land size at the exact threshold", () => {
    const pack = buildEvidencePackFixture({
      savedMarketEvidence: [
        evidenceMarket({
          id: "subject",
          listingRole: "subject_active_listing",
          relationship: "target_asset",
          landSizeM2: 990,
        }),
      ],
    });

    expect(pack.contradictions.map((item) => item.id)).not.toContain(
      "subject-land-size-mismatch-subject",
    );
  });

  it("detects multiple subject active listings", () => {
    const pack = buildEvidencePackFixture({
      savedMarketEvidence: [
        evidenceMarket({ id: "subject-a", listingRole: "subject_active_listing" }),
        evidenceMarket({ id: "subject-b", listingRole: "subject_active_listing" }),
      ],
    });

    expect(pack.contradictions.map((item) => item.id)).toContain(
      "multiple-subject-active-listings",
    );
  });

  it("detects cross-parcel chosen strategy while keeping missing information as gaps", () => {
    const pack = buildEvidencePackFixture({
      chosenScenario: evidenceScenario({ id: "wrong", parcelId: "parcel-b" }),
      parcel: evidenceParcel({ rawProperties: {} }),
    });

    expect(pack.contradictions.map((item) => item.id)).toContain(
      "chosen-scenario-cross-parcel",
    );
    expect(pack.contradictions.map((item) => item.id)).not.toContain("missing-zoning");
    expect(pack.gaps.map((gap) => gap.id)).toContain("missing-zoning");
  });
});
