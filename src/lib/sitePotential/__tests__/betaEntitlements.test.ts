import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  betaIdempotencyPrefix,
  isBetaAdminAllowed,
  isSitePotentialBetaGenerationReady,
  isSitePotentialBetaEnabled,
  resolveSitePotentialRuntimeReadiness,
} from "../betaEntitlements";
import {
  loadParcelBetaStatus,
  resolveSitePotentialGenerationAvailability,
  sitePotentialGenerationUnavailableReason,
  SITE_POTENTIAL_ALLOWANCE_SIGN_IN_MESSAGE,
  type BetaCreditUiStatus,
} from "../betaStatusRequest";

function read(path: string) {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function betaPayload(parcelId: string, creditsRemaining: number) {
  return {
    success: true,
    enabled: true,
    creditsRemaining,
    betaCreditsRemaining: creditsRemaining,
    purchasedCredits: 0,
    freeEligible: true,
    canGenerate: true,
    nextEntitlementSource: "free_allowance",
    free: {
      used24Hours: 0,
      used7Days: 0,
      used30Days: 0,
      remaining24Hours: creditsRemaining,
      remaining7Days: creditsRemaining,
      remaining30Days: creditsRemaining,
    },
    openRequestStatus: parcelId,
  };
}

const READY_RUNTIME_ENV = {
  SITE_POTENTIAL_BETA_ENABLED: "true",
  SITE_POTENTIAL_WORKER_ENABLED: "true",
  SITE_POTENTIAL_WORKER_SECRET: "worker-secret",
  OPENAI_API_KEY: "openai-key",
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "publishable-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
} as const;

describe("Site Potential private beta entitlements", () => {
  it("keeps a free allowance valid when purchased and beta credits are zero", () => {
    expect(
      sitePotentialGenerationUnavailableReason({
        enabled: true,
        creditsRemaining: 0,
        purchasedCredits: 0,
        betaCreditsRemaining: 0,
        freeEligible: true,
        canGenerate: true,
      }),
    ).toBe("Generation is available from the free allowance.");
    expect(
      sitePotentialGenerationUnavailableReason({
        enabled: true,
        creditsRemaining: 0,
        purchasedCredits: 0,
        betaCreditsRemaining: 0,
        freeEligible: false,
        canGenerate: false,
      }),
    ).toBe("No purchased or beta/test credits are available.");
  });
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
      isSitePotentialBetaGenerationReady(READY_RUNTIME_ENV),
    ).toBe(true);

    expect(
      isSitePotentialBetaGenerationReady({
        SITE_POTENTIAL_BETA_ENABLED: "true",
        SITE_POTENTIAL_WORKER_ENABLED: "false",
        SITE_POTENTIAL_WORKER_SECRET: "worker-secret",
        OPENAI_API_KEY: "openai-key",
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "publishable-key",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
      }),
    ).toBe(false);

    expect(
      isSitePotentialBetaGenerationReady({
        SITE_POTENTIAL_BETA_ENABLED: "true",
        SITE_POTENTIAL_WORKER_ENABLED: "true",
        SITE_POTENTIAL_WORKER_SECRET: "worker-secret",
        OPENAI_API_KEY: "",
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "publishable-key",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
      }),
    ).toBe(false);
  });

  it("maps server readiness into safe, actionable runtime codes", () => {
    expect(resolveSitePotentialRuntimeReadiness(READY_RUNTIME_ENV)).toEqual({
      status: "READY",
      ready: true,
    });
    expect(
      resolveSitePotentialRuntimeReadiness({
        ...READY_RUNTIME_ENV,
        SITE_POTENTIAL_BETA_ENABLED: "false",
      }),
    ).toEqual({ status: "GENERATION_DISABLED", ready: false });
    expect(
      resolveSitePotentialRuntimeReadiness({
        ...READY_RUNTIME_ENV,
        SITE_POTENTIAL_WORKER_ENABLED: "false",
      }),
    ).toEqual({ status: "WORKER_DISABLED", ready: false });
    expect(
      resolveSitePotentialRuntimeReadiness({ ...READY_RUNTIME_ENV, OPENAI_API_KEY: "" }),
    ).toEqual({ status: "SERVER_CONFIGURATION_ERROR", ready: false });
  });

  it("maps UI, session, entitlement and provider states without enabling known failures", () => {
    expect(
      resolveSitePotentialGenerationAvailability({
        uiEnabled: false,
        lifecycle: "ready",
        status: null,
      }),
    ).toMatchObject({ status: "UI_DISABLED", canGenerate: false });
    expect(
      resolveSitePotentialGenerationAvailability({
        uiEnabled: true,
        lifecycle: "error",
        status: null,
        error: SITE_POTENTIAL_ALLOWANCE_SIGN_IN_MESSAGE,
      }),
    ).toMatchObject({ status: "SIGNED_OUT", canGenerate: false });
    expect(
      resolveSitePotentialGenerationAvailability({
        uiEnabled: true,
        lifecycle: "ready",
        status: { enabled: true, creditsRemaining: 0, canGenerate: false, runtimeStatus: "READY" },
      }),
    ).toMatchObject({ status: "ENTITLEMENT_UNAVAILABLE", canGenerate: false });
    expect(
      resolveSitePotentialGenerationAvailability({
        uiEnabled: true,
        lifecycle: "ready",
        status: {
          enabled: true,
          creditsRemaining: 1,
          canGenerate: true,
          runtimeStatus: "PROVIDER_UNAVAILABLE",
        },
      }),
    ).toMatchObject({ status: "PROVIDER_UNAVAILABLE", canGenerate: false });
    expect(
      resolveSitePotentialGenerationAvailability({
        uiEnabled: true,
        lifecycle: "ready",
        status: { enabled: true, creditsRemaining: 1, canGenerate: true, runtimeStatus: "READY" },
      }),
    ).toMatchObject({ status: "READY", canGenerate: true });
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

    expect(route).toContain("resolveSitePotentialRuntimeReadiness");
    expect(route).toContain("sitePotentialRuntimeMessage");
    expect(route).toContain(
      "No free allowance or credit has been used.",
    );
    expect(route.indexOf("resolveSitePotentialRuntimeReadiness")).toBeLessThan(
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

  it("keeps legacy beta services separate from the deterministic Site Potential UI", () => {
    const tab = read("src/components/property/dossier/SitePotentialTab.tsx");
    const statusRequest = read("src/lib/sitePotential/betaStatusRequest.ts");
    const apiClient = read("src/lib/sitePotential/sitePotentialApiClient.ts");

    expect(tab).toContain("VacantLandBuildEnvelope");
    expect(tab).toContain("StreetSideBuildEnvelope");
    expect(tab).toContain("There are no AI house concepts, generated renders, or facade images");
    expect(tab).not.toContain("VITE_SITE_POTENTIAL_BETA_UI");
    expect(tab).not.toContain("Three site-grounded concepts");
    expect(tab).not.toContain("Generate 3 free concepts");
    expect(tab).not.toContain("Use 1 credit for 3 concepts");
    expect(statusRequest).toContain("No purchased or beta/test credits are available.");
    expect(tab).not.toContain("Purchased credits");
    expect(tab).not.toContain("Daily packs");
    expect(tab).not.toContain("Weekly packs");
    expect(tab).not.toContain("Monthly packs");
    expect(tab).not.toContain("Buy more Site Potential credits");
    expect(tab).not.toContain("Checkout connection pending");
    expect(tab).not.toContain("Select for Easy Erf Report");
    expect(tab).not.toContain("createErfAssetSignedUrl");
    expect(tab).not.toContain("fetchSitePotentialApi");
    expect(apiClient).toContain('"beta-redeem"');
    expect(apiClient).toContain('"pack-status"');
    expect(apiClient).toContain('"retry-pack"');
    expect(apiClient).toContain("VITE_SITE_POTENTIAL_EDGE_API");
    expect(apiClient).toContain('`/api/site-potential/${input.route}`');
  });

  it("does not show beta allowance eligibility in the deterministic Site Potential UI", () => {
    const tab = read("src/components/property/dossier/SitePotentialTab.tsx");
    const request = read("src/lib/sitePotential/betaStatusRequest.ts");

    expect(request).toContain('export type AllowanceStatusLifecycle = "loading" | "ready" | "error"');
    expect(tab).not.toContain("Checking allowance");
    expect(tab).not.toContain("This erf: Eligible");
    expect(tab).not.toContain("Retry allowance check");
    expect(tab).not.toContain("generationAvailability.message");

    expect(request).toContain("const payload = await response.json().catch(() => null)");
    expect(request).toContain('if (!isCurrentRequest()) return { kind: "stale" }');
    expect(request).toContain("SITE_POTENTIAL_ALLOWANCE_SIGN_IN_MESSAGE");
    expect(request).toContain("Sign in to check Site Potential allowance.");
    expect(request).toContain('status: "UI_DISABLED"');
    expect(request).toContain('status: "ENTITLEMENT_UNAVAILABLE"');

  });

  it("ignores a stale previous-parcel beta-status response after the current parcel succeeds", async () => {
    let currentRequestId = 0;
    let state: { parcelId: string; status: BetaCreditUiStatus } | null = null;
    const parcelAJson = deferred<unknown>();
    const parcelBJson = deferred<unknown>();
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("parcelId=parcel-a")) {
        return {
          ok: true,
          json: () => parcelAJson.promise,
        } as Response;
      }
      if (url.includes("parcelId=parcel-b")) {
        return {
          ok: true,
          json: () => parcelBJson.promise,
        } as Response;
      }
      throw new Error(`Unexpected beta-status URL: ${url}`);
    });
    const getSession = vi.fn(async () => ({
      data: { session: { access_token: "session-token" } },
    }));

    async function startRequest(parcelId: string) {
      const requestId = ++currentRequestId;
      const result = await loadParcelBetaStatus({
        parcelId,
        getSession,
        fetchImpl,
        isCurrentRequest: () => requestId === currentRequestId,
      });
      if (result.kind === "ready") {
        state = { parcelId, status: result.status };
      }
      return result;
    }

    const parcelARequest = startRequest("parcel-a");
    await vi.waitUntil(() => fetchImpl.mock.calls.length === 1);

    const parcelBRequest = startRequest("parcel-b");
    await vi.waitUntil(() => fetchImpl.mock.calls.length === 2);

    parcelBJson.resolve(betaPayload("parcel-b", 6));
    await expect(parcelBRequest).resolves.toMatchObject({
      kind: "ready",
      status: { creditsRemaining: 6, openRequestStatus: "parcel-b" },
    });
    expect(state).toMatchObject({
      parcelId: "parcel-b",
      status: { creditsRemaining: 6, openRequestStatus: "parcel-b" },
    });

    parcelAJson.resolve(betaPayload("parcel-a", 1));
    await expect(parcelARequest).resolves.toEqual({ kind: "stale" });
    expect(state).toMatchObject({
      parcelId: "parcel-b",
      status: { creditsRemaining: 6, openRequestStatus: "parcel-b" },
    });
  });

  it("keeps signed-out beta status unavailable instead of returning an eligible erf status", async () => {
    const fetchImpl = vi.fn();
    const result = await loadParcelBetaStatus({
      parcelId: "parcel-a",
      getSession: async () => ({ data: { session: null } }),
      fetchImpl,
      isCurrentRequest: () => true,
    });

    expect(result).toEqual({
      kind: "signed_out",
      message: SITE_POTENTIAL_ALLOWANCE_SIGN_IN_MESSAGE,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty("status");
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
    expect(migration).not.toContain("item.option_index = 1");
    expect(migration).not.toContain("primary_item.option_index = 1");
  });

  it("adds a SQL function repair that removes same-parcel free-pack enforcement", () => {
    const migration = read(
      "supabase/migrations/20260723110000_allow_repeat_site_potential_free_packs_per_erf.sql",
    );

    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.redeem_site_potential_pack_v2");
    expect(migration).toContain("v_used_24 < 1 AND v_used_7 < 3 AND v_used_30 < 6");
    expect(migration).not.toContain("v_same_parcel_30");
    expect(migration).not.toContain("COUNT(*) FILTER (WHERE parcel_id = p_parcel_id)");
    expect(migration).toContain("requested_count, completed_count");
    expect(migration).toContain("'packSize', 3");
    expect(migration).toContain("'reserved', -1");
    expect(migration).not.toContain("item.option_index = 1");
    expect(migration).not.toContain("primary_item.option_index = 1");
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

  it("keeps retrying a legacy pack separate from entitlement consumption", () => {
    const route = read("src/routes/api/site-potential.retry-pack.ts");
    const server = read("src/lib/sitePotential/betaServer.ts");

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
  });

  it("keeps real staging proof separate from mocked/local tests", () => {
    const script = read("scripts/site-potential-beta-staging-check.ts");

    expect(script).toContain("This intentionally calls the real beta redemption endpoint");
    expect(script).toContain("/api/site-potential/beta-redeem");
    expect(script).toContain("/api/site-potential/pack-status");
    expect(script).toContain("EASY_ERF_BASE_URL");
  });
});
