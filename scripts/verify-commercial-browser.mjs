import { chromium } from "playwright";

const baseUrl = process.env.EASY_ERF_BROWSER_BASE_URL || "http://127.0.0.1:4173";
const confirmedParcelId = "csg:lpi:c03400140000157000000";
const confirmedPropertyReference = "Erf 1570 · Sea Vista · Kouga";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

try {
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60000 });

  const selfReviewButton = page.getByRole("button", { name: /^Investigate it myself$/i });
  const doneForYouButton = page.getByRole("link", { name: /^Do it for me · R999$/i });
  await selfReviewButton.waitFor({ state: "visible", timeout: 30000 });
  await doneForYouButton.waitFor({ state: "visible", timeout: 30000 });

  const homeBody = await page.locator("body").innerText();
  for (const requiredText of [
    "Choose how you want to investigate",
    "Investigate it myself",
    "Do it for me · R999",
    "let Easy Erf do the investigation for you",
  ]) {
    if (!homeBody.toLowerCase().includes(requiredText.toLowerCase())) {
      throw new Error(`Home map is missing required investigation choice: ${requiredText}`);
    }
  }
  if (/r999 review|get human review · r999/i.test(homeBody)) {
    throw new Error("Retired Human Review sales copy is still visible on the home map.");
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
    .getByRole("heading", { name: /You choose the property. We do the investigation./i })
    .waitFor({ state: "visible", timeout: 30000 });

  const selectionGateBody = await page.locator("body").innerText();
  for (const requiredText of [
    "Done-for-You Property Investigation",
    "R999 is not just a final review",
    "standard Easy Erf investigation",
    "See the final deliverable before you pay",
    "Example reviewer bottom line",
    "What R999 includes",
    "One third-party property data report",
    "Provider may vary",
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
      throw new Error(`Done-for-you property/value gate is missing required truth: ${requiredText}`);
    }
  }
  if (selectionGateBody.toLowerCase().includes("investigate this property for me · r999")) {
    throw new Error("Done-for-you payment must not be available before a canonical parcel is confirmed.");
  }
  if (
    (await page.getByRole("textbox").count()) &&
    selectionGateBody.includes("Property address, Erf or LPI reference")
  ) {
    throw new Error("Done-for-you checkout must not accept a free-form property reference.");
  }

  const selectedUrl = new URL(`${baseUrl}/pricing`);
  selectedUrl.searchParams.set("parcelId", confirmedParcelId);
  selectedUrl.searchParams.set("propertyReference", confirmedPropertyReference);
  selectedUrl.searchParams.set("source", "browser-acceptance");
  await page.goto(selectedUrl.toString(), { waitUntil: "networkidle", timeout: 60000 });

  await page
    .getByRole("heading", { name: /You choose the property. We do the investigation./i })
    .waitFor({ state: "visible", timeout: 30000 });

  const body = await page.locator("body").innerText();
  for (const requiredText of [
    "Done-for-You Property Investigation",
    "Confirmed property",
    confirmedPropertyReference,
    confirmedParcelId,
    "done-for-you investigation is locked to this parcel",
    "standard Easy Erf investigation",
    "See the final deliverable before you pay",
    "Example reviewer bottom line",
    "What R999 includes",
    "One third-party property data report",
    "Provider may vary",
    "about 3 business days",
    "Your investigation stays in your Easy Erf account",
    "Tell us what matters most",
    "Overall Property Check",
    "Property Potential",
    "Check My Intended Use",
    "Tell the reviewer what you are considering",
    "Clear scope boundary",
    "does not provide legal, tax, engineering, architectural, valuation",
    "I understand the done-for-you Easy Erf investigation provides property research and due-diligence support",
    "One-time R999 payment. No recurring subscription.",
    "Stripe handles payment only",
  ]) {
    if (!body.toLowerCase().includes(requiredText.toLowerCase())) {
      throw new Error(`Done-for-you page is missing required scoped-product truth: ${requiredText}`);
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
    "Free Lightstone",
  ]) {
    if (body.toLowerCase().includes(forbiddenText.toLowerCase())) {
      throw new Error(`Done-for-you page exposes forbidden or retired copy: ${forbiddenText}`);
    }
  }

  const checkoutButton = page.getByRole("button", {
    name: /^Investigate this property for me · R999$/i,
  });
  await checkoutButton.waitFor({ state: "visible", timeout: 30000 });
  if (!(await checkoutButton.isDisabled())) {
    throw new Error("Payment must remain disabled until the controlled emphasis and scope are complete.");
  }

  await page.getByRole("button", { name: /^Overall Property Check/i }).click();
  if (!(await checkoutButton.isDisabled())) {
    throw new Error("Payment must remain disabled until the scope acknowledgement is checked.");
  }

  const scopeAcknowledgement = page.getByRole("checkbox", {
    name: /I understand the done-for-you Easy Erf investigation provides property research/i,
  });
  await scopeAcknowledgement.waitFor({ state: "visible", timeout: 30000 });
  await scopeAcknowledgement.check();
  if (await checkoutButton.isDisabled()) {
    throw new Error("Confirmed parcel, Overall Property Check and scope acknowledgement should satisfy the payment gate.");
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

  const doneForYouNav = page.getByRole("link", { name: /^Done for You$/i }).first();
  await doneForYouNav.waitFor({ state: "visible", timeout: 30000 });

  await page.goto(`${baseUrl}/how-it-works`, { waitUntil: "networkidle", timeout: 60000 });
  const howItWorksBody = await page.locator("body").innerText();
  for (const requiredText of [
    "Done-for-You Property Investigation · R999",
    "Easy Erf does the investigation",
    "Standard investigation we work through",
    "one third-party property data report",
    "The human-reviewed output still answers five simple questions",
    "deterministic build envelope and street-side build-line view",
  ]) {
    if (!howItWorksBody.toLowerCase().includes(requiredText.toLowerCase())) {
      throw new Error(`How It Works is missing done-for-you truth: ${requiredText}`);
    }
  }

  console.log(
    "Commercial browser smoke verified: the R999 product is a done-for-you standard Easy Erf investigation with a human-reviewed final report; it cannot start from a typed Erf number; requires a confirmed canonical parcel; keeps the selected property locked; treats the customer focus as emphasis rather than reduced scope; keeps the included property-data-report promise provider-neutral and rights-aware; Stripe handoff remains payment-only; checkout is not invoked; and retired Human Review/open-ended advice sales copy is absent.",
  );
} finally {
  await browser.close();
}
