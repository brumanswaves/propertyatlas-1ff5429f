import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";

const phase = process.env.REPORT_PHASE || "before";
const port = Number(process.env.REPORT_PORT || 4188);
const artifacts = resolve(`artifacts/report-${phase}`);
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const [screen, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]]) {
    for (const evidence of ["sparse", "supported"]) {
      const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block" });
      const errors = [], requests = [], externalDestinations = [];
      await context.route("**/*", (route) => {
        const request = route.request(), url = new URL(request.url());
        if (request.isNavigationRequest() && ["www.google.com", "csg.esri-southafrica.com"].includes(url.hostname)) {
          externalDestinations.push({ host: url.hostname, path: url.pathname, query: url.searchParams.get("query") });
          return route.fulfill({ contentType: "text/html", body: "<h1>Synthetic external destination. No provider contacted.</h1>" });
        }
        if (url.hostname !== "127.0.0.1" || request.method() !== "GET" || url.pathname.startsWith("/api/")) {
          requests.push({ host: url.hostname, path: url.pathname, method: request.method() });
          return route.abort();
        }
        return route.continue();
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${port}/scripts/fixtures/report-preview.html?evidence=${evidence}#order-00000000-0000-4000-8000-000000000042`);
      await page.locator("[data-investigation-report]").waitFor();
      await page.screenshot({ path: `${artifacts}/${evidence}-${screen}-opening.png` });
      await page.screenshot({ path: `${artifacts}/${evidence}-${screen}-full.png`, fullPage: true });
      const reportHeight = await page.locator("[data-investigation-report]").evaluate((el) => el.scrollHeight);
      const interactions = [];
      if (phase !== "before") {
        const originalHash = new URL(page.url()).hash;
        const ask = page.locator("#report-ask");
        const askBounds = await ask.boundingBox();
        const assessmentBounds = await page.locator("#report-decision").boundingBox();
        assert.ok(askBounds.y >= 0 && askBounds.y + askBounds.height < height, "Ask must be visible without scrolling");
        assert.ok(askBounds.y + askBounds.height <= assessmentBounds.y, "Ask must be above the assessment");
        await ask.locator("summary").click();
        await ask.locator("textarea").fill("What remains unverified for this synthetic erf?");
        await page.screenshot({ path: `${artifacts}/${evidence}-${screen}-ask.png` });
        await ask.locator("summary").click();
        await ask.locator("summary").click();
        assert.equal(await ask.locator("textarea").inputValue(), "What remains unverified for this synthetic erf?");
        await ask.locator("summary").click();
        assert.equal(new URL(page.url()).hash, originalHash);
        interactions.push("Ask is visible at the top; expands and retains the unsent question; no AI request");
        assert.equal(await page.locator("#report-next-action [data-action-id]").count(), 3);
        assert.equal(await page.locator(".report-evidence-details[open]").count(), 0);
        const sourceLink = page.locator('#report-next-action a[href="#investigation-sg"]').first();
        await sourceLink.click();
        await page.locator("#investigation-sg").waitFor({ state: "visible" });
        assert.equal(new URL(page.url()).hash, originalHash);
        await page.locator(".report-evidence-details[open] [data-report-return]").first().click();
        assert.equal(await sourceLink.evaluate((el) => document.activeElement === el), true);
        assert.equal(await sourceLink.evaluate((el) => el.tabIndex), 0, "Returning must not remove a link from keyboard navigation");
        interactions.push("SG evidence opens; return restores originating action focus; exact-order hash unchanged");
        if (evidence === "supported") {
          assert.match(await page.locator("#report-risk-strip").innerText(), /600|580/);
          await page.getByRole("link", { name: "View assumptions and outputs" }).click();
          await page.locator("#investigation-strategy").waitFor({ state: "visible" });
          await page.screenshot({ path: `${artifacts}/${evidence}-${screen}-strategy.png` });
          interactions.push("Saved Strategy figures and assumptions accessible");
        }
        // Expand all follow-ups and verify the grouped planning destination.
        await page.getByRole("link", { name: /View all .* grouped actions/ }).click();
        const provenance = page.locator('#investigation-findings a[href^="#investigation-source-"]').first();
        const provenanceId = (await provenance.getAttribute("href")).slice(1);
        await provenance.click();
        assert.equal(await page.evaluate((id) => document.activeElement?.id === id, provenanceId), true);
        assert.equal(new URL(page.url()).hash, originalHash);
        await page.locator(".report-evidence-details[open] [data-report-return]").last().click();
        assert.equal(await provenance.evaluate((el) => document.activeElement === el), true);
        interactions.push("Finding source opens its exact provenance record and restores keyboard focus");
        const planning = page.locator('#investigation-actions a[href="#investigation-planning"]').first();
        await planning.click();
        await page.locator("#investigation-planning").waitFor({ state: "visible" });
        await page.screenshot({ path: `${artifacts}/${evidence}-${screen}-planning.png` });
        interactions.push("Planning action opens planning evidence, not a generic research panel");
        await page.getByRole("link", { name: /View all .* grouped actions/ }).click();
        const professional = page.locator("#investigation-actions").getByRole("link", { name: "Find town planner", exact: true });
        const popupPromise = context.waitForEvent("page");
        await professional.click();
        const popup = await popupPromise;
        await popup.waitForLoadState();
        assert.equal(await popup.title(), "");
        await popup.close();
        assert.equal(new URL(page.url()).hash, originalHash);
        assert.ok(externalDestinations.some((item) => item.host === "www.google.com" && /Town planner near .*St Francis Bay/.test(item.query)));
        interactions.push("Professional search uses existing Google Maps fallback with town/location; report remains open");
        // A real canonical source link, intercepted before any external request is sent.
        const firstAction = page.locator("#report-next-action [data-action-id]").first();
        await firstAction.locator("summary").first().click();
        const sourcePopupPromise = context.waitForEvent("page");
        await firstAction.getByRole("link", { name: "Chief Surveyor-General document viewer", exact: true }).click();
        const sourcePopup = await sourcePopupPromise;
        await sourcePopup.waitForLoadState();
        await sourcePopup.close();
        interactions.push("Canonical external SG source opens a separate tab; no provider traffic");
        await page.goto(`http://127.0.0.1:${port}/scripts/fixtures/report-preview.html?evidence=${evidence}&editable#${originalHash.slice(1)}`);
        await page.locator("#report-next-action [data-action-id]").first().getByRole("button").click();
        assert.match(await page.getByRole("status").innerText(), /Erf 42: research \/ sg-diagram-evidence/);
        await page.getByRole("button", { name: "Return to report", exact: true }).click();
        assert.equal(new URL(page.url()).hash, originalHash);
        interactions.push("Editable callback receives exact canonical task and anchor with same parcel; no save");
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(overflow, false);
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      results.push({ evidence, screen, reportHeight, errors, blockedRequests: requests, interactions, externalDestinations });
      await context.close();
    }
  }
} finally { await browser.close(); }
await writeFile(`${artifacts}/receipt.json`, JSON.stringify({ source: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), phase, syntheticOnly: true, results }, null, 2));
console.log(JSON.stringify(results, null, 2));
