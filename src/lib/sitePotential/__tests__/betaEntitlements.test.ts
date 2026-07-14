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

  it("routes beta redemption through the entitlement transaction and durable queue", () => {
    const route = read("src/routes/api/site-potential.beta-redeem.ts");

    expect(route).toContain("isSitePotentialBetaEnabled");
    expect(route).toContain("isSitePotentialBetaGenerationReady");
    expect(route).toContain(
      "Private beta generation is temporarily unavailable. Your beta credit has not been used.",
    );
    expect(route.indexOf("isSitePotentialBetaGenerationReady")).toBeLessThan(
      route.indexOf("consumeBetaCreditForDesignPack"),
    );
    expect(route).toContain("consumeBetaCreditForDesignPack");
    expect(route).toContain("queueSitePotentialGeneration");
    expect(route).toContain('paymentProvider: "beta_credit"');
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

  it("shows private beta UI states without fake checkout copy", () => {
    const tab = read("src/components/property/dossier/SitePotentialTab.tsx");

    expect(tab).toContain("VITE_SITE_POTENTIAL_BETA_UI");
    expect(tab).toContain("AI Property Concepts - Private Beta");
    expect(tab).toContain("Generate with beta credit");
    expect(tab).toContain("No beta credits available");
    expect(tab).toContain("Request beta access");
    expect(tab).toContain(
      "Easy Erf is currently testing AI property visualisations with selected users.",
    );
    expect(tab).toContain("/api/site-potential/beta-redeem");
    expect(tab).toContain("/api/site-potential/beta-request");
    expect(tab).toContain("/api/site-potential/pack-status");
    expect(tab).toContain("createSitePotentialPackStatusPoller");
    expect(tab).toContain("poller.start(false)");
    expect(tab).toContain("poller.stop()");
    expect(tab).toContain("assetDesignPackId(asset) === activeDesignPackId");
    expect(tab).toContain("packCompletedCount} of {packRequestedCount}");
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
    expect(server).not.toContain("worker_id:");
    expect(server).not.toContain("lease_expires_at:");
  });

  it("keeps real staging proof separate from mocked/local tests", () => {
    const script = read("scripts/site-potential-beta-staging-check.ts");

    expect(script).toContain("This intentionally calls the real beta redemption endpoint");
    expect(script).toContain("/api/site-potential/beta-redeem");
    expect(script).toContain("/api/site-potential/pack-status");
    expect(script).toContain("EASY_ERF_BASE_URL");
  });
});
