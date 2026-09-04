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
const EMAIL_PROVIDER = "resend";
const RESEND_ENDPOINT = "https://api.resend.com/emails";
const ALLOWED_ACTIONS = new Set(["send"]);
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type NotificationReceipt = {
  status: "sent" | "failed";
  channel: "automatic_email";
  provider: "resend";
  recipient: string;
  reportVersion: string;
  attemptedAt: string;
  sentAt: string | null;
  sentBy: string;
  providerMessageId: string | null;
  errorCode: string | null;
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
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanSingleLine(value: unknown, maxLength: number): string | null {
  const cleaned = cleanText(value)
    ?.replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function statusOf(order: { status?: string | null; status_enum?: string | null }) {
  const raw = (order.status_enum || order.status || "").toLowerCase();
  return raw === "fulfilling" ? "processing" : raw === "complete" ? "ready" : raw;
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseReceipt(value: unknown): NotificationReceipt | null {
  if (!isRecord(value)) return null;
  const status = cleanText(value.status);
  const channel = cleanText(value.channel);
  const provider = cleanText(value.provider);
  const recipient = cleanText(value.recipient)?.toLowerCase() ?? null;
  const reportVersion = normalizeTimestamp(value.reportVersion);
  const attemptedAt = normalizeTimestamp(value.attemptedAt);
  const sentAt = normalizeTimestamp(value.sentAt);
  const sentBy = cleanText(value.sentBy);
  const providerMessageId = cleanText(value.providerMessageId);
  const errorCode = cleanText(value.errorCode);

  if (
    (status !== "sent" && status !== "failed") ||
    channel !== "automatic_email" ||
    provider !== EMAIL_PROVIDER ||
    !recipient ||
    !reportVersion ||
    !attemptedAt ||
    !sentBy
  ) {
    return null;
  }
  if (status === "sent" && (!sentAt || !providerMessageId)) return null;
  if (status === "failed" && !errorCode) return null;

  return {
    status,
    channel,
    provider,
    recipient,
    reportVersion,
    attemptedAt,
    sentAt,
    sentBy,
    providerMessageId,
    errorCode,
  };
}

function buildEmail(input: {
  orderId: string;
  customerEmail: string;
  customerName: string | null;
  propertyReference: string;
  appUrl: string;
}) {
  const reportUrl = new URL("/orders", input.appUrl);
  reportUrl.searchParams.set("report", input.orderId);

  const firstName = input.customerName?.trim().split(/\s+/)[0] || "there";
  const subject = `Your Easy Erf report is ready: ${input.propertyReference}`;
  const text = [
    `Hi ${firstName},`,
    "",
    `Your Done-for-You Property Investigation for ${input.propertyReference} is ready.`,
    "",
    `Open the Human-Reviewed Easy Erf Report in your dashboard: ${reportUrl.toString()}`,
    "",
    "The report shows the available property evidence, key risks, remaining unknowns and the next checks worth completing.",
    "",
    `Sign in using ${input.customerEmail}.`,
    "",
    "Easy Erf",
    "Every erf. All the facts.",
  ].join("\n");

  const safeFirstName = escapeHtml(firstName);
  const safeProperty = escapeHtml(input.propertyReference);
  const safeReportUrl = escapeHtml(reportUrl.toString());
  const safeEmail = escapeHtml(input.customerEmail);
  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f7fbff;font-family:Arial,sans-serif;color:#0d1b2a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7fbff;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #d9e6f2;border-radius:20px;overflow:hidden;">
          <tr><td style="background:#0d1b2a;padding:22px 28px;color:#ffffff;font-size:18px;font-weight:700;">Easy <span style="color:#ff8a33;">Erf</span></td></tr>
          <tr><td style="padding:32px 28px;">
            <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Hi ${safeFirstName},</p>
            <h1 style="margin:0 0 16px;font-size:26px;line-height:1.25;">Your property investigation is ready</h1>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#475569;">Your Human-Reviewed Easy Erf Report for <strong style="color:#0d1b2a;">${safeProperty}</strong> is available in your dashboard.</p>
            <p style="margin:0 0 28px;"><a href="${safeReportUrl}" style="display:inline-block;background:#ff6a00;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 22px;border-radius:999px;">Open your report</a></p>
            <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#475569;">The report records the available evidence, important risks, remaining unknowns and the next checks worth completing.</p>
            <p style="margin:0;font-size:13px;line-height:1.7;color:#64748b;">Sign in using ${safeEmail}.</p>
          </td></tr>
          <tr><td style="border-top:1px solid #e2e8f0;padding:18px 28px;font-size:12px;line-height:1.6;color:#64748b;">Easy Erf provides property research and due-diligence support. It is not municipal approval or professional legal, planning, engineering or valuation advice.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return {
    recipient: input.customerEmail,
    subject,
    text,
    html,
    reportUrl: reportUrl.toString(),
  };
}

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  try {
    const parsed = await response.json();
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function providerErrorCode(response: Response, body: Record<string, unknown>) {
  return (
    cleanSingleLine(body.name, 120) ??
    cleanSingleLine(body.code, 120) ??
    `http_${response.status}`
  );
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
  const action = typeof body.action === "string" ? body.action : "send";
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
    .select("id,user_id,parcel_id,provider,payload,status,status_enum,review_content,completed_at")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    return json({ ok: false, error: "Report order was not found.", requestId }, 404);
  }

  const payload = isRecord(order.payload) ? order.payload : {};
  if (order.provider !== "stripe" || payload.orderKind !== "easy_erf_investigation") {
    return json(
      { ok: false, error: "Order is not an Easy Erf Stripe investigation.", requestId },
      409,
    );
  }
  if (statusOf(order) !== "ready") {
    return json(
      { ok: false, error: "Deliver the report before emailing the customer.", requestId },
      409,
    );
  }
  if (!isUuid(order.user_id)) {
    return json(
      {
        ok: false,
        error: "A matched customer account is required before notification.",
        requestId,
      },
      409,
    );
  }

  const reportVersion = normalizeTimestamp(order.completed_at);
  if (!reportVersion) {
    return json({ ok: false, error: "The delivered report does not have a valid version.", requestId }, 409);
  }

  const reportValidation = validateHumanReviewReportContent(order.review_content);
  if (!reportValidation.ok) {
    return json(
      {
        ok: false,
        error: "A complete structured report is required before notification.",
        requestId,
      },
      409,
    );
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
        error: "Resolve every standard investigation checklist item before notification.",
        requestId,
      },
      409,
    );
  }

  const { data: customerData, error: customerError } = await admin.auth.admin.getUserById(
    order.user_id,
  );
  const customer = customerData.user;
  const customerEmail = customer?.email?.trim().toLowerCase() ?? null;
  if (customerError || !customer || !customerEmail) {
    return json(
      {
        ok: false,
        error: "The customer account does not have a deliverable email address.",
        requestId,
      },
      409,
    );
  }

  const existingReceipt = parseReceipt(reviewContent.customerNotification);
  if (
    existingReceipt?.status === "sent" &&
    existingReceipt.recipient === customerEmail &&
    existingReceipt.reportVersion === reportVersion
  ) {
    return json({ ok: true, receipt: existingReceipt, alreadySent: true, requestId });
  }

  const emailEnabled = requiredEnv("EASY_ERF_CUSTOMER_EMAIL_ENABLED") === "true";
  const resendApiKey = requiredEnv("RESEND_API_KEY");
  const fromEmail = requiredEnv("EASY_ERF_REPORT_FROM_EMAIL");
  const replyTo = requiredEnv("EASY_ERF_REPORT_REPLY_TO");
  const appUrlValue = requiredEnv("EASY_ERF_APP_URL") ?? "https://easyerf.co.za";
  let appUrl: string;
  try {
    const parsedAppUrl = new URL(appUrlValue);
    if (parsedAppUrl.protocol !== "https:" || parsedAppUrl.hostname !== "easyerf.co.za") {
      throw new Error("invalid app url");
    }
    appUrl = parsedAppUrl.origin;
  } catch {
    return json({ ok: false, error: "The customer dashboard URL is not configured safely.", requestId }, 503);
  }

  if (!emailEnabled || !resendApiKey || !fromEmail) {
    return json(
      {
        ok: false,
        code: "EMAIL_NOT_CONFIGURED",
        error: "The report is ready, but automatic customer email is not configured.",
        requestId,
      },
      503,
    );
  }

  const customerName =
    cleanSingleLine(payload.customerName, 120) ??
    cleanSingleLine(customer.user_metadata?.full_name, 120);
  const propertyReference =
    cleanSingleLine(payload.propertyReference, 240) ??
    cleanSingleLine(order.parcel_id, 240) ??
    "your property";
  const email = buildEmail({
    orderId: order.id,
    customerEmail,
    customerName,
    propertyReference,
    appUrl,
  });
  const idempotencyKey = `easy-erf-report-ready/${order.id}/${reportVersion}`;

  let providerResponse: Response;
  try {
    providerResponse = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email.recipient],
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
  } catch {
    const errorCode = "provider_unreachable";
    await admin.rpc("record_easy_erf_customer_email_attempt", {
      p_order_id: order.id,
      p_actor_user_id: founder.id,
      p_recipient_email: customerEmail,
      p_delivery_status: "failed",
      p_provider: EMAIL_PROVIDER,
      p_report_version: reportVersion,
      p_provider_message_id: null,
      p_error_code: errorCode,
    });
    log("automatic_email_failed", requestId, {
      founderId: founder.id,
      orderId: order.id,
      errorCode,
    });
    return json(
      {
        ok: false,
        code: "EMAIL_SEND_FAILED",
        error: "The report is ready, but the customer email could not be sent. Retry from the delivered order.",
        requestId,
      },
      502,
    );
  }

  const providerBody = await responseBody(providerResponse);
  const providerMessageId = cleanSingleLine(providerBody.id, 255);
  if (!providerResponse.ok || !providerMessageId) {
    const errorCode = !providerResponse.ok
      ? providerErrorCode(providerResponse, providerBody)
      : "invalid_provider_response";
    const { data: failedOrder } = await admin.rpc("record_easy_erf_customer_email_attempt", {
      p_order_id: order.id,
      p_actor_user_id: founder.id,
      p_recipient_email: customerEmail,
      p_delivery_status: "failed",
      p_provider: EMAIL_PROVIDER,
      p_report_version: reportVersion,
      p_provider_message_id: null,
      p_error_code: errorCode,
    });
    const failedContent = isRecord(failedOrder?.review_content) ? failedOrder.review_content : {};
    log("automatic_email_failed", requestId, {
      founderId: founder.id,
      orderId: order.id,
      errorCode,
      providerStatus: providerResponse.status,
    });
    return json(
      {
        ok: false,
        code: "EMAIL_SEND_FAILED",
        error: "The report is ready, but the customer email could not be sent. Retry from the delivered order.",
        receipt: parseReceipt(failedContent.customerNotification),
        requestId,
      },
      502,
    );
  }

  const { data: updatedOrder, error: recordError } = await admin.rpc(
    "record_easy_erf_customer_email_attempt",
    {
      p_order_id: order.id,
      p_actor_user_id: founder.id,
      p_recipient_email: customerEmail,
      p_delivery_status: "sent",
      p_provider: EMAIL_PROVIDER,
      p_report_version: reportVersion,
      p_provider_message_id: providerMessageId,
      p_error_code: null,
    },
  );
  if (recordError || !updatedOrder) {
    log("automatic_email_receipt_failed", requestId, {
      founderId: founder.id,
      orderId: order.id,
      providerMessageId,
      errorCode: recordError?.code ?? null,
    });
    return json(
      {
        ok: false,
        code: "EMAIL_SENT_RECEIPT_FAILED",
        error: "The email provider accepted the report email, but Easy Erf could not record the receipt.",
        emailAccepted: true,
        providerMessageId,
        requestId,
      },
      500,
    );
  }

  const updatedContent = isRecord(updatedOrder.review_content) ? updatedOrder.review_content : {};
  const receipt = parseReceipt(updatedContent.customerNotification);
  if (!receipt || receipt.status !== "sent") {
    return json(
      {
        ok: false,
        code: "EMAIL_SENT_RECEIPT_FAILED",
        error: "The email provider accepted the report email, but the receipt was not persisted.",
        emailAccepted: true,
        providerMessageId,
        requestId,
      },
      500,
    );
  }

  log("automatic_email_sent", requestId, {
    founderId: founder.id,
    orderId: order.id,
    providerMessageId,
  });
  return json({
    ok: true,
    receipt,
    reportUrl: email.reportUrl,
    alreadySent: false,
    requestId,
  });
});
