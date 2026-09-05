import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { partitionCustomerReportOrders } from "@/lib/humanReview/customerReportPresentation";
import { isHumanReviewReportContentComplete } from "@/lib/humanReview/reportContent";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const founderRoute = source("src/routes/admin_.fulfillment.tsx");
const customerRoute = source("src/routes/orders.tsx");

describe("Easy Erf founder fulfillment UI", () => {
  it("keeps operations navigation in document coordinates, clear of the fulfillment Back control", () => {
    const guard = source("src/components/admin/AdminGuard.tsx");
    const operations = guard.slice(guard.indexOf('<nav'), guard.indexOf('</nav>'));
    expect(operations).toContain('aria-label="Founder Operations"');
    expect(operations).toContain('className="absolute');
    expect(operations).not.toContain('className="fixed');
    for (const path of ["/admin", "/admin/users", "/admin/entitlements", "/admin/launch-readiness", "/admin/readiness", "/admin/public-data-debug"]) {
      expect(operations).toContain(`href="${path}"`);
    }
    expect(founderRoute).toContain("pb-16 pt-36");
    expect(founderRoute).toContain('onClick={onExit}');
    expect(guard).toContain('.eq("role", "admin")');
  });

  it("uses authenticated Edge Functions instead of writing report orders directly", () => {
    expect(founderRoute).toContain('supabase.functions.invoke("easy-erf-founder-fulfillment"');
    expect(founderRoute).toContain('"easy-erf-founder-report-upload"');
    expect(founderRoute).not.toMatch(/from\("report_orders"\)[\s\S]{0,200}\.(update|insert|delete)\(/);
    expect(founderRoute).toContain('action: FulfillmentAction');
  });

  it("makes the founder complete the standard investigation before final report delivery", () => {
    expect(source("src/components/admin/FounderHumanReviewEditor.tsx")).toContain("DONE_FOR_YOU_INVESTIGATION_CHECKLIST_ITEMS");
    expect(founderRoute).toContain("Open full property investigation");
    expect(founderRoute).toContain("Start this exact investigation");
    expect(founderRoute).toContain("Mark this exact report ready");
    expect(founderRoute).toContain("do not attach or redistribute the provider PDF");
  });

  it("disables both delivery paths until the saved report and checklist are resolved", () => {
    expect(founderRoute).toContain("isHumanReviewReportContentComplete(order.review_content)");
    expect(founderRoute).toContain("parseHumanReviewInvestigationChecklist(order.review_content)");
    expect(founderRoute).toContain("const deliveryReady = reportReady && checklistReady");
    expect(founderRoute).toContain("disabled={busy || !deliveryReady}");
    expect(founderRoute).toContain("disabled={busy || !file || !deliveryReady}");
    expect(founderRoute).toContain(
      "Resolve and save every standard investigation checklist item first.",
    );

    const validReport = {
      bottomLine: "Reviewed bottom line",
      known: ["Known"],
      potential: ["Potential"],
      risks: ["Risk"],
      unknowns: ["Unknown"],
      nextSteps: ["Next"],
    };
    expect(isHumanReviewReportContentComplete(validReport)).toBe(true);
    expect(
      isHumanReviewReportContentComplete({ ...validReport, potential: [] }),
    ).toBe(false);
    expect(
      isHumanReviewReportContentComplete({
        ...validReport,
        known: Array.from({ length: 9 }, (_, index) => `Known ${index + 1}`),
      }),
    ).toBe(false);
    expect(
      isHumanReviewReportContentComplete({ ...validReport, known: ["Known", 42] }),
    ).toBe(false);
    expect(
      isHumanReviewReportContentComplete({
        ...validReport,
        bottomLine: "x".repeat(1401),
      }),
    ).toBe(false);
  });

  it("keeps delivered content read-only until the order is explicitly reopened", () => {
    expect(founderRoute).toContain('disabled={busy || status === "ready"}');
    expect(founderRoute).toContain("Reopen this exact report");
    expect(founderRoute).toContain("<AlertDialogContent");
    expect(founderRoute).toContain("The report will return to investigation status.");
    expect(founderRoute).not.toContain("window.confirm");
  });

  it("uploads only a selected optional Easy Erf PDF through a short-lived signed upload", () => {
    expect(founderRoute).toContain('accept="application/pdf,.pdf"');
    expect(founderRoute).toContain("uploadToSignedUrl(prepared.path, prepared.token, file");
    expect(founderRoute).toContain('contentType: "application/pdf"');
    expect(founderRoute).toContain('action: "mark_ready"');
    expect(founderRoute).toContain("pdfStoragePath: prepared.path");
    expect(founderRoute).not.toContain('placeholder="Report PDF storage path"');
    expect(founderRoute).toContain('placeholder="Failure reason for this exact order"');
  });

  it("keys every workbench form by the complete order, not just its report editor", () => {
    expect(founderRoute).toMatch(/<FocusedOrderWorkbench\s+key=\{focusedOrderId\}/);
    expect(founderRoute).toContain('aria-label="Selected order identity"');
    expect(founderRoute).toContain('data-order-id={order.id}');
    expect(founderRoute).toContain("No other order has been opened or made actionable.");
    const queue = founderRoute.slice(founderRoute.indexOf("function QueueOverview"), founderRoute.indexOf("function FocusedOrderWorkbench"));
    expect(queue).not.toMatch(/onTransition|onUploadReport|FounderHumanReviewEditor|FounderCustomerNotification|<input|<textarea|<select/);
    expect(queue).toContain("Open exact order");
  });
});

describe("Easy Erf customer fulfillment status", () => {
  it("reads only the signed-in user Stripe investigation orders", () => {
    expect(customerRoute).toContain('.eq("user_id", user.id)');
    expect(customerRoute).toContain('.eq("provider", "stripe")');
    expect(customerRoute).not.toMatch(/from\("report_orders"\)[\s\S]{0,200}\.(update|insert|delete)\(/);
  });

  it("partitions every order into exactly one presentation while preserving purchase order", () => {
    const structuredContent = {
      bottomLine: "The structured web report is available.",
      known: ["The parcel identity is recorded."],
      potential: [],
      risks: [],
      unknowns: [],
      nextSteps: [],
    };
    const orders = [
      { id: "structured", status: "ready", status_enum: null, review_content: structuredContent },
      { id: "legacy", status: "ready", status_enum: null, review_content: null },
      { id: "processing", status: "paid", status_enum: "fulfilling", review_content: structuredContent },
      { id: "complete", status: "paid", status_enum: "complete", review_content: structuredContent },
    ];

    const grouped = partitionCustomerReportOrders(orders);
    const finishedIds = grouped.finished.map(({ order }) => order.id);
    const finishedKinds = grouped.finished.map((report) => report.kind);
    const inProgressIds = grouped.inProgress.map((order) => order.id);
    const allPresentationIds = [...finishedIds, ...inProgressIds];

    expect(finishedIds).toEqual(["structured", "legacy", "complete"]);
    expect(finishedKinds).toEqual(["structured", "legacy", "structured"]);
    expect(grouped.structuredFinished.map(({ order }) => order.id)).toEqual([
      "structured",
      "complete",
    ]);
    expect(grouped.legacyFinished.map((order) => order.id)).toEqual(["legacy"]);
    expect(inProgressIds).toEqual(["processing"]);
    expect(new Set(allPresentationIds).size).toBe(orders.length);
  });

  it("shows matching clickable cards for separate completed purchases", () => {
    expect(customerRoute).toContain("Each card below is a separate paid order.");
    expect(customerRoute).toContain("The same property can appear more than once");
    expect(customerRoute).toContain("Order reference");
    expect(customerRoute).toContain("Open order");
    expect(customerRoute).toContain("Separate paid order");
    expect(customerRoute).toContain("finishedDeliveryLabel(report)");
    expect(customerRoute).toContain("reports.map((report)");
    expect(customerRoute).toContain("groupedOrders.finished.find");
    expect(customerRoute).toContain("report.kind === \"structured\"");
  });

  it("shows the done-for-you lifecycle and creates a five-minute private report download when a PDF exists", () => {
    expect(customerRoute).toContain("Payment received");
    expect(customerRoute).toContain("Investigation underway");
    expect(customerRoute).toContain("Report ready");
    expect(customerRoute).toContain("Easy Erf has taken over the property investigation.");
    expect(customerRoute).toContain('.from("erf-files")');
    expect(customerRoute).toContain("createSignedUrl(order.pdf_storage_path, 300, { download: true })");
    expect(customerRoute).toContain("Download PDF");
    expect(customerRoute).toContain('<CustomerWorkspaceShell activeTab="reports">');
    expect(customerRoute).toContain("In progress");
    expect(customerRoute).toContain("Finished reports");
    expect(customerRoute).toContain('label="Finished"');
    expect(customerRoute).toContain("Back to reports");
    expect(customerRoute).toContain('nextUrl.searchParams.set("report", orderId)');
    expect(customerRoute).toContain("partitionCustomerReportOrders(orders)");
    expect(customerRoute).not.toContain("Secure report delivery is the next connection before launch.");
  });
});
