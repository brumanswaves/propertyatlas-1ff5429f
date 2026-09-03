import {
  EASY_ERF_R999_AMOUNT_TOTAL,
  EASY_ERF_R999_CURRENCY,
} from "./easyErfStripePaymentContract.ts";

export const EASY_ERF_LIVE_SITE_HOST = "easyerf.co.za";
export const EASY_ERF_R999_RETURN_URL = "https://easyerf.co.za/orders?payment=received";
export const EASY_ERF_REQUIRED_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
] as const;

export type EasyErfCheckoutMode = "test" | "live" | "invalid";
export type EasyErfStripeKeyMode = "test" | "live" | "missing" | "unknown";
export type EasyErfLaunchCheckStatus = "pass" | "fail" | "unknown";
export type EasyErfLaunchState =
  | "invalid_configuration"
  | "test_mode"
  | "live_disarmed_blocked"
  | "live_disarmed_preflight_passed"
  | "live_armed_blocked"
  | "live_armed_preflight_passed";

export type EasyErfLaunchCheck = {
  id: string;
  label: string;
  status: EasyErfLaunchCheckStatus;
  detail: string;
  blocking: boolean;
  inspectable: boolean;
};

export type EasyErfLaunchEnvironment = {
  checkoutMode: EasyErfCheckoutMode;
  liveArmed: boolean;
  stripeKeyConfigured: boolean;
  stripeKeyMode: EasyErfStripeKeyMode;
  webhookSecretConfigured: boolean;
  acceptedPaymentLinkCount: number;
};

export type EasyErfPaymentLinkInspection = {
  contractValid: boolean;
  returnUrlValid: boolean;
};

export type EasyErfWebhookInspection = {
  endpointFound: boolean;
  enabled: boolean;
  modeMatches: boolean;
  requiredEventsPresent: boolean;
};

export type EasyErfStripeAccountInspection = {
  nameValid: boolean;
  businessUrlValid: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirementsClear: boolean;
  detailsSubmitted: boolean;
};

export type EasyErfLaunchReadiness = {
  state: EasyErfLaunchState;
  checkoutMode: EasyErfCheckoutMode;
  liveArmed: boolean;
  liveCheckoutGateOpen: boolean;
  inspectablePreflightPassed: boolean;
  readyForControlledSignatureTest: boolean;
  signatureSecretMatch: "not_verified";
  checks: EasyErfLaunchCheck[];
};

type PaymentLinkProbe = {
  active?: boolean;
  livemode?: boolean;
  url?: string | null;
  after_completion?: {
    type?: string | null;
    redirect?: { url?: string | null } | null;
  } | null;
};

type LineItemProbe = {
  price?:
    | string
    | {
        unit_amount?: number | null;
        currency?: string | null;
        type?: string | null;
      }
    | null;
};

type WebhookEndpointProbe = {
  url?: string | null;
  status?: string | null;
  livemode?: boolean;
  enabled_events?: readonly string[] | null;
};

type StripeAccountProbe = {
  business_profile?: {
    name?: string | null;
    url?: string | null;
  } | null;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
  requirements?: {
    currently_due?: readonly unknown[] | null;
    past_due?: readonly unknown[] | null;
    disabled_reason?: string | null;
  } | null;
};

export function resolveEasyErfCheckoutMode(raw: string | undefined): EasyErfCheckoutMode {
  const value = raw?.trim().toLowerCase();
  if (!value || value === "test") return "test";
  if (value === "live") return "live";
  return "invalid";
}

export function classifyEasyErfStripeKey(raw: string | undefined): EasyErfStripeKeyMode {
  const value = raw?.trim();
  if (!value) return "missing";
  if (/^(?:sk|rk)_live_/i.test(value)) return "live";
  if (/^(?:sk|rk)_test_/i.test(value)) return "test";
  return "unknown";
}

function normalizeUrl(value: string | null | undefined): URL | null {
  const text = value?.trim();
  if (!text) return null;
  try {
    return new URL(text.includes("://") ? text : `https://${text}`);
  } catch {
    return null;
  }
}

function normalizedEndpoint(value: string | null | undefined): string | null {
  const url = normalizeUrl(value);
  if (!url) return null;
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

function isExpectedReturnUrl(value: string | null | undefined): boolean {
  const actual = normalizeUrl(value);
  const expected = normalizeUrl(EASY_ERF_R999_RETURN_URL);
  if (!actual || !expected) return false;
  return actual.origin === expected.origin &&
    actual.pathname === expected.pathname &&
    actual.searchParams.get("payment") === "received";
}

export function inspectEasyErfPaymentLink(
  link: PaymentLinkProbe,
  lineItems: readonly LineItemProbe[],
  expectedLivemode: boolean,
): EasyErfPaymentLinkInspection {
  const checkoutUrl = normalizeUrl(link.url);
  const price = lineItems.length === 1 && typeof lineItems[0]?.price !== "string"
    ? lineItems[0]?.price
    : null;

  const contractValid = link.active === true &&
    link.livemode === expectedLivemode &&
    checkoutUrl?.protocol === "https:" &&
    checkoutUrl.hostname === "buy.stripe.com" &&
    lineItems.length === 1 &&
    Boolean(price) &&
    price?.unit_amount === EASY_ERF_R999_AMOUNT_TOTAL &&
    price?.currency?.toLowerCase() === EASY_ERF_R999_CURRENCY &&
    price?.type === "one_time";

  const returnUrlValid = link.after_completion?.type === "redirect" &&
    isExpectedReturnUrl(link.after_completion.redirect?.url);

  return { contractValid, returnUrlValid };
}

export function inspectEasyErfWebhookEndpoints(
  endpoints: readonly WebhookEndpointProbe[],
  expectedUrl: string,
  expectedLivemode: boolean,
): EasyErfWebhookInspection {
  const expected = normalizedEndpoint(expectedUrl);
  const endpoint = endpoints.find((candidate) => normalizedEndpoint(candidate.url) === expected);
  const enabledEvents = new Set(endpoint?.enabled_events ?? []);
  const requiredEventsPresent = enabledEvents.has("*") ||
    EASY_ERF_REQUIRED_WEBHOOK_EVENTS.every((event) => enabledEvents.has(event));

  return {
    endpointFound: Boolean(endpoint),
    enabled: endpoint?.status === "enabled",
    modeMatches: endpoint?.livemode === expectedLivemode,
    requiredEventsPresent,
  };
}

function isEasyErfBusinessUrl(value: string | null | undefined): boolean {
  const url = normalizeUrl(value);
  if (!url) return false;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  return host === EASY_ERF_LIVE_SITE_HOST;
}

export function inspectEasyErfStripeAccount(
  account: StripeAccountProbe,
): EasyErfStripeAccountInspection {
  const currentlyDue = account.requirements?.currently_due ?? [];
  const pastDue = account.requirements?.past_due ?? [];

  return {
    nameValid: account.business_profile?.name?.trim().toLowerCase() === "easy erf",
    businessUrlValid: isEasyErfBusinessUrl(account.business_profile?.url),
    chargesEnabled: account.charges_enabled === true,
    payoutsEnabled: account.payouts_enabled === true,
    requirementsClear: currentlyDue.length === 0 &&
      pastDue.length === 0 &&
      !account.requirements?.disabled_reason,
    detailsSubmitted: account.details_submitted === true,
  };
}

function check(
  id: string,
  label: string,
  status: EasyErfLaunchCheckStatus,
  detail: string,
  options: { blocking?: boolean; inspectable?: boolean } = {},
): EasyErfLaunchCheck {
  return {
    id,
    label,
    status,
    detail,
    blocking: options.blocking ?? true,
    inspectable: options.inspectable ?? true,
  };
}

export function buildEasyErfR999LaunchReadiness(input: {
  environment: EasyErfLaunchEnvironment;
  paymentLink: EasyErfPaymentLinkInspection | null;
  webhook: EasyErfWebhookInspection | null;
  account: EasyErfStripeAccountInspection | null;
}): EasyErfLaunchReadiness {
  const { environment, paymentLink, webhook, account } = input;
  const expectedKeyMode = environment.checkoutMode === "live"
    ? "live"
    : environment.checkoutMode === "test"
      ? "test"
      : null;

  const checks: EasyErfLaunchCheck[] = [
    check(
      "checkout-mode",
      "Checkout runtime mode",
      environment.checkoutMode === "live" ? "pass" : "fail",
      environment.checkoutMode === "live"
        ? "Runtime is configured for LIVE verification."
        : environment.checkoutMode === "test"
          ? "Runtime remains in TEST mode."
          : "Checkout mode is invalid.",
    ),
    check(
      "live-disarmed",
      "Live arming gate",
      environment.liveArmed ? "fail" : "pass",
      environment.liveArmed
        ? "The live arming flag is ON. Keep it OFF until all launch evidence is complete."
        : "The live arming flag is OFF, so this preflight cannot intentionally open live checkout.",
    ),
    check(
      "stripe-key-mode",
      "Stripe secret-key mode",
      expectedKeyMode && environment.stripeKeyMode === expectedKeyMode ? "pass" : "fail",
      !environment.stripeKeyConfigured
        ? "No Stripe secret key is configured."
        : environment.stripeKeyMode === "unknown"
          ? "The configured Stripe key mode cannot be classified safely."
          : expectedKeyMode && environment.stripeKeyMode === expectedKeyMode
            ? `The configured Stripe key matches ${expectedKeyMode.toUpperCase()} mode.`
            : `The configured Stripe key is ${environment.stripeKeyMode.toUpperCase()} while checkout mode is ${environment.checkoutMode.toUpperCase()}.`,
    ),
    check(
      "accepted-payment-link",
      "Accepted R999 Payment Link",
      environment.acceptedPaymentLinkCount > 0 && paymentLink?.contractValid === true ? "pass" : "fail",
      paymentLink?.contractValid
        ? `${environment.acceptedPaymentLinkCount} accepted Payment Link ID${environment.acceptedPaymentLinkCount === 1 ? " is" : "s are"} configured; a link matches one-time R999 ZAR checkout in the expected mode.`
        : environment.acceptedPaymentLinkCount === 0
          ? "No accepted R999 Payment Link ID is configured."
          : "The configured Payment Link could not be verified as active, correctly priced, one-time, and in the expected mode.",
    ),
    check(
      "payment-return-url",
      "Post-payment return URL",
      paymentLink?.returnUrlValid === true ? "pass" : "fail",
      paymentLink?.returnUrlValid
        ? "Stripe returns paid customers to the Easy Erf reports page."
        : "The Payment Link return URL does not match the Easy Erf paid-order return path.",
    ),
    check(
      "webhook-secret-present",
      "Webhook signing secret present",
      environment.webhookSecretConfigured ? "pass" : "fail",
      environment.webhookSecretConfigured
        ? "A webhook signing secret is configured. Its value is never returned by this preflight."
        : "No webhook signing secret is configured.",
    ),
    check(
      "webhook-endpoint",
      "Stripe webhook endpoint",
      webhook?.endpointFound && webhook.enabled && webhook.modeMatches && webhook.requiredEventsPresent
        ? "pass"
        : "fail",
      webhook?.endpointFound && webhook.enabled && webhook.modeMatches && webhook.requiredEventsPresent
        ? "The expected Easy Erf webhook is enabled in the correct mode with both required Checkout events."
        : "The expected webhook is missing, disabled, in the wrong mode, or missing a required Checkout event.",
    ),
    check(
      "stripe-account-capability",
      "Stripe account capability",
      account?.chargesEnabled &&
          account.payoutsEnabled &&
          account.requirementsClear &&
          account.detailsSubmitted
        ? "pass"
        : "fail",
      account?.chargesEnabled &&
          account.payoutsEnabled &&
          account.requirementsClear &&
          account.detailsSubmitted
        ? "Stripe reports charging and payouts enabled with no current or past-due account requirements."
        : "The Stripe account is not fully enabled or has unresolved requirements.",
    ),
    check(
      "stripe-business-profile",
      "Easy Erf Stripe business profile",
      account?.nameValid && account.businessUrlValid ? "pass" : "fail",
      account?.nameValid && account.businessUrlValid
        ? "The Stripe business name and website identify Easy Erf."
        : "The Stripe business name or website does not identify Easy Erf correctly.",
    ),
    check(
      "webhook-signature-match",
      "Webhook signing-secret match",
      "unknown",
      "A read-only inspection can prove only that a secret exists. A controlled signed event is still required to prove that the Supabase secret matches this Stripe endpoint.",
      { inspectable: false },
    ),
  ];

  const inspectablePreflightPassed = checks.every(
    (item) => !item.blocking || !item.inspectable || item.status === "pass",
  );
  const readyForControlledSignatureTest = environment.checkoutMode === "live" &&
    !environment.liveArmed &&
    inspectablePreflightPassed;
  const liveCheckoutGateOpen = environment.checkoutMode === "live" &&
    environment.liveArmed &&
    environment.stripeKeyMode === "live" &&
    paymentLink?.contractValid === true;

  let state: EasyErfLaunchState;
  if (environment.checkoutMode === "invalid") state = "invalid_configuration";
  else if (environment.checkoutMode === "test") state = "test_mode";
  else if (environment.liveArmed) {
    state = inspectablePreflightPassed
      ? "live_armed_preflight_passed"
      : "live_armed_blocked";
  } else {
    state = inspectablePreflightPassed
      ? "live_disarmed_preflight_passed"
      : "live_disarmed_blocked";
  }

  return {
    state,
    checkoutMode: environment.checkoutMode,
    liveArmed: environment.liveArmed,
    liveCheckoutGateOpen,
    inspectablePreflightPassed,
    readyForControlledSignatureTest,
    signatureSecretMatch: "not_verified",
    checks,
  };
}
