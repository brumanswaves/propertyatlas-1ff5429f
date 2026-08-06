import { describe, expect, it } from "vitest";
import {
  erfAssetPlanApprovalStatus,
  isVerifiedMunicipalApprovedPlan,
  planApprovalStatusLabel,
} from "@/lib/evidence/planApprovalMetadata";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";

function asset(overrides: Partial<ErfAsset> = {}): ErfAsset {
  return {
    id: "TEST FIXTURE - NOT A REAL PROPERTY DOCUMENT",
    user_id: "user-1",
    parcel_id: "parcel-1",
    asset_category: "architectural_plan",
    asset_type: "approved_building_plan",
    source_label: "User identified as approved municipal building plans",
    storage_bucket: "erf-files",
    storage_path: "user-1/parcel-1/architectural_plan/test-fixture.pdf",
    original_file_name: "approved-municipal-plans-test-fixture.pdf",
    mime_type: "application/pdf",
    size_bytes: 1234,
    checksum_sha256: null,
    status: "uploaded_reference_only",
    metadata: {},
    local_migration_fingerprint: null,
    created_at: "2026-07-31T08:00:00.000Z",
    updated_at: "2026-07-31T08:00:00.000Z",
    ...overrides,
  };
}

describe("plan approval metadata", () => {
  it("does not infer municipal approval from filename, source label or category", () => {
    const testFixture = asset();

    expect(erfAssetPlanApprovalStatus(testFixture)).toBe("unknown");
    expect(isVerifiedMunicipalApprovedPlan(testFixture)).toBe(false);
    expect(planApprovalStatusLabel(testFixture)).toBe("Plan file stored, approval not verified");
  });

  it("distinguishes user-identified plans from verified municipal approval", () => {
    expect(
      planApprovalStatusLabel(
        asset({ metadata: { planApprovalStatus: "user_identified" } }),
      ),
    ).toBe("User identified plan, approval not verified");
    expect(
      isVerifiedMunicipalApprovedPlan(
        asset({ metadata: { planApprovalStatus: "verified_municipal_approval" } }),
      ),
    ).toBe(true);
  });
});
