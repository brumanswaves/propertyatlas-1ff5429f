import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const migration = source(
  "supabase/migrations/20260831090000_easy_erf_founder_fulfillment_controls.sql",
);
const deliveryMigration = source(
  "supabase/migrations/20260831113000_secure_easy_erf_report_delivery.sql",
);
const reopenMigration = source(
  "supabase/migrations/20260831142610_reopen_easy_erf_human_review.sql",
);
const founderFunction = source("supabase/functions/easy-erf-founder-fulfillment/index.ts");
const uploadFunction = source("supabase/functions/easy-erf-founder-report-upload/index.ts");
const config = source("supabase/config.toml");

describe("Easy Erf founder fulfillment database authority", () => {
  it("keeps customer roles unable to write fulfillment state", () => {
    expect(migration).toContain(
      "revoke all on function public.transition_easy_erf_report_order(uuid, text, uuid, text, text)\nfrom public, anon, authenticated",
    );
    expect(deliveryMigration).toContain(
      "revoke all on function public.transition_easy_erf_report_order(uuid, text, uuid, text, text)\nfrom public, anon, authenticated",
    );
    expect(deliveryMigration).toContain(
      "grant execute on function public.transition_easy_erf_report_order(uuid, text, uuid, text, text)\nto service_role",
    );
    expect(migration).toContain(
      "revoke all on table public.report_order_events from public, anon, authenticated",
    );
  });

  it("enforces a narrow paid-processing-ready-or-failed state machine", () => {
    expect(deliveryMigration).toContain("when 'start_review' then");
    expect(deliveryMigration).toContain("Only paid orders can start review");
    expect(deliveryMigration).toContain("when 'mark_ready' then");
    expect(deliveryMigration).toContain("Only processing orders can be marked ready");
    expect(deliveryMigration).toContain("when 'mark_failed' then");
    expect(deliveryMigration).toContain("Only paid or processing orders can be marked failed");
    expect(reopenMigration).toContain("when 'reopen_review' then");
    expect(reopenMigration).toContain("Only ready orders can be reopened for review");
    expect(reopenMigration).toContain("completed_at = null");
    expect(deliveryMigration).not.toContain("when 'mark_paid'");
  });

  it("requires the exact private customer PDF object before ready", () => {
    expect(deliveryMigration).toContain("A matched customer account is required before report delivery");
    expect(deliveryMigration).toContain("'/paid-reports/'");
    expect(deliveryMigration).toContain("'/report.pdf'");
    expect(deliveryMigration).toContain("Report PDF storage path does not match the customer order");
    expect(deliveryMigration).toContain("from storage.objects");
    expect(deliveryMigration).toContain("bucket_id = 'erf-files'");
    expect(deliveryMigration).toContain("Report PDF is not present in private storage");
    expect(deliveryMigration).toContain("insert into public.report_order_events");
  });
});

describe("Easy Erf founder fulfillment Edge Function", () => {
  it("requires JWT and an explicit admin-role check before service-role use", () => {
    expect(config).toMatch(
      /\[functions\.easy-erf-founder-fulfillment\][\s\S]*verify_jwt = true/,
    );
    expect(founderFunction).toContain('request.headers.get("authorization")');
    expect(founderFunction).toContain("userClient.auth.getUser()");
    expect(founderFunction).toContain('userClient.rpc("has_role"');
    expect(founderFunction).toContain('_role: "admin"');
    expect(founderFunction.indexOf('userClient.rpc("has_role"')).toBeLessThan(
      founderFunction.indexOf("createClient(supabaseUrl, serviceRoleKey"),
    );
  });

  it("accepts only the four explicit fulfillment actions", () => {
    expect(founderFunction).toContain(
      'new Set(["start_review", "reopen_review", "mark_ready", "mark_failed"])',
    );
    expect(founderFunction).toContain("Unsupported fulfillment action.");
  });

  it("does not accept actor identity from the request body", () => {
    expect(founderFunction).toContain("p_actor_user_id: user.id");
    expect(founderFunction).not.toMatch(/body\.(actor|userId|actorUserId)/);
  });
});

describe("Easy Erf founder report upload Edge Function", () => {
  it("requires JWT and admin authorization before creating a service-role client", () => {
    expect(config).toMatch(
      /\[functions\.easy-erf-founder-report-upload\][\s\S]*verify_jwt = true/,
    );
    expect(uploadFunction).toContain('request.headers.get("authorization")');
    expect(uploadFunction).toContain("userClient.auth.getUser()");
    expect(uploadFunction).toContain('userClient.rpc("has_role"');
    expect(uploadFunction).toContain('_role: "admin"');
    expect(uploadFunction.indexOf('userClient.rpc("has_role"')).toBeLessThan(
      uploadFunction.indexOf("createClient(supabaseUrl, serviceRoleKey"),
    );
  });

  it("normalizes canonical fulfillment enum values before checking upload state", () => {
    expect(uploadFunction).toContain(
      'return raw === "fulfilling" ? "processing" : raw === "complete" ? "ready" : raw;',
    );
    expect(uploadFunction.indexOf('raw === "fulfilling"')).toBeLessThan(
      uploadFunction.indexOf('statusOf(order) !== "processing"'),
    );
  });

  it("prepares only the exact processing-order PDF path in the private existing bucket", () => {
    expect(uploadFunction).toContain('const REPORT_BUCKET = "erf-files"');
    expect(uploadFunction).toContain('statusOf(order) !== "processing"');
    expect(uploadFunction).toContain("payload.orderKind !== \"easy_erf_investigation\"");
    expect(uploadFunction).toContain('`${order.user_id}/paid-reports/${order.id}/report.pdf`');
    expect(uploadFunction).toContain("createSignedUploadUrl(path, { upsert: true })");
    expect(uploadFunction).toContain("Report PDF must be between 1 byte and 25 MB.");
  });

  it("refuses a signed upload token until the structured report and checklist are resolved", () => {
    expect(uploadFunction).toContain("validateHumanReviewReportContent(order.review_content)");
    expect(uploadFunction).toContain("validateHumanReviewInvestigationChecklist");
    expect(uploadFunction).toContain("isHumanReviewInvestigationChecklistResolved");
    expect(uploadFunction).toContain(
      "Resolve and save every standard investigation checklist item before uploading the optional PDF.",
    );
    expect(uploadFunction.indexOf("validateHumanReviewReportContent(order.review_content)")).toBeLessThan(
      uploadFunction.indexOf("createSignedUploadUrl(path, { upsert: true })"),
    );
    expect(uploadFunction.indexOf("isHumanReviewInvestigationChecklistResolved")).toBeLessThan(
      uploadFunction.indexOf("createSignedUploadUrl(path, { upsert: true })"),
    );
  });
});
