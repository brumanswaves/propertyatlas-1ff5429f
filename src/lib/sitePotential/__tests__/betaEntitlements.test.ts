import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  betaIdempotencyPrefix,
  isBetaAdminAllowed,
  isSitePotentialBetaGenerationReady,
  isSitePotentialBetaEnabled,
} from "../betaEntitlements";

function read(path: string) {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

describe("Site Potential private beta entitlements", () => {
  it("keeps beta mode disabled unless explicitly configured", () => {
    expect(isSitePotentialBetaEnabled({ SITE_POTENTIAL_BETA_ENABLED: undefined })).toBe(false);
    expect(isSitePotentialBetaEnabled({ SITE_POTENTIAL_BETA_ENABLED: "false" })).toBe(false);
    expect(isSitePotentialBetaEnabled({ SITE_POTENTIAL_BETA_ENABLED: "true" })).toBe(true);
  });

  it("allows only allowlisted administrators to grant beta credits", () => {
    expect(
      isBetaAdminAllowed(
        {
          SITE_POTENTIAL_BETA_ENABLED: "false",
          SITE_POTENTIAL_BETA_ADMIN_ALLOWLIST: "admin@example.com",
        },
        { id: "admin-id", email: "admin@example.com" },
      ),
    ).toMatchObject({ allowed: false });

    expect(
      isBetaAdminAllowed(
        {
          SITE_POTENTIAL_BETA_ENABLED: "true",
          SITE_POTENTIAL_BETA_ADMIN_ALLOWLIST: "admin@example.com",
        },
        { id: "user-id", email: "user@example.com" },
      ),
    ).toMatchObject({ allowed: false });

    expect(
      isBetaAdminAllowed(
        {
          SITE_POTENTIAL_BETA_ENABLED: "true",
          SITE_POTENTIAL_BETA_ADMIN_ALLOWLIST: "admin@example.com",
        },
        { id: "admin-id", email: "admin@example.com" },
      ),
    ).toMatchObject({ allowed: true });
  });

  it("uses a project-scoped beta idempotency prefix", () => {
    expect(
      betaIdempotencyPrefix({
        userId: "user-1",
        parcelId: "parcel-1",
        siteProjectId: "project-1",
      }),
    ).toBe("beta:user-1:parcel-1:project-1");
  });

  it("requires the worker and server secrets before beta generation is ready", () => {
    expect(
      isSitePotentialBetaGenerationReady({
        SITE_POTENTIAL_BETA_ENABLED: "true",
        SITE_POTENTIAL_WORKER_ENABLED: "true",
        SITE_POTENTIAL_WORKER_SECRET: "worker-secret",
        OPENAI_API_KEY: "openai-key",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
      }),
    ).toBe(true);

    expect(
      isSitePotentialBetaGenerationReady({
        SITE_POTENTIAL_BETA_ENABLED: "true",
        SITE_POTENTIAL_WORKER_ENABLED: "false",
        SITE_POTENTIAL_WORKER_SECRET: "worker-secret",
        OPENAI_API_KEY: "openai-key",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
      }),
    ).toBe(false);

    expect(
      isSitePotentialBetaGenerationReady({
        SITE_POTENTIAL_BETA_ENABLED: "true",
        SITE_POTENTIAL_WORKER_ENABLED: "true",
        SITE_POTENTIAL_WORKER_SECRET: "worker-secret",
        OPENAI_API_KEY: "",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
      }),
    ).toBe(false);
  });

  it("creates secure beta-credit tables and a service-role-only redemption RPC", () => {
    const migration = read("supabase/migrations/20260714113000_site_potential_beta_credits.sql");

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.site_potential_beta_credits");
    expect(migration).toContain("credits_granted integer NOT NULL CHECK (credits_granted > 0)");
    expect(migration).toContain("credits_used integer NOT NULL DEFAULT 0");
    expect(migration).toContain('CREATE POLICY "users read own beta credit balance"');
    expect(migration).not.toMatch(
      /site_potential_beta_credits FOR (INSERT|UPDATE|DELETE) TO authenticated/i,
    );
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS public.site_potential_beta_access_requests",
    );
    expect(migration).toContain("site_potential_beta_access_requests_one_open_idx");
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.consume_site_potential_beta_credit",
    );
    expect(migration).toContain("FOR UPDATE SKIP LOCKED");
    expect(migration).toContain("credits_used = credits_used + 1");
    expect(migration).toContain(
      "payment_provider,\n    payment_reference,\n    entitlement_status",
    );
    expect(migration).toContain("'beta_credit'");
    expect(migration).toContain("'amountCents', 0");
    expect(migration).toContain("UNIQUE");
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.consume_site_potential_beta_credit(uuid, text, uuid, text, timestamptz)",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.consume_site_potential_beta_credit(uuid, text, uuid, text, timestamptz)\nTO service_role",
    );
  });

  it("routes generation through free-first or purchased-credit entitlement and the durable queue", () => {
    const route = read("src/routes/api/site-potential.beta-redeem.ts");

    expect(route).toContain("isSitePotentialBetaEnabled");
    expect(route).toContain("isSitePotentialBetaGenerationReady");
    expect(route).toContain(
      "Site Potential generation is temporarily unavailable. No free allowance or credit has been used.",
    );
    expect(route.indexOf("isSitePotentialBetaGenerationReady")).toBeLessThan(
      route.indexOf("consumeSitePotentialEntitlement"),
    );
    expect(route).toContain("consumeSitePotentialEntitlement");
    expect(route).toContain("queueSitePotentialGeneration");
    expect(route).toContain("paymentProvider: entitlement.entitlementSource");
    expect(route).toContain("Three independent property concepts have been queued");
    expect(route).not.toContain("SITE_POTENTIAL_PRICE_CENTS");
  });

  it("keeps beta grants behind server-side admin allowlist and service role", () => {
    const route = read("src/routes/api/site-potential.beta-grant.ts");

    expect(route).toContain("isBetaAdminAllowed");
    expect(route).toContain("createServiceRoleSupabaseClient");
    expect(route).toContain("targetUserId");
    expect(route).toContain("A grant reason is required.");
    expect(route).not.toContain("VITE_SITE_POTENTIAL_BETA_UI");

    const server = read("src/lib/sitePotential/betaServer.ts");
    expect(server).toContain('from("site_potential_beta_access_requests")');
    expect(server).toContain('status: "approved"');
    expect(server).toContain('.eq("status", "open")');
  });

  it("shows free allowance and inline report-only concept selection while purchase UI is hidden", () => {
    const tab = read("src/components/property/dossier/SitePotentialTab.tsx");
    const progress = read("src/lib/sitePotential/generationProgress.ts");

    expect(tab).toContain("VITE_SITE_POTENTIAL_BETA_UI");
    expect(tab).toContain("Three site-grounded concepts");
    expect(tab).toContain("Generate 3 free concepts");
    expect(tab).toContain("Use 1 credit for 3 concepts");
    expect(tab).toContain("Allowance unavailable");
    expect(tab).toContain("Purchased credits");
    expect(tab).not.toContain("Buy more Site Potential credits");
    expect(tab).not.toContain("Checkout connection pending");
    expect(tab).toContain("Select for Easy Erf Report");
    expect(tab).toContain("createErfAssetSignedUrl");
    expect(tab).toContain("<img");
    expect(tab).not.toContain("Use selected concept in Strategy");
    expect(tab).not.toContain("onOpenStrategy");
    expect(tab).toContain("/api/site-potential/beta-redeem");
    expect(tab).toContain("/api/site-potential/pack-status");
    expect(tab).toContain("/api/site-potential/retry-pack");
    expect(tab).toContain("Site Potential generation progress");
    expect(progress).toContain("Waiting for generator");
    expect(progress).toContain("Waiting for the image generator to start.");
    expect(tab).toContain("Refresh status");
    expect(tab).toContain("Retry current pack");
    expect(tab).toContain("createSitePotentialPackStatusPoller");
    expect(tab).toContain("poller.start(false)");
    expect(tab).toContain("poller.stop()");
    expect(tab).toContain("assetDesignPackId(asset) === activeDesignPackId");
    expect(tab).toContain("packCompletedCount} of {packRequestedCount}");
  });

  it("adds free rolling limits and an immutable purchased-credit ledger for three-image packs", () => {
    const migration = read("supabase/migrations/20260715150000_site_potential_v2_entitlements.sql");
    const config = read("src/lib/sitePotential/config.ts");

    expect(config).toContain("rolling24Hours: 1");
    expect(config).toContain("rolling7Days: 3");
    expect(config).toContain("rolling30Days: 6");
    expect(config).not.toContain("sameParcelRolling30Days");
    expect(config).toContain("{ credits: 5, priceCents: 49_900");
    expect(config).toContain("{ credits: 10, priceCents: 89_900");
    expect(config).toContain("{ credits: 25, priceCents: 199_900");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.site_potential_credit_wallets");
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS public.site_potential_credit_purchases",
    );
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.site_potential_credit_ledger");
    expect(migration).toContain("idempotency_key text NOT NULL UNIQUE");
    expect(migration).toContain("v_used_24 < 1 AND v_used_7 < 3 AND v_used_30 < 6");
    expect(migration).toContain("requested_count, completed_count");
    expect(migration).toContain("'packSize', 3");
    expect(migration).toContain("'reserved', -1");
    expect(migration).toContain("'restored', 1");
    expect(migration).toContain("Pack did not complete all three concepts");
    expect(migration).not.toContain("item.option_index = 1");
    expect(migration).not.toContain("primary_item.option_index = 1");
  });

  it("advertises repeat-erf allowance in the Site Potential tab", () => {
    const tab = read("src/components/property/dossier/SitePotentialTab.tsx");
    expect(tab).toContain("1 / day · 3 / week · 6 / month free");
    expect(tab).toContain(
      "You may use your available packs on the same erf or across different properties.",
    );
    expect(tab).toContain("Repeat use on this erf");
    expect(tab).not.toContain("sameParcelEligible");
    expect(tab).not.toContain(">This erf<");
    expect(tab).not.toContain("Not eligible");
  });

  it("adds a provider-neutral authenticated pack status endpoint", () => {
    const route = read("src/routes/api/site-potential.pack-status.ts");
    const server = read("src/lib/sitePotential/betaServer.ts");

    expect(route).toContain('createFileRoute("/api/site-potential/pack-status")');
    expect(route).toContain("authenticateApiRequest");
    expect(route).toContain("readSitePotentialPackStatus");
    expect(route).toContain("parcelId and siteProjectId are required.");
    expect(server).toContain('from("erf_site_projects")');
    expect(server).toContain('from("erf_design_packs")');
    expect(server).toContain('from("erf_design_pack_items")');
    expect(server).toContain('.eq("user_id", input.userId)');
    expect(server).toContain("workerHeartbeatAt");
    expect(server).toContain("workerActive");
    expect(server).toContain("hasRetryableWork");
    expect(server).toContain("terminal");
    expect(server).not.toContain("workerId: String");
  });

  it("retries the current pack without consuming another entitlement or worker secret", () => {
    const route = read("src/routes/api/site-potential.retry-pack.ts");
    const server = read("src/lib/sitePotential/betaServer.ts");
    const tab = read("src/components/property/dossier/SitePotentialTab.tsx");

    expect(route).toContain('createFileRoute("/api/site-potential/retry-pack")');
    expect(route).toContain("authenticateApiRequest");
    expect(route).toContain("retrySitePotentialPack");
    expect(route).not.toContain("SITE_POTENTIAL_WORKER_SECRET");
    expect(route).not.toContain("consumeSitePotentialEntitlement");
    expect(route).not.toContain("consumeSitePotentialBetaCredit");
    expect(route).not.toContain("redeem_site_potential_pack_v2");
    expect(server).toContain("export async function retrySitePotentialPack");
    expect(server).toContain('status: "queued"');
    expect(server).toContain('generation_status: "generating"');
    expect(tab).toContain("No additional credit was used.");
  });

  it("keeps real staging proof separate from mocked/local tests", () => {
    const script = read("scripts/site-potential-beta-staging-check.ts");

    expect(script).toContain("This intentionally calls the real beta redemption endpoint");
    expect(script).toContain("/api/site-potential/beta-redeem");
    expect(script).toContain("/api/site-potential/pack-status");
    expect(script).toContain("EASY_ERF_BASE_URL");
  });

  it("removes the same-parcel gate from the redemption function", () => {
    const migration = read(
      "supabase/migrations/20260723110000_allow_repeat_site_potential_free_packs_per_erf.sql",
    );
    // Strip SQL comments before asserting on executable content.
    const executable = migration
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    expect(executable).not.toContain("v_same_parcel_30");
    expect(executable).not.toMatch(/parcel_id\s*=\s*p_parcel_id/);
    expect(executable).not.toContain("v_same_parcel_30 < 1");
  });
});
