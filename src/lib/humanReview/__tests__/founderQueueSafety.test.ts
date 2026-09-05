import { describe, expect, it } from "vitest";

import {
  buildFocusedOrderHash,
  founderDeliveryResult,
  founderOrderReviewReasons,
  isLegacyFounderOrder,
  parseFocusedOrderId,
  reportOrderMode,
} from "../founderQueueSafety";

const ORDER_ID = "384be2fe-f7aa-4687-970c-5a6db34cfeba";
const current = {
  id: ORDER_ID,
  status: "ready",
  status_enum: "ready",
  review_focus: "property_check",
  parcel_id: "csg:lpi:c03400140000157000000",
  payload: { livemode: false, propertyReference: "Erf 1570, 24 Padrone Crescent, St Francis Bay" },
  review_content: { bottomLine: "Reviewed fixture", known: ["Recorded"], potential: [], risks: [], unknowns: [], nextSteps: [] },
};

describe("founder fulfillment exact-order focus", () => {
  it("accepts only a complete UUID order hash", () => {
    expect(parseFocusedOrderId(`#order-${ORDER_ID}`)).toBe(ORDER_ID);
    expect(parseFocusedOrderId("#order-384be2fe")).toBeNull();
    expect(parseFocusedOrderId(`#other-${ORDER_ID}`)).toBeNull();
    expect(parseFocusedOrderId("")).toBeNull();
  });

  it("builds the canonical focused-order hash", () => {
    expect(buildFocusedOrderHash(ORDER_ID.toUpperCase())).toBe(`#order-${ORDER_ID}`);
    expect(() => buildFocusedOrderHash("384be2fe")).toThrow(
      "A valid report order ID is required.",
    );
  });
});

describe("founder fulfillment queue classification", () => {
  it("keeps legacy-format orders out of the primary queue", () => {
    expect(isLegacyFounderOrder({ id: ORDER_ID, review_focus: null })).toBe(true);
    expect(isLegacyFounderOrder({ id: ORDER_ID, review_focus: "" })).toBe(true);
    expect(isLegacyFounderOrder(current)).toBe(false);
  });

  it.each([
    { ...current, parcel_id: null },
    { ...current, payload: { ...current.payload, propertyReference: "1570" } },
    { ...current, review_focus: null },
    { ...current, review_content: null },
    { ...current, payload: { propertyReference: "Erf 1570" } },
  ])("excludes incomplete or ambiguous delivered records from current-order priority", (legacy) => {
    expect(founderOrderReviewReasons(legacy).length).toBeGreaterThan(0);
    expect([legacy, current].filter((order) => !isLegacyFounderOrder(order))).toEqual([current]);
  });

  it.each([
    { status: "paid", status_enum: "paid" },
    { status: "processing", status_enum: "processing" },
    { status: "processing", status_enum: "fulfilling" },
    { status: "failed", status_enum: "failed" },
  ])("keeps a structurally valid $status order current before final report content exists", (lifecycle) => {
    const unfinished = {
      ...current,
      ...lifecycle,
      review_content: null,
    };

    expect(founderOrderReviewReasons(unfinished)).not.toContain(
      "Delivered structured report content missing",
    );
    expect(isLegacyFounderOrder(unfinished)).toBe(false);
  });

  it.each([
    { status: "ready", status_enum: "ready" },
    { status: "ready", status_enum: "complete" },
    { status: "delivered", status_enum: null },
  ])("requires structured report content after delivery: %j", (lifecycle) => {
    const deliveredWithoutReport = {
      ...current,
      ...lifecycle,
      review_content: null,
    };

    expect(founderOrderReviewReasons(deliveredWithoutReport)).toContain(
      "Delivered structured report content missing",
    );
    expect(isLegacyFounderOrder(deliveredWithoutReport)).toBe(true);
  });

  it("labels only an explicit live payload as LIVE", () => {
    expect(reportOrderMode({ livemode: true })).toBe("LIVE");
    expect(reportOrderMode({ livemode: "true" })).toBe("LIVE");
    expect(reportOrderMode({ livemode: false })).toBe("TEST");
    expect(reportOrderMode({})).toBe("UNKNOWN");
    expect(reportOrderMode(null)).toBe("UNKNOWN");
  });
});

describe("delivery and notification are separate results", () => {
  it.each([
    [{ ok: true, emailAccepted: true }, true, "customer email accepted"],
    [{ ok: true, receipt: { status: "sent" } }, true, "email recorded as sent"],
    [{ ok: true, alreadySent: true }, true, "email already recorded"],
    [{ ok: false, code: "EMAIL_NOT_CONFIGURED" }, false, "service is disabled"],
    [{ ok: false, code: "EMAIL_SEND_FAILED" }, false, "customer email failed"],
    [null, false, "not confirmed"],
  ])("does not conflate notification outcomes: %j", (notification, success, message) => {
    expect(founderDeliveryResult(notification)).toEqual({ success, message: expect.stringContaining(message as string) });
  });
});
