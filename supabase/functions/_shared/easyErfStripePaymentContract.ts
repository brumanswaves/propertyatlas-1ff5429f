export const EASY_ERF_R999_AMOUNT_TOTAL = 99_900;
export const EASY_ERF_R999_CURRENCY = "zar";
export const EASY_ERF_PROPERTY_REFERENCE_FIELD_KEY = "property_reference";
export const EASY_ERF_INVESTIGATION_REQUEST_FIELD_KEY = "investigation_request";

const MAX_STRIPE_TEXT_LENGTH = 255;

type UnknownRecord = Record<string, unknown>;

export type EasyErfStripeOrderInput = {
  checkoutSessionId: string;
  paymentLinkId: string;
  paymentIntentId: string | null;
  customerId: string | null;
  clientReferenceId: string | null;
  customerEmail: string;
  customerName: string | null;
  propertyReference: string;
  investigationRequest: string | null;
  amountTotal: number;
  currency: typeof EASY_ERF_R999_CURRENCY;
  livemode: boolean;
  parsedParcelId: string | null;
};

export type EasyErfCheckoutValidation =
  | {
      ok: true;
      disposition: "record";
      order: EasyErfStripeOrderInput;
    }
  | {
      ok: true;
      disposition: "ignore";
      reason: "unrelated_payment_link" | "payment_not_settled";
    }
  | {
      ok: false;
      code:
        | "INVALID_CHECKOUT_SESSION"
        | "PAYMENT_LINK_NOT_CONFIGURED"
        | "WRONG_MODE"
        | "WRONG_AMOUNT"
        | "CUSTOMER_EMAIL_MISSING"
        | "PROPERTY_REFERENCE_MISSING";
      error: string;
    };

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function nonEmptyText(value: unknown, maxLength = MAX_STRIPE_TEXT_LENGTH): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > maxLength) return null;
  return text;
}

function objectId(value: unknown): string | null {
  const direct = nonEmptyText(value);
  if (direct) return direct;
  return nonEmptyText(asRecord(value)?.id);
}

function customTextField(session: UnknownRecord, key: string): string | null {
  if (!Array.isArray(session.custom_fields)) return null;

  for (const fieldValue of session.custom_fields) {
    const field = asRecord(fieldValue);
    if (!field || field.key !== key) continue;

    const fieldType = nonEmptyText(field.type);
    if (fieldType === "text") {
      return nonEmptyText(asRecord(field.text)?.value);
    }
    if (fieldType === "numeric") {
      return nonEmptyText(asRecord(field.numeric)?.value);
    }
    if (fieldType === "dropdown") {
      return nonEmptyText(asRecord(field.dropdown)?.value);
    }
  }

  return null;
}

export function parseAcceptedPaymentLinkIds(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export function parseCanonicalParcelId(propertyReference: string): string | null {
  const value = propertyReference.trim();
  const canonical = /^csg:lpi:([a-z]\d{20})$/i.exec(value);
  if (canonical) return `csg:lpi:${canonical[1].toLowerCase()}`;

  const lpi = /^([a-z]\d{20})$/i.exec(value);
  if (lpi) return `csg:lpi:${lpi[1].toLowerCase()}`;

  return null;
}

export function parseStandaloneErfNumber(propertyReference: string): string | null {
  const match = /^(?:erf[\s:#-]*)?(\d{1,10})(?:\s*\/\s*0)?$/i.exec(
    propertyReference.trim(),
  );
  if (!match) return null;

  return match[1].replace(/^0+(?=\d)/, "");
}

export function validateEasyErfCheckoutSession(
  value: unknown,
  acceptedPaymentLinkIds: ReadonlySet<string>,
): EasyErfCheckoutValidation {
  const session = asRecord(value);
  const checkoutSessionId = nonEmptyText(session?.id);
  if (!session || session.object !== "checkout.session" || !checkoutSessionId) {
    return {
      ok: false,
      code: "INVALID_CHECKOUT_SESSION",
      error: "Stripe event did not contain a valid Checkout Session.",
    };
  }

  if (acceptedPaymentLinkIds.size === 0) {
    return {
      ok: false,
      code: "PAYMENT_LINK_NOT_CONFIGURED",
      error: "No accepted Easy Erf Payment Link is configured.",
    };
  }

  const paymentLinkId = objectId(session.payment_link);
  if (!paymentLinkId || !acceptedPaymentLinkIds.has(paymentLinkId)) {
    return { ok: true, disposition: "ignore", reason: "unrelated_payment_link" };
  }

  if (session.mode !== "payment") {
    return {
      ok: false,
      code: "WRONG_MODE",
      error: "Easy Erf checkout must be a one-time payment.",
    };
  }

  if (session.payment_status !== "paid") {
    return { ok: true, disposition: "ignore", reason: "payment_not_settled" };
  }

  const currency = nonEmptyText(session.currency)?.toLowerCase();
  const amountTotal = session.amount_total;
  if (
    currency !== EASY_ERF_R999_CURRENCY ||
    typeof amountTotal !== "number" ||
    !Number.isInteger(amountTotal) ||
    amountTotal !== EASY_ERF_R999_AMOUNT_TOTAL
  ) {
    return {
      ok: false,
      code: "WRONG_AMOUNT",
      error: "Easy Erf checkout amount or currency did not match the R999 offer.",
    };
  }

  const customerDetails = asRecord(session.customer_details);
  const customerEmail = (
    nonEmptyText(customerDetails?.email) ?? nonEmptyText(session.customer_email)
  )?.toLowerCase();
  if (!customerEmail) {
    return {
      ok: false,
      code: "CUSTOMER_EMAIL_MISSING",
      error: "Paid Easy Erf checkout did not include a customer email.",
    };
  }

  const propertyReference = customTextField(session, EASY_ERF_PROPERTY_REFERENCE_FIELD_KEY);
  if (!propertyReference) {
    return {
      ok: false,
      code: "PROPERTY_REFERENCE_MISSING",
      error: "Paid Easy Erf checkout did not include the required property reference.",
    };
  }

  return {
    ok: true,
    disposition: "record",
    order: {
      checkoutSessionId,
      paymentLinkId,
      paymentIntentId: objectId(session.payment_intent),
      customerId: objectId(session.customer),
      clientReferenceId: nonEmptyText(session.client_reference_id),
      customerEmail,
      customerName: nonEmptyText(customerDetails?.name),
      propertyReference,
      investigationRequest: customTextField(
        session,
        EASY_ERF_INVESTIGATION_REQUEST_FIELD_KEY,
      ),
      amountTotal,
      currency: EASY_ERF_R999_CURRENCY,
      livemode: session.livemode === true,
      parsedParcelId: parseCanonicalParcelId(propertyReference),
    },
  };
}
