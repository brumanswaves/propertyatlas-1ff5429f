export function fixedPaymentLinkFixture(livemode = true) {
  return {
    active: true, livemode, url: "https://buy.stripe.com/synthetic",
    allow_promotion_codes: false, automatic_tax: { enabled: false },
    shipping_options: [], optional_items: null, managed_payments: null,
  };
}

export function fixedLineItemFixture() {
  return {
    quantity: 1, adjustable_quantity: null,
    amount_subtotal: 99_900, amount_total: 99_900,
    amount_tax: 0, amount_discount: 0, currency: "zar",
    price: {
      unit_amount: 99_900, currency: "zar", type: "one_time",
      billing_scheme: "per_unit", custom_unit_amount: null, transform_quantity: null,
      currency_options: { zar: { unit_amount: 99_900, custom_unit_amount: null } },
    },
  };
}
