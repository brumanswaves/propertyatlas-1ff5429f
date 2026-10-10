// Retain the synthetic-capable assertions from the live OAuth browser check.
import assert from "node:assert/strict";
import { chromium } from "playwright";
const base = new URL(process.env.EASY_ERF_BROWSER_BASE_URL);
assert.equal(base.hostname, "127.0.0.1");
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(new URL("/auth", base).href, { waitUntil: "networkidle", timeout: 60000 });
  const logo = page.getByRole("link", { name: /easy erf home/i }).first();
  await logo.waitFor({ state: "visible", timeout: 30000 });
  const box = await logo.boundingBox();
  assert.ok(box && box.width >= 150 && box.height >= 40, "Visible auth logo at least 150×40px");
  await page.getByRole("button", { name: /continue with google/i }).waitFor({ state: "visible", timeout: 30000 });
  console.log("Local auth screen: visible Easy Erf logo and Google button; provider navigation not exercised.");
} finally {
  await browser.close();
}
