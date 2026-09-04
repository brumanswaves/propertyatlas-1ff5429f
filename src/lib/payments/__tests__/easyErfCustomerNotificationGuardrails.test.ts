import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const notificationFunction = source(
  "supabase/functions/easy-erf-founder-customer-notification/index.ts",
);
const fulfillmentFunction = source("supabase/functions/easy-erf-founder-fulfillment/index.ts");
const notificationMigration = source(
  "supabase/migrations/20260904114500_automatic_report_ready_email.sql",
);
const notificationUi = source("src/components/admin/FounderCustomerNotification.tsx");
const founderEditor = source("src/components/admin/FounderHumanReviewEditor.tsx");
const config = source("supabase/config.toml");

describe("Easy Erf automatic customer report email boundary", () => {
  it("requires authenticated founder-admin access before service-role use", () => {
    expect(config).toMatch(
      /\[functions\.easy-erf-founder-customer-notification\][\s\S]*verify_jwt = true/,
    );
    expect(notificationFunction).toContain('request.headers.get("authorization")');
    expect(notificationFunction).toContain("userClient.auth.getUser()");
    expect(notificationFunction).toContain('userClient.rpc("has_role"');
    expect(notificationFunction).toContain('_role: "admin"');
    expect(notificationFunction.indexOf('userClient.rpc("has_role"')).toBeLessThan(
      notificationFunction.indexOf("createClient(supabaseUrl, serviceRoleKey"),
    );
  });

  it("sends the report-ready email automatically through a disabled-by-default provider gate", () => {
    expect(notificationFunction).toContain('const ALLOWED_ACTIONS = new Set(["send"])');
    expect(notificationFunction).toContain('const RESEND_ENDPOINT = "https://api.resend.com/emails"');
    expect(notificationFunction).toContain('requiredEnv("EASY_ERF_CUSTOMER_EMAIL_ENABLED") === "true"');
    expect(notificationFunction).toContain('requiredEnv("RESEND_API_KEY")');
    expect(notificationFunction).toContain('requiredEnv("EASY_ERF_REPORT_FROM_EMAIL")');
    expect(notificationFunction).toContain('"Idempotency-Key": idempotencyKey');
    expect(notificationFunction).toContain("easy-erf-report-ready/${order.id}/${reportVersion}");
    expect(notificationFunction).toContain("to: [email.recipient]");
    expect(notificationFunction).toContain('new URL("/orders", input.appUrl)');
    expect(notificationFunction).toContain('reportUrl.searchParams.set("report", input.orderId)');
    expect(notificationFunction).not.toContain("mailto:");
    expect(notificationFunction).not.toContain("I SENT THIS EMAIL");
    expect(notificationFunction).not.toContain("record_sent");
  });

  it("resolves the canonical customer and validates the delivered report before sending", () => {
    expect(notificationFunction).toContain("admin.auth.admin.getUserById(");
    expect(notificationFunction).toContain("validateHumanReviewReportContent(order.review_content)");
    expect(notificationFunction).toContain("validateHumanReviewInvestigationChecklist");
    expect(notificationFunction).toContain("isHumanReviewInvestigationChecklistResolved");
    expect(notificationFunction).toContain('statusOf(order) !== "ready"');
    expect(notificationFunction).toContain("const rawReportVersion = cleanText(order.completed_at)");
    expect(notificationFunction).toContain("normalizeTimestamp(rawReportVersion)");
    expect(notificationFunction).toContain("p_report_version: rawReportVersion");
    expect(notificationFunction).toContain("cleanSingleLine(payload.propertyReference, 240)");
    expect(notificationFunction).toContain("The customer account does not have a deliverable email address.");
  });

  it("records success and failure without accepting recipient or provider identity from the browser", () => {
    expect(notificationFunction).toContain('"record_easy_erf_customer_email_attempt"');
    expect(notificationFunction).toContain('p_delivery_status: "sent"');
    expect(notificationFunction).toContain('p_delivery_status: "failed"');
    expect(notificationFunction).toContain("p_recipient_email: customerEmail");
    expect(notificationFunction).toContain("p_provider: EMAIL_PROVIDER");
    expect(notificationFunction).not.toMatch(/body\.(recipient|provider|providerMessageId)/);
  });

  it("triggers customer email after the ready transition and leaves retry evidence when it fails", () => {
    expect(fulfillmentFunction).toContain("triggerAutomaticCustomerEmail");
    expect(fulfillmentFunction).toContain(
      '`${input.supabaseUrl}/functions/v1/easy-erf-founder-customer-notification`',
    );
    expect(fulfillmentFunction).toContain('body: JSON.stringify({ orderId: input.orderId, action: "send" })');
    expect(fulfillmentFunction.indexOf('admin.rpc(\n    "transition_easy_erf_report_order"')).toBeLessThan(
      fulfillmentFunction.indexOf("triggerAutomaticCustomerEmail({"),
    );
    expect(fulfillmentFunction).toContain("return json({ ok: true, order, notification, requestId })");
  });

  it("removes manual admin busywork and keeps only status plus recovery retry", () => {
    expect(notificationUi).toContain("New reports email the customer automatically");
    expect(notificationUi).toContain("Send report email");
    expect(notificationUi).toContain("Retry report email");
    expect(notificationUi).toContain("This is the recovery control");
    expect(notificationUi).not.toContain("Prepare customer email");
    expect(notificationUi).not.toContain("Open email draft");
    expect(notificationUi).not.toContain("Copy email");
    expect(notificationUi).not.toContain("Record customer notified");
    expect(notificationUi).not.toContain("I sent this exact email");
    expect(founderEditor).toContain("<FounderCustomerNotification");
  });
});

describe("Easy Erf automatic email database receipt", () => {
  it("retires the manual receipt function and accepts only the exact ready report version", () => {
    expect(notificationMigration).toContain(
      "drop function if exists public.record_easy_erf_customer_notification(uuid, uuid, text)",
    );
    expect(notificationMigration).toContain(
      "create or replace function public.record_easy_erf_customer_email_attempt(",
    );
    expect(notificationMigration).toContain("public.has_role(p_actor_user_id");
    expect(notificationMigration).toContain("Founder actor must have admin role");
    expect(notificationMigration).toContain("v_status is distinct from 'ready'");
    expect(notificationMigration).toContain("v_order.completed_at <> p_report_version");
    expect(notificationMigration).toContain(
      "Email report version does not match the delivered report",
    );
    expect(notificationMigration).toContain("from auth.users");
    expect(notificationMigration).toContain(
      "Notification recipient does not match the order customer",
    );
  });

  it("records automatic send success, failure and one idempotent sent event", () => {
    expect(notificationMigration).toContain("v_delivery_status not in ('sent', 'failed')");
    expect(notificationMigration).toContain("v_provider <> 'resend'");
    expect(notificationMigration).toContain("'channel', 'automatic_email'");
    expect(notificationMigration).toContain("'providerMessageId'");
    expect(notificationMigration).toContain("'errorCode'");
    expect(notificationMigration).toContain("'customer_notified'");
    expect(notificationMigration).toContain("'customer_notification_failed'");
    expect(notificationMigration).toContain("return v_order;");
  });

  it("preserves report content and clears the receipt when a report is reopened", () => {
    expect(notificationMigration).toContain("'{customerNotification}'");
    expect(notificationMigration).toContain(
      "comment on function public.clear_easy_erf_customer_notification_on_reopen()",
    );
    expect(notificationMigration).toContain("Clears the prior automatic customer-email receipt");
  });

  it("keeps the automatic receipt RPC service-role only", () => {
    expect(notificationMigration).toContain(
      "revoke all on function public.record_easy_erf_customer_email_attempt(",
    );
    expect(notificationMigration).toContain(
      "grant execute on function public.record_easy_erf_customer_email_attempt(",
    );
    expect(notificationMigration).toContain("to service_role;");
  });
});
