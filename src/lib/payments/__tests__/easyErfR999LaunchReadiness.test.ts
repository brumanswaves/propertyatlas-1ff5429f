import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildEasyErfR999LaunchReadiness,
  classifyEasyErfStripeKey,
  inspectEasyErfPaymentLink,
  inspectEasyErfStripeAccount,
  inspectEasyErfWebhookEndpoints,
  resolveEasyErfCheckoutMode,
  type EasyErfLaunchEnvironment,
} from "../../../../supabase/functions/_shared/easyErfR999LaunchReadiness";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const functionSource = source(
  "supabase/functions/easy-erf-founder-launch-readiness/index.ts",
);
const routeSource = source("src/routes/admin.launch-readiness.tsx");
const adminGuardSource = source("src/components/admin/AdminGuard.tsx");
const configSource = source("supabase/config.toml");

const validPaymentLink = inspectEasyErfPaymentLink(
  {
    active: true,
    livemode: true,
    url: "https://buy.stripe.com/example",
    after_completion: {
      type: "redirect",
      redirect: { url: "https://easyerf.co.za/orders?payment=received" },
    },
  },
  [
    {
      price: {
        unit_amount: 99_900,
        currency: "zar",
        type: "one_time",
      },
    },
  ],
  true,
);

const validWebhook = inspectEasyErfWebhookEndpoints(
  [
    {
      url: "https://project.supabase.co/functions/v1/easy-erf-stripe-webhook",
      status: "enabled",
      livemode: true,
      enabled_events: [
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
      ],
    },
  ],
  "https://project.supabase.co/functions/v1/easy-erf-stripe-webhook",
  true,
);

const validAccount = inspectEasyErfStripeAccount({
  business_profile: { name: "Easy Erf", url: "https://easyerf.co.za" },
  charges_enabled: true,
  payouts_enabled: true,
  details_submitted: true,
  requirements: { currently_due: [], past_due: [], disabled_reason: null },
});

function liveEnvironment(overrides: Partial<EasyErfLaunchEnvironment> = {}) {
  return {
    checkoutMode: "live" as const,
    liveArmed: false,
    stripeKeyConfigured: true,
    stripeKeyMode: "live" as const,
    webhookSecretConfigured: true,
    acceptedPaymentLinkCount: 1,
    ...overrides,
  };
}

describe("Easy Erf R999 launch readiness model", () => {
  it("keeps missing mode safely in TEST and classifies common Stripe key modes", () => {
    expect(resolveEasyErfCheckoutMode(undefined)).toBe("test");
    expect(resolveEasyErfCheckoutMode("LIVE")).toBe("live");
    expect(resolveEasyErfCheckoutMode("unexpected")).toBe("invalid");
    expect(classifyEasyErfStripeKey("sk_live_example")).toBe("live");
    expect(classifyEasyErfStripeKey("rk_test_example")).toBe("test");
    expect(classifyEasyErfStripeKey("opaque-key")).toBe("unknown");
    expect(classifyEasyErfStripeKey(undefined)).toBe("missing");
  });

  it("accepts only an active one-time R999 ZAR link in the expected mode and return path", () => {
    expect(validPaymentLink).toEqual({ contractValid: true, returnUrlValid: true });

    expect(
      inspectEasyErfPaymentLink(
        {
          active: true,
          livemode: true,
          url: "https://buy.stripe.com/example",
          after_completion: {
            type: "redirect",
            redirect: { url: "https://easyerf.co.za/orders?payment=received" },
          },
        },
        [{ price: { unit_amount: 100_000, currency: "zar", type: "one_time" } }],
        true,
      ),
    ).toEqual({ contractValid: false, returnUrlValid: true });
  });

  it("requires the exact enabled webhook and both settlement events", () => {
    expect(validWebhook).toEqual({
      endpointFound: true,
      enabled: true,
      modeMatches: true,
      requiredEventsPresent: true,
    });

    expect(
      inspectEasyErfWebhookEndpoints(
        [
          {
            url: "https://project.supabase.co/functions/v1/easy-erf-stripe-webhook",
            status: "enabled",
            livemode: true,
            enabled_events: ["checkout.session.completed"],
          },
        ],
        "https://project.supabase.co/functions/v1/easy-erf-stripe-webhook",
        true,
      ).requiredEventsPresent,
    ).toBe(false);
  });

  it("passes inspectable preflight only while LIVE is selected and remains disarmed", () => {
    const readiness = buildEasyErfR999LaunchReadiness({
      environment: liveEnvironment(),
      paymentLink: validPaymentLink,
      webhook: validWebhook,
      account: validAccount,
    });

    expect(readiness.state).toBe("live_disarmed_preflight_passed");
    expect(readiness.inspectablePreflightPassed).toBe(true);
    expect(readiness.readyForControlledSignatureTest).toBe(true);
    expect(readiness.liveCheckoutGateOpen).toBe(false);
    expect(readiness.signatureSecretMatch).toBe("not_verified");
    expect(readiness.checks.find((item) => item.id === "webhook-signature-match")).toMatchObject({
      status: "unknown",
      blocking: true,
      inspectable: false,
    });
  });

  it("surfaces an armed live gate as a blocker and risk signal", () => {
    const readiness = buildEasyErfR999LaunchReadiness({
      environment: liveEnvironment({ liveArmed: true }),
      paymentLink: validPaymentLink,
      webhook: validWebhook,
      account: validAccount,
    });

    expect(readiness.state).toBe("live_armed_blocked");
    expect(readiness.inspectablePreflightPassed).toBe(false);
    expect(readiness.readyForControlledSignatureTest).toBe(false);
    expect(readiness.liveCheckoutGateOpen).toBe(true);
    expect(readiness.checks.find((item) => item.id === "live-disarmed")).toMatchObject({
      status: "fail",
      blocking: true,
    });
  });

  it("blocks on a stale Stripe business website even when payment mechanics are enabled", () => {
    const staleAccount = inspectEasyErfStripeAccount({
      business_profile: { name: "Easy Erf", url: "www.example-supplier.com" },
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
      requirements: { currently_due: [], past_due: [], disabled_reason: null },
    });
    const readiness = buildEasyErfR999LaunchReadiness({
      environment: liveEnvironment(),
      paymentLink: validPaymentLink,
      webhook: validWebhook,
      account: staleAccount,
    });

    expect(staleAccount.businessUrlValid).toBe(false);
    expect(readiness.inspectablePreflightPassed).toBe(false);
    expect(readiness.readyForControlledSignatureTest).toBe(false);
    expect(readiness.checks.find((item) => item.id === "stripe-business-profile")).toMatchObject({
      status: "fail",
      blocking: true,
    });
  });

  it("does not present TEST mode as live-launch evidence", () => {
    const readiness = buildEasyErfR999LaunchReadiness({
      environment: liveEnvironment({
        checkoutMode: "test",
        stripeKeyMode: "test",
      }),
      paymentLink: inspectEasyErfPaymentLink(
        {
          active: true,
          livemode: false,
          url: "https://buy.stripe.com/example",
          after_completion: {
            type: "redirect",
            redirect: { url: "https://easyerf.co.za/orders?payment=received" },
          },
        },
        [{ price: { unit_amount: 99_900, currency: "zar", type: "one_time" } }],
        false,
      ),
      webhook: inspectEasyErfWebhookEndpoints(
        [
          {
            url: "https://project.supabase.co/functions/v1/easy-erf-stripe-webhook",
            status: "enabled",
            livemode: false,
            enabled_events: ["*"],
          },
        ],
        "https://project.supabase.co/functions/v1/easy-erf-stripe-webhook",
        false,
      ),
      account: validAccount,
    });

    expect(readiness.state).toBe("test_mode");
    expect(readiness.inspectablePreflightPassed).toBe(false);
    expect(readiness.readyForControlledSignatureTest).toBe(false);
  });
});

describe("founder-only launch preflight safety guardrails", () => {
  it("authenticates and checks the admin role before any Stripe inspection", () => {
    expect(configSource).toMatch(
      /\[functions\.easy-erf-founder-launch-readiness\][\s\S]*verify_jwt = true/,
    );
    expect(functionSource).toContain("userClient.auth.getUser()");
    expect(functionSource).toContain('userClient.rpc("has_role"');
    expect(functionSource).toContain('_role: "admin"');
    expect(functionSource.indexOf('userClient.rpc("has_role"')).toBeLessThan(
      functionSource.indexOf("new Stripe(stripeSecretKey)"),
    );
  });

  it("remains read-only and does not use the service role", () => {
    expect(functionSource).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(functionSource).not.toMatch(/\.insert\s*\(/);
    expect(functionSource).not.toMatch(/\.update\s*\(/);
    expect(functionSource).not.toMatch(/\.upsert\s*\(/);
    expect(functionSource).not.toMatch(/\.delete\s*\(/);
    expect(functionSource).not.toContain("checkout.sessions.create");
    expect(functionSource).not.toContain("paymentIntents.create");
    expect(functionSource).not.toContain("webhookEndpoints.create");
  });

  it("returns only the safe readiness projection and never a secret value", () => {
    const responseStart = functionSource.indexOf("return json({\n    ok: true,");
    const response = functionSource.slice(responseStart);
    expect(responseStart).toBeGreaterThan(-1);
    expect(response).toContain("...readiness");
    expect(response).not.toContain("stripeSecretKey");
    expect(response).not.toContain("STRIPE_WEBHOOK_SECRET");
    expect(response).not.toContain("acceptedPaymentLinkIds");
  });

  it("gives the founder inspection and refresh controls but no arming control", () => {
    expect(adminGuardSource).toContain('href="/admin/launch-readiness"');
    expect(routeSource).toContain('"easy-erf-founder-launch-readiness"');
    expect(routeSource).toContain("This screen cannot arm checkout");
    expect(routeSource).toContain("Run preflight");
    expect(routeSource).not.toContain("EASY_ERF_R999_LIVE_ENABLED");
    expect(routeSource).not.toContain("set secret");
    expect(routeSource).not.toContain("Enable live checkout");
  });
});
