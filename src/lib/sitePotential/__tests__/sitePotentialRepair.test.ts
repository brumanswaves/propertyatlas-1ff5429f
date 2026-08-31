import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import {
  buildGeneratedDesignMetadata,
  designPackItemRows,
  designPackStatusFromItems,
  requiresImageEditPath,
  retryableDesignPackItems,
  sourceAssetsForGenerationMode,
} from "../generationJobs";
import { buildSitePotentialPrompt } from "../generation";
import { describeSitePotentialParcelContext } from "../parcelContext";
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

  it("keeps historical worker migrations portable without seeding deployment configuration", () => {
    const lovableRoleMigration = read(
      "supabase/migrations/20260720150455_4818e236-9455-49f6-81c7-397ecbb12bac.sql",
    );
    const workerUrlMigration = read(
      "supabase/migrations/20260813090000_make_site_potential_worker_portable.sql",
    );
    const workerScheduleMigration = read(
      "supabase/migrations/20260720150510_f8470865-5fa1-4143-83f0-acb6d16c115d.sql",
    );
    const migrationNames = readdirSync("supabase/migrations")
      .filter((name) => name.endsWith(".sql"))
      .sort();
    const historicalMigrationNames = [
      "20260610065719_286b13eb-4dee-460b-a0c0-6339f6162c22.sql",
      "20260610065753_4e315e28-7e34-4f00-bc3d-630d856f957b.sql",
      "20260617151453_6f98a6cb-76a6-428a-aafb-a1384e439788.sql",
      "20260617151510_bdf53030-c4b4-4343-9e7e-f38d5f6654ca.sql",
      "20260617153206_9c7217f5-c6cf-4802-97ed-89b234837e33.sql",
      "20260617153220_4c24d38a-0ab3-4ea9-a3d8-80a00f578387.sql",
      "20260617160402_cafa6599-8384-4eb2-959c-b2867542794b.sql",
      "20260617162228_6dbfa98a-1e97-4a87-a3268c9923e7.sql",
      "20260618124248_2c910e9a-41d0-4dc8-ac8e-8d5597688573.sql",
      "20260713090000_erf_file_vault_site_potential.sql",
      "20260713100000_repair_site_potential_security_jobs.sql",
      "20260714090000_site_potential_durable_generation_jobs.sql",
      "20260714103000_lock_site_potential_worker_rpc_leases.sql",
      "20260714113000_site_potential_beta_credits.sql",
      "20260714124500_site_potential_pack_completion_status.sql",
      "20260714133000_site_potential_retryable_pack_reconciliation.sql",
      "20260715131130_14a0ad68-a2f0-4fc1-97d9-6a2dfe8fb18a.sql",
      "20260715150000_site_potential_v2_entitlements.sql",
      "20260718085305_c77a3420-4a02-4475-a190-545c802c2944.sql",
      "20260720150359_8c82e8f6-1cc4-4afd-a359-7f016296099e.sql",
      "20260720150438_112ff1d2-8f81-4afb-953d-b83b2a86eaf2.sql",
      "20260720150455_4818e236-9455-49f6-81c7-397ecbb12bac.sql",
      "20260720150510_f8470865-5fa1-4143-83f0-acb6d16c115d.sql",
      "20260720193000_patch_saved_property_user_data.sql",
      "20260721141802_20cf1377-64a2-4dc8-ac8e-8d5597688573.sql",
      "20260723090000_normalize_erf_asset_storage_paths.sql",
      "20260723110000_allow_repeat_site_potential_free_packs_per_erf.sql",
    ];

    expect(lovableRoleMigration).toContain("FROM pg_roles");
    expect(lovableRoleMigration).toContain("rolname = 'sandbox_exec'");
    expect(lovableRoleMigration).toMatch(
      /IF EXISTS[\s\S]*GRANT USAGE ON SCHEMA private TO sandbox_exec;/,
    );
    expect(lovableRoleMigration).not.toMatch(
      /^GRANT USAGE ON SCHEMA private TO sandbox_exec;/m,
    );

    expect(workerUrlMigration).toContain("site_potential_worker_secret");
    expect(workerUrlMigration).toContain("site_potential_worker_url");
    expect(workerUrlMigration).toContain("IF v_secret IS NULL THEN");
    expect(workerUrlMigration).toContain("IF v_url IS NULL THEN");
    expect(workerUrlMigration).toContain("net.http_post");
    expect(workerUrlMigration).toContain("timeout_milliseconds := 55000");
    expect(workerUrlMigration).toContain("X-Site-Potential-Worker-Secret");
    expect(workerUrlMigration).not.toContain("erfstoep.lovable.app");
    expect(workerUrlMigration).not.toMatch(
      /INSERT INTO private\.worker_secrets|UPDATE private\.worker_secrets/i,
    );
    expect(workerUrlMigration).toContain("SECURITY DEFINER");
    expect(workerUrlMigration).toContain(
      "REVOKE ALL ON FUNCTION private.invoke_site_potential_worker(integer) FROM PUBLIC, anon, authenticated",
    );
    expect(workerUrlMigration).toContain(
      "GRANT EXECUTE ON FUNCTION private.invoke_site_potential_worker(integer) TO postgres, service_role",
    );
    expect(workerScheduleMigration).toContain(
      "SELECT private.invoke_site_potential_worker(1);",
    );

    expect(migrationNames).toHaveLength(31);
    expect(migrationNames).toEqual([
      ...historicalMigrationNames,
      "20260813090000_make_site_potential_worker_portable.sql",
      "20260829113000_secure_easy_erf_stripe_fulfillment.sql",
      "20260829140000_remove_legacy_report_order_policies.sql",
      "20260831090000_easy_erf_founder_fulfillment_controls.sql",
    ]);
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

  it("keeps generated Supabase types aligned with Site Potential and Erf File Vault migrations", () => {
    const types = read("src/integrations/supabase/types.ts");
    const requiredTables = [
      "erf_asset_events",
      "erf_assets",
      "erf_design_packs",
      "erf_design_pack_items",
      "erf_site_project_assets",
      "erf_site_projects",
      "site_potential_beta_access_requests",
      "site_potential_beta_credits",
    ];
    const requiredFunctions = [
      "claim_next_site_potential_item",
      "consume_site_potential_beta_credit",
      "finalize_site_potential_item",
      "recover_stale_site_potential_jobs",
      "renew_site_potential_item_lease",
    ];

    for (const table of requiredTables) {
      expect(types).toContain(`${table}: {`);
    }
    for (const fn of requiredFunctions) {
      expect(types).toContain(`${fn}: {`);
    }
    const finalizeStart = types.indexOf("finalize_site_potential_item: {");
    expect(finalizeStart).toBeGreaterThan(-1);
    let depth = 0;
    let finalizeEnd = -1;
    for (let i = finalizeStart; i < types.length; i++) {
      const ch = types[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          finalizeEnd = i + 1;
          break;
        }
      }
    }
    expect(finalizeEnd).toBeGreaterThan(finalizeStart);
    const finalizeBlock = types.slice(finalizeStart, finalizeEnd);
    const hasLegacyReturnAlias = finalizeBlock.includes(
      'Returns: Database["public"]["Tables"]["erf_assets"]["Row"]',
    );
    const hasSetofRelationship = /SetofOptions:\s*\{[^}]*to:\s*"erf_assets"/s.test(finalizeBlock);
    expect(hasLegacyReturnAlias || hasSetofRelationship).toBe(true);
    expect(finalizeBlock).toContain("p_source_label?: string");
  });

  it("keeps public and private worker routes on the same shared handler", () => {
    const privateRoute = read("src/routes/api/site-potential.process.ts");
    const publicRoute = read("src/routes/api/public.site-potential.process.ts");

    expect(privateRoute).toContain('createFileRoute("/api/site-potential/process")');
    expect(publicRoute).toContain('createFileRoute("/api/public/site-potential/process")');
    expect(privateRoute).toContain("@/lib/sitePotential/processWorkerRequest");
    expect(publicRoute).toContain("@/lib/sitePotential/processWorkerRequest");
    expect(privateRoute).toContain("handleProcessSitePotentialRequest(request)");
    expect(publicRoute).toContain("handleProcessSitePotentialRequest(request)");
    expect(privateRoute).not.toContain("createServiceRoleSupabaseClient");
    expect(publicRoute).not.toContain("createServiceRoleSupabaseClient");
  });

  it("exposes the public worker route in the generated route tree", () => {
    const routeTree = read("src/routeTree.gen.ts");

    expect(routeTree).toContain("'/api/site-potential/process'");
    expect(routeTree).toContain("'/api/public/site-potential/process'");
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

  it("creates stable three-slot jobs, retries only failed or missing options and reuses completed items", () => {
    expect(designPackItemRows({ userId: "u1", designPackId: "pack1" })).toMatchObject([
      { option_index: 1 },
      { option_index: 2 },
      { option_index: 3 },
    ]);

    const completed = item(1, "completed", 1);
    const failed = item(2, "failed", 1);
    const pending = item(3, "pending", 0);
    expect(retryableDesignPackItems([completed, failed, pending])).toMatchObject([
      { option_index: 2 },
      { option_index: 3 },
    ]);
  });

  it("reconciles retry-aware three-concept pack statuses consistently", () => {
    expect(designPackStatusFromItems([item(1, "completed", 1), item(2, "completed", 1), item(3, "completed", 1)])).toMatchObject({
      status: "ready",
      completedCount: 3,
      terminal: true,
    });
    expect(designPackStatusFromItems([item(1, "completed", 1), item(2, "failed", 1), item(3, "pending", 0)])).toMatchObject({
      status: "processing",
      completedCount: 1,
      hasRetryableWork: true,
      terminal: false,
    });
    expect(designPackStatusFromItems([item(1, "failed", 3), item(2, "failed", 3), item(3, "failed", 3)])).toMatchObject({
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
    expect(
      buildSitePotentialPrompt(
        {
          mode: "renovation",
          referenceLabels: ["existing house photo uploaded by the user"],
        },
        0,
      ),
    ).toContain("Reference image 1: existing house photo uploaded by the user");
    expect(buildSitePotentialPrompt({ mode: "renovation" }, 0)).toContain(
      "Preserve the recognisable house structure",
    );
  });

  it("creates three materially different site-grounded prompt directions without image text", () => {
    const parcelContext = {
      parcelId: "csg:lpi:test",
      sourceLabel: "Kouga SG Properties",
      erfNumber: 1570,
      portion: 0,
      lpi: "C03400140000157000000",
      parcelKey: "E108C034001400001570000000",
      municipality: "Kouga",
      province: "Eastern Cape",
      suburbOrArea: "St Francis Bay",
      town: "St Francis Bay",
      coordinates: { lng: 24.82, lat: -34.17 },
      knownFields: [],
      sourceAttributes: {},
      frontage: null,
      capturedAt: "2026-07-15T00:00:00.000Z",
    };
    const prompts = [0, 1, 2].map((optionIndex) =>
      buildSitePotentialPrompt(
        {
          mode: "vacant_land",
          parcelContext,
          referenceLabels: ["official highlighted parcel map", "uploaded topography image"],
        },
        optionIndex,
      ),
    );

    expect(prompts[0]).toContain("Sheltered Courtyard");
    expect(prompts[1]).toContain("View-Focused Linear");
    expect(prompts[2]).toContain("Split-Level Site Response");
    expect(new Set(prompts).size).toBe(3);
    for (const prompt of prompts) {
      expect(prompt).toContain("The three concepts are independent");
      expect(prompt).toContain("official highlighted parcel map");
      expect(prompt).toContain("Do not generate words, captions, labels");
      expect(prompt).not.toContain("AI-generated concept visualisation. Not an architectural plan");
    }
  });

  it("carries user-confirmed primary and secondary frontages into the site context without claiming planning evidence", () => {
    expect(
      describeSitePotentialParcelContext({
        parcelId: "csg:lpi:test",
        sourceLabel: "Kouga SG Properties",
        erfNumber: 1570,
        portion: 0,
        lpi: "C03400140000157000000",
        parcelKey: "E108C034001400001570000000",
        municipality: "Kouga",
        province: "Eastern Cape",
        suburbOrArea: "St Francis Bay",
        town: "St Francis Bay",
        coordinates: { lng: 24.82, lat: -34.17 },
        knownFields: [],
        sourceAttributes: {},
        frontage: {
          primaryStreet: "Padrone Crescent",
          secondaryStreets: ["Corner Road"],
          basis: "user_confirmed",
        },
        capturedAt: "2026-07-15T00:00:00.000Z",
      }),
    ).toContain("User-confirmed frontage: Padrone Crescent; secondary frontage: Corner Road");
  });

  it("defaults OpenAI image generation to GPT Image 2 landscape medium", () => {
    const metadata = buildGeneratedDesignMetadata({
      optionIndex: 1,
      prompt: "prompt",
      responseId: "resp",
      imageInputIds: [],
    });
    expect(metadata).toMatchObject({
      model: "gpt-image-2",
      size: "1536x1024",
      quality: "medium",
    });
  });

  it("uses canonical Erf File Vault paths for Site Potential reference downloads", () => {
    const source = read("supabase/functions/site-potential-worker/index.ts");
    expect(source).toContain("decodeErfAssetStoragePath");
    expect(source).toContain("createSignedUrl(decodedPath");
  });

  it("adds an idempotent guarded migration for legacy encoded Erf File Vault paths", () => {
    const migration = read(
      "supabase/migrations/20260723090000_normalize_erf_asset_storage_paths.sql",
    );
    expect(migration).toContain("decode");
    expect(migration).toContain("storage_path");
  });

  it("records generated-design provenance and source asset IDs", () => {
    expect(
      buildGeneratedDesignMetadata({
        optionIndex: 1,
        prompt: "prompt",
        responseId: "resp",
        imageInputIds: ["asset-1", "asset-2"],
      }),
    ).toMatchObject({
      optionIndex: 1,
      responseId: "resp",
      imageInputIds: ["asset-1", "asset-2"],
    });
  });

  it("repairs pack completion so one finalized item does not mark the project ready", () => {
    const migration = read(
      "supabase/migrations/20260714124500_site_potential_pack_completion_status.sql",
    );
    expect(migration).toContain("completed_count");
    expect(migration).toContain("completed_count >= 3");
  });
});

function item(optionIndex: number, status: string, attemptCount: number) {
  return {
    option_index: optionIndex,
    status,
    attempt_count: attemptCount,
    result_asset_id: status === "completed" ? `asset-${optionIndex}` : null,
    last_error: status === "failed" ? "failed" : null,
  };
}
