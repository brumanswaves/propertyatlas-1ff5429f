import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const founderRoute = source("src/routes/admin.fulfillment.tsx");
const customerRoute = source("src/routes/orders.tsx");

describe("Easy Erf founder fulfillment UI", () => {
  it("uses authenticated Edge Functions instead of writing report orders directly", () => {
    expect(founderRoute).toContain('supabase.functions.invoke("easy-erf-founder-fulfillment"');
    expect(founderRoute).toContain('"easy-erf-founder-report-upload"');
    expect(founderRoute).not.toMatch(/from\("report_orders"\)[\s\S]{0,200}\.(update|insert|delete)\(/);
    expect(founderRoute).toContain('action: FulfillmentAction');
  });

  it("makes the founder complete the standard investigation before final report delivery", () => {
    expect(founderRoute).toContain("Standard done-for-you investigation checklist");
    expect(founderRoute).toContain("Open full property investigation");
    expect(founderRoute).toContain("Start Done-for-You Investigation");
    expect(founderRoute).toContain("Mark web report ready");
    expect(founderRoute).toContain("do not attach or redistribute the provider PDF");
  });

  it("uploads only a selected optional Easy Erf PDF through a short-lived signed upload", () => {
    expect(founderRoute).toContain('accept="application/pdf,.pdf"');
    expect(founderRoute).toContain("uploadToSignedUrl(prepared.path, prepared.token, file");
    expect(founderRoute).toContain('contentType: "application/pdf"');
    expect(founderRoute).toContain('action: "mark_ready"');
    expect(founderRoute).toContain("pdfStoragePath: prepared.path");
    expect(founderRoute).not.toContain('placeholder="Report PDF storage path"');
    expect(founderRoute).toContain('placeholder="Failure reason"');
  });
});

describe("Easy Erf customer fulfillment status", () => {
  it("reads only the signed-in user Stripe investigation orders", () => {
    expect(customerRoute).toContain('.eq("user_id", user.id)');
    expect(customerRoute).toContain('.eq("provider", "stripe")');
    expect(customerRoute).not.toMatch(/from\("report_orders"\)[\s\S]{0,200}\.(update|insert|delete)\(/);
  });

  it("shows the done-for-you lifecycle and creates a five-minute private report download when a PDF exists", () => {
    expect(customerRoute).toContain("Payment received");
    expect(customerRoute).toContain("Investigation underway");
    expect(customerRoute).toContain("Report ready");
    expect(customerRoute).toContain("Easy Erf has taken over the property investigation.");
    expect(customerRoute).toContain('.from("erf-files")');
    expect(customerRoute).toContain("createSignedUrl(order.pdf_storage_path, 300, { download: true })");
    expect(customerRoute).toContain("Download PDF");
    expect(customerRoute).not.toContain("Secure report delivery is the next connection before launch.");
  });
});
