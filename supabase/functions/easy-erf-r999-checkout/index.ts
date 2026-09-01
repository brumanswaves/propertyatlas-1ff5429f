import { createClient } from "npm:@supabase/supabase-js@2.108.0";
import Stripe from "npm:stripe@22.6.0";

import { validateHumanReviewCheckoutRequest } from "../_shared/easyErfHumanReviewContract.ts";
import {
  parseAcceptedPaymentLinkIds,
  parseCanonicalParcelId,
  parseStandaloneErfNumber,
} from "../_shared/easyErfStripePaymentContract.ts";

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): unknown;
};

type CheckoutMode = "test" | "live";

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

function resolveCheckoutMode(): CheckoutMode | null {
  const configured = Deno.env.get("EASY_ERF_R999_CHECKOUT_MODE")?.trim().toLowerCase();
  if (!configured || configured === "test") return "test";
  if (configured === "live") return "live";
  return null;
}

function liveCheckoutIsArmed() {
  return Deno.env.get("EASY_ERF_R999_LIVE_ENABLED")?.trim().toLowerCase() === "true";
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  const token = match?.[1]?.trim();
  return token || null;
}

function savedPropertyFilters(erfNumber: string): Array<Record<string, string | number>> {
  const numeric = Number(erfNumber);
  const filters: Array<Record<string, string | number>> = [
    { erfNumber },
    { erf: erfNumber },
  ];
  if (Number.isSafeInteger(numeric)) {
    filters.push({ erfNumber: numeric }, { erf: numeric });
  }
  return filters;
}

async function resolveSavedParcel(
  admin: ReturnType<typeof createClient>,
  userId: string,
  propertyReference: string,
): Promise<string | null> {
  const canonical = parseCanonicalParcelId(propertyReference);
  if (canonical) return canonical;

  const erfNumber = parseStandaloneErfNumber(propertyReference);
  if (!erfNumber) return null;

  const parcelIds = new Set<string>();
  for (const userDataFilter of savedPropertyFilters(erfNumber)) {
    const { data, error } = await admin
      .from("saved_properties")
      .select("parcel_id")
      .eq("user_id", userId)
      .contains("user_data", userDataFilter)
      .limit(2);

    if (error) return null;
    for (const row of data ?? []) {
      if (typeof row?.parcel_id === "string" && row.parcel_id.trim()) {
        parcelIds.add(row.parcel_id);
      }
    }
  }

  return parcelIds.size === 1 ? [...parcelIds][0] : null;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed." }, 405);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Choose a Human Review focus before checkout." }, 400);
  }

  const validation = validateHumanReviewCheckoutRequest(body);
  if (!validation.ok) return json({ ok: false, error: validation.error }, 400);

  const checkoutMode = resolveCheckoutMode();
  if (!checkoutMode) {
    return json({ ok: false, error: "Human Review checkout mode is invalid." }, 503);
  }
  if (checkoutMode === "live" && !liveCheckoutIsArmed()) {
    return json({ ok: false, error: "Live Human Review checkout is not enabled." }, 503);
  }

  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")?.trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  const acceptedIds = parseAcceptedPaymentLinkIds(
    Deno.env.get("EASY_ERF_R999_PAYMENT_LINK_IDS"),
  );
  if (!stripeSecretKey || !supabaseUrl || !serviceRoleKey || acceptedIds.size === 0) {
    return json({ ok: false, error: "Human Review checkout is not configured." }, 503);
  }

  const token = bearerToken(request);
  if (!token) {
    return json({ ok: false, error: "Sign in before starting Human Review checkout." }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData.user;
  if (userError || !user) {
    return json({ ok: false, error: "Sign in before starting Human Review checkout." }, 401);
  }

  const brief = validation.request;
  const propertyReference = brief.propertyReferenceHint?.trim() ?? "";
  if (!propertyReference) {
    return json({ ok: false, error: "Add the property before starting Human Review checkout." }, 400);
  }

  const resolvedParcelId =
    brief.parcelId ??
    (await resolveSavedParcel(admin, user.id, propertyReference));

  const expectedLivemode = checkoutMode === "live";
  const stripe = new Stripe(stripeSecretKey);
  let verifiedUrl: URL | null = null;

  for (const paymentLinkId of acceptedIds) {
    try {
      const link = await stripe.paymentLinks.retrieve(paymentLinkId);
      if (!link.active || link.livemode !== expectedLivemode || typeof link.url !== "string") continue;

      const lineItems = await stripe.paymentLinks.listLineItems(paymentLinkId, { limit: 10 });
      if (lineItems.data.length !== 1) continue;
      const price = lineItems.data[0].price;
      if (
        !price ||
        typeof price === "string" ||
        price.unit_amount !== 99900 ||
        price.currency.toLowerCase() !== "zar" ||
        price.type !== "one_time"
      ) continue;

      const candidate = new URL(link.url);
      if (candidate.protocol !== "https:" || candidate.hostname !== "buy.stripe.com") continue;
      verifiedUrl = candidate;
      break;
    } catch {
      continue;
    }
  }

  if (!verifiedUrl) {
    return json(
      {
        ok: false,
        error: `Verified ${checkoutMode.toUpperCase()} Human Review checkout is unavailable.`,
      },
      503,
    );
  }

  const { data: requestRow, error: requestError } = await admin
    .from("human_review_requests")
    .insert({
      user_id: user.id,
      parcel_id: resolvedParcelId,
      property_reference_hint: propertyReference,
      focus: brief.focus,
      intended_use: brief.intendedUse,
      context: brief.context,
      source_surface: brief.sourceSurface,
      scope_acknowledged_at: new Date().toISOString(),
      status: "checkout_started",
    })
    .select("id")
    .single();

  if (requestError || typeof requestRow?.id !== "string") {
    return json({ ok: false, error: "The Human Review brief could not be prepared." }, 500);
  }

  // Stripe carries only this opaque request UUID. The property and review
  // questions stay inside Easy Erf; Stripe is used only to collect payment.
  verifiedUrl.searchParams.set("client_reference_id", requestRow.id);

  return json({
    ok: true,
    mode: checkoutMode,
    url: verifiedUrl.toString(),
    reviewRequestId: requestRow.id,
  });
});
