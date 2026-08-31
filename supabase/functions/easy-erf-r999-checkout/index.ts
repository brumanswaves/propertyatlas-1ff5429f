import Stripe from "npm:stripe@22.6.0";

import { parseAcceptedPaymentLinkIds } from "../_shared/easyErfStripePaymentContract.ts";

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): unknown;
};

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

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed." }, 405);

  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")?.trim();
  const acceptedIds = parseAcceptedPaymentLinkIds(
    Deno.env.get("EASY_ERF_R999_PAYMENT_LINK_IDS"),
  );
  if (!stripeSecretKey || acceptedIds.size === 0) {
    return json({ ok: false, error: "Human Review checkout is not configured." }, 503);
  }

  const stripe = new Stripe(stripeSecretKey);
  for (const paymentLinkId of acceptedIds) {
    try {
      const link = await stripe.paymentLinks.retrieve(paymentLinkId);
      if (!link.active || link.livemode || typeof link.url !== "string") continue;
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
      const url = new URL(link.url);
      if (url.protocol !== "https:" || url.hostname !== "buy.stripe.com") continue;
      return json({ ok: true, mode: "test", url: url.toString() });
    } catch {
      continue;
    }
  }

  return json({ ok: false, error: "Verified TEST Human Review checkout is unavailable." }, 503);
});
