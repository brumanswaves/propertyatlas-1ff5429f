import { describe, expect, it } from "vitest";
import {
  ERF_EXTRACTION_KEYS,
  expectedIdentityFromCanonicalLpi,
  matchDocumentIdentity,
  normalizeExtractedClaim,
  normalizeExtractedIdentity,
  parseLegalPortionToken,
  type ErfExpectedIdentity,
} from "../../../../supabase/functions/_shared/erfExtractionContract";

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

/** Exactly what the Lightstone report for 24 Padrone Crescent yields. */
const padroneIdentity = normalizeExtractedIdentity({
  erfNumber: "1570",
  portionNumber: "PTN OF 1496-GP12252",
  lpiCode: null,
  sgCode: null,
  streetAddress: "24 Padrone Crescent",
  suburbOrTown: "St Francis-on-Sea",
  municipality: "ST FRANCIS BAY MUN",
  province: "EASTERN CAPE",
});

describe("legal portion token parser", () => {
  it("derives active erf identity from the canonical LPI without a saved-property bookmark", () => {
    expect(expectedIdentityFromCanonicalLpi(ERF_1570_PARCEL_ID)).toEqual({
      lpiCode: "C03400140000157000000",
      erfNumber: "1570",
      portionNumber: "0",
    });
  });
  it("treats bracketed parent lineage as provenance, not a subject portion", () => {
    const token = parseLegalPortionToken("PTN OF 1496-GP12252");
    expect(token.subjectPortion).toBeNull();
    expect(token.parentErfNumber).toBe("1496");
    expect(token.generalPlanReference).toBe("GP12252");
    expect(token.lineage).toBe("PTN OF 1496-GP12252");
  });

  it("reads an explicit subject portion in every common shape", () => {
    expect(parseLegalPortionToken("2").subjectPortion).toBe("2");
    expect(parseLegalPortionToken("Portion 2").subjectPortion).toBe("2");
    expect(parseLegalPortionToken("PTN 2").subjectPortion).toBe("2");
    expect(parseLegalPortionToken("1570/2").subjectPortion).toBe("2");
  });

  it("keeps both the subject portion and the parent for 'PTN 2 OF 1496'", () => {
    const token = parseLegalPortionToken("PTN 2 OF 1496");
    expect(token.subjectPortion).toBe("2");
    expect(token.parentErfNumber).toBe("1496");
  });

  it("treats remainder/freehold wording as portion 0", () => {
    expect(parseLegalPortionToken("Remainder").subjectPortion).toBe("0");
    expect(parseLegalPortionToken("RE").subjectPortion).toBe("0");
    expect(parseLegalPortionToken("").subjectPortion).toBeNull();
  });
});

describe("identity gate for the 24 Padrone Crescent report", () => {
  it("matches Erf 1570 [PTN OF 1496-GP12252] against the selected freehold erf", () => {
    const result = matchDocumentIdentity(expected1570, padroneIdentity);
    expect(result.status).toBe("matched");
  });

  it("retains parent erf 1496 and GP12252 separately from the subject", () => {
    const result = matchDocumentIdentity(expected1570, padroneIdentity);
    expect(result.lineage?.subjectPortion).toBeNull();
    expect(result.lineage?.parentErfNumber).toBe("1496");
    expect(result.lineage?.generalPlanReference).toBe("GP12252");
  });

  it("corroborates the match on province while tolerating municipality aliases", () => {
    const result = matchDocumentIdentity(expected1570, padroneIdentity);
    expect(result.reason).toMatch(/province matches/);
    expect(result.reason).not.toMatch(/municipality is different/);
  });

  it("still rejects an explicitly different subject portion", () => {
    const result = matchDocumentIdentity(
      expected1570,
      normalizeExtractedIdentity({ ...padroneIdentity, portionNumber: "Portion 2" }),
    );
    expect(result.status).toBe("mismatch");
    expect(result.reason).toMatch(/portion 2/i);
  });

  it("still rejects a genuinely different subject erf", () => {
    const result = matchDocumentIdentity(
      expected1570,
      normalizeExtractedIdentity({ ...padroneIdentity, erfNumber: "262" }),
    );
    expect(result.status).toBe("mismatch");
    expect(result.reason).toMatch(/erf 262/);
  });

  it("still rejects a conflicting province", () => {
    const result = matchDocumentIdentity(
      expected1570,
      normalizeExtractedIdentity({ ...padroneIdentity, province: "North-West" }),
    );
    expect(result.status).toBe("mismatch");
    expect(result.reason).toMatch(/province is different/);
  });
});

describe("owner personal data minimisation", () => {
  it("does not allow owner ID or registration numbers in the claim vocabulary", () => {
    expect(ERF_EXTRACTION_KEYS.ownership).not.toContain("ownerIdOrRegistrationNumber");
    expect(
      normalizeExtractedClaim({
        domain: "ownership",
        key: "ownerIdOrRegistrationNumber",
        label: "Owner ID",
        value: "8001015009087",
        quote: "ID: 8001015009087",
        confidence: "high",
      }),
    ).toBeNull();
  });

  it("still allows the registered owner name", () => {
    expect(
      normalizeExtractedClaim({
        domain: "ownership",
        key: "registeredOwner",
        label: "Registered owner",
        value: "J A Smith",
        quote: "Registered owner: J A Smith",
        confidence: "high",
      }),
    ).toMatchObject({ key: "registeredOwner", value: "J A Smith" });
  });
});
