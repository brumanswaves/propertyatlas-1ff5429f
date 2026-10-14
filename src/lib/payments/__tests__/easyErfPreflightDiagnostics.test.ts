import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import * as readiness from "../../../../supabase/functions/_shared/easyErfR999LaunchReadiness";
import * as contract from "../../../../supabase/functions/_shared/easyErfStripePaymentContract";

import { fixedPaymentLinkFixture, fixedLineItemFixture } from "./fixedPaymentLinkFixture";

const code = ts.transpileModule(
  readFileSync("supabase/functions/easy-erf-founder-launch-readiness/index.ts", "utf8"),
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  },
).outputText;
const goodAccount = {
  id: "acct_ObservedFixture",
  business_profile: { name: "Easy Erf", url: "https://easyerf.co.za" },
  charges_enabled: true,
  payouts_enabled: true,
  details_submitted: true,
  requirements: { currently_due: [], past_due: [] },
  secret: "PRIVATE_ACCOUNT_SENTINEL",
  external_accounts: { data: ["PRIVATE_BANK_SENTINEL"] },
};
function harness(
  options: {
    admin?: boolean;
    authenticated?: boolean;
    mode?: string;
    armed?: boolean;
    paymentQuantity?: number | null;
    paymentLink?: boolean;
    linkChanges?: Record<string, unknown>;
    itemChanges?: Record<string, unknown>;
    moreItems?: boolean;
  } = {},
) {
  let handler!: (request: Request) => Promise<Response>;
  const account = vi.fn().mockResolvedValue(goodAccount);
  const logs: string[] = [];
  const stripe = vi.fn(function () {
    return {
      accounts: { retrieve: account },
      webhookEndpoints: { list: vi.fn().mockResolvedValue({ data: [] }) },
      paymentLinks: {
        retrieve: vi.fn().mockImplementation(async (_id: string, params?: { expand?: string[] }) => {
          const link: Record<string, unknown> = {
          ...fixedPaymentLinkFixture(options.mode === "live"),
          active: true,
          livemode: options.mode === "live",
          url: "https://buy.stripe.com/fixture",
          ...options.linkChanges,
          after_completion: {
            type: "redirect",
            redirect: { url: readiness.EASY_ERF_R999_RETURN_URL },
          },
          };
          if (!params?.expand?.includes("optional_items")) delete link.optional_items;
          return link;
        }),
        listLineItems: vi.fn().mockResolvedValue({
          has_more: options.moreItems ?? false,
          data: [
            {
              ...fixedLineItemFixture(),
              ...options.itemChanges,
              quantity: options.paymentQuantity,
              price: fixedLineItemFixture().price,
            },
          ],
        }),
      },
    };
  });
  const env: Record<string, string> = {
    SUPABASE_URL: "https://fixture.invalid",
    SUPABASE_ANON_KEY: "PRIVATE_ANON_SENTINEL",
    STRIPE_SECRET_KEY: `sk_${options.mode ?? "test"}_PRIVATE_KEY_SENTINEL`,
    STRIPE_WEBHOOK_SECRET: "PRIVATE_WEBHOOK_SENTINEL",
    EASY_ERF_R999_CHECKOUT_MODE: options.mode ?? "test",
    EASY_ERF_R999_PAYMENT_LINK_IDS: options.paymentLink ? "plink_Fixture" : "",
    EASY_ERF_R999_LIVE_ENABLED: String(options.armed ?? false),
  };
  runInNewContext(code, {
    exports: {},
    Request,
    Response,
    Error,
    crypto,
    console: { log: (value: string) => logs.push(value) },
    Deno: {
      env: { get: (key: string) => env[key] },
      serve: (fn: typeof handler) => {
        handler = fn;
      },
    },
    require: (id: string) => {
      if (id.startsWith("npm:@supabase"))
        return {
          createClient: () => ({
            auth: {
              getUser: async () => ({
                data: { user: options.authenticated === false ? null : { id: "founder-fixture" } },
                error: null,
              }),
            },
            rpc: async () => ({ data: options.admin !== false, error: null }),
          }),
        };
      if (id.startsWith("npm:stripe")) return { default: stripe };
      if (id.endsWith("easyErfR999LaunchReadiness.ts")) return readiness;
      if (id.endsWith("easyErfStripePaymentContract.ts")) return contract;
      throw new Error("Unexpected dependency");
    },
  });
  return {
    account,
    stripe,
    logs,
    request: (auth = true) =>
      handler(
        new Request("https://fixture.invalid", {
          method: "POST",
          headers: auth
            ? { authorization: "Bearer PRIVATE_AUTH_SENTINEL", "x-request-id": "request-fixture" }
            : {},
        }),
      ),
  };
}

const build = (account: ReturnType<typeof readiness.inspectEasyErfStripeAccount> | null) =>
  readiness.buildEasyErfR999LaunchReadiness({
    account,
    environment: {
      checkoutMode: "live",
      liveArmed: false,
      stripeKeyConfigured: true,
      stripeKeyMode: "live",
      webhookSecretConfigured: true,
      acceptedPaymentLinkCount: 1,
    },
    paymentLink: { contractValid: true, returnUrlValid: true },
    webhook: { endpointFound: true, enabled: true, modeMatches: true, requiredEventsPresent: true },
  });

describe("canonical account profile diagnostics", () => {
  it.each([
    [undefined, "unknown", "unknown"],
    [null, "unknown", "unknown"],
    [{}, "unknown", "unknown"],
    [{ name: "Easy Erf" }, "pass", "unknown"],
    [{ url: "https://easyerf.co.za" }, "unknown", "pass"],
    [{ name: null, url: null }, "unknown", "unknown"],
    [{ name: "", url: "" }, "fail", "fail"],
    [{ name: "Other", url: "https://wrong.invalid" }, "fail", "fail"],
    [{ name: "Other" }, "fail", "unknown"],
    [{ name: " Easy Erf ", url: "https://www.easyerf.co.za" }, "pass", "pass"],
  ] as const)("keeps profile %j evidence distinct", (profile, nameStatus, businessUrlStatus) => {
    const account = readiness.inspectEasyErfStripeAccount({
      ...goodAccount,
      business_profile: profile,
    });
    expect(account).toMatchObject({ accountId: goodAccount.id, nameStatus, businessUrlStatus });
    const result = build(account);
    expect(result.checks.find((x) => x.id === "stripe-business-name")?.status).toBe(nameStatus);
    expect(result.checks.find((x) => x.id === "stripe-business-url")?.status).toBe(
      businessUrlStatus,
    );
    expect(result.inspectablePreflightPassed).toBe(
      nameStatus === "pass" && businessUrlStatus === "pass",
    );
    expect(result.liveCheckoutGateOpen).toBe(false);
    expect(result.signatureSecretMatch).toBe("not_verified");
  });
  it.each([undefined, null, "sk_test_PRIVATE", "acct_bad\nPRIVATE"])(
    "does not expose malformed identity %j",
    (id) => {
      const account = readiness.inspectEasyErfStripeAccount({ ...goodAccount, id });
      expect(account.accountId).toBeNull();
      expect(build(account).inspectablePreflightPassed).toBe(false);
      expect(JSON.stringify(build(account))).not.toContain("PRIVATE");
    },
  );
});

describe("actual preflight handler with isolated service doubles", () => {
  it.each([{ admin: false }, { authenticated: false }])(
    "excludes unauthorized callers %j",
    async (options) => {
      const h = harness(options);
      const response = await h.request();
      expect([401, 403]).toContain(response.status);
      expect(h.stripe).not.toHaveBeenCalled();
      expect(await response.text()).not.toContain("acct_");
    },
  );
  it("excludes missing authorization before provider access", async () => {
    const h = harness();
    expect((await h.request(false)).status).toBe(401);
    expect(h.account).not.toHaveBeenCalled();
  });
  it("binds the actual returned account to one probe and serializes only safe diagnostics", async () => {
    const h = harness();
    const result = await (await h.request()).json();
    expect(h.account).toHaveBeenCalledExactlyOnceWith(null);
    expect(result.requestId).toBe("request-fixture");
    expect(Number.isNaN(Date.parse(result.observedAt))).toBe(false);
    expect(
      result.checks.find((x: { id: string }) => x.id === "stripe-account-identity").detail,
    ).toContain(goodAccount.id);
    expect(result.checks.find((x: { id: string }) => x.id === "stripe-business-name").status).toBe(
      "pass",
    );
    expect(JSON.stringify(result) + h.logs.join("")).not.toContain("PRIVATE_");
    expect(result.state).toBe("test_mode");
    expect(result.readyForControlledSignatureTest).toBe(false);
    expect(result.liveCheckoutGateOpen).toBe(false);
  });
  it("discards prior account evidence after a failed probe without leaking upstream error", async () => {
    const h = harness();
    await h.request();
    const error = new Error("PRIVATE_ERROR_SENTINEL");
    error.name = "PRIVATE_ERROR_NAME_SENTINEL";
    h.account.mockRejectedValueOnce(error);
    const result = await (await h.request()).json();
    const identity = result.checks.find((x: { id: string }) => x.id === "stripe-account-identity");
    expect(identity.status).toBe("unknown");
    expect(
      result.checks.find((x: { id: string }) => x.id === "stripe-business-profile").status,
    ).toBe("unknown");
    expect(JSON.stringify(result)).not.toContain(goodAccount.id);
    expect(JSON.stringify(result) + h.logs.join("")).not.toContain("PRIVATE_");
    expect(h.account).toHaveBeenCalledTimes(2);
  });
  it.each([false, true])("keeps LIVE safety gates with arming=%s", async (armed) => {
    const h = harness({ mode: "live", armed });
    h.account.mockResolvedValueOnce({ ...goodAccount, business_profile: undefined });
    const result = await (await h.request()).json();
    expect(result.state).toBe(armed ? "live_armed_blocked" : "live_disarmed_blocked");
    expect(result.inspectablePreflightPassed).toBe(false);
    expect(result.readyForControlledSignatureTest).toBe(false);
    expect(result.signatureSecretMatch).toBe("not_verified");
  });
});

describe("actual preflight line-item mapping", () => {
  it.each([1, 0, 2, -1, 1.5, null, undefined])(
    "accepts only quantity one through the endpoint: %s",
    async (quantity) => {
      const h = harness({ mode: "live", paymentLink: true, paymentQuantity: quantity });
      const response = await h.request();
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(
        result.checks.find((x: { id: string }) => x.id === "accepted-payment-link").status,
      ).toBe(quantity === 1 ? "pass" : "fail");
      expect(result.checks.find((x: { id: string }) => x.id === "payment-return-url").status).toBe(
        "pass",
      );
      expect(result.liveCheckoutGateOpen).toBe(false);
      expect(result.signatureSecretMatch).toBe("not_verified");
    },
  );
});


describe("actual founder preflight total guards", () => {
  it.each([
    ["promotions", { allow_promotion_codes: true }],
    ["tax", { automatic_tax: { enabled: true } }],
    ["shipping", { shipping_options: [{}] }],
    ["upsells", { optional_items: [{}] }],
    ["unobservable upsells", { optional_items: undefined }],
  ])("cannot report a safe total with %s", async (_name, linkChanges) => {
    const h = harness({ mode: "live", paymentLink: true, paymentQuantity: 1, linkChanges });
    const result = await (await h.request()).json();
    expect(result.checks.find((x: { id: string }) => x.id === "accepted-payment-link").status).toBe("fail");
  });
  it.each([
    ["adjustable quantity", { adjustable_quantity: { enabled: true } }],
    ["computed total", { amount_total: 100_000 }],
    ["discount", { amount_discount: 100 }],
  ])("preserves %s observations through the actual endpoint", async (_name, itemChanges) => {
    const h = harness({ mode: "live", paymentLink: true, paymentQuantity: 1, itemChanges });
    const result = await (await h.request()).json();
    expect(result.checks.find((x: { id: string }) => x.id === "accepted-payment-link").status).toBe("fail");
  });
  it("rejects truncated lists and requests expanded price currencies", async () => {
    const h = harness({ mode: "live", paymentLink: true, paymentQuantity: 1, moreItems: true });
    const result = await (await h.request()).json();
    expect(result.checks.find((x: { id: string }) => x.id === "accepted-payment-link").status).toBe("fail");
    const transport = h.stripe.mock.results[0].value.paymentLinks;
    expect(transport.retrieve).toHaveBeenCalledWith("plink_Fixture", { expand: ["optional_items"] });
    const calls = transport.listLineItems;
    expect(calls).toHaveBeenCalledWith("plink_Fixture", { limit: 10, expand: ["data.price.currency_options"] });
  });
});

describe("optional-item transport expansion", () => {
  it("omits optional_items without expansion and retains a legitimate fixed R999 control", async () => {
    const h = harness({ mode: "live", paymentLink: true, paymentQuantity: 1 });
    const result = await (await h.request()).json();
    expect(result.checks.find((x: { id: string }) => x.id === "accepted-payment-link").status).toBe("pass");
    const retrieve = h.stripe.mock.results[0].value.paymentLinks.retrieve;
    expect(retrieve).toHaveBeenCalledWith("plink_Fixture", { expand: ["optional_items"] });
    expect(await retrieve("plink_Fixture")).not.toHaveProperty("optional_items");
    expect(await retrieve("plink_Fixture", { expand: ["optional_items"] })).toHaveProperty("optional_items", null);
  });
});
