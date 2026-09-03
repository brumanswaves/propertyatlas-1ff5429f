import { createClient } from "npm:@supabase/supabase-js@2.108.0";
import Stripe from "npm:stripe@22.6.0";

import { parseAcceptedPaymentLinkIds } from "../_shared/easyErfStripePaymentContract.ts";
import {
  buildEasyErfR999LaunchReadiness,
  classifyEasyErfStripeKey,
  inspectEasyErfPaymentLink,
  inspectEasyErfStripeAccount,
  inspectEasyErfWebhookEndpoints,
  resolveEasyErfCheckoutMode,
  type EasyErfPaymentLinkInspection,
  type EasyErfStripeAccountInspection,
  type EasyErfWebhookInspection,
} from "../_shared/easyErfR999LaunchReadiness.ts";

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): unknown;
};

const FUNCTION_NAME = "easy-erf-founder-launch-readiness";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requiredEnv(name: string): string | null {
  const value = Deno.env.get(name)?.trim();
  return value || null;
}

function log(stage: string, requestId: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ fn: FUNCTION_NAME, stage, requestId, ...extra }));
}

function errorClass(error: unknown) {
  return error instanceof Error ? error.name : "UnknownError";
}

Deno.serve(async (request: Request) => {
  const requestId = request.headers.get("x-request-id")?.trim() || crypto.randomUUID();

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed.", requestId }, 405);
  }

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const anonKey = requiredEnv("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    log("auth_configuration_missing", requestId, {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasAnonKey: Boolean(anonKey),
    });
    return json({ ok: false, error: "Launch preflight is not configured.", requestId }, 503);
  }

  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return json({ ok: false, error: "Authorization is required.", requestId }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  const user = authData.user;
  if (authError || !user) {
    log("auth_rejected", requestId, { hasUser: Boolean(user) });
    return json({ ok: false, error: "Authentication failed.", requestId }, 401);
  }

  const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });
  if (roleError || isAdmin !== true) {
    log("admin_rejected", requestId, {
      userId: user.id,
      roleErrorCode: roleError?.code ?? null,
    });
    return json({ ok: false, error: "Founder admin access is required.", requestId }, 403);
  }

  const checkoutMode = resolveEasyErfCheckoutMode(
    Deno.env.get("EASY_ERF_R999_CHECKOUT_MODE"),
  );
  const liveArmed = Deno.env.get("EASY_ERF_R999_LIVE_ENABLED")?.trim().toLowerCase() ===
    "true";
  const stripeSecretKey = requiredEnv("STRIPE_SECRET_KEY");
  const stripeKeyMode = classifyEasyErfStripeKey(stripeSecretKey ?? undefined);
  const webhookSecretConfigured = Boolean(requiredEnv("STRIPE_WEBHOOK_SECRET"));
  const acceptedPaymentLinkIds = parseAcceptedPaymentLinkIds(
    Deno.env.get("EASY_ERF_R999_PAYMENT_LINK_IDS"),
  );

  const environment = {
    checkoutMode,
    liveArmed,
    stripeKeyConfigured: Boolean(stripeSecretKey),
    stripeKeyMode,
    webhookSecretConfigured,
    acceptedPaymentLinkCount: acceptedPaymentLinkIds.size,
  };

  let paymentLinkInspection: EasyErfPaymentLinkInspection | null = null;
  let webhookInspection: EasyErfWebhookInspection | null = null;
  let accountInspection: EasyErfStripeAccountInspection | null = null;

  if (stripeSecretKey) {
    const stripe = new Stripe(stripeSecretKey);

    try {
      const account = await stripe.accounts.retrieve(null);
      accountInspection = inspectEasyErfStripeAccount({
        business_profile: {
          name: account.business_profile?.name,
          url: account.business_profile?.url,
        },
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        requirements: {
          currently_due: account.requirements?.currently_due,
          past_due: account.requirements?.past_due,
          disabled_reason: account.requirements?.disabled_reason,
        },
      });
    } catch (error) {
      log("stripe_account_probe_failed", requestId, { errorClass: errorClass(error) });
    }

    if (checkoutMode !== "invalid") {
      const expectedLivemode = checkoutMode === "live";

      for (const paymentLinkId of acceptedPaymentLinkIds) {
        try {
          const link = await stripe.paymentLinks.retrieve(paymentLinkId);
          const lineItems = await stripe.paymentLinks.listLineItems(paymentLinkId, { limit: 10 });
          const inspection = inspectEasyErfPaymentLink(
            {
              active: link.active,
              livemode: link.livemode,
              url: link.url,
              after_completion: link.after_completion.type === "redirect"
                ? {
                    type: "redirect",
                    redirect: { url: link.after_completion.redirect?.url ?? null },
                  }
                : { type: link.after_completion.type },
            },
            lineItems.data.map((item) => {
              const price = item.price;
              return {
                price: typeof price === "string"
                  ? price
                  : price
                    ? {
                        unit_amount: price.unit_amount,
                        currency: price.currency,
                        type: price.type,
                      }
                    : null,
              };
            }),
            expectedLivemode,
          );

          const currentScore = Number(inspection.contractValid) * 2 +
            Number(inspection.returnUrlValid);
          const previousScore = paymentLinkInspection
            ? Number(paymentLinkInspection.contractValid) * 2 +
              Number(paymentLinkInspection.returnUrlValid)
            : -1;
          if (currentScore > previousScore) paymentLinkInspection = inspection;
          if (inspection.contractValid && inspection.returnUrlValid) break;
        } catch (error) {
          log("payment_link_probe_failed", requestId, { errorClass: errorClass(error) });
        }
      }

      try {
        const webhookEndpoints = await stripe.webhookEndpoints.list({ limit: 100 });
        const expectedWebhookUrl = `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/easy-erf-stripe-webhook`;
        webhookInspection = inspectEasyErfWebhookEndpoints(
          webhookEndpoints.data.map((endpoint) => ({
            url: endpoint.url,
            status: endpoint.status,
            livemode: endpoint.livemode,
            enabled_events: endpoint.enabled_events,
          })),
          expectedWebhookUrl,
          expectedLivemode,
        );
      } catch (error) {
        log("webhook_endpoint_probe_failed", requestId, { errorClass: errorClass(error) });
      }
    }
  }

  const readiness = buildEasyErfR999LaunchReadiness({
    environment,
    paymentLink: paymentLinkInspection,
    webhook: webhookInspection,
    account: accountInspection,
  });

  log("preflight_completed", requestId, {
    userId: user.id,
    state: readiness.state,
    checkoutMode: readiness.checkoutMode,
    liveArmed: readiness.liveArmed,
    liveCheckoutGateOpen: readiness.liveCheckoutGateOpen,
    inspectablePreflightPassed: readiness.inspectablePreflightPassed,
    readyForControlledSignatureTest: readiness.readyForControlledSignatureTest,
  });

  return json({
    ok: true,
    observedAt: new Date().toISOString(),
    requestId,
    ...readiness,
  });
});
