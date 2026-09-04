import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const notificationFunction = source(
  "supabase/functions/easy-erf-founder-customer-notification/index.ts",
);
const notificationMigration = source(
  "supabase/migrations/20260903211000_record_manual_report_notification.sql",
);
const notificationUi = source("src/components/admin/FounderCustomerNotification.tsx");
const founderEditor = source("src/components/admin/FounderHumanReviewEditor.tsx");
const config = source("supabase/config.toml");

describe("Easy Erf founder customer notification boundary", () => {
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

  it("prepares a founder-sent email without contacting the customer automatically", () => {
    expect(notificationFunction).toContain('new Set(["prepare", "record_sent"])');
    expect(notificationFunction).toContain("sendsAutomatically: false");
    expect(notificationFunction).toContain("mailto:");
    expect(notificationFunction).toContain("https://easyerf.co.za/orders");
    expect(notificationFunction).not.toMatch(/api\.resend\.com|sendgrid|mailgun|postmark/i);
    expect(notificationFunction).not.toMatch(/fetch\s*\(/);
    expect(notificationFunction).toContain("cleanSingleLine(payload.customerName, 120)");
    expect(notificationFunction).toContain("cleanSingleLine(payload.propertyReference, 240)");
    expect(notificationUi).toContain("The email could not be copied");
    expect(notificationUi).toContain("Easy Erf prepares the exact customer");
    expect(notificationUi).toMatch(/property\s+and secure report link/);
    expect(notificationUi).toContain("Open email draft");
    expect(notificationUi).toContain("Copy email");
    expect(notificationUi).toContain("Recording this does");
    expect(notificationUi).toContain("not send the email");
  });

  it("requires a complete report and resolved checklist before preparing the email", () => {
    expect(notificationFunction).toContain(
      "validateHumanReviewReportContent(order.review_content)",
    );
    expect(notificationFunction).toContain("validateHumanReviewInvestigationChecklist");
    expect(notificationFunction).toContain("isHumanReviewInvestigationChecklistResolved");
    expect(notificationFunction).toContain(
      "Resolve every standard investigation checklist item before preparing the customer email.",
    );
  });

  it("resolves the canonical order customer and requires explicit sent confirmation", () => {
    expect(notificationFunction).toContain("admin.auth.admin.getUserById(");
    expect(notificationFunction).toContain('const RECORD_CONFIRMATION = "I SENT THIS EMAIL"');
    expect(notificationFunction).toContain("body.confirmation !== RECORD_CONFIRMATION");
    // eslint-disable-next-line no-useless-escape
    expect(notificationFunction).toContain('\"record_easy_erf_customer_notification\"');
    expect(notificationFunction).toContain("cleanText(body.recipient)?.toLowerCase()");
    expect(notificationFunction).toContain("RECIPIENT_CHANGED");
    expect(notificationFunction).toContain("Prepare the email again.");
    expect(notificationUi).toContain("recipient: draft.recipient");
    expect(notificationUi).toContain("I sent this exact email to");
    expect(notificationUi).toContain("Record customer notified");
  });

  it("shows notification controls only on the delivered read-only report state", () => {
    expect(founderEditor).toContain("const notificationAvailable = disabled && !defaultOpen");
    expect(founderEditor).toContain("<FounderCustomerNotification");
    expect(founderEditor).toContain("available={notificationAvailable}");
  });
});

describe("Easy Erf customer notification database receipt", () => {
  it("accepts only a ready Easy Erf order and its canonical customer email", () => {
    expect(notificationMigration).toContain("public.has_role(p_actor_user_id");
    expect(notificationMigration).toContain("Founder actor must have admin role");
    expect(notificationMigration).toContain("v_order.provider is distinct from 'stripe'");
    expect(notificationMigration).toContain("v_status is distinct from 'ready'");
    expect(notificationMigration).toContain(
      "Only a ready report can be recorded as customer notified",
    );
    expect(notificationMigration).toContain("from auth.users");
    expect(notificationMigration).toContain("where id = v_order.user_id");
    expect(notificationMigration).toContain(
      "Notification recipient does not match the order customer",
    );
    expect(notificationMigration).toContain(
      "A complete structured Human Review web report is required before notification",
    );
    expect(notificationMigration).toContain(
      "A resolved standard investigation checklist is required before notification",
    );
    expect(notificationMigration).toContain(
      "Every standard investigation checklist item must be complete or not applicable before notification",
    );
  });

  it("records one idempotent manual-email receipt and audit event", () => {
    expect(notificationMigration).toContain("v_existing_notification ->> 'status' = 'sent'");
    expect(notificationMigration).toContain(
      "v_existing_notification ->> 'channel' = 'manual_email'",
    );
    expect(notificationMigration).toContain(
      "nullif(v_existing_notification ->> 'sentBy', '') is not null",
    );
    expect(notificationMigration).toContain("return v_order;");
    expect(notificationMigration).toContain("'{customerNotification}'");
    expect(notificationMigration).toContain("'customer_notified'");
    expect(notificationMigration).toContain("'manual_email'");
    expect(notificationMigration).toContain("The function does not send email.");
  });

  it("clears the prior receipt when a delivered report is reopened", () => {
    expect(notificationMigration).toContain(
      "create or replace function public.clear_easy_erf_customer_notification_on_reopen()",
    );
    expect(notificationMigration).toContain(
      "new.review_content := new.review_content - 'customerNotification'",
    );
    expect(notificationMigration).toContain(
      "create trigger clear_easy_erf_customer_notification_on_reopen",
    );
  });

  it("keeps the receipt RPC service-role only", () => {
    expect(notificationMigration).toContain(
      "revoke all on function public.record_easy_erf_customer_notification(uuid, uuid, text)\nfrom public, anon, authenticated",
    );
    expect(notificationMigration).toContain(
      "grant execute on function public.record_easy_erf_customer_notification(uuid, uuid, text)\nto service_role",
    );
  });
});
