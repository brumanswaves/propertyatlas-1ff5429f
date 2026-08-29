import { createClient } from "npm:@supabase/supabase-js@2.108.0";
import Stripe from "npm:stripe@^22.0.0";

import {
  parseAcceptedPaymentLinkIds,
  validateEasyErfCheckoutSession,
  type EasyErfStripeOrderInput,
} from "../_shared/easyErfStripePaymentContract.ts";

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): unknown;
};

const FUNCTION_NAME = "easy-erf-stripe-webhook";
const SUPPORTED_EVENT_TYPES = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function log(stage: string, requestId: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ fn: FUNCTION_NAME, stage, requestId, ...extra }));
}

function requiredEnv(name: string): string | null {
  const value = Deno.env.get(name)?.trim();
  return value || null;
}

function looksLikeUuid(value: string | null): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
}

type AdminClient = ReturnType<typeof createClient>;

type AccountMatch = {
  userId: string | null;
  parcelId: string | null;
};

async function resolveAccountMatch(
  admin: AdminClient,
  order: EasyErfStripeOrderInput,
  requestId: string,
): Promise<AccountMatch> {
  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("id,email")
    .ilike("email", order.customerEmail)
    .limit(2);

  if (profileError) {
    log("profile_match_failed", requestId, { errorCode: profileError.code ?? null });
    return { userId: null, parcelId: order.parsedParcelId };
  }

  if (!profiles || profiles.length !== 1 || typeof profiles[0]?.id !== "string") {
    log("profile_match_unresolved", requestId, { matchCount: profiles?.length ?? 0 });
    return { userId: null, parcelId: order.parsedParcelId };
  }

  const userId = profiles[0].id;
  let parcelId = order.parsedParcelId;

  if (looksLikeUuid(order.clientReferenceId)) {
    const { data: savedProperty, error: savedPropertyError } = await admin
      .from("saved_properties")
      .select("parcel_id")
      .eq("id", order.clientReferenceId)
      .eq("user_id", userId)
      .maybeSingle();

    if (savedPropertyError) {
      log("saved_property_match_failed", requestId, {
        errorCode: savedPropertyError.code ?? null,
      });
    } else if (savedProperty && typeof savedProperty.parcel_id === "string") {
      parcelId = savedProperty.parcel_id;
    }
  }

  return { userId, parcelId };
}

Deno.serve(async (request: Request) => {
  const requestId = request.headers.get("x-request-id")?.trim() || crypto.randomUUID();

  if (request.method !== "POST") {
    return json({ received: false, error: "Method not allowed.", requestId }, 405);
  }

  const stripeSecretKey = requiredEnv("STRIPE_SECRET_KEY");
  const webhookSecret = requiredEnv("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const acceptedPaymentLinkIds = parseAcceptedPaymentLinkIds(
    Deno.env.get("EASY_ERF_R999_PAYMENT_LINK_IDS"),
  );

  if (
    !stripeSecretKey ||
    !webhookSecret ||
    !supabaseUrl ||
    !serviceRoleKey ||
    acceptedPaymentLinkIds.size === 0
  ) {
    log("configuration_missing", requestId, {
      hasStripeKey: Boolean(stripeSecretKey),
      hasWebhookSecret: Boolean(webhookSecret),
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceRoleKey),
      acceptedPaymentLinkCount: acceptedPaymentLinkIds.size,
    });
    return json(
      { received: false, error: "Easy Erf payment fulfillment is not configured.", requestId },
      503,
    );
  }

  const signature = request.headers.get("stripe-signature")?.trim();
  if (!signature) {
    log("signature_rejected", requestId, { reason: "missing_header" });
    return json({ received: false, error: "Stripe signature is required.", requestId }, 400);
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return json({ received: false, error: "Request body could not be read.", requestId }, 400);
  }

  const stripe = new Stripe(stripeSecretKey);
  const cryptoProvider = Stripe.createSubtleCryptoProvider();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider,
    );
  } catch (error) {
    log("signature_rejected", requestId, {
      errorClass: error instanceof Error ? error.name : "UnknownError",
    });
    return json({ received: false, error: "Stripe signature was invalid.", requestId }, 400);
  }

  if (!SUPPORTED_EVENT_TYPES.has(event.type)) {
    log("event_ignored", requestId, { eventId: event.id, eventType: event.type });
    return json({ received: true, recorded: false, reason: "event_not_used", requestId });
  }

  const validation = validateEasyErfCheckoutSession(
    event.data.object,
    acceptedPaymentLinkIds,
  );

  if (!validation.ok) {
    log("checkout_rejected", requestId, {
      eventId: event.id,
      eventType: event.type,
      code: validation.code,
    });
    return json(
      { received: false, recorded: false, code: validation.code, error: validation.error, requestId },
      400,
    );
  }

  if (validation.disposition === "ignore") {
    log("checkout_ignored", requestId, {
      eventId: event.id,
      eventType: event.type,
      reason: validation.reason,
    });
    return json({ received: true, recorded: false, reason: validation.reason, requestId });
  }

  const order = validation.order;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const accountMatch = await resolveAccountMatch(admin, order, requestId);

  const { data: orderId, error: recordError } = await admin.rpc(
    "record_easy_erf_stripe_payment",
    {
      p_provider_order_ref: order.checkoutSessionId,
      p_event_id: event.id,
      p_payment_link_id: order.paymentLinkId,
      p_payment_intent_id: order.paymentIntentId,
      p_customer_id: order.customerId,
      p_client_reference_id: order.clientReferenceId,
      p_customer_email: order.customerEmail,
      p_customer_name: order.customerName,
      p_property_reference: order.propertyReference,
      p_investigation_request: order.investigationRequest,
      p_currency: order.currency,
      p_amount_total: order.amountTotal,
      p_livemode: order.livemode,
      p_matched_user_id: accountMatch.userId,
      p_matched_parcel_id: accountMatch.parcelId,
    },
  );

  if (recordError || typeof orderId !== "string") {
    log("order_record_failed", requestId, {
      eventId: event.id,
      eventType: event.type,
      errorCode: recordError?.code ?? null,
    });
    return json(
      { received: false, recorded: false, error: "Payment was not recorded.", requestId },
      500,
    );
  }

  log("order_recorded", requestId, {
    eventId: event.id,
    eventType: event.type,
    orderId,
    checkoutSessionId: order.checkoutSessionId,
    livemode: order.livemode,
    matchedUser: Boolean(accountMatch.userId),
    matchedParcel: Boolean(accountMatch.parcelId),
  });

  return json({ received: true, recorded: true, orderId, requestId });
});
