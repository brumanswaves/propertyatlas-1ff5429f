import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  FOUNDER_DETAIL_COLUMNS,
  founderQueueSummaryReviewReasons,
  isFullFounderOrderId,
  isLegacyFounderSummary,
  parseFounderQueueSummaries,
  readFounderOrder,
  readFounderQueue,
  type FounderQueueSummary,
} from "../founderQueueData";

const A = "33333333-3333-4333-8333-333333333333";
const B = "44444444-4444-4444-8444-444444444444";
const summary: FounderQueueSummary = {
  id: A, parcel_id: "csg:lpi:c03400140000157000000", report_type: "human_review",
  status: "processing", status_enum: "fulfilling", provider: "stripe", price_cents: 99900,
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", completed_at: null,
  payment_mode: "TEST", has_property_reference: true, has_review_focus: true, has_report_content: false,
};

function detailClient(data: unknown, error: unknown = null) {
  const query = {
    select: vi.fn(), eq: vi.fn(), abortSignal: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.abortSignal.mockReturnValue(query);
  const from = vi.fn().mockReturnValue(query);
  return { query, from, client: { from } as unknown as Parameters<typeof readFounderOrder>[0] };
}

describe("founder metadata and selected-detail boundary", () => {
  it("accepts only a full UUID", () => {
    expect(isFullFounderOrderId(A)).toBe(true);
    for (const value of [A.slice(0, 8), `${A},${B}`, `${A} `, "", "../orders"]) {
      expect(isFullFounderOrderId(value)).toBe(false);
    }
  });

  it("accepts explicit metadata without inventing private content", () => {
    const result = parseFounderQueueSummaries([summary]);
    expect(result).toEqual([summary]);
    expect(result[0]).not.toHaveProperty("payload");
    expect(result[0]).not.toHaveProperty("review_content");
    expect(result[0]).not.toHaveProperty("user_id");
  });

  it.each(["payload", "review_content", "review_context", "failure_reason", "customerEmail", "customerNotification"])("rejects an unexpected %s field", (key) => {
    expect(() => parseFounderQueueSummaries([{ ...summary, [key]: "PRIVATE_SENTINEL" }])).toThrow("unexpected fields");
  });

  it("rejects malformed, duplicate and mismatched rows", () => {
    expect(() => parseFounderQueueSummaries(null)).toThrow();
    expect(() => parseFounderQueueSummaries([summary, summary])).toThrow("Duplicate");
    expect(() => parseFounderQueueSummaries([{ ...summary, id: A.slice(0, 8) }])).toThrow();
    expect(() => parseFounderQueueSummaries([{ ...summary, payment_mode: null }])).toThrow();
    expect(() => parseFounderQueueSummaries([{ ...summary, provider: "other" }])).toThrow();
    expect(() => parseFounderQueueSummaries([{ ...summary, has_report_content: "true" }])).toThrow();
  });

  it.each(["paid", "processing", "fulfilling"])("retains %s orders before a report is written", (status) => {
    expect(isLegacyFounderSummary({ ...summary, status, status_enum: status })).toBe(false);
  });

  it.each(["ready", "complete", "completed", "delivered"])("separates %s orders missing a report", (status) => {
    expect(founderQueueSummaryReviewReasons({ ...summary, status, status_enum: status })).toContain("Delivered structured report content missing");
    expect(isLegacyFounderSummary({ ...summary, status, status_enum: status, has_report_content: true })).toBe(false);
  });

  it("never converts unknown payment mode into test mode", () => {
    expect(founderQueueSummaryReviewReasons({ ...summary, payment_mode: "UNKNOWN" })).toContain("Payment mode unavailable");
  });

  it("uses only the read-only summary RPC for the queue", async () => {
    const signal = new AbortController().signal;
    const abortSignal = vi.fn().mockResolvedValue({ data: [summary], error: null });
    const rpc = vi.fn().mockReturnValue({ abortSignal });
    const client = { rpc } as unknown as Parameters<typeof readFounderQueue>[0];
    expect(await readFounderQueue(client, signal)).toEqual([summary]);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("list_easy_erf_founder_queue", { p_limit: 100 });
    expect(abortSignal).toHaveBeenCalledExactlyOnceWith(signal);
  });

  it("filters details by one complete UUID and provider before the read", async () => {
    const { client, from, query } = detailClient({ id: A, provider: "stripe", review_content: { bottomLine: "PRIVATE_A" } });
    const signal = new AbortController().signal;
    await readFounderOrder(client, A, signal);
    expect(from).toHaveBeenCalledExactlyOnceWith("report_orders");
    expect(query.select).toHaveBeenCalledExactlyOnceWith(FOUNDER_DETAIL_COLUMNS);
    expect(query.eq.mock.calls).toEqual([["id", A], ["provider", "stripe"]]);
    expect(query.abortSignal).toHaveBeenCalledWith(signal);
    expect(query.maybeSingle).toHaveBeenCalledOnce();
    expect(query.eq.mock.invocationCallOrder.at(-1)).toBeLessThan(query.maybeSingle.mock.invocationCallOrder[0]);
  });

  it("does not submit any data request for a partial UUID", async () => {
    const { client, from } = detailClient(null);
    await expect(readFounderOrder(client, A.slice(0, 8), new AbortController().signal)).rejects.toThrow("complete order UUID");
    expect(from).not.toHaveBeenCalled();
  });

  it("fails closed on a wrong-order response or read error", async () => {
    const signal = new AbortController().signal;
    await expect(readFounderOrder(detailClient({ id: B, provider: "stripe" }).client, A, signal)).rejects.toThrow("did not match");
    await expect(readFounderOrder(detailClient({ id: A, provider: "stripe" }, { message: "denied" }).client, A, signal)).rejects.toThrow("Could not load");
    expect(await readFounderOrder(detailClient(null).client, A, signal)).toBeNull();
  });

  it("wires the route to isolated state and keeps bodies out of queue cards", () => {
    const route = readFileSync(resolve("src/routes/admin_.fulfillment.tsx"), "utf8");
    const hook = readFileSync(resolve("src/lib/humanReview/useFounderOrderData.ts"), "utf8");
    expect(route).toContain("useFounderOrderData(focusedOrderId, !isAdmin)");
    expect(route).not.toContain('.from("report_orders")');
    const queue = route.slice(route.indexOf("function QueueOverview"), route.indexOf("function FocusedOrderWorkbench"));
    expect(queue).not.toContain("order.payload");
    expect(queue).not.toContain("order.review_content");
    expect(hook).toContain("detailRequest.current?.abort()");
    expect(hook).toContain("selectedRef.current !== id");
    expect(hook).toContain("order: null");
    expect(hook).toContain("detail.id === selectedId");
  });
});
