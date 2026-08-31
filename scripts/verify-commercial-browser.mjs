import { chromium } from "playwright";

const baseUrl = process.env.EASY_ERF_BROWSER_BASE_URL || "http://127.0.0.1:4173";

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

  await page.getByRole("heading", { name: /Hand the property investigation to Easy Erf/i }).waitFor({
    state: "visible",
    timeout: 30000,
  });

  const body = await page.locator("body").innerText();
  for (const requiredText of [
    "Human Review · R999",
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
    "no subscription",
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
  ]) {
    if (body.toLowerCase().includes(forbiddenText.toLowerCase())) {
      throw new Error(`Human Review page exposes forbidden or retired copy: ${forbiddenText}`);
    }
  }

  const checkoutButton = page.getByRole("button", { name: /^Continue to secure checkout$/i });
  await checkoutButton.waitFor({ state: "visible", timeout: 30000 });
  if (!(await checkoutButton.isDisabled())) {
    throw new Error("Human Review checkout must remain disabled until a controlled focus is selected.");
  }

  await page.getByRole("button", { name: /^Property Check/i }).click();
  if (!(await checkoutButton.isDisabled())) {
    throw new Error("Human Review checkout must remain disabled until the required scope acknowledgement is checked.");
  }

  const scopeAcknowledgement = page.getByRole("checkbox", {
    name: /I understand Easy Erf provides property research and due-diligence support/i,
  });
  await scopeAcknowledgement.waitFor({ state: "visible", timeout: 30000 });
  await scopeAcknowledgement.check();
  if (await checkoutButton.isDisabled()) {
    throw new Error("Property Check plus scope acknowledgement should satisfy the controlled checkout gate.");
  }

  await page.getByRole("button", { name: /^Check My Intended Use/i }).click();
  if (!(await checkoutButton.isDisabled())) {
    throw new Error("Intended-use checkout must remain disabled until one supported intended use is selected.");
  }

  const secondDwelling = page.getByRole("button", { name: /^Add a second dwelling$/i });
  await secondDwelling.waitFor({ state: "visible", timeout: 30000 });
  await secondDwelling.click();
  if (await checkoutButton.isDisabled()) {
    throw new Error("A supported intended use plus acknowledgement should satisfy the controlled scope gate.");
  }

  const humanReviewNav = page.getByRole("link", { name: /^Human Review$/i }).first();
  await humanReviewNav.waitFor({ state: "visible", timeout: 30000 });

  console.log(
    "Commercial browser smoke verified: map offers self-service or Human Review; self-service opens Address/Erf choice; Human Review exposes exactly the approved three goals; checkout requires the scope acknowledgement; intended use requires a supported sub-choice; checkout is not invoked; and open-ended or retired advice copy is absent.",
  );
} finally {
  await browser.close();
}
