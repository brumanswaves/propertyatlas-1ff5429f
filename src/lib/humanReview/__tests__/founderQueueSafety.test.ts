import { describe, expect, it } from "vitest";

import {
  buildFocusedOrderHash,
  isLegacyFounderOrder,
  parseFocusedOrderId,
  reportOrderMode,
} from "../founderQueueSafety";

const ORDER_ID = "384be2fe-f7aa-4687-970c-5a6db34cfeba";

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
    expect(isLegacyFounderOrder({ id: ORDER_ID, review_focus: "property_check" })).toBe(false);
  });

  it("labels only an explicit live payload as LIVE", () => {
    expect(reportOrderMode({ livemode: true })).toBe("LIVE");
    expect(reportOrderMode({ livemode: "true" })).toBe("LIVE");
    expect(reportOrderMode({ livemode: false })).toBe("TEST");
    expect(reportOrderMode({})).toBe("TEST");
    expect(reportOrderMode(null)).toBe("TEST");
  });
});
