import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GuidedPropertyChecksStep } from "@/components/property/investigation/GuidedPropertyChecksStep";
import { GuidedSgDiagramStep } from "@/components/property/investigation/GuidedSgDiagramStep";
import { GuidedTitleStep } from "@/components/property/investigation/GuidedTitleStep";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";

const vaultFixture = vi.hoisted(() => ({
  assets: [] as ErfAsset[],
  error: null as string | null,
}));

vi.mock("@/lib/workbench/useErfFileVault", () => ({
  dispatchErfFileVaultUpdated: vi.fn(),
  useErfFileVault: vi.fn(() => ({
    assets: vaultFixture.assets,
    loading: false,
    error: vaultFixture.error,
    uploadState: null,
    migration: null,
    signedIn: true,
    refresh: vi.fn(),
    upload: vi.fn(),
    remove: vi.fn(),
    open: vi.fn(),
    migrateLocalAttachments: vi.fn(),
  })),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    message: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

function parcel(): NormalizedOfficialParcel {
  return {
    id: "parcel:test-fixture",
    source: "csg",
    sourceLabel: "Chief Surveyor-General",
    layer: "csg-parcels",
    erfNumber: 1021,
    portion: 0,
    lpi: "C03400140000102100000",
    parcelKey: "E108C034001400001021000000",
    objectId: 1021,
    municipality: "Kouga Local Municipality",
    province: "Eastern Cape",
    suburbOrArea: "Sea Vista",
    town: "St Francis Bay",
    coordinates: { lng: 24.82, lat: -34.16 },
    knownFields: [],
    missingFields: [],
    rawProperties: { SHAPE_Area: 713 },
  };
}

function asset(overrides: Partial<ErfAsset>): ErfAsset {
  return {
    id: "TEST FIXTURE - NOT A REAL PROPERTY DOCUMENT",
    user_id: "user-1",
    parcel_id: "parcel:test-fixture",
    asset_category: "sg_diagram",
    asset_type: "sg_diagram",
    source_label: "Synthetic test fixture",
    storage_bucket: "erf-files",
    storage_path: "user-1/parcel:test-fixture/sg_diagram/test-fixture.pdf",
    original_file_name: "TEST FIXTURE - NOT A REAL PROPERTY DOCUMENT.pdf",
    mime_type: "application/pdf",
    size_bytes: 2048,
    checksum_sha256: null,
    status: "uploaded_reference_only",
    metadata: {},
    local_migration_fingerprint: null,
    created_at: "2026-07-31T08:00:00.000Z",
    updated_at: "2026-07-31T08:00:00.000Z",
    ...overrides,
  };
}

describe("guided vault evidence steps", () => {
  beforeEach(() => {
    vaultFixture.assets = [];
    vaultFixture.error = null;
  });

  it("TEST FIXTURE - NOT A REAL PROPERTY DOCUMENT: parent General Plan is context only with no Read or Retry action", () => {
    vaultFixture.assets = [
      asset({
        metadata: {
          extractionStatus: "ready",
          identityMatchStatus: "parent_lineage_match",
          documentLineage: {
            parentErfNumber: "1496",
            generalPlanReference: "GP12252",
            lineage: "parent general plan",
          },
        },
      }),
    ];

    const html = renderToStaticMarkup(
      <GuidedSgDiagramStep parcel={parcel()} onContinue={vi.fn()} />,
    );

    expect(html).toContain("context only");
    expect(html).toContain("not a readable subject SG diagram");
    expect(html).not.toContain("Read diagram");
    expect(html).not.toContain("Retry reading");
    expect(html).not.toContain("Matched diagram ready");
  });

  it("TEST FIXTURE - NOT A REAL PROPERTY DOCUMENT: title documents use title wording instead of report wording", () => {
    vaultFixture.assets = [
      asset({
        asset_category: "title_deed",
        asset_type: "title_deed",
        metadata: {
          extractionStatus: "ready",
          identityMatchStatus: "matched",
          extractedClaims: [
            {
              domain: "ownership",
              key: "registeredOwner",
              label: "Registered owner",
              value: "Private owner",
              numericValue: null,
              unit: null,
              page: 1,
              quote: "Registered owner: Private owner",
              confidence: "medium",
            },
          ],
        },
      }),
    ];

    const html = renderToStaticMarkup(
      <GuidedTitleStep parcel={parcel()} onContinue={vi.fn()} onOpenPaidReports={vi.fn()} />,
    );

    expect(html).toContain("Matched title deed ready");
    expect(html).not.toContain("Report searchable");
  });

  it("TEST FIXTURE - NOT A REAL PROPERTY DOCUMENT: user-identified plans do not claim municipal approval", () => {
    vaultFixture.assets = [
      asset({
        asset_category: "architectural_plan",
        asset_type: "approved_building_plan",
        source_label: "User identified as approved municipal building plans",
        original_file_name: "approved-municipal-plans-test-fixture.pdf",
        metadata: { planApprovalStatus: "user_identified" },
      }),
    ];

    const html = renderToStaticMarkup(
      <GuidedPropertyChecksStep parcel={parcel()} onContinue={vi.fn()} />,
    );

    expect(html).toContain("User identified plan, approval not verified");
    expect(html).toContain("approval still unverified");
    expect(html).toContain("approved-plan warning remains open");
    expect(html).not.toContain("Municipal approval verified");
  });

  it("TEST FIXTURE - NOT A REAL PROPERTY DOCUMENT: upload failure, retry and wrong-property states stay explicit", () => {
    vaultFixture.error = "TEST FIXTURE - NOT A REAL PROPERTY DOCUMENT upload failed";
    vaultFixture.assets = [
      asset({
        id: "failed-survey",
        asset_category: "topography",
        asset_type: "topographical_survey",
        metadata: { extractionStatus: "failed", extractionError: "Could not read fixture." },
      }),
      asset({
        id: "wrong-survey",
        asset_category: "topography",
        asset_type: "topographical_survey",
        original_file_name: "wrong-property-test-fixture.pdf",
        metadata: { extractionStatus: "ready", identityMatchStatus: "mismatch" },
      }),
    ];

    const html = renderToStaticMarkup(
      <GuidedPropertyChecksStep parcel={parcel()} onContinue={vi.fn()} />,
    );

    expect(html).toContain("TEST FIXTURE - NOT A REAL PROPERTY DOCUMENT upload failed");
    expect(html).toContain("Retry reading");
    expect(html).toContain("different property");
    expect(html).toContain("not used for this erf");
  });
});
