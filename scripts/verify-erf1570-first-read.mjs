import { chromium } from "playwright";

const baseUrl = process.env.EASY_ERF_BROWSER_BASE_URL || "http://127.0.0.1:4173";
const LPI = "C03400140000157000000";
const PARCEL_KEY = "E108C034001400001570000000";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

async function firstVisible(locator, description, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const count = await locator.count();
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      if (await candidate.isVisible().catch(() => false)) return candidate;
    }
    await page.waitForTimeout(100);
  }

  const visibleButtons = await page
    .locator("button:visible")
    .allInnerTexts()
    .catch(() => []);
  const bodyText = await page
    .locator("body")
    .innerText()
    .catch(() => "");
  throw new Error(
    `Could not find visible ${description}. Visible buttons: ${JSON.stringify(visibleButtons.slice(0, 30))}. Body excerpt: ${JSON.stringify(bodyText.slice(0, 2500))}`,
  );
}

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByRole("link", { name: /easy erf home/i }).first().waitFor({
    state: "visible",
    timeout: 30000,
  });
  await page.getByText(/CSG parcels loaded:/i).first().waitFor({
    state: "visible",
    timeout: 30000,
  });

  const searchLauncher = await firstVisible(
    page.locator("button").filter({
      hasText: /Search address, erf number, suburb, LPI, or parcel key/i,
    }),
    "main property search launcher",
  );
  await searchLauncher.click();

  const erfSearch = await firstVisible(
    page.locator("button").filter({ hasText: /Erf Search/i }),
    "Erf Search option",
  );
  await erfSearch.click();

  await firstVisible(
    page.locator('input[placeholder="LPI or parcel key"]'),
    "LPI or parcel key input",
  );
  await page.getByText(/Pilot registry loaded:/i).first().waitFor({
    state: "visible",
    timeout: 30000,
  });

  const codeInput = await firstVisible(
    page.locator('input[placeholder="LPI or parcel key"]'),
    "LPI or parcel key input",
  );
  await codeInput.fill(LPI);

  const searchIdentity = await firstVisible(
    page.locator("button").filter({ hasText: /Search official parcel identity/i }),
    "official parcel identity search button",
  );
  await searchIdentity.click();

  const result = await firstVisible(
    page.locator("button").filter({ hasText: /Erf 1570/i }),
    "Erf 1570 official result",
  );

  const resultGroup = result.locator("xpath=ancestor::*[@role='group'][1]");
  const resultText = await resultGroup.innerText();
  for (const expected of ["Exact official match", LPI, PARCEL_KEY]) {
    if (!resultText.includes(expected)) {
      throw new Error(`Erf 1570 search result is missing ${expected}. Result: ${resultText}`);
    }
  }

  await result.click();

  await page.getByText(/Property overview/i).first().waitFor({ state: "visible", timeout: 30000 });
  await firstVisible(
    page.locator("button").filter({ hasText: /Investigate this property|Continue investigation/i }),
    "investigation start/continue button",
  );

  const body = await page.locator("body").innerText();
  for (const expected of ["Erf 1570", LPI, PARCEL_KEY, "618.7 m²"]) {
    if (!body.includes(expected)) {
      throw new Error(`Property First Read is missing canonical Erf 1570 evidence: ${expected}`);
    }
  }

  for (const forbidden of [
    "generate a visual concept pack",
    "Select a preferred concept",
    "Concepts are visual starting points",
  ]) {
    if (body.includes(forbidden)) {
      throw new Error(`Retired Site Potential concept language is visible: ${forbidden}`);
    }
  }

  console.log(
    `Erf 1570 browser first read verified: exact official search -> ${LPI} / ${PARCEL_KEY} -> Property Overview with 618.7 m² evidence.`,
  );
} finally {
  await browser.close();
}
