import { z } from "zod";
import { ApiRequestError, authenticateApiRequest, createServiceRoleSupabaseClient } from "@/lib/sitePotential/serverAuth";
import { investigationAssetSchema } from "./sharedInvestigation";
import { buildErfAssetStoragePath, validateErfAssetFile } from "@/lib/workbench/erfFileVault";

const MAX_UPLOAD = 26_214_400;
const inputSchema = z.object({ orderId: z.string().uuid(), revision: z.coerce.number().int().nonnegative(),
  assetType: z.string().trim().min(1).max(120), sourceLabel: z.string().trim().min(1).max(200),
  category: z.enum(["official_document", "sg_diagram", "paid_report", "title_deed", "zoning_document", "topography", "site_photo", "existing_house_photo", "architectural_plan", "other"]) });
export interface InvestigationUploadServerDeps { authenticate?: typeof authenticateApiRequest; serviceClient?: typeof createServiceRoleSupabaseClient }
function fail(message: string, status: number) { return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } }); }

export async function handleInvestigationUploadRequest(request: Request, deps: InvestigationUploadServerDeps = {}) {
  try {
    if (request.method !== "POST") return fail("Method not allowed.", 405);
    const auth = await (deps.authenticate ?? authenticateApiRequest)(request);
    // Bound multipart parsing before reading the file into memory.
    const reader = request.body?.getReader();
    if (!reader) return fail("No document was supplied.", 400);
    const chunks: Uint8Array<ArrayBuffer>[] = []; let length = 0;
    while (true) {
      const part = await reader.read(); if (part.done) break;
      length += part.value.byteLength;
      if (length > MAX_UPLOAD + 65_536) { await reader.cancel(); return fail("Document exceeds the upload limit.", 413); }
      chunks.push(new Uint8Array(part.value));
    }
    const form = await new Response(new Blob(chunks), { headers: { "Content-Type": request.headers.get("Content-Type") ?? "" } }).formData();
    const input = inputSchema.parse({ orderId: form.get("orderId"), revision: form.get("revision"), category: form.get("category"),
      assetType: form.get("assetType"), sourceLabel: form.get("sourceLabel") });
    const file = form.get("file");
    if (!file || typeof file === "string" || file.size > MAX_UPLOAD) return fail("A supported document is required.", 400);
    const validation = validateErfAssetFile(file, input.category, file.name);
    if (!validation.ok) return fail(validation.reason === "too_large" ? "The file exceeds this category's size limit." : "The file is empty or its type is unsupported.", 400);
    const reserved = await auth.supabase.rpc("reserve_order_investigation_asset", { p_order_id: input.orderId,
      p_expected_revision: input.revision, p_category: input.category, p_name: file.name, p_mime: file.type, p_size: file.size });
    if (reserved.error) return fail(reserved.error.code === "40001" ? "Evidence changed. Reload before uploading." : "This upload is not authorized.", reserved.error.code === "40001" ? 409 : 403);
    const asset = investigationAssetSchema.parse(reserved.data);
    const expectedPath = buildErfAssetStoragePath({ userId: asset.user_id, parcelId: asset.parcel_id, category: input.category, assetId: asset.id, fileName: file.name });
    const prefix = expectedPath.slice(0, expectedPath.lastIndexOf("/") + 1);
    const filename = asset.storage_path.slice(prefix.length);
    if (asset.storage_bucket !== "erf-files" || !asset.storage_path.startsWith(prefix) || !filename || /[\\/]/.test(filename) || filename.includes("..")) return fail("Upload path could not be verified.", 409);
    const service = (deps.serviceClient ?? createServiceRoleSupabaseClient)();
    const bytes = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const checksum = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
    const uploaded = await service.storage.from("erf-files").upload(asset.storage_path, bytes, { contentType: file.type, upsert: false, cacheControl: "0" });
    const finished = await service.rpc("finish_order_investigation_asset", {
      p_order_id: input.orderId, p_asset_id: asset.id, p_actor_id: auth.user.id, p_uploaded: !uploaded.error,
      p_checksum: uploaded.error ? null : checksum,
      p_permissions: { aiProcessingAllowed: form.get("aiProcessingAllowed") === "true", redistributionAllowed: form.get("redistributionAllowed") === "true",
        assetType: input.assetType, sourceLabel: input.sourceLabel },
    });
    if (uploaded.error || finished.error) {
      if (!uploaded.error) await service.storage.from("erf-files").remove([asset.storage_path]);
      return fail("The upload was not completed. Reload the investigation before retrying.", 409);
    }
    return Response.json({ ok: true, assetId: asset.id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail("The document could not be uploaded.", error instanceof ApiRequestError ? error.status : error instanceof z.ZodError ? 400 : 503);
  }
}
