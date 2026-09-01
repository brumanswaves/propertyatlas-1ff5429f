import { chromium } from "playwright";

const baseUrl = process.env.EASY_ERF_BROWSER_BASE_URL || "http://127.0.0.1:4173";
const confirmedParcelId = "csg:lpi:c03400140000157000000";
const confirmedPropertyReference = "Erf 1570 · Sea Vista · Kouga";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

try {
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60000 });

  const selfReviewButton = page.getByRole("button", { name: /^Investigate it myself$/i });
  const humanReviewButton = page.getByRole("link", { name: /^Get Human Review · R999$/i });
  await selfReviewButton.waitFor({ state: "visible", timeout: 30000 });
  await humanReviewButton.waitFor({ state: "visible", timeout: 30000 });

  const homeBody = await page.locator("body").innerText();
  for (const requiredText of [
    "Choose how you want to investigate",
    "Investigate it myself",
    "Get Human Review · R999",
  ]) {
    if (!homeBody.toLowerCase().includes(requiredText.toLowerCase())) {
      throw new Error(`Home map is missing required investigation choice: ${requiredText}`);
    }
  }
  if (homeBody.toLowerCase().includes("r999 review")) {
    throw new Error('Retired navigation label "R999 Review" is still visible.');
  }

  await selfReviewButton.click();
  await page.getByRole("button", { name: /Address Search/i }).waitFor({
    state: "visible",
    timeout: 30000,
  });
  await page.getByRole("button", { name: /Erf Search/i }).waitFor({
    state: "visible",
    timeout: 30000,
  });

  await page.goto(`${baseUrl}/pricing`, { waitUntil: "networkidle", timeout: 60000 });
  await page
    .getByRole("heading", { name: /See what Human Review delivers, then confirm the exact property/i })
    .waitFor({ state: "visible", timeout: 30000 });

  const selectionGateBody = await page.locator("body").innerText();
  for (const requiredText of [
    "See the deliverable before you pay",
    "Example reviewer bottom line",
    "What R999 includes",
    "What do we know?",
    "What appears possible?",
    "What could be a problem?",
    "What do we not know yet?",
    "What should be verified next?",
    "about 3 business days",
    "Erf numbers repeat across South Africa",
    "Find the exact erf or address on the map first",
    "Search",
    "Review on map",
    "Confirm property",
    "Find and confirm property on map",
  ]) {
    if (!selectionGateBody.toLowerCase().includes(requiredText.toLowerCase())) {
      throw new Error(`Human Review property/value gate is missing required truth: ${requiredText}`);
    }
  }
  if (selectionGateBody.toLowerCase().includes("continue to secure payment")) {
    throw new Error("Human Review payment must not be available before a canonical parcel is confirmed.");
  }
  if (
    (await page.getByRole("textbox").count()) &&
    selectionGateBody.includes("Property address, Erf or LPI reference")
  ) {
    throw new Error("Human Review must not accept a free-form property reference on the payment brief page.");
  }

  const selectedUrl = new URL(`${baseUrl}/pricing`);
  selectedUrl.searchParams.set("parcelId", confirmedParcelId);
  selectedUrl.searchParams.set("propertyReference", confirmedPropertyReference);
  selectedUrl.searchParams.set("source", "browser-acceptance");
  await page.goto(selectedUrl.toString(), { waitUntil: "networkidle", timeout: 60000 });

  await page
    .getByRole("heading", { name: /Hand this confirmed property investigation to Easy Erf/i })
    .waitFor({ state: "visible", timeout: 30000 });

  const body = await page.locator("body").innerText();
  for (const requiredText of [
    "Human Review · R999",
    "Confirmed property",
    confirmedPropertyReference,
    confirmedParcelId,
    "Human Review is locked to this parcel",
    "See the deliverable before you pay",
    "Example reviewer bottom line",
    "What R999 includes",
    "about 3 business days",
    "Your review stays in your Easy Erf account",
    "Choose one investigation focus",
    "Property Check",
    "Property Potential",
    "Check My Intended Use",
    "Tell us about your situation — not a new question",
    "What do we know?",
    "What appears possible?",
    "What could be a problem?",
    "What do we not know yet?",
    "What should be verified next?",
    "Clear scope boundary",
    "does not provide legal, tax, engineering, architectural, valuation",
    "I understand Easy Erf provides property research and due-diligence support",
    "One-time R999 payment. No recurring subscription.",
    "Stripe handles payment only",
  ]) {
    if (!body.toLowerCase().includes(requiredText.toLowerCase())) {
      throw new Error(`Human Review page is missing required scoped-product truth: ${requiredText}`);
    }
  }

  for (const forbiddenText of [
    "R999 Review",
    "Before I Buy",
    "Ask us anything",
    "What do you want to know?",
    "R199/month",
    "R499/month",
    "Property address, Erf or LPI reference",
  ]) {
    if (body.toLowerCase().includes(forbiddenText.toLowerCase())) {
      throw new Error(`Human Review page exposes forbidden or retired copy: ${forbiddenText}`);
    }
  }

  const checkoutButton = page.getByRole("button", { name: /^Continue to secure payment$/i });
  await checkoutButton.waitFor({ state: "visible", timeout: 30000 });
  if (!(await checkoutButton.isDisabled())) {
    throw new Error("Human Review payment must remain disabled until controlled scope is complete.");
  }

  await page.getByRole("button", { name: /^Property Check/i }).click();
  if (!(await checkoutButton.isDisabled())) {
    throw new Error("Human Review payment must remain disabled until the scope acknowledgement is checked.");
  }

  const scopeAcknowledgement = page.getByRole("checkbox", {
    name: /I understand Easy Erf provides property research and due-diligence support/i,
  });
  await scopeAcknowledgement.waitFor({ state: "visible", timeout: 30000 });
  await scopeAcknowledgement.check();
  if (await checkoutButton.isDisabled()) {
    throw new Error("Confirmed parcel, Property Check and scope acknowledgement should satisfy the payment gate.");
  }

  await page.getByRole("button", { name: /^Check My Intended Use/i }).click();
  if (!(await checkoutButton.isDisabled())) {
    throw new Error("Intended-use payment must remain disabled until one supported intended use is selected.");
  }

  const secondDwelling = page.getByRole("button", { name: /^Add a second dwelling$/i });
  await secondDwelling.waitFor({ state: "visible", timeout: 30000 });
  await secondDwelling.click();
  if (await checkoutButton.isDisabled()) {
    throw new Error("Confirmed parcel, supported intended use and acknowledgement should satisfy the payment gate.");
  }

  const humanReviewNav = page.getByRole("link", { name: /^Human Review$/i }).first();
  await humanReviewNav.waitFor({ state: "visible", timeout: 30000 });

  await page.goto(`${baseUrl}/how-it-works`, { waitUntil: "networkidle", timeout: 60000 });
  const howItWorksBody = await page.locator("body").innerText();
  for (const requiredText of [
    "Human Review · R999 once-off",
    "What happens after you choose Human Review",
    "A human reviews the same property file",
    "Every Human-Reviewed report answers",
    "deterministic build envelope and street-side build-line view",
  ]) {
    if (!howItWorksBody.toLowerCase().includes(requiredText.toLowerCase())) {
      throw new Error(`How It Works is missing Human Review truth: ${requiredText}`);
    }
  }

  console.log(
    "Commercial browser smoke verified: Human Review shows a tangible report preview before payment; cannot start from a typed Erf number; requires a confirmed canonical parcel; keeps the confirmed parcel locked through the controlled brief; Stripe handoff stays payment-only; How It Works explains the R999 Human Review path; checkout is not invoked; and retired open-ended advice copy is absent.",
  );
} finally {
  await browser.close();
}
