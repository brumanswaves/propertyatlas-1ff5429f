import { describe, expect, it } from "vitest";
import { inspectEasyErfPaymentLink } from "../../../../supabase/functions/_shared/easyErfR999LaunchReadiness";
import { fixedPaymentLinkFixture, fixedLineItemFixture } from "./fixedPaymentLinkFixture";

const link = fixedPaymentLinkFixture();
const item = fixedLineItemFixture();
type LinkProbe = Parameters<typeof inspectEasyErfPaymentLink>[0];
type ItemProbe = Parameters<typeof inspectEasyErfPaymentLink>[1][number];
const valid = (l: LinkProbe = link, i: ItemProbe = item, complete = true) =>
  inspectEasyErfPaymentLink(l, [i], true, complete).contractValid;

describe("fixed R999 pre-payment total contract", () => {
  it("retains safe TEST/LIVE links and accepts explicit empty optional items/currency options", () => {
    expect(valid()).toBe(true);
    expect(inspectEasyErfPaymentLink(fixedPaymentLinkFixture(false), [item], false).contractValid).toBe(true);
    expect(valid({ ...link, optional_items: [] }, { ...item, price: { ...item.price, currency_options: {} } })).toBe(true);
  });

  it.each([
    ["promotions", { allow_promotion_codes: true }],
    ["automatic tax", { automatic_tax: { enabled: true } }],
    ["shipping", { shipping_options: [{}] }],
    ["optional items", { optional_items: [{}] }],
    ["managed payments", { managed_payments: { enabled: true } }],
  ])("rejects %s even when the current item total is R999", (_name, changes) => {
    expect(inspectEasyErfPaymentLink({ ...link, ...changes }, [item], true).contractValid).toBe(false);
  });

  it.each([
    "allow_promotion_codes", "automatic_tax", "shipping_options", "optional_items", "managed_payments",
  ])("blocks missing link observation %s", (field) => {
    const incomplete: Record<string, unknown> = { ...link }; delete incomplete[field];
    expect(inspectEasyErfPaymentLink(incomplete, [item], true).contractValid).toBe(false);
  });

  it.each([
    ["adjustable quantity", { adjustable_quantity: { enabled: true } }],
    ["discount", { amount_discount: 100 }],
    ["tax", { amount_tax: 100 }],
    ["subtotal", { amount_subtotal: 100_000 }],
    ["total", { amount_total: 100_000 }],
    ["currency", { currency: "usd" }],
    ["tax rates", { taxes: [{}] }],
    ["discount records", { discounts: [{}] }],
  ])("rejects %s before checkout", (_name, changes) => {
    expect(inspectEasyErfPaymentLink(link, [{ ...item, ...changes }], true).contractValid).toBe(false);
  });

  it.each(["adjustable_quantity", "amount_discount", "amount_tax", "amount_subtotal", "amount_total", "currency"])(
    "blocks missing item observation %s", (field) => {
      const incomplete: Record<string, unknown> = { ...item }; delete incomplete[field];
      expect(inspectEasyErfPaymentLink(link, [incomplete], true).contractValid).toBe(false);
    });

  it.each([
    ["custom amount", { custom_unit_amount: { enabled: true } }],
    ["transformed quantity", { transform_quantity: { divide_by: 2, round: "up" } }],
    ["tiered price", { billing_scheme: "tiered" }],
    ["alternative currency", { currency_options: { usd: { unit_amount: 99900, custom_unit_amount: null } } }],
    ["different ZAR option", { currency_options: { zar: { unit_amount: 100000, custom_unit_amount: null } } }],
    ["custom ZAR option", { currency_options: { zar: { unit_amount: 99900, custom_unit_amount: {} } } }],
    ["unexpanded currency options", { currency_options: undefined }],
  ])("rejects %s", (_name, changes) => {
    expect(inspectEasyErfPaymentLink(link, [{ ...item, price: { ...item.price, ...changes } }], true).contractValid).toBe(false);
  });

  it("rejects truncated item lists instead of treating the first item as the full checkout", () => {
    expect(valid(link, item, false)).toBe(false);
  });
});
