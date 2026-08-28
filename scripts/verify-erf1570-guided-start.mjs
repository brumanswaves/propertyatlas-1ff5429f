import { chromium } from "playwright";

const baseUrl = process.env.EASY_ERF_BROWSER_BASE_URL || "http://127.0.0.1:4173";
const LPI = "C03400140000157000000";
const PARCEL_KEY = "E108C034001400001570000000";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
let monitorMutations = false;
const unexpectedSupabaseMutations = [];

page.on("request", (request) => {
  if (!monitorMutations) return;
  const method = request.method().toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return;

  try {
    const url = new URL(request.url());
    const canonicalHost = url.hostname === "easyerf.supabase.co";
    const persistentApi =
      url.pathname.startsWith("/rest/v1/") ||
      url.pathname.startsWith("/storage/v1/") ||
      url.pathname.startsWith("/functions/v1/");
    if (canonicalHost && persistentApi) {
      unexpectedSupabaseMutations.push(`${method} ${url.pathname}`);
    }
  } catch {
    // Ignore non-URL browser internals.
  }
});

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

  const visibleButtons = await page.locator("button:visible").allInnerTexts().catch(() => []);
  const bodyText = await page.locator("body").innerText().catch(() => "");
  throw new Error(
    `Could not find visible ${description}. Visible buttons: ${JSON.stringify(visibleButtons.slice(0, 30))}. Body excerpt: ${JSON.stringify(bodyText.slice(0, 2500))}`,
  );
}

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByText(/CSG parcels loaded:/i).first().waitFor({ state: "visible", timeout: 30000 });

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
  await page.getByText(/Pilot registry loaded:/i).first().waitFor({ state: "visible", timeout: 30000 });

  const codeInput = await firstVisible(
    page.locator('input[placeholder="LPI or parcel key"]'),
    "LPI or parcel key input",
  );
  await codeInput.fill(LPI);
  await firstVisible(
    page.locator("button").filter({ hasText: /Search official parcel identity/i }),
    "official parcel identity search button",
  ).then((button) => button.click());

  const result = await firstVisible(
    page.locator("button").filter({ hasText: /Erf 1570/i }),
    "Erf 1570 official result",
  );
  const resultText = (await result.locator("xpath=ancestor::*[@role='group'][1]").innerText()).toUpperCase();
  for (const expected of ["EXACT OFFICIAL MATCH", LPI, PARCEL_KEY]) {
    if (!resultText.includes(expected.toUpperCase())) {
      throw new Error(`Erf 1570 search result is missing ${expected}.`);
    }
  }
  await result.click();

  await page.getByText(/Property overview/i).first().waitFor({ state: "visible", timeout: 30000 });
  const investigateButton = await firstVisible(
    page.locator("button").filter({ hasText: /Investigate this property|Continue investigation/i }),
    "investigation start/continue button",
  );

  monitorMutations = true;
  await investigateButton.click();

  await page.getByText(/Confirm this is the correct erf/i).first().waitFor({
    state: "visible",
    timeout: 30000,
  });
  const confirmBody = await page.locator("body").innerText();
  for (const expected of ["Erf number", "1570", "Extent", "618.7 m²"]) {
    if (!confirmBody.includes(expected)) {
      throw new Error(`Guided property confirmation is missing ${expected}.`);
    }
  }

  const advancedDetails = page.locator("summary").filter({ hasText: /Advanced parcel details/i }).first();
  await advancedDetails.waitFor({ state: "visible", timeout: 30000 });
  await advancedDetails.click();
  const advancedText = (await advancedDetails.locator("xpath=.. ").innerText()).toUpperCase();
  for (const expected of [LPI, PARCEL_KEY]) {
    if (!advancedText.includes(expected.toUpperCase())) {
      throw new Error(`Guided property confirmation is missing canonical identifier ${expected}.`);
    }
  }

  const confirmButton = await firstVisible(
    page.locator("button").filter({ hasText: /Yes, this is the correct erf/i }),
    "confirm correct erf button",
  );
  await confirmButton.click();

  await page.getByText(/Add the address people use to find this erf/i).first().waitFor({
    state: "visible",
    timeout: 30000,
  });
  await page.waitForTimeout(750);

  if (unexpectedSupabaseMutations.length > 0) {
    throw new Error(
      `Guest Guided acceptance unexpectedly mutated canonical Supabase: ${unexpectedSupabaseMutations.join(", ")}`,
    );
  }

  const addressBody = await page.locator("body").innerText();
  if (!addressBody.includes("Working address")) {
    throw new Error("Guided Investigation did not advance to the working-address step.");
  }
  if (!addressBody.includes("separate from the official")) {
    throw new Error("Address step no longer explains that working address is separate from official identity.");
  }

  console.log(
    `Erf 1570 Guided start verified: exact official search -> Property Overview -> confirm-property -> add-address, with no guest Supabase persistence mutation.`,
  );
} finally {
  await browser.close();
}
