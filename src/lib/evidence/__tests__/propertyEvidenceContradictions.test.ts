import { describe, expect, it } from "vitest";
import { selectPropertyEvidence } from "../selectPropertyEvidence";
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

    const contradiction = pack.contradictions.find((item) => item.id === "market-address-municipality-mismatch");
    expect(contradiction).toMatchObject({
      claimIds: expect.arrayContaining(["claim-identity-municipality-parcel-municipality", "claim-address-addr-1-municipality"]),
      sourceIds: expect.arrayContaining(["official-parcel-record", "address-addr-1"]),
      nextAction: "Reconfirm the Market address and parcel identity.",
      targetTab: "listings",
    });
    expect(contradiction?.displayedValues).toEqual(
      expect.arrayContaining(["Market address: City of Cape Town", "Parcel: Kouga Local Municipality"]),
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

    const contradiction = pack.contradictions.find((item) => item.id === "market-address-province-mismatch");
    expect(contradiction).toMatchObject({
      claimIds: expect.arrayContaining(["claim-identity-province-parcel-province", "claim-address-addr-1-province"]),
      sourceIds: expect.arrayContaining(["official-parcel-record", "address-addr-1"]),
      targetTab: "listings",
    });
    expect(pack.domains.find((domain) => domain.domain === "address")?.state).toBe("conflicting");
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

    const contradiction = pack.contradictions.find((item) => item.id === "subject-land-size-mismatch-subject");
    expect(contradiction).toMatchObject({
      claimIds: expect.arrayContaining(["claim-identity-areaM2-area-m2", "claim-market-subject-landSizeM2"]),
      sourceIds: expect.arrayContaining(["official-parcel-record", "market-subject"]),
      targetTab: "listings",
    });
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

    const contradiction = pack.contradictions.find((item) => item.id === "multiple-subject-active-listings");
    expect(contradiction).toMatchObject({
      claimIds: expect.arrayContaining(["claim-market-subject-a-listingRole", "claim-market-subject-b-listingRole"]),
      sourceIds: expect.arrayContaining(["market-subject-a", "market-subject-b"]),
      targetTab: "listings",
    });
  });

  it("detects cross-parcel chosen strategy while keeping missing information as gaps", () => {
    const pack = buildEvidencePackFixture({
      chosenScenario: evidenceScenario({ id: "wrong", parcelId: "parcel-b" }),
      parcel: evidenceParcel({ rawProperties: {} }),
    });

    expect(pack.contradictions.map((item) => item.id)).toContain(
      "chosen-scenario-cross-parcel",
    );
    expect(pack.contradictions.find((item) => item.id === "chosen-scenario-cross-parcel")).toMatchObject({
      sourceIds: ["system-state"],
      displayedValues: expect.arrayContaining(["parcel-b", "parcel-a"]),
      nextAction: "Choose a Strategy scenario for this erf.",
    });
    expect(pack.contradictions.map((item) => item.id)).not.toContain("missing-zoning");
    expect(pack.gaps.map((gap) => gap.id)).toContain("missing-zoning");
  });

  it("retrieves sources supporting a contradiction", () => {
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
      question: "Why is the subject listing land size a contradiction?",
      domains: ["market", "identity"],
    });

    expect(result.contradictions.map((item) => item.id)).toContain("subject-land-size-mismatch-subject");
    expect(result.sources.map((source) => source.id)).toEqual(
      expect.arrayContaining(["official-parcel-record", "market-subject"]),
    );
  });
});
