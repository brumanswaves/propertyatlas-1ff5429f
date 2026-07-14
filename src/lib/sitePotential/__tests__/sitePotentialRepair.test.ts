import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildGeneratedDesignMetadata,
  designPackItemRows,
  designPackStatusFromItems,
  requiresImageEditPath,
  retryableDesignPackItems,
  sourceAssetsForGenerationMode,
} from "../generationJobs";
import { buildSitePotentialPrompt } from "../generation";
import { isDevelopmentEntitlementAllowed } from "../serverAuth";

function read(path: string) {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

describe("Site Potential production-blocker repair", () => {
  it("locks worker-only RPC functions to service_role with exact signatures", () => {
    const migration = read(
      "supabase/migrations/20260714103000_lock_site_potential_worker_rpc_leases.sql",
    );

    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.recover_stale_site_potential_jobs(timestamptz, integer)\nFROM PUBLIC, anon, authenticated",
    );
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.claim_next_site_potential_item(text, timestamptz, timestamptz, integer)\nFROM PUBLIC, anon, authenticated",
    );
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.renew_site_potential_item_lease(uuid, text, timestamptz, timestamptz)\nFROM PUBLIC, anon, authenticated",
    );
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.finalize_site_potential_item(text, uuid, uuid, uuid, text, uuid, text, text, text, text, text, integer, jsonb, text)\nFROM PUBLIC, anon, authenticated",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.recover_stale_site_potential_jobs(timestamptz, integer)\nTO service_role",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.claim_next_site_potential_item(text, timestamptz, timestamptz, integer)\nTO service_role",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.renew_site_potential_item_lease(uuid, text, timestamptz, timestamptz)\nTO service_role",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.finalize_site_potential_item(text, uuid, uuid, uuid, text, uuid, text, text, text, text, text, integer, jsonb, text)\nTO service_role",
    );
  });

  it("counts claimed attempts and blocks finalisation after lease ownership is lost", () => {
    const migration = read(
      "supabase/migrations/20260714103000_lock_site_potential_worker_rpc_leases.sql",
    );

    expect(migration).toContain("attempt_count = attempt_count + 1");
    expect(migration).toContain("RETURNING attempt_count INTO v_attempt_count");
    expect(migration).toContain("AND item.attempt_count < p_max_attempts");
    expect(migration).toContain("WHEN attempt_count >= p_max_attempts THEN 'failed'");
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.renew_site_potential_item_lease",
    );
    expect(migration).toContain("AND item.worker_id = p_worker_id");
    expect(migration).toContain("AND item.lease_expires_at > p_now");
    expect(migration).toContain("OR item_row.lease_expires_at <= now()");
  });

  it("documents the trusted scheduler required for durable generation", () => {
    const doc = read("docs/SITE_POTENTIAL_WORKER_DEPLOYMENT.md");

    expect(doc).toContain("POST /api/site-potential/process");
    expect(doc).toContain("SITE_POTENTIAL_WORKER_SECRET");
    expect(doc).toContain(
      "`SITE_POTENTIAL_GENERATION_ENABLED=true` only after staging verification passes",
    );
    expect(doc).toContain(
      "Never expose the worker secret, service-role key, or OpenAI key to the browser.",
    );
  });

  it("removes browser write policies from design packs and adds trusted job items", () => {
    const migration = read(
      "supabase/migrations/20260713100000_repair_site_potential_security_jobs.sql",
    );

    expect(migration).toContain(
      'DROP POLICY IF EXISTS "users insert own pending design packs" ON public.erf_design_packs',
    );
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "users update own design packs" ON public.erf_design_packs',
    );
    expect(migration).not.toMatch(/CREATE POLICY .*design packs".*FOR INSERT TO authenticated/is);
    expect(migration).not.toMatch(/CREATE POLICY .*design packs".*FOR UPDATE TO authenticated/is);
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.erf_design_pack_items");
    expect(migration).toContain("UNIQUE (design_pack_id, option_index)");
    expect(migration).toContain('CREATE POLICY "users read own design pack items"');
    expect(migration).toContain("ensure_site_project_selected_design");
    expect(migration).toContain("ensure_site_project_asset_integrity");
  });

  it("keeps development entitlements unavailable in production and supports allowlists", () => {
    expect(
      isDevelopmentEntitlementAllowed(
        { NODE_ENV: "production", SITE_POTENTIAL_DEV_ENTITLEMENTS: "true" },
        { id: "admin", email: "admin@example.com" },
      ),
    ).toMatchObject({ allowed: false });

    expect(
      isDevelopmentEntitlementAllowed(
        {
          NODE_ENV: "development",
          SITE_POTENTIAL_DEV_ENTITLEMENTS: "true",
          SITE_POTENTIAL_DEV_ADMIN_ALLOWLIST: "admin@example.com",
        },
        { id: "user-1", email: "user@example.com" },
      ),
    ).toMatchObject({ allowed: false });

    expect(
      isDevelopmentEntitlementAllowed(
        {
          NODE_ENV: "development",
          SITE_POTENTIAL_DEV_ENTITLEMENTS: "true",
          SITE_POTENTIAL_DEV_ADMIN_ALLOWLIST: "admin@example.com",
        },
        { id: "user-1", email: "admin@example.com" },
      ),
    ).toMatchObject({ allowed: true });
  });

  it("creates stable six-slot jobs, retries only failed or missing options and reuses completed items", () => {
    expect(designPackItemRows({ userId: "u1", designPackId: "pack1" })).toMatchObject([
      { option_index: 1, status: "queued" },
      { option_index: 2, status: "queued" },
      { option_index: 3, status: "queued" },
      { option_index: 4, status: "queued" },
      { option_index: 5, status: "queued" },
      { option_index: 6, status: "queued" },
    ]);

    const items = [
      { id: "i1", option_index: 1, status: "complete" as const, generated_asset_id: "a1" },
      { id: "i2", option_index: 2, status: "failed" as const, generated_asset_id: null },
      { id: "i3", option_index: 3, status: "queued" as const, generated_asset_id: null },
      { id: "i4", option_index: 4, status: "generating" as const, generated_asset_id: null },
    ];

    expect(retryableDesignPackItems(items).map((item) => item.option_index)).toEqual([2, 3]);
    expect(designPackStatusFromItems(items)).toMatchObject({
      status: "generating",
      completedCount: 1,
    });

    const completeItems = designPackItemRows({ userId: "u1", designPackId: "pack2" }).map(
      (item) => ({
        ...item,
        id: `item-${item.option_index}`,
        status: "complete" as const,
        generated_asset_id: `asset-${item.option_index}`,
      }),
    );
    expect(designPackStatusFromItems(completeItems)).toMatchObject({
      status: "complete",
      completedCount: 6,
      terminal: true,
    });
  });

  it("reconciles retry-aware design pack statuses consistently", () => {
    const item = (
      optionIndex: number,
      status: "queued" | "generating" | "complete" | "failed",
      attemptCount = 0,
    ) => ({
      id: `item-${optionIndex}`,
      option_index: optionIndex,
      status,
      generated_asset_id: status === "complete" ? `asset-${optionIndex}` : null,
      attempt_count: attemptCount,
    });

    expect(
      designPackStatusFromItems([
        item(1, "failed", 1),
        item(2, "queued"),
        item(3, "queued"),
        item(4, "queued"),
        item(5, "queued"),
        item(6, "queued"),
      ]),
    ).toMatchObject({ status: "partial_failed", completedCount: 0, hasRetryableWork: true });

    expect(
      designPackStatusFromItems([
        item(1, "generating"),
        item(2, "queued"),
        item(3, "queued"),
        item(4, "queued"),
        item(5, "queued"),
        item(6, "queued"),
      ]),
    ).toMatchObject({ status: "generating", hasRetryableWork: true });

    expect(
      designPackStatusFromItems([
        item(1, "complete"),
        item(2, "complete"),
        item(3, "failed", 1),
        item(4, "queued"),
        item(5, "queued"),
        item(6, "queued"),
      ]),
    ).toMatchObject({ status: "partial_failed", completedCount: 2, hasRetryableWork: true });

    expect(
      designPackStatusFromItems([
        item(1, "complete"),
        item(2, "complete"),
        item(3, "failed", 3),
        item(4, "failed", 3),
        item(5, "failed", 3),
        item(6, "failed", 3),
      ]),
    ).toMatchObject({
      status: "partial_failed",
      completedCount: 2,
      hasRetryableWork: false,
      terminal: true,
    });

    expect(
      designPackStatusFromItems([
        item(1, "failed", 3),
        item(2, "failed", 3),
        item(3, "failed", 3),
        item(4, "failed", 3),
        item(5, "failed", 3),
        item(6, "failed", 3),
      ]),
    ).toMatchObject({
      status: "failed",
      completedCount: 0,
      hasRetryableWork: false,
      terminal: true,
    });
  });

  it("requires image-edit/reference-image generation for renovation source photos", () => {
    const source = {
      id: "photo-1",
      asset_category: "existing_house_photo",
      storage_path: "u/parcel/existing_house_photo/photo-1/photo.png",
      mime_type: "image/png",
    };

    expect(sourceAssetsForGenerationMode("renovation", [source])).toEqual([source]);
    expect(requiresImageEditPath("renovation", [source])).toBe(true);
    expect(buildSitePotentialPrompt({ mode: "renovation" }, 0)).toContain(
      "Use the supplied user-uploaded property photograph as the visual reference.",
    );
    expect(buildSitePotentialPrompt({ mode: "renovation" }, 0)).toContain(
      "Preserve the recognisable house structure",
    );
  });

  it("records generated-design provenance and source asset IDs", () => {
    expect(
      buildGeneratedDesignMetadata({
        designPackId: "pack-1",
        designPackItemId: "item-2",
        optionIndex: 2,
        siteProjectId: "project-1",
        sourceAssetIds: ["photo-1"],
        model: "gpt-image-1",
        prompt: "prompt text",
      }),
    ).toMatchObject({
      designPackId: "pack-1",
      designPackItemId: "item-2",
      optionIndex: 2,
      siteProjectId: "project-1",
      sourceAssetIds: ["photo-1"],
      model: "gpt-image-1",
      promptVersion: "site-potential-2026-07-secure-v2",
      disclaimer: expect.stringContaining("AI-generated concept visualisation"),
    });
  });

  it("repairs pack completion so one finalized item does not mark the project ready", () => {
    const migration = read(
      "supabase/migrations/20260714133000_site_potential_retryable_pack_reconciliation.sql",
    );

    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.finalize_site_potential_item");
    expect(migration).toContain("item_row.lease_expires_at <= now()");
    expect(migration).toContain("v_completed_count >= v_requested_count THEN 'complete'");
    expect(migration).toContain("WHEN v_generating_count > 0 THEN 'generating'");
    expect(migration).toContain(
      "WHEN v_failed_count > 0 AND v_eligible_count > 0 THEN 'partial_failed'",
    );
    expect(migration).toContain("WHEN v_eligible_count > 0 THEN 'queued'");
    expect(migration).toContain("v_pack_status = 'complete' THEN 'concepts_ready'");
    expect(migration).toContain(
      "WHEN v_eligible_count > 0 OR v_pack_status IN ('queued', 'generating') THEN 'generating'",
    );
    expect(migration).toContain("WHEN v_pack_status IN ('failed', 'partial_failed') THEN 'failed'");
    expect(migration).not.toContain("SET generation_status = 'concepts_ready'");
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.finalize_site_potential_item(text, uuid, uuid, uuid, text, uuid, text, text, text, text, text, integer, jsonb, text)\nFROM PUBLIC, anon, authenticated",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.finalize_site_potential_item(text, uuid, uuid, uuid, text, uuid, text, text, text, text, text, integer, jsonb, text)\nTO service_role",
    );
  });
});
