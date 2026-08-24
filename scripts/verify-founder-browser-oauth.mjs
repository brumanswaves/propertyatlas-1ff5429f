import { chromium } from "playwright";

const appUrl = process.env.EASY_ERF_BROWSER_URL || "http://127.0.0.1:4173/auth";
const expectedProjectRef = "xiqpfhsdlvwrwhclonsg";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

try {
  await page.goto(appUrl, { waitUntil: "networkidle", timeout: 60000 });

  const forgotPassword = page.getByRole("button", { name: /forgot your password/i });
  await forgotPassword.waitFor({ state: "visible", timeout: 30000 });

  const passwordInput = page.getByLabel("Password");
  if ((await passwordInput.getAttribute("type")) !== "password") {
    throw new Error("Password field must default to hidden text.");
  }
  await page.getByRole("button", { name: /show password/i }).click();
  if ((await passwordInput.getAttribute("type")) !== "text") {
    throw new Error("Password visibility control did not reveal the password field.");
  }
  await page.getByRole("button", { name: /hide password/i }).click();

  const desktopLogo = page.getByRole("link", { name: /easy erf home/i }).locator("img");
  const logoSrc = await desktopLogo.getAttribute("src");
  if (!logoSrc?.includes("easy-erf-nav-logo-transparent.png")) {
    throw new Error(`Expected the readable Easy Erf horizontal logo, got ${logoSrc ?? "no logo source"}.`);
  }
  const logoBox = await desktopLogo.boundingBox();
  if (!logoBox || logoBox.width < 80 || logoBox.height < 24) {
    throw new Error(`Easy Erf sign-in logo is too small: ${JSON.stringify(logoBox)}.`);
  }

  await page.getByRole("button", { name: /new here\? create an account/i }).click();
  await page.getByText(/email verification may be required before your first sign-in/i).waitFor({
    state: "visible",
    timeout: 10000,
  });
  await page.getByRole("button", { name: /already have an account\? sign in/i }).click();

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

  console.log(
    `Browser auth smoke verified: readable Easy Erf branding, password recovery/visibility UX, signup verification guidance, and ${appUrl} -> founder Supabase -> Google Accounts.`,
  );
} finally {
  await browser.close();
}
