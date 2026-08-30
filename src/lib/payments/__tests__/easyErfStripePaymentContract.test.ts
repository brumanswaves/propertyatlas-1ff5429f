import { describe, expect, it } from "vitest";

import {
  EASY_ERF_INVESTIGATION_REQUEST_FIELD_KEY,
  EASY_ERF_PROPERTY_REFERENCE_FIELD_KEY,
  EASY_ERF_R999_AMOUNT_TOTAL,
  parseAcceptedPaymentLinkIds,
  parseCanonicalParcelId,
  parseStandaloneErfNumber,
  validateEasyErfCheckoutSession,
} from "../../../../supabase/functions/_shared/easyErfStripePaymentContract";

// These identifiers are synthetic fixtures and never reference live Stripe objects.
const PAYMENT_LINK_ID = "plink_easy_erf_test";
const SESSION_ID = "cs_test_easy_erf";
const LPI = "C03400140000157000000";
const PARCEL_ID = `csg:lpi:${LPI.toLowerCase()}`;

function textField(key: string, value: string) {
  return {
    key,
    label: { type: "custom", custom: key },
    optional: false,
    type: "text",
    text: { value },
  };
}

function checkoutSession(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    object: "checkout.session",
    mode: "payment",
    payment_status: "paid",
    amount_total: EASY_ERF_R999_AMOUNT_TOTAL,
    currency: "zar",
    livemode: false,
    payment_link: PAYMENT_LINK_ID,
    payment_intent: "pi_test_easy_erf",
    customer: "cus_test_easy_erf",
    client_reference_id: "a222bb34-93f7-4722-9fc0-8dfb6fe8a3e8",
    customer_details: {
      email: "Customer@Example.com",
      name: "Easy Erf Customer",
    },
    custom_fields: [
      textField(EASY_ERF_PROPERTY_REFERENCE_FIELD_KEY, LPI),
      textField(
        EASY_ERF_INVESTIGATION_REQUEST_FIELD_KEY,
        "Can I build a second dwelling?",
      ),
    ],
    ...overrides,
  };
}

const acceptedLinks = new Set([PAYMENT_LINK_ID]);

describe("Easy Erf Stripe payment-link allowlist", () => {
  it("trims, deduplicates and drops empty values", () => {
    expect([
      ...parseAcceptedPaymentLinkIds(
        ` ${PAYMENT_LINK_ID},,${PAYMENT_LINK_ID},plink_live `,
      ),
    ]).toEqual([PAYMENT_LINK_ID, "plink_live"]);
  });

  it("fails closed when no Easy Erf Payment Link is configured", () => {
    expect(validateEasyErfCheckoutSession(checkoutSession(), new Set())).toMatchObject({
      ok: false,
      code: "PAYMENT_LINK_NOT_CONFIGURED",
    });
  });

  it("ignores checkout sessions from another Payment Link", () => {
    expect(
      validateEasyErfCheckoutSession(
        checkoutSession({ payment_link: "plink_other_business" }),
        acceptedLinks,
      ),
    ).toEqual({ ok: true, disposition: "ignore", reason: "unrelated_payment_link" });
  });
});

describe("Easy Erf R999 Checkout Session validation", () => {
  it("extracts the exact paid one-property investigation contract", () => {
    const result = validateEasyErfCheckoutSession(checkoutSession(), acceptedLinks);

    expect(result).toEqual({
      ok: true,
      disposition: "record",
      order: {
        checkoutSessionId: SESSION_ID,
        paymentLinkId: PAYMENT_LINK_ID,
        paymentIntentId: "pi_test_easy_erf",
        customerId: "cus_test_easy_erf",
        clientReferenceId: "a222bb34-93f7-4722-9fc0-8dfb6fe8a3e8",
        customerEmail: "customer@example.com",
        customerName: "Easy Erf Customer",
        propertyReference: LPI,
        investigationRequest: "Can I build a second dwelling?",
        amountTotal: EASY_ERF_R999_AMOUNT_TOTAL,
        currency: "zar",
        livemode: false,
        parsedParcelId: PARCEL_ID,
      },
    });
  });

  it("accepts expanded Stripe object ids", () => {
    const result = validateEasyErfCheckoutSession(
      checkoutSession({
        payment_link: { id: PAYMENT_LINK_ID, object: "payment_link" },
        payment_intent: { id: "pi_expanded", object: "payment_intent" },
        customer: { id: "cus_expanded", object: "customer" },
      }),
      acceptedLinks,
    );

    expect(result).toMatchObject({
      ok: true,
      disposition: "record",
      order: {
        paymentLinkId: PAYMENT_LINK_ID,
        paymentIntentId: "pi_expanded",
        customerId: "cus_expanded",
      },
    });
  });

  it("ignores a completed session until its payment is settled", () => {
    expect(
      validateEasyErfCheckoutSession(
        checkoutSession({ payment_status: "unpaid" }),
        acceptedLinks,
      ),
    ).toEqual({ ok: true, disposition: "ignore", reason: "payment_not_settled" });
  });

  it("rejects subscription mode", () => {
    expect(
      validateEasyErfCheckoutSession(
        checkoutSession({ mode: "subscription" }),
        acceptedLinks,
      ),
    ).toMatchObject({ ok: false, code: "WRONG_MODE" });
  });

  it("rejects any amount or currency other than exactly R999 ZAR", () => {
    for (const overrides of [
      { amount_total: 99_901 },
      { amount_total: 999 },
      { currency: "usd" },
      { amount_total: null },
    ]) {
      expect(
        validateEasyErfCheckoutSession(checkoutSession(overrides), acceptedLinks),
      ).toMatchObject({
        ok: false,
        code: "WRONG_AMOUNT",
      });
    }
  });

  it("requires Stripe-collected customer email", () => {
    expect(
      validateEasyErfCheckoutSession(
        checkoutSession({ customer_details: { name: "No Email" }, customer_email: null }),
        acceptedLinks,
      ),
    ).toMatchObject({ ok: false, code: "CUSTOMER_EMAIL_MISSING" });
  });

  it("requires a property reference before a paid order can be recorded", () => {
    expect(
      validateEasyErfCheckoutSession(checkoutSession({ custom_fields: [] }), acceptedLinks),
    ).toMatchObject({ ok: false, code: "PROPERTY_REFERENCE_MISSING" });
  });

  it("keeps the investigation question optional", () => {
    const result = validateEasyErfCheckoutSession(
      checkoutSession({
        custom_fields: [textField(EASY_ERF_PROPERTY_REFERENCE_FIELD_KEY, "24 Padrone Crescent")],
      }),
      acceptedLinks,
    );

    expect(result).toMatchObject({
      ok: true,
      disposition: "record",
      order: {
        propertyReference: "24 Padrone Crescent",
        investigationRequest: null,
        parsedParcelId: null,
      },
    });
  });

  it("rejects malformed Checkout Session objects", () => {
    for (const value of [null, {}, { id: SESSION_ID }, { object: "checkout.session" }]) {
      expect(validateEasyErfCheckoutSession(value, acceptedLinks)).toMatchObject({
        ok: false,
        code: "INVALID_CHECKOUT_SESSION",
      });
    }
  });
});

describe("Easy Erf property-reference parsing", () => {
  it("normalizes only exact 21-character CSG LPI references", () => {
    expect(parseCanonicalParcelId(LPI)).toBe(PARCEL_ID);
    expect(parseCanonicalParcelId(`CSG:LPI:${LPI}`)).toBe(PARCEL_ID);
  });

  it("keeps addresses, erf numbers and arbitrary identifiers out of LPI parsing", () => {
    for (const value of [
      "24 Padrone Crescent",
      "Erf 1570",
      "1570",
      "C0340014000015700000",
      "C034001400001570000000",
      "A1234567890ABCDEFGHIJ",
    ]) {
      expect(parseCanonicalParcelId(value)).toBeNull();
    }
  });

  it("extracts only standalone unportioned erf-number references", () => {
    expect(parseStandaloneErfNumber("1570")).toBe("1570");
    expect(parseStandaloneErfNumber("Erf 1570")).toBe("1570");
    expect(parseStandaloneErfNumber("ERF: 001570")).toBe("1570");
    expect(parseStandaloneErfNumber("1570 / 0")).toBe("1570");
  });

  it("does not reduce an address, LPI or nonzero portion to an erf number", () => {
    for (const value of [
      "24 Padrone Crescent",
      LPI,
      `csg:lpi:${LPI}`,
      "1570/1",
      "Erf 1570, St Francis Bay",
      "Erf",
      "reference-1570",
    ]) {
      expect(parseStandaloneErfNumber(value)).toBeNull();
    }
  });
});
