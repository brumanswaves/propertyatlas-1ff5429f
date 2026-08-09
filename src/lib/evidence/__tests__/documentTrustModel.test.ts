import { describe, expect, it } from "vitest";
import {
  erfAssetExtractionLabel,
  erfAssetHasSearchableExtraction,
  erfAssetIdentityUserConfirmed,
} from "../extractionMetadata";
import { redactPersonalIdentifiers } from "../buildPropertyEvidencePack";

function asset(identityMatchStatus: "matched" | "unverified" | "mismatch", confirmed = false) {
  return {
    parcel_id: "csg:lpi:C03400140000157000000",
    metadata: {
      extractionStatus: "partial",
      identityMatchStatus,
      ...(confirmed
        ? {
            identityBinding: "user_confirmed",
            identityUserConfirmedParcelId: "csg:lpi:C03400140000157000000",
          }
        : {}),
    },
  };
}

describe("document trust model", () => {
  it("keeps readable unverified documents out of evidence until the user confirms them", () => {
    expect(erfAssetHasSearchableExtraction(asset("unverified"))).toBe(false);
    expect(erfAssetHasSearchableExtraction(asset("unverified", true))).toBe(true);
    expect(erfAssetIdentityUserConfirmed(asset("unverified", true))).toBe(true);
    expect(erfAssetExtractionLabel(asset("unverified", true))).toContain("attached by user");
    expect(erfAssetExtractionLabel(asset("unverified", true))).not.toContain("verified");
  });

  it("never lets a definite mismatch become searchable through user confirmation metadata", () => {
    expect(erfAssetHasSearchableExtraction(asset("mismatch", true))).toBe(false);
  });

  it("redacts South African identity numbers before extracted text reaches Ask or reports", () => {
    const output = redactPersonalIdentifiers("Owner ID number: 8001015009087");
    expect(output).toContain("[personal identifier redacted]");
    expect(output).not.toContain("8001015009087");
  });
});
