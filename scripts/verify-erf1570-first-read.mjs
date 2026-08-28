import { chromium } from "playwright";

const baseUrl = process.env.EASY_ERF_BROWSER_BASE_URL || "http://127.0.0.1:4173";
const LPI = "C03400140000157000000";
const PARCEL_KEY = "E108C034001400001570000000";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });

  const searchLauncher = page.getByRole("button", {
    name: /search address, erf number, suburb, lpi, or parcel key/i,
  });
  await searchLauncher.waitFor({ state: "visible", timeout: 30000 });
  await searchLauncher.click();

  const erfSearch = page.getByRole("button", { name: /Erf Search/i });
  await erfSearch.waitFor({ state: "visible", timeout: 30000 });
  await erfSearch.click();

  await page.getByText(/Pilot registry loaded:/i).waitFor({ state: "visible", timeout: 30000 });

  const codeInput = page.getByPlaceholder("LPI or parcel key");
  await codeInput.fill(LPI);
  await page.getByRole("button", { name: /Search official parcel identity/i }).click();

  const result = page.getByRole("button", { name: /Open Erf 1570/i }).first();
  await result.waitFor({ state: "visible", timeout: 30000 });

  const resultGroup = page.getByRole("group", { name: /Erf 1570.*official search result/i }).first();
  const resultText = await resultGroup.innerText();
  for (const expected of ["Exact official match", LPI, PARCEL_KEY]) {
    if (!resultText.includes(expected)) {
      throw new Error(`Erf 1570 search result is missing ${expected}.`);
    }
  }

  await result.click();

  await page.getByText(/Property overview/i).first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByRole("button", { name: /Investigate this property|Continue investigation/i }).waitFor({
    state: "visible",
    timeout: 30000,
  });

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
