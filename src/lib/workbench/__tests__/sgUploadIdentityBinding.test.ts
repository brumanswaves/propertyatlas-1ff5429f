import { describe, expect, it } from "vitest";
import { erfAssetHasSearchableExtraction } from "@/lib/evidence/extractionMetadata";
import { buildErfAssetUploadMetadata } from "../erfFileVault";

describe("SG upload identity binding", () => {
  const parcelId = "csg:lpi:c03400140000157000000";

  it("treats an SG uploaded into the selected erf as the user's attachment decision", () => {
    const metadata = buildErfAssetUploadMetadata(
      {
        parcelId,
        category: "sg_diagram",
        metadata: {
          expectedIdentityContext: {
            erfNumber: "1570",
            streetAddress: "24 Padrone Crescent",
          },
        },
      },
      "2026-08-26T15:00:00.000Z",
    );

    expect(metadata).toMatchObject({
      identityBinding: "user_confirmed",
      identityUserConfirmedParcelId: parcelId,
      identityUserConfirmedAt: "2026-08-26T15:00:00.000Z",
    });
    expect(metadata.expectedIdentityContext).toEqual({
      erfNumber: "1570",
      streetAddress: "24 Padrone Crescent",
    });
  });

  it("makes readable non-mismatching findings searchable without a second confirmation click", () => {
    expect(
      erfAssetHasSearchableExtraction({
        parcel_id: parcelId,
        metadata: {
          extractionStatus: "partial",
          identityMatchStatus: "unverified",
          identityBinding: "user_confirmed",
          identityUserConfirmedParcelId: parcelId,
        },
      }),
    ).toBe(true);
  });

  it("never lets user attachment override a detected property mismatch", () => {
    expect(
      erfAssetHasSearchableExtraction({
        parcel_id: parcelId,
        metadata: {
          extractionStatus: "ready",
          identityMatchStatus: "mismatch",
          identityBinding: "user_confirmed",
          identityUserConfirmedParcelId: parcelId,
        },
      }),
    ).toBe(false);
  });

  it("does not automatically bind non-SG uploads", () => {
    expect(
      buildErfAssetUploadMetadata({
        parcelId,
        category: "paid_report",
        metadata: { source: "paid-report-upload" },
      }),
    ).toEqual({ source: "paid-report-upload" });
  });
});
