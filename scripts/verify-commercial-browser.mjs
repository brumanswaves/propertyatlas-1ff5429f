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

  await page.getByRole("heading", { name: /Easy Erf Property Investigation/i }).waitFor({
    state: "visible",
    timeout: 30000,
  });

  const body = await page.locator("body").innerText();

  for (const requiredText of [
    "Human Review",
    "R999",
    "one property, introductory price",
    "Anything we cannot verify is labelled as unresolved",
    "Build envelope, not generated house concepts",
    "does not generate house designs, facades or AI building concepts",
    "No subscription right now",
  ]) {
    if (!body.toLowerCase().includes(requiredText.toLowerCase())) {
      throw new Error(`Human Review page is missing required commercial truth: ${requiredText}`);
    }
  }

  for (const forbiddenText of [
    "R999 Review",
    "Secure checkout is being connected",
    "Site Potential concept generation is currently controlled",
    "R199/month",
    "R499/month",
  ]) {
    if (body.toLowerCase().includes(forbiddenText.toLowerCase())) {
      throw new Error(`Human Review page still exposes retired commercial/product copy: ${forbiddenText}`);
    }
  }

  const checkoutButton = page.getByRole("button", { name: /^Start Human Review — R999$/i });
  await checkoutButton.waitFor({ state: "visible", timeout: 30000 });
  if (await checkoutButton.isDisabled()) {
    throw new Error("Human Review TEST checkout entry must be enabled before invocation.");
  }

  const humanReviewNav = page.getByRole("link", { name: /^Human Review$/i }).first();
  await humanReviewNav.waitFor({ state: "visible", timeout: 30000 });

  console.log(
    "Commercial browser smoke verified: map offers self-service or Human Review, self-service opens Address/Erf choice, Human Review R999 page is visible, TEST checkout entry is enabled, deterministic Site Potential remains explicit, and subscription copy is absent.",
  );
} finally {
  await browser.close();
}
