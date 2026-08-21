import { chromium } from "playwright";

const appUrl = process.env.EASY_ERF_BROWSER_URL || "http://127.0.0.1:4173/auth";
const expectedProjectRef = "xiqpfhsdlvwrwhclonsg";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(appUrl, { waitUntil: "networkidle", timeout: 60000 });

  const googleButton = page.getByRole("button", { name: /continue with google/i });
  await googleButton.waitFor({ state: "visible", timeout: 30000 });

  await Promise.all([
    page.waitForURL((url) => {
      return (
        url.hostname === "accounts.google.com" ||
        (url.hostname === `${expectedProjectRef}.supabase.co` && url.pathname.includes("/auth/v1/authorize"))
      );
    }, { timeout: 60000 }),
    googleButton.click(),
  ]);

  if (page.url().includes(`${expectedProjectRef}.supabase.co/auth/v1/authorize`)) {
    await page.waitForURL((url) => url.hostname === "accounts.google.com", { timeout: 60000 });
  }

  const finalUrl = new URL(page.url());
  if (finalUrl.hostname !== "accounts.google.com") {
    throw new Error(`Expected Google Accounts redirect, got ${finalUrl.hostname}`);
  }

  console.log(`Browser OAuth smoke verified: ${appUrl} -> founder Supabase -> Google Accounts.`);
} finally {
  await browser.close();
}
