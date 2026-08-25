import { chromium } from "playwright";

const appUrl = process.env.EASY_ERF_BROWSER_URL || "http://127.0.0.1:4173/auth";
const expectedProjectRef = "xiqpfhsdlvwrwhclonsg";
const brandedAuthHost = "easyerf.supabase.co";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(appUrl, { waitUntil: "networkidle", timeout: 60000 });

  const authLogo = page.getByRole("link", { name: /easy erf home/i }).first();
  await authLogo.waitFor({ state: "visible", timeout: 30000 });
  const logoBox = await authLogo.boundingBox();
  if (!logoBox || logoBox.width < 150 || logoBox.height < 40) {
    throw new Error(
      `Expected a clearly visible Easy Erf auth logo, got ${logoBox ? `${Math.round(logoBox.width)}x${Math.round(logoBox.height)}` : "no bounding box"}.`,
    );
  }

  const googleButton = page.getByRole("button", { name: /continue with google/i });
  await googleButton.waitFor({ state: "visible", timeout: 30000 });

  await Promise.all([
    page.waitForURL((url) => {
      return (
        url.hostname === "accounts.google.com" ||
        (url.hostname === brandedAuthHost && url.pathname.includes("/auth/v1/authorize"))
      );
    }, { timeout: 60000 }),
    googleButton.click(),
  ]);

  if (new URL(page.url()).hostname === brandedAuthHost) {
    await page.waitForURL((url) => url.hostname === "accounts.google.com", { timeout: 60000 });
  }

  const finalUrl = new URL(page.url());
  if (finalUrl.hostname !== "accounts.google.com") {
    throw new Error(`Expected Google Accounts redirect, got ${finalUrl.hostname}`);
  }

  await page.waitForLoadState("domcontentloaded", { timeout: 30000 }).catch(() => {});
  const googleBody = await page.locator("body").innerText({ timeout: 30000 });
  if (googleBody.includes(expectedProjectRef)) {
    throw new Error(
      `Google OAuth screen still exposes the raw Supabase project ref ${expectedProjectRef}.`,
    );
  }

  if (!/easyerf\.supabase\.co|Easy Erf/i.test(googleBody)) {
    throw new Error(
      "Google OAuth screen did not visibly identify the branded Easy Erf auth destination.",
    );
  }

  console.log(
    `Browser auth verified: visible Easy Erf logo + ${appUrl} -> ${brandedAuthHost} -> Google Accounts with branded destination visible.`,
  );
} finally {
  await browser.close();
}
