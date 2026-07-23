import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assetGroupForCategory,
  buildErfAssetStoragePath,
  canonicalErfAssetStoragePath,
  erfAssetStoragePathCandidates,
  groupErfAssets,
  localAttachmentMigrationFingerprint,
  safeFileName,
  safeErfAssetPathSegment,
  validateErfAssetFile,
  type ErfAsset,
} from "../erfFileVault";

function read(path: string) {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

function asset(partial: Partial<ErfAsset>): ErfAsset {
  return {
    id: partial.id ?? crypto.randomUUID(),
    user_id: "user-1",
    parcel_id: "parcel-1",
    asset_category: partial.asset_category ?? "other",
    asset_type: partial.asset_type ?? "other",
    source_label: partial.source_label ?? "Test asset",
    storage_bucket: "erf-files",
    storage_path: partial.storage_path ?? "path",
    original_file_name: partial.original_file_name ?? "file.pdf",
    mime_type: partial.mime_type ?? "application/pdf",
    size_bytes: partial.size_bytes ?? 1234,
    checksum_sha256: null,
    status: partial.status ?? "uploaded_reference_only",
    metadata: partial.metadata ?? {},
    local_migration_fingerprint: partial.local_migration_fingerprint ?? null,
    created_at: partial.created_at ?? "2026-07-13T10:00:00.000Z",
    updated_at: partial.updated_at ?? "2026-07-13T10:00:00.000Z",
  };
}

describe("erfFileVault", () => {
  it("builds stable private storage paths without unsafe file names", () => {
    expect(safeFileName(" Lightstone Report #1!!.pdf ")).toBe("Lightstone-Report-1.pdf");
    expect(
      buildErfAssetStoragePath({
        userId: "user-1",
        parcelId: "csg:lpi:C03400140000102100000",
        category: "paid_report",
        assetId: "asset-1",
        fileName: "Lightstone Report #1!!.pdf",
      }),
    ).toBe("user-1/csg:lpi:C03400140000102100000/paid_report/asset-1/Lightstone-Report-1.pdf");
  });

  it("prevents parcel path segments from creating extra storage levels", () => {
    expect(safeErfAssetPathSegment("csg:lpi:C034/001\\400")).toBe("csg:lpi:C034-001-400");
    expect(
      buildErfAssetStoragePath({
        userId: "user-1",
        parcelId: "../csg:lpi:C034\\001/400",
        category: "site_photo",
        assetId: "asset-1",
        fileName: "photo.png",
      }).split("/"),
    ).toEqual(["user-1", "..-csg:lpi:C034-001-400", "site_photo", "asset-1", "photo.png"]);
  });

  it("normalizes only legacy encoded parcel colons", () => {
    expect(
      canonicalErfAssetStoragePath(
        "user-1/csg%3Alpi%3Ac03400140000157000000/generated_design/asset-1/concept%20one.png",
      ),
    ).toBe(
      "user-1/csg:lpi:c03400140000157000000/generated_design/asset-1/concept%20one.png",
    );
    expect(
      canonicalErfAssetStoragePath(
        "user-1/csg%3alpi%3ac03400140000157000000/paid_report/asset-1/report.pdf",
      ),
    ).toBe("user-1/csg:lpi:c03400140000157000000/paid_report/asset-1/report.pdf");
    expect(
      canonicalErfAssetStoragePath("user-1/parcel%2Fnot-decoded/site_photo/asset-1/photo.png"),
    ).toBe("user-1/parcel%2Fnot-decoded/site_photo/asset-1/photo.png");
  });

  it("tries canonical storage paths before legacy stored paths", () => {
    expect(
      erfAssetStoragePathCandidates(
        "user-1/csg%3Alpi%3Ac03400140000157000000/sg_diagram/asset-1/diagram.pdf",
      ),
    ).toEqual([
      "user-1/csg:lpi:c03400140000157000000/sg_diagram/asset-1/diagram.pdf",
      "user-1/csg%3Alpi%3Ac03400140000157000000/sg_diagram/asset-1/diagram.pdf",
    ]);
    expect(
      erfAssetStoragePathCandidates(
        "user-1/csg:lpi:c03400140000157000000/sg_diagram/asset-1/diagram.pdf",
      ),
    ).toEqual(["user-1/csg:lpi:c03400140000157000000/sg_diagram/asset-1/diagram.pdf"]);
  });

  it("uses canonical path candidates for signing and deletion", () => {
    const source = read("src/lib/workbench/erfFileVault.ts");

    expect(source).toContain("createSignedUrl(storagePath, ERF_FILE_SIGNED_URL_TTL_SECONDS)");
    expect(source).toContain("for (const storagePath of erfAssetStoragePathCandidates");
    expect(source).toContain(".remove(erfAssetStoragePathCandidates(asset.storage_path))");
  });

  it("validates category-aware file limits and MIME types", () => {
    expect(
      validateErfAssetFile({ size: 1000, type: "application/pdf" }, "paid_report", "report.pdf"),
    ).toEqual({ ok: true });
    expect(
      validateErfAssetFile({ size: 1000, type: "image/jpeg" }, "site_photo", "site.jpg"),
    ).toEqual({ ok: true });
    expect(
      validateErfAssetFile({ size: 1000, type: "application/pdf" }, "site_photo", "plan.pdf"),
    ).toEqual({ ok: false, reason: "unsupported_type" });
    expect(validateErfAssetFile({ size: 0, type: "application/pdf" }, "paid_report")).toEqual({
      ok: false,
      reason: "empty_file",
    });
  });

  it("groups all Easy Erf vault asset categories for the final report", () => {
    const grouped = groupErfAssets([
      asset({ asset_category: "sg_diagram" }),
      asset({ asset_category: "paid_report" }),
      asset({ asset_category: "generated_design" }),
    ]);

    expect(assetGroupForCategory("sg_diagram")).toBe("Official and source documents");
    expect(grouped["Official and source documents"]).toHaveLength(1);
    expect(grouped["Paid reports"]).toHaveLength(1);
    expect(grouped["Generated concepts"]).toHaveLength(1);
  });

  it("creates idempotent migration fingerprints from legacy local attachments", () => {
    expect(
      localAttachmentMigrationFingerprint({
        id: "legacy-1",
        parcelId: "parcel-1",
        kind: "paid-report-lightstone",
        provider: "lightstone",
        status: "uploaded_reference_only",
        fileName: "lightstone.pdf",
        fileType: "application/pdf",
        fileSize: 1234,
        uploadedAt: "2026-07-13T10:00:00.000Z",
        sourceLabel: "User uploaded Lightstone report",
        file: new Blob(["pdf"], { type: "application/pdf" }),
      }),
    ).toBe(
      "local-v1:parcel-1:paid-report-lightstone:lightstone:lightstone.pdf:1234:2026-07-13T10:00:00.000Z",
    );
  });
});
