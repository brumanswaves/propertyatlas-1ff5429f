import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const base = process.env.EASY_ERF_BROWSER_BASE_URL || "http://127.0.0.1:4189";
assert.equal(new URL(base).hostname, "127.0.0.1");
const output = resolve("artifacts/selected-parcel-boundary");
await mkdir(output, { recursive: true });
const registry = JSON.parse(await readFile("public/data/kouga-st-francis-pilot-parcels.json", "utf8"));
const target = registry.records.find(r => r.erf === "1570");
const other = registry.records.find(r => r.lpi && r.id !== target.id && r.erf !== "1570");
assert.ok(target && other);
const [w, s, e, n] = target.bounds;
const geometry = { type: "Polygon", coordinates: [[[w,s],[e,s],[e,n],[w,n],[w,s]]] };
const fc = { type: "FeatureCollection", features: [{ type: "Feature", properties: target.properties, geometry }] };
const browser = await chromium.launch({ headless: true, channel: process.env.EASY_ERF_BROWSER_CHANNEL || "chromium" });
const results = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await context.newPage();
    let release;
    let hold = true;
    let pending = false;
    const writes = [];
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await context.route("**/*", async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname.endsWith("/functions/v1/arcgis-public-proxy")) {
        const body = request.postDataJSON();
        const isBoundary = body.layer === "csg-parcels" && Math.abs(body.bbox[2] - body.bbox[0] - 0.004) < 0.000001;
        if (isBoundary) {
          if (hold) { pending = true; await new Promise(resolve => { release = resolve; }); }
          return route.fulfill({ json: fc });
        }
        return route.fulfill({ json: { type: "FeatureCollection", features: [] } });
      }
      if (url.pathname.startsWith("/rest/v1/")) {
        if (!["GET", "HEAD"].includes(request.method())) writes.push(url.pathname);
        return route.fulfill({ json: request.headers().accept?.includes("vnd.pgrst.object") ? null : [] });
      }
      if (url.hostname === "api.mapbox.com" && url.pathname.includes("/styles/")) {
        return route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: "blank", type: "background", paint: { "background-color": "#e5e7eb" } }] } });
      }
      if (url.hostname === "events.mapbox.com" || url.pathname === "/map-sessions/v1") return route.fulfill({ json: {} });
      if (url.origin === base) return route.continue();
      // No real Auth, GIS, model, mail or telemetry requests leave this fixture.
      return route.abort();
    });
    const select = async record => {
      await page.getByRole("button", { name: /Search address, erf number, suburb, LPI, or parcel key/i }).click();
      await page.getByRole("button", { name: /^Erf Search/ }).click();
      await page.getByPlaceholder("LPI or parcel key", { exact: true }).fill(record.lpi);
      await page.getByRole("button", { name: "Search official parcel identity", exact: true }).click();
      await page.getByRole("button", { name: new RegExp("^Open Erf " + record.erf) }).click();
      await page.getByText("Property first read", { exact: true }).waitFor();
    };
    await page.goto(base);
    await page.getByText(/No CSG parcels in this view/i).first().waitFor({ timeout: 30000 }).catch(async error => {
      await page.screenshot({ path: resolve(output, "failure.png") });
      console.error(JSON.stringify({ errors, body: (await page.locator("body").innerText()).slice(0, 2000) }));
      throw error;
    });
    await select(target);
    await page.waitForFunction(() => history.state?.easyErfJourney?.selection?.geometry === null);
    for (let i = 0; !pending && i < 100; i++) await page.waitForTimeout(50);
    assert.ok(pending, "Background geometry request started after First Read opened");
    const before = await page.evaluate(() => ({ history: history.state, length: history.length, storage: { ...localStorage } }));
    hold = false;
    release();
    await page.waitForFunction(() => history.state?.easyErfJourney?.selection?.geometry?.type === "Polygon");
    const after = await page.evaluate(() => ({ history: history.state, length: history.length, storage: { ...localStorage } }));
    assert.equal(after.length, before.length);
    const expected = structuredClone(before.history);
    expected.easyErfJourney.selection.geometry = geometry;
    assert.deepEqual(after.history, expected, "Geometry must not reset view/step/router metadata");
    assert.deepEqual(after.storage, before.storage, "Boundary hydration must not write drafts/evidence");
    assert.equal(writes.length, 0);
    await page.screenshot({ path: resolve(output, "hydrated-first-read-" + width + ".png") });
    await page.goBack();
    await page.waitForFunction(() => history.state?.easyErfJourney?.selection === null);
    await page.goForward();
    await page.getByText("Property first read", { exact: true }).waitFor();
    await page.reload();
    await page.getByText("Property first read", { exact: true }).waitFor();
    assert.deepEqual(await page.evaluate(() => history.state.easyErfJourney.selection.geometry), geometry);

    await page.getByRole("button", { name: /^(Investigate this property|Continue investigation)$/i }).first().click();
    await page.getByRole("button", { name: "Open full research workspace", exact: true }).click();
    await page.getByRole("button", { name: "Site Potential", exact: true }).first().click();
    await page.getByText("Review inputs and technical details", { exact: true }).click();
    await page.getByRole("checkbox", { name: /The outline shown matches the erf/ }).waitFor();
    await page.getByRole("button", { name: /^Boundary 1(?: ·|$)/ }).waitFor();
    assert.equal(await page.getByText(/No parcel boundary geometry/i).count(), 0);
    await page.screenshot({ path: resolve(output, "hydrated-site-potential-" + width + ".png") });

    // A response arriving after leaving the parcel must not reopen it.
    await page.getByRole("button", { name: "Back to map", exact: true }).click();
    hold = true;
    pending = false;
    await select(other);
    for (let i = 0; !pending && i < 100; i++) await page.waitForTimeout(50);
    assert.ok(pending);
    await page.getByRole("button", { name: "Back to full map", exact: true }).first().click();
    hold = false;
    release();
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => history.state.easyErfJourney.selection), null);
    await page.goBack();
    await page.getByText("Property first read", { exact: true }).waitFor();
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => history.state.easyErfJourney.parcelId), other.id);
    assert.equal(await page.evaluate(() => history.state.easyErfJourney.selection.geometry), null, "Wrong parcel response excluded");
    assert.equal(writes.length, 0);
    assert.deepEqual(errors, []);
    results.push({ width, immediateFirstRead: true, delayedExactBoundary: true, sitePotentialBoundaryAvailable: true, historyAndDraftsPreserved: true, staleResponseIgnored: true, wrongParcelRejected: true, writes: writes.length });
    await context.close();
  }
  await writeFile(resolve(output, "receipt.json"), JSON.stringify({
    sha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    dirty: Boolean(execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim()),
    syntheticGeometryOnly: true, results,
  }, null, 2));
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
