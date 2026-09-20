import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
const state = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }));
vi.mock("@/lib/sitePotential/runtimeEnv", () => ({ readServerEnv: (name: string) => state.env[name] }));
import { investigationBackend } from "../investigationBackend.server";
import { handleInvestigationUploadRequest } from "../investigationUploadServer";
import { handleInvestigationAssetRequest } from "../investigationAssetServer";
import { handleInvestigationReviewRequest } from "../investigationReviewServer";
import { buildErfAssetStoragePath } from "@/lib/workbench/erfFileVault";

const actor = "11111111-1111-4111-8111-111111111111";
const order = "22222222-2222-4222-8222-222222222222";
const assetId = "33333333-3333-4333-8333-333333333333";
const canonical = "https://xiqpfhsdlvwrwhclonsg.supabase.co";
function configure(url = canonical) {
  Object.assign(state.env, { EASY_ERF_SUPABASE_URL: url,
    EASY_ERF_SUPABASE_PUBLISHABLE_KEY: "canonical-public-fixture",
    EASY_ERF_SUPABASE_SERVICE_ROLE_KEY: "canonical-service-fixture" });
}
beforeEach(() => { state.env = { SUPABASE_URL: "https://retired.invalid",
  SUPABASE_PUBLISHABLE_KEY: "retired-public-fixture", SUPABASE_SERVICE_ROLE_KEY: "retired-service-fixture" }; });
afterEach(() => vi.restoreAllMocks());

describe("investigation routes use the canonical backend", () => {
  it("uploads original bytes through real SDK Auth, reservation, Storage and finalization on one isolated backend", async () => {
    const fileBytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4]);
    const storagePath = buildErfAssetStoragePath({ userId: actor, parcelId: "manual:fixture", category: "sg_diagram", assetId, fileName: "synthetic.png" });
    const calls: Array<{ path: string; key: string | undefined; body: Buffer }> = [];
    const server = createServer(async (req, res) => {
      const chunks: Buffer[] = []; for await (const part of req) chunks.push(Buffer.from(part));
      const body = Buffer.concat(chunks); calls.push({ path: req.url!, key: req.headers.apikey as string | undefined, body });
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/auth/v1/user") res.end(JSON.stringify({ id: actor, aud: "authenticated" }));
      else if (req.url === "/rest/v1/rpc/reserve_order_investigation_asset") res.end(JSON.stringify({
        id: assetId, user_id: actor, parcel_id: "manual:fixture", asset_category: "sg_diagram", asset_type: "sg_diagram",
        source_label: "Synthetic fixture", storage_bucket: "erf-files", storage_path: storagePath,
        original_file_name: "synthetic.png", mime_type: "image/png", size_bytes: fileBytes.length, checksum_sha256: null,
        status: "pending_upload", metadata: {}, local_migration_fingerprint: null, created_at: "2026-09-20", updated_at: "2026-09-20",
      }));
      else if (req.url?.startsWith("/storage/v1/object/erf-files/")) res.end(JSON.stringify({ Key: storagePath }));
      else if (req.url === "/rest/v1/rpc/finish_order_investigation_asset") res.end("null");
      else { res.statusCode = 404; res.end("{}"); }
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    try {
      configure(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
      const form = new FormData();
      Object.entries({ orderId: order, revision: "58", category: "sg_diagram", assetType: "sg_diagram", sourceLabel: "Synthetic fixture",
        aiProcessingAllowed: "false", redistributionAllowed: "false" }).forEach(([key, value]) => form.set(key, value));
      form.set("file", new Blob([fileBytes], { type: "image/png" }), "synthetic.png");
      const response = await handleInvestigationUploadRequest(new Request("http://localhost/api/investigations/upload", {
        method: "POST", headers: { Authorization: "Bearer synthetic-actor" }, body: form,
      }));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true, assetId });
      expect(calls.map(call => call.path)).toEqual(["/auth/v1/user", "/rest/v1/rpc/reserve_order_investigation_asset",
        `/storage/v1/object/erf-files/${storagePath}`, "/rest/v1/rpc/finish_order_investigation_asset"]);
      expect(calls.map(call => call.key)).toEqual(["canonical-public-fixture", "canonical-public-fixture", "canonical-service-fixture", "canonical-service-fixture"]);
      expect(calls[2].body).toEqual(Buffer.from(fileBytes));
      const finalization = JSON.parse(calls[3].body.toString());
      expect(finalization.p_checksum).toBe(Buffer.from(await crypto.subtle.digest("SHA-256", fileBytes)).toString("hex"));
      expect(finalization.p_permissions).toMatchObject({ aiProcessingAllowed: false, redistributionAllowed: false });
    } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  });
  it.each(["EASY_ERF_SUPABASE_URL", "EASY_ERF_SUPABASE_PUBLISHABLE_KEY", "EASY_ERF_SUPABASE_SERVICE_ROLE_KEY"])("rejects incomplete %s without generic credential fallback", async missing => {
    configure(); delete state.env[missing];
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network must not be used"));
    for (const handler of [handleInvestigationUploadRequest, handleInvestigationAssetRequest, handleInvestigationReviewRequest]) {
      const response = await handler(new Request("http://localhost/api/investigations/test", { method: "POST", headers: { Authorization: "Bearer synthetic" }, body: "{}" }));
      expect(response.status).toBe(503);
      expect(await response.text()).not.toMatch(/fixture|retired|Bearer/);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("uses the selected backend and service key for downstream functions even with retired generic values", () => {
    configure(); const backend = investigationBackend();
    expect(backend.env("SUPABASE_URL")).toBe(canonical);
    state.env.EASY_ERF_SUPABASE_SERVICE_ROLE_KEY = "changed-after-request-start";
    expect(backend.env("SUPABASE_SERVICE_ROLE_KEY")).toBe("canonical-service-fixture");
    expect(backend.env("SUPABASE_PUBLISHABLE_KEY")).toBe("canonical-public-fixture");
  });
  it("rejects a retired-only configuration before sending any token", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network must not be used"));
    await expect(investigationBackend().authenticate(new Request("http://localhost", { headers: { Authorization: "Bearer synthetic" } }))).rejects.toMatchObject({ status: 503 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
