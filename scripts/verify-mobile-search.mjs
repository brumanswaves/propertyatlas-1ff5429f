const { chromium } = await import(process.env.EASY_ERF_PLAYWRIGHT_MODULE || "playwright");
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.EASY_ERF_BROWSER_BASE_URL || "http://127.0.0.1:4197";
assert.equal(new URL(base).hostname, "127.0.0.1", "Local fixture only");
const output = "artifacts/pr205-mobile";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.EASY_ERF_BROWSER_EXECUTABLE,
});
const results = [];
try {
  for (const [width, height] of [
    [375, 667],
    [390, 844],
    [360, 640],
    [844, 390],
    [1440, 1000],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      serviceWorkers: "block",
    });
    const blocked = [];
    const writes = [];
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/functions/v1/arcgis-public-proxy"))
        return route.fulfill({ json: { type: "FeatureCollection", features: [] } });
      if (url.pathname.startsWith("/rest/v1/")) {
        if (!["GET", "HEAD"].includes(route.request().method())) writes.push(url.pathname);
        return route.fulfill({ json: [] });
      }
      if (url.hostname === "api.mapbox.com" && url.pathname.includes("/styles/"))
        return route.fulfill({
          json: {
            version: 8,
            sources: {},
            layers: [{ id: "blank", type: "background", paint: { "background-color": "#e5e7eb" } }],
          },
        });
      if (url.origin === base) return route.continue();
      blocked.push(url.hostname + url.pathname);
      return route.abort();
    });
    const page = await context.newPage();
    await page.goto(base, { waitUntil: "domcontentloaded" });
    const search = page.getByRole("button", {
      name: /Search address, erf number, suburb, LPI, or parcel key/i,
    });
    await search.waitFor({ timeout: 60000 });
    await search.click();
    const address = page.getByRole("button", { name: /^Address Search/ });
    const erf = page.getByRole("button", { name: /^Erf Search/ });
    await address.waitFor();
    const bounds = await erf.boundingBox();
    assert.ok(
      bounds && bounds.x >= 0 && bounds.x + bounds.width <= width + 1,
      "Chooser fits screen width",
    );
    assert.ok(bounds.y + bounds.height < height, "Chooser visible in viewport");
    if (width < 768 || height <= 500) {
      await page
        .getByRole("button", { name: "Investigate it myself", exact: true })
        .waitFor({ state: "hidden" });
      const closeBounds = await page
        .getByRole("button", { name: "Close property search", exact: true })
        .boundingBox();
      assert.ok(closeBounds.height >= 44, "Close control has a usable touch target");
      await page.screenshot({ path: `${output}/${width}x${height}-chooser.png` });
      await page.getByRole("button", { name: "Close property search", exact: true }).click();
      await page
        .getByRole("button", { name: "Investigate it myself", exact: true })
        .waitFor({ state: "visible" });
      if (width < 768) {
        const zoom = await page.locator(".mapboxgl-ctrl-bottom-right").boundingBox();
        const cta = await page
          .getByRole("button", { name: "Investigate it myself", exact: true })
          .boundingBox();
        assert.ok(zoom.y + zoom.height < cta.y, "Map zoom remains above the bottom actions");
      }
      await page.screenshot({ path: `${output}/${width}x${height}-closed.png` });
      await search.click();
    } else {
      await page.screenshot({ path: `${output}/${width}x${height}-chooser.png` });
    }
    await address.click();
    await page.getByPlaceholder("Enter street address or place name").fill("ab");
    await page.getByText("Type at least 3 characters to search addresses.").waitFor();
    await page.getByRole("button", { name: "Search type", exact: true }).click();
    await erf.click();
    await page.getByPlaceholder("LPI or parcel key", { exact: true }).fill("C03400140000157000000");
    await page
      .getByRole("button", { name: "Search official parcel identity", exact: true })
      .click();
    await page.getByRole("button", { name: /^Open Erf 1570/ }).click();
    await page.getByText("Property first read", { exact: true }).waitFor();
    await page.screenshot({ path: `${output}/${width}x${height}-selected.png` });
    assert.deepEqual(writes, [], "Search and selection do not write investigation records");
    results.push({
      width,
      height,
      chooserBounds: bounds,
      bothLanes: true,
      exactSyntheticSelection: true,
      writes,
      blocked,
    });
    await context.close();
  }
  await writeFile(`${output}/browser-results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
