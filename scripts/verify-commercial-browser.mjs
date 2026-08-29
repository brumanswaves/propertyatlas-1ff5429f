import { chromium } from "playwright";

const baseUrl = process.env.EASY_ERF_BROWSER_BASE_URL || "http://127.0.0.1:4173";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

try {
  const response = await page.goto(`${baseUrl}/pricing`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });

  try {
    await page.getByRole("heading", { name: /Easy Erf Property Investigation/i }).waitFor({
      state: "visible",
      timeout: 30000,
    });
  } catch (error) {
    const title = await page.title().catch(() => "");
    const bodyExcerpt = await page
      .locator("body")
      .innerText()
      .then((body) => body.slice(0, 3000))
      .catch(() => "");
    const originalMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      [
        "Pricing acceptance heading was not visible.",
        `HTTP status: ${response?.status() ?? "unknown"}`,
        `Final URL: ${page.url()}`,
        `Document title: ${JSON.stringify(title)}`,
        `Public body excerpt: ${JSON.stringify(bodyExcerpt)}`,
        `Original error: ${originalMessage}`,
      ].join("\n"),
    );
  }

  const body = await page.locator("body").innerText();

  for (const requiredText of [
    "R999",
    "one property, introductory price",
    "human review",
    "Anything we cannot verify is labelled as unresolved",
    "Build envelope, not generated house concepts",
    "does not generate house designs, facades or AI building concepts",
    "No subscription right now",
  ]) {
    if (!body.toLowerCase().includes(requiredText.toLowerCase())) {
      throw new Error(`Pricing page is missing required commercial truth: ${requiredText}`);
    }
  }

  for (const forbiddenText of [
    "Site Potential concept generation is currently controlled",
    "R199/month",
    "R499/month",
  ]) {
    if (body.toLowerCase().includes(forbiddenText.toLowerCase())) {
      throw new Error(`Pricing page still exposes retired commercial/product copy: ${forbiddenText}`);
    }
  }

  const checkoutButton = page.getByRole("button", { name: /secure checkout is being connected/i });
  await checkoutButton.waitFor({ state: "visible", timeout: 30000 });
  if (!(await checkoutButton.isDisabled())) {
    throw new Error("R999 checkout must remain disabled when no verified payment link is configured.");
  }

  const pricingLink = page.getByRole("link", { name: /^Pricing$/i }).first();
  await pricingLink.waitFor({ state: "visible", timeout: 30000 });

  console.log(
    "Commercial browser smoke verified: R999 human review visible, deterministic Site Potential visible, subscription copy absent, checkout fail-closed.",
  );
} finally {
  await browser.close();
}
