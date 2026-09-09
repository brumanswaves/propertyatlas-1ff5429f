import { z } from "zod";
import { ApiRequestError, authenticateApiRequest, createServiceRoleSupabaseClient } from "@/lib/sitePotential/serverAuth";
import { investigationAssetSchema, orderInvestigationSchema } from "./sharedInvestigation";
import { investigationReviewVersionSchema } from "./investigationReviewVersion";
import { canonicalErfAssetStoragePath, safeErfAssetPathSegment } from "@/lib/workbench/erfFileVault";

const inputSchema = z.object({ orderId: z.string().uuid(), assetId: z.string().uuid(), versionId: z.string().uuid().optional(), preview: z.boolean().default(false) }).strict();
const imageMimes = new Set(["image/png", "image/jpeg", "image/webp"]);
const documentMimes = new Set([...imageMimes, "application/pdf", "image/tiff"]);
export interface InvestigationAssetServerDeps {
  authenticate?: typeof authenticateApiRequest;
  serviceClient?: typeof createServiceRoleSupabaseClient;
}
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
function unavailable(status: number) { return Response.json({ error: "This document is unavailable for this investigation." }, { status, headers }); }

export async function handleInvestigationAssetRequest(request: Request, deps: InvestigationAssetServerDeps = {}) {
  try {
    if (request.method !== "POST") return unavailable(405);
    const auth = await (deps.authenticate ?? authenticateApiRequest)(request);
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > 4096) return unavailable(413);
    const input = inputSchema.parse(JSON.parse(text));
    const scoped = await auth.supabase.rpc("read_order_investigation", { p_order_id: input.orderId });
    if (scoped.error) return unavailable(403);
    const scope = orderInvestigationSchema.parse(scoped.data);
    const assetInput = { p_order_id: input.orderId, p_asset_id: input.assetId, ...(input.versionId ? { p_version_id: input.versionId } : {}) };
    const result = await auth.supabase.rpc("read_order_investigation_asset", assetInput);
    if (result.error) return unavailable(403);
    const asset = investigationAssetSchema.parse(result.data);
    if (asset.id !== input.assetId || asset.user_id !== scope.customerId || asset.parcel_id !== scope.parcelId || scope.orderId !== input.orderId) return unavailable(403);
    if (input.versionId) {
      const saved = await auth.supabase.rpc("read_investigation_review", { p_order_id: input.orderId, p_version_id: input.versionId });
      if (saved.error) return unavailable(403);
      const version = investigationReviewVersionSchema.parse(saved.data);
      if (version.id !== input.versionId || version.order_id !== scope.orderId || version.customer_id !== scope.customerId
        || !version.evidence_snapshot.assets.some((item) => item.id === asset.id && item.checksum_sha256 === asset.checksum_sha256 && item.storage_path === asset.storage_path)) return unavailable(403);
    }
    // Owning the investigation does not confer rights to redistribute a licensed provider PDF.
    if (asset.asset_category === "paid_report" && auth.user.id === scope.customerId && asset.metadata.redistributionAllowed !== true) return unavailable(403);
    const canonical = canonicalErfAssetStoragePath(asset.storage_path);
    const prefix = `${asset.user_id}/${safeErfAssetPathSegment(asset.parcel_id)}/${asset.asset_category}/${asset.id}/`;
    if (asset.storage_bucket !== "erf-files" || !canonical.startsWith(prefix) || canonical.includes("..")) return unavailable(403);
    let path = canonical;
    let mime = asset.mime_type.split(";", 1)[0].trim().toLowerCase();
    if (input.preview) {
      const preview = asset.metadata.sgPreviewStoragePath;
      if (typeof preview === "string" && preview.trim()) {
        path = canonicalErfAssetStoragePath(preview);
        mime = String(asset.metadata.sgPreviewMimeType ?? "").toLowerCase();
        if (!path.startsWith(`${prefix}derived/`) || path.includes("..")) return unavailable(403);
      }
      if (!imageMimes.has(mime)) return unavailable(404);
    }
    // A blob URL can execute active content even when its HTTP download used
    // Content-Disposition: attachment. Only passive document formats enter the viewer.
    if (!documentMimes.has(mime)) return unavailable(415);
    const service = (deps.serviceClient ?? createServiceRoleSupabaseClient)();
    const blob = await service.storage.from("erf-files").download(path);
    if (blob.error || !blob.data) return unavailable(404);
    if (!input.preview && asset.checksum_sha256) {
      const digest = await crypto.subtle.digest("SHA-256", await blob.data.arrayBuffer());
      const checksum = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
      if (checksum !== asset.checksum_sha256) return unavailable(409);
    }
    // A second authorization check after storage retrieval excludes a revocation during download.
    const stillAllowed = await auth.supabase.rpc("read_order_investigation_asset", assetInput);
    if (stillAllowed.error || JSON.stringify(stillAllowed.data) !== JSON.stringify(result.data)) return unavailable(403);
    return new Response(blob.data, { headers: { ...headers, "Content-Type": mime,
      "Content-Disposition": `${input.preview ? "inline" : "attachment"}; filename="${asset.original_file_name.replace(/[^a-zA-Z0-9._-]/g, "-")}"` } });
  } catch (error) {
    return unavailable(error instanceof ApiRequestError ? error.status : error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 503);
  }
}
