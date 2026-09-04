import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const migration = source(
  "supabase/migrations/20260831130000_align_easy_erf_fulfillment_status_enum.sql",
);
const founderRoute = source("src/routes/admin_.fulfillment.tsx");
const customerRoute = source("src/routes/orders.tsx");
const customerPresentation = source("src/lib/humanReview/customerReportPresentation.ts");

describe("Easy Erf fulfillment status compatibility", () => {
  it("uses the existing production enum values instead of inventing processing/ready enum labels", () => {
    expect(migration).toContain("status_enum = 'fulfilling'::public.report_order_status");
    expect(migration).toContain("status_enum = 'complete'::public.report_order_status");
    expect(migration).not.toContain("status_enum = 'processing'::public.report_order_status");
    expect(migration).not.toContain("status_enum = 'ready'::public.report_order_status");
  });

  it("normalizes fulfilling/complete back to the product lifecycle labels", () => {
    expect(migration).toContain("when 'fulfilling' then 'processing'");
    expect(migration).toContain("when 'complete' then 'ready'");
    expect(founderRoute).toContain('status === "fulfilling" ? "processing"');
    expect(founderRoute).toContain('status === "complete" ? "ready"');
    expect(customerRoute).toContain("customerReportStatus(order)");
    expect(customerPresentation).toContain('status === "fulfilling" ? "processing"');
    expect(customerPresentation).toContain('status === "complete" ? "ready"');
  });
});
