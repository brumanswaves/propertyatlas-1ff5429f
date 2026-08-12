import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { erfAssetCanConfirmIdentity } from "@/lib/evidence/extractionMetadata";
import { toSupabaseJson } from "@/lib/supabase/json";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import {
  readAllWorkspaceAttachments,
  removePaidReportAttachment,
  removeSgDiagramAttachment,
  type ErfWorkspaceAttachmentRecord,
} from "./erfWorkspaceFiles";

export const ERF_FILE_BUCKET = "erf-files";
export const ERF_FILE_SIGNED_URL_TTL_SECONDS = 10 * 60;

export type ErfAssetCategory =
  | "official_document"
  | "sg_diagram"
  | "paid_report"
  | "title_deed"
  | "zoning_document"
  | "topography"
  | "site_photo"
  | "existing_house_photo"
  | "architectural_plan"
  | "inspiration_image"
  | "generated_design"
  | "report_export"
  | "other";

export type ErfAssetStatus =
  | "pending_upload"
  | "uploaded_reference_only"
  | "processing"
  | "ready"
  | "failed"
  | "archived"
  | "deleted";

export interface ErfAsset {
  id: string;
  user_id: string;
  parcel_id: string;
  asset_category: ErfAssetCategory;
  asset_type: string;
  source_label: string | null;
  storage_bucket: string;
  storage_path: string;
  original_file_name: string;
  mime_type: string;
  size_bytes: number;
  checksum_sha256: string | null;
  status: ErfAssetStatus;
  metadata: Record<string, unknown>;
  local_migration_fingerprint: string | null;
  created_at: string;
  updated_at: string;
}

export type ErfAssetGroup =
  | "Official and source documents"
  | "Paid reports"
  | "Site and topography"
  | "Property photographs"
  | "Plans and inspiration"
  | "Generated concepts"
  | "Report exports"
  | "Other";

export interface UploadErfAssetInput {
  parcelId: string;
  file: File | Blob;
  fileName: string;
  category: ErfAssetCategory;
  assetType: string;
  sourceLabel: string;
  metadata?: Record<string, unknown>;
  localMigrationFingerprint?: string | null;
  status?: ErfAssetStatus;
  onProgress?: (progress: number, label: string) => void;
}

export function buildErfAssetExpectedIdentityContext(parcel: NormalizedOfficialParcel) {
  return {
    lpiCode: parcel.lpi,
    erfNumber: parcel.erfNumber == null ? null : String(parcel.erfNumber),
    portionNumber: parcel.portion == null ? "0" : String(parcel.portion),
    municipality: parcel.municipality,
    province: parcel.province,
    town: parcel.suburbOrArea ?? parcel.town,
    streetAddress:
      parcel.knownFields.find((field) => /working address|street address/i.test(field.label))?.value ??
      null,
  };
}

export interface VaultMigrationResult {
  attempted: number;
  uploaded: number;
  skipped: number;
  failed: number;
  messages: string[];
}

export type ErfAssetValidation =
  | { ok: true }
  | { ok: false; reason: "too_large" | "unsupported_type" | "empty_file" };

const MAX_BYTES_BY_CATEGORY: Record<ErfAssetCategory, number> = {
  official_document: 25 * 1024 * 1024,
  sg_diagram: 25 * 1024 * 1024,
  paid_report: 25 * 1024 * 1024,
  title_deed: 25 * 1024 * 1024,
  zoning_document: 25 * 1024 * 1024,
  topography: 25 * 1024 * 1024,
  site_photo: 15 * 1024 * 1024,
  existing_house_photo: 15 * 1024 * 1024,
  architectural_plan: 25 * 1024 * 1024,
  inspiration_image: 15 * 1024 * 1024,
  generated_design: 15 * 1024 * 1024,
  report_export: 25 * 1024 * 1024,
  other: 25 * 1024 * 1024,
};

const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/tiff",
  "image/tif",
  "image/webp",
]);

const PHOTO_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeAsset(row: Record<string, unknown>): ErfAsset {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    parcel_id: String(row.parcel_id),
    asset_category: String(row.asset_category) as ErfAssetCategory,
    asset_type: String(row.asset_type),
    source_label: row.source_label == null ? null : String(row.source_label),
    storage_bucket: String(row.storage_bucket ?? ERF_FILE_BUCKET),
    storage_path: String(row.storage_path),
    original_file_name: String(row.original_file_name),
    mime_type: String(row.mime_type),
    size_bytes: Number(row.size_bytes ?? 0),
    checksum_sha256: row.checksum_sha256 == null ? null : String(row.checksum_sha256),
    status: String(row.status ?? "uploaded_reference_only") as ErfAssetStatus,
    metadata: isRecord(row.metadata) ? row.metadata : {},
    local_migration_fingerprint:
      row.local_migration_fingerprint == null ? null : String(row.local_migration_fingerprint),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at ?? row.created_at),
  };
}

export function safeFileName(fileName: string) {
  const cleaned = fileName
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/\.+/g, ".")
    .slice(0, 120);
  return cleaned || "easy-erf-file";
}

export function safeErfAssetPathSegment(value: string) {
  const cleaned = value
    .normalize("NFKC")
    .split("")
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join("")
    .replace(/[\\/]+/g, "-")
    .trim()
    .slice(0, 180);
  return cleaned || "unknown-parcel";
}

export function canonicalErfAssetStoragePath(storagePath: string) {
  const parts = storagePath.split("/");
  if (parts.length < 2) return storagePath;
  const parcelSegment = parts[1].replace(/%3A/gi, ":");
  if (parcelSegment === parts[1]) return storagePath;
  return [parts[0], parcelSegment, ...parts.slice(2)].join("/");
}

export function erfAssetStoragePathCandidates(storagePath: string) {
  const canonical = canonicalErfAssetStoragePath(storagePath);
  return canonical === storagePath ? [storagePath] : [canonical, storagePath];
}

export function buildErfAssetStoragePath(input: {
  userId: string;
  parcelId: string;
  category: ErfAssetCategory;
  assetId: string;
  fileName: string;
}) {
  return [
    input.userId,
    safeErfAssetPathSegment(input.parcelId),
    input.category,
    input.assetId,
    safeFileName(input.fileName),
  ].join("/");
}

export function validateErfAssetFile(
  file: Pick<File | Blob, "size" | "type">,
  category: ErfAssetCategory,
  fileName = "file",
): ErfAssetValidation {
  if (file.size <= 0) return { ok: false, reason: "empty_file" };
  if (file.size > MAX_BYTES_BY_CATEGORY[category]) return { ok: false, reason: "too_large" };
  const lowerName = fileName.toLowerCase();
  const type = String(file.type ?? "").toLowerCase();
  const isPhotoCategory =
    category === "site_photo" ||
    category === "existing_house_photo" ||
    category === "inspiration_image" ||
    category === "generated_design";
  const allowed = isPhotoCategory ? PHOTO_MIME_TYPES : DOCUMENT_MIME_TYPES;
  const extensionSupported = isPhotoCategory
    ? /\.(png|jpe?g|webp)$/i.test(lowerName)
    : /\.(pdf|png|jpe?g|tiff?|webp)$/i.test(lowerName);
  return allowed.has(type) || extensionSupported
    ? { ok: true }
    : { ok: false, reason: "unsupported_type" };
}

export function assetGroupForCategory(category: ErfAssetCategory): ErfAssetGroup {
  switch (category) {
    case "official_document":
    case "sg_diagram":
    case "title_deed":
    case "zoning_document":
      return "Official and source documents";
    case "paid_report":
      return "Paid reports";
    case "topography":
      return "Site and topography";
    case "site_photo":
    case "existing_house_photo":
      return "Property photographs";
    case "architectural_plan":
    case "inspiration_image":
      return "Plans and inspiration";
    case "generated_design":
      return "Generated concepts";
    case "report_export":
      return "Report exports";
    default:
      return "Other";
  }
}

export function groupErfAssets(assets: ErfAsset[]) {
  return assets.reduce<Record<ErfAssetGroup, ErfAsset[]>>(
    (groups, asset) => {
      groups[assetGroupForCategory(asset.asset_category)].push(asset);
      return groups;
    },
    {
      "Official and source documents": [],
      "Paid reports": [],
      "Site and topography": [],
      "Property photographs": [],
      "Plans and inspiration": [],
      "Generated concepts": [],
      "Report exports": [],
      Other: [],
    },
  );
}

export function localAttachmentMigrationFingerprint(attachment: ErfWorkspaceAttachmentRecord) {
  return [
    "local-v1",
    attachment.parcelId,
    attachment.kind,
    attachment.provider ?? "none",
    attachment.fileName,
    attachment.fileSize,
    attachment.uploadedAt,
  ].join(":");
}

function localAttachmentCategory(attachment: ErfWorkspaceAttachmentRecord): ErfAssetCategory {
  if (attachment.kind === "sg-diagram") return "sg_diagram";
  if (attachment.kind === "paid-report-lightstone" || attachment.kind === "paid-report-windeed") {
    return "paid_report";
  }
  return "other";
}

function localAttachmentAssetType(attachment: ErfWorkspaceAttachmentRecord) {
  if (attachment.kind === "sg-diagram") return "sg_diagram";
  if (attachment.provider) return `${attachment.provider}_report`;
  return attachment.kind;
}

export async function currentVaultUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Sign in to use the Erf File Vault.");
  return data.user.id;
}

export async function listErfAssets(parcelId: string, categories?: ErfAssetCategory[]) {
  const userId = await currentVaultUserId();
  let query = supabase
    .from("erf_assets")
    .select("*")
    .eq("user_id", userId)
    .eq("parcel_id", parcelId)
    .neq("status", "deleted")
    .order("created_at", { ascending: false });
  if (categories?.length) query = query.in("asset_category", categories);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data : []).map(normalizeAsset);
}

export async function uploadErfAsset(input: UploadErfAssetInput) {
  input.onProgress?.(5, "Checking sign-in");
  const userId = await currentVaultUserId();
  const validation = validateErfAssetFile(input.file, input.category, input.fileName);
  if (!validation.ok) return validation;

  const assetId = crypto.randomUUID();
  const storagePath = buildErfAssetStoragePath({
    userId,
    parcelId: input.parcelId,
    category: input.category,
    assetId,
    fileName: input.fileName,
  });

  input.onProgress?.(25, "Uploading file");
  const { error: uploadError } = await supabase.storage
    .from(ERF_FILE_BUCKET)
    .upload(storagePath, input.file, {
      cacheControl: "3600",
      contentType: input.file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) throw new Error(uploadError.message);

  input.onProgress?.(75, "Saving file metadata");
  const payload: TablesInsert<"erf_assets"> = {
    id: assetId,
    user_id: userId,
    parcel_id: input.parcelId,
    asset_category: input.category,
    asset_type: input.assetType,
    source_label: input.sourceLabel,
    storage_bucket: ERF_FILE_BUCKET,
    storage_path: storagePath,
    original_file_name: input.fileName,
    mime_type: input.file.type || "application/octet-stream",
    size_bytes: input.file.size,
    status: input.status ?? "uploaded_reference_only",
    metadata: toSupabaseJson(input.metadata ?? {}),
    local_migration_fingerprint: input.localMigrationFingerprint ?? null,
  };

  const { data, error: insertError } = await supabase
    .from("erf_assets")
    .insert(payload)
    .select("*")
    .single();
  if (insertError) {
    await supabase.storage.from(ERF_FILE_BUCKET).remove([storagePath]);
    throw new Error(insertError.message);
  }
  input.onProgress?.(100, "File saved");
  return { ok: true as const, asset: normalizeAsset(data) };
}

export async function createErfAssetSignedUrl(asset: ErfAsset) {
  let lastError: unknown = null;
  for (const storagePath of erfAssetStoragePathCandidates(asset.storage_path)) {
    const { data, error } = await supabase.storage
      .from(asset.storage_bucket || ERF_FILE_BUCKET)
      .createSignedUrl(storagePath, ERF_FILE_SIGNED_URL_TTL_SECONDS);
    if (data?.signedUrl) return data.signedUrl;
    lastError = error;
  }
  const message =
    lastError && typeof lastError === "object" && "message" in lastError
      ? String((lastError as { message?: unknown }).message)
      : "Could not open file.";
  throw new Error(message);
}

const PREVIEW_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function createErfAssetPreviewSignedUrl(asset: ErfAsset) {
  const previewPath = asset.metadata.sgPreviewStoragePath;
  const mimeType = String(asset.metadata.sgPreviewMimeType ?? asset.mime_type).split(";")[0].toLowerCase();
  const path = typeof previewPath === "string" && previewPath.trim()
    ? previewPath.trim()
    : PREVIEW_MIME_TYPES.has(mimeType)
      ? asset.storage_path
      : null;
  if (!path) return null;
  const candidates = erfAssetStoragePathCandidates(path);
  for (const candidate of candidates) {
    const { data, error } = await supabase.storage
      .from(asset.storage_bucket || ERF_FILE_BUCKET)
      .createSignedUrl(candidate, ERF_FILE_SIGNED_URL_TTL_SECONDS);
    if (!error && data?.signedUrl) return data.signedUrl;
  }
  return null;
}

export async function confirmErfAssetIdentityForParcel(asset: ErfAsset) {
  const userId = await currentVaultUserId();
  if (asset.user_id !== userId) throw new Error("This file does not belong to the signed-in user.");
  if (!erfAssetCanConfirmIdentity(asset)) {
    throw new Error("Only a readable document that needs confirmation can be attached this way.");
  }
  const metadata = {
    ...asset.metadata,
    identityUserConfirmedAt: new Date().toISOString(),
    identityUserConfirmedParcelId: asset.parcel_id,
    identityBinding: "user_confirmed",
  };
  const { data, error } = await supabase
    .from("erf_assets")
    .update({ metadata: toSupabaseJson(metadata) })
    .eq("id", asset.id)
    .eq("user_id", userId)
    .eq("parcel_id", asset.parcel_id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return normalizeAsset(data);
}

export async function deleteErfAsset(asset: ErfAsset) {
  const { error: removeError } = await supabase.storage
    .from(asset.storage_bucket || ERF_FILE_BUCKET)
    .remove(erfAssetStoragePathCandidates(asset.storage_path));
  if (removeError) throw new Error(removeError.message);
  const { error: deleteError } = await supabase
    .from("erf_assets")
    .delete()
    .eq("id", asset.id);
  if (deleteError) throw new Error(deleteError.message);
}

export async function migrateLocalWorkspaceAttachmentsToVault(parcelId: string) {
  const result: VaultMigrationResult = {
    attempted: 0,
    uploaded: 0,
    skipped: 0,
    failed: 0,
    messages: [],
  };
  const userId = await currentVaultUserId();
  const localAttachments = await readAllWorkspaceAttachments(parcelId).catch(() => []);
  result.attempted = localAttachments.length;
  if (!localAttachments.length) return result;

  const fingerprints = localAttachments.map(localAttachmentMigrationFingerprint);
  const { data: existingRows, error } = await supabase
    .from("erf_assets")
    .select("local_migration_fingerprint")
    .eq("user_id", userId)
    .eq("parcel_id", parcelId)
    .in("local_migration_fingerprint", fingerprints);
  if (error) throw new Error(error.message);
  const existing = new Set(
    (Array.isArray(existingRows) ? existingRows : [])
      .map((row) => String(row.local_migration_fingerprint ?? ""))
      .filter(Boolean),
  );

  for (const attachment of localAttachments) {
    const fingerprint = localAttachmentMigrationFingerprint(attachment);
    if (existing.has(fingerprint)) {
      result.skipped += 1;
      continue;
    }
    try {
      const upload = await uploadErfAsset({
        parcelId,
        file: attachment.file,
        fileName: attachment.fileName,
        category: localAttachmentCategory(attachment),
        assetType: localAttachmentAssetType(attachment),
        sourceLabel: attachment.sourceLabel,
        localMigrationFingerprint: fingerprint,
        metadata: {
          migratedFrom: "indexeddb",
          legacyId: attachment.id,
          legacyKind: attachment.kind,
          provider: attachment.provider ?? null,
          uploadedAt: attachment.uploadedAt,
        },
      });
      if (!upload.ok) {
        result.failed += 1;
        result.messages.push(`${attachment.fileName}: ${upload.reason}`);
        continue;
      }
      if (attachment.kind === "sg-diagram") {
        await removeSgDiagramAttachment(parcelId, attachment.id);
      } else if (attachment.provider) {
        await removePaidReportAttachment(parcelId, attachment.provider, attachment.id);
      }
      result.uploaded += 1;
    } catch (migrationError) {
      result.failed += 1;
      result.messages.push(
        `${attachment.fileName}: ${
          migrationError instanceof Error ? migrationError.message : "Migration failed"
        }`,
      );
    }
  }
  return result;
}
