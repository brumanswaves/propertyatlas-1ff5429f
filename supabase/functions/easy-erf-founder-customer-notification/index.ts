import { createClient } from "npm:@supabase/supabase-js@2.108.0";

import {
  isHumanReviewInvestigationChecklistResolved,
  validateHumanReviewInvestigationChecklist,
  validateHumanReviewReportContent,
} from "../_shared/easyErfHumanReviewContract.ts";

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): unknown;
};

const FUNCTION_NAME = "easy-erf-founder-customer-notification";
const RECORD_CONFIRMATION = "I SENT THIS EMAIL";
const ALLOWED_ACTIONS = new Set(["prepare", "record_sent"]);
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function requiredEnv(name: string): string | null {
  const value = Deno.env.get(name)?.trim();
  return value || null;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function statusOf(order: { status?: string | null; status_enum?: string | null }) {
  const raw = (order.status_enum || order.status || "").toLowerCase();
  return raw === "fulfilling" ? "processing" : raw === "complete" ? "ready" : raw;
}

function customerNotificationReceipt(value: unknown) {
  if (!isRecord(value)) return null;
  const status = cleanText(value.status);
  const channel = cleanText(value.channel);
  const recipient = cleanText(value.recipient)?.toLowerCase() ?? null;
  const sentAt = cleanText(value.sentAt);
  const sentBy = cleanText(value.sentBy);
  if (status !== "sent" || channel !== "manual_email" || !recipient || !sentAt || !sentBy) {
    return null;
  }
  return { status, channel, recipient, sentAt, sentBy };
}

function buildDraft(input: {
  orderId: string;
  customerEmail: string;
  customerName: string | null;
  propertyReference: string;
}) {
  const reportUrl = new URL("https://easyerf.co.za/orders");
  reportUrl.searchParams.set("report", input.orderId);

  const firstName = input.customerName?.trim().split(/\s+/)[0] || "there";
  const subject = `Your Easy Erf report is ready: ${input.propertyReference}`;
  const body = [
    `Hi ${firstName},`,
    "",
    `Your Human-Reviewed Easy Erf Report for ${input.propertyReference} is ready.`,
    "",
    `Open it securely in your Easy Erf account: ${reportUrl.toString()}`,
    "",
    "The report records the available property evidence, key risks, remaining unknowns and the next checks worth completing.",
    "",
    `Sign in using ${input.customerEmail}.`,
    "",
    "Easy Erf",
    "Every erf. All the facts.",
  ].join("\n");

  return {
    recipient: input.customerEmail,
    subject,
    body,
    reportUrl: reportUrl.toString(),
    mailtoUrl: `mailto:${encodeURIComponent(input.customerEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  };
}

function log(stage: string, requestId: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ fn: FUNCTION_NAME, stage, requestId, ...extra }));
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
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ ok: false, error: "Customer notification is not configured.", requestId }, 503);
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
  const founder = authData.user;
  if (authError || !founder) {
    return json({ ok: false, error: "Authentication failed.", requestId }, 401);
  }

  const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
    _user_id: founder.id,
    _role: "admin",
  });
  if (roleError || isAdmin !== true) {
    return json({ ok: false, error: "Founder admin access is required.", requestId }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body.", requestId }, 400);
  }

  const orderId = body.orderId;
  const action = typeof body.action === "string" ? body.action : "prepare";
  if (!isUuid(orderId)) {
    return json({ ok: false, error: "A valid orderId is required.", requestId }, 400);
  }
  if (!ALLOWED_ACTIONS.has(action)) {
    return json({ ok: false, error: "Unsupported notification action.", requestId }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: order, error: orderError } = await admin
    .from("report_orders")
    .select("id,user_id,parcel_id,provider,payload,status,status_enum,review_content")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    return json({ ok: false, error: "Report order was not found.", requestId }, 404);
  }

  const payload = isRecord(order.payload) ? order.payload : {};
  if (order.provider !== "stripe" || payload.orderKind !== "easy_erf_investigation") {
    return json({ ok: false, error: "Order is not an Easy Erf Stripe investigation.", requestId }, 409);
  }
  if (statusOf(order) !== "ready") {
    return json({ ok: false, error: "Deliver the report before preparing the customer email.", requestId }, 409);
  }
  if (!isUuid(order.user_id)) {
    return json({ ok: false, error: "A matched customer account is required before notification.", requestId }, 409);
  }

  const reportValidation = validateHumanReviewReportContent(order.review_content);
  if (!reportValidation.ok) {
    return json({ ok: false, error: "A complete structured report is required before notification.", requestId }, 409);
  }

  const reviewContent = isRecord(order.review_content) ? order.review_content : {};
  const checklistValidation = validateHumanReviewInvestigationChecklist(
    reviewContent.investigationChecklist,
  );
  if (
    !checklistValidation.ok ||
    !isHumanReviewInvestigationChecklistResolved(checklistValidation.checklist)
  ) {
    return json(
      {
        ok: false,
        error:
          "Resolve every standard investigation checklist item before preparing the customer email.",
        requestId,
      },
      409,
    );
  }

  const { data: customerData, error: customerError } = await admin.auth.admin.getUserById(order.user_id);
  const customer = customerData.user;
  const customerEmail = customer?.email?.trim().toLowerCase() ?? null;
  if (customerError || !customer || !customerEmail) {
    return json({ ok: false, error: "The customer account does not have a deliverable email address.", requestId }, 409);
  }

  const customerName = cleanText(payload.customerName) ?? cleanText(customer.user_metadata?.full_name);
  const propertyReference = cleanText(payload.propertyReference) ?? cleanText(order.parcel_id) ?? "your property";
  const draft = buildDraft({
    orderId: order.id,
    customerEmail,
    customerName,
    propertyReference,
  });
  const existingReceipt = customerNotificationReceipt(reviewContent.customerNotification);

  if (action === "prepare") {
    log("notification_draft_prepared", requestId, {
      founderId: founder.id,
      orderId: order.id,
      alreadyRecorded: Boolean(existingReceipt),
    });
    return json({
      ok: true,
      draft,
      receipt: existingReceipt,
      sendsAutomatically: false,
      requestId,
    });
  }

  if (body.confirmation !== RECORD_CONFIRMATION) {
    return json(
      {
        ok: false,
        error: `Type ${RECORD_CONFIRMATION} only after sending the exact prepared email.`,
        requestId,
      },
      400,
    );
  }

  const { data: updatedOrder, error: recordError } = await admin.rpc(
    "record_easy_erf_customer_notification",
    {
      p_order_id: order.id,
      p_actor_user_id: founder.id,
      p_recipient_email: customerEmail,
    },
  );
  if (recordError || !updatedOrder) {
    log("notification_record_failed", requestId, {
      founderId: founder.id,
      orderId: order.id,
      errorCode: recordError?.code ?? null,
    });
    return json({ ok: false, error: "The notification receipt could not be saved.", requestId }, 409);
  }

  const updatedContent = isRecord(updatedOrder.review_content) ? updatedOrder.review_content : {};
  const receipt = customerNotificationReceipt(updatedContent.customerNotification);
  if (!receipt) {
    return json({ ok: false, error: "The notification receipt was not persisted.", requestId }, 500);
  }

  log("notification_recorded", requestId, {
    founderId: founder.id,
    orderId: order.id,
  });
  return json({ ok: true, draft, receipt, sendsAutomatically: false, requestId });
});
