import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const founderRoute = source("src/routes/admin.fulfillment.tsx");
const customerRoute = source("src/routes/orders.tsx");

describe("Easy Erf founder fulfillment UI", () => {
  it("uses the authenticated founder Edge Function instead of writing report orders directly", () => {
    expect(founderRoute).toContain('supabase.functions.invoke("easy-erf-founder-fulfillment"');
    expect(founderRoute).not.toMatch(/from\("report_orders"\)[\s\S]{0,200}\.(update|insert|delete)\(/);
    expect(founderRoute).toContain('action: FulfillmentAction');
  });

  it("only exposes the legal founder actions and requires report path before ready", () => {
    expect(founderRoute).toContain('"start_review" | "mark_ready" | "mark_failed"');
    expect(founderRoute).toContain('placeholder="Report PDF storage path"');
    expect(founderRoute).toContain('disabled={busy || !path.trim()}');
    expect(founderRoute).toContain('placeholder="Failure reason"');
  });
});

describe("Easy Erf customer fulfillment status", () => {
  it("reads only the signed-in user Stripe investigation orders", () => {
    expect(customerRoute).toContain('.eq("user_id", user.id)');
    expect(customerRoute).toContain('.eq("provider", "stripe")');
    expect(customerRoute).not.toMatch(/from\("report_orders"\)[\s\S]{0,200}\.(update|insert|delete)\(/);
  });

  it("shows the payment, review and report-ready lifecycle without claiming delivery exists", () => {
    expect(customerRoute).toContain("Payment received");
    expect(customerRoute).toContain("Human review");
    expect(customerRoute).toContain("Report ready");
    expect(customerRoute).toContain("Secure report delivery is the next connection before launch.");
  });
});
