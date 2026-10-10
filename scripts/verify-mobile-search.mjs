const { chromium } = await import(process.env.EASY_ERF_PLAYWRIGHT_MODULE || "playwright");
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.EASY_ERF_BROWSER_BASE_URL || "http://127.0.0.1:4197";
assert.equal(new URL(base).hostname, "127.0.0.1", "Local fixture only");
const output = process.env.EASY_ERF_BROWSER_ARTIFACTS || "artifacts/pr205-mobile";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.EASY_ERF_BROWSER_EXECUTABLE,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const results = [];
async function hitArea(locator, label, minimum = 44) {
  await locator.waitFor({ state: "visible" });
  const box = await locator.boundingBox();
  assert.ok(box && box.width >= minimum && box.height >= minimum, `${label}: 44px target`);
  assert.ok(
    await locator.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return [0.15, 0.5, 0.85].every((fraction) => {
        const hit = document.elementFromPoint(box.x + box.width * fraction, box.y + box.height / 2);
        return hit && element.contains(hit);
      });
    }),
    `${label}: unobscured hit area`,
  );
  return box;
}
async function checkActions(page) {
  const self = page.getByRole("button", { name: "Investigate it myself", exact: true });
  const paid = page.getByRole("link", { name: "Do it for me · R999", exact: true });
  const selfBounds = await hitArea(self, "Self investigation");
  await hitArea(paid, "Paid investigation");
  assert.equal(await paid.getAttribute("href"), "/pricing");
  const banner = page
    .getByText("Official parcel data is temporarily unavailable. Try again or open source maps.")
    .locator("..");
  await banner.waitFor();
  const bannerBounds = await banner.boundingBox();
  const overlap =
    Math.min(bannerBounds.x + bannerBounds.width, selfBounds.x + selfBounds.width) >
      Math.max(bannerBounds.x, selfBounds.x) &&
    Math.min(bannerBounds.y + bannerBounds.height, selfBounds.y + selfBounds.height) >
      Math.max(bannerBounds.y, selfBounds.y);
  assert.equal(overlap, false, "Unavailable-data banner does not overlap actions");
  return { selfBounds, bannerBounds };
}
async function markerPoint(marker) {
  return marker.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  });
}
async function settleMarker(page, marker) {
  let last = await markerPoint(marker);
  for (let attempt = 0; attempt < 30; attempt++) {
    await page.waitForTimeout(100);
    const current = await markerPoint(marker);
    if (Math.hypot(current.x - last.x, current.y - last.y) < 0.1) return current;
    last = current;
  }
  throw new Error("Map marker did not settle");
}
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
    const addressRequests = [];
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === base && url.pathname === "/api/address/suggestions") {
        const request = route.request().postDataJSON();
        addressRequests.push(request.action);
        if (request.action === "autocomplete")
          return route.fulfill({
            json: {
              success: true,
              suggestions: [
                {
                  id: "synthetic-address",
                  placeId: "synthetic-address",
                  label: "Synthetic mobile test address",
                  subtitle: "Local fixture",
                  source: "google",
                },
              ],
            },
          });
        assert.equal(request.action, "details");
        assert.equal(request.placeId, "synthetic-address");
        return route.fulfill({
          json: {
            success: true,
            place: { formattedAddress: "Synthetic mobile test address", lat: -34.165, lng: 24.83 },
          },
        });
      }
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
      if (url.origin === base) {
        assert.ok(
          ["GET", "HEAD"].includes(route.request().method()),
          "No unexpected local mutation",
        );
        assert.ok(
          !url.pathname.startsWith("/api/"),
          "Only the synthetic address endpoint is allowed",
        );
        return route.continue();
      }
      blocked.push(url.hostname + url.pathname);
      return route.abort();
    });
    const page = await context.newPage();
    await page.goto(base, { waitUntil: "domcontentloaded" });
    const search = page.getByRole("button", {
      name: /Search address, erf number, suburb, LPI, or parcel key|Synthetic mobile/i,
    });
    await search.waitFor({ timeout: 60000 });
    const initialActions = await checkActions(page);
    await search.click();
    const address = page.getByRole("button", { name: /^Address Search/ });
    const erf = page.getByRole("button", { name: /^Erf Search/ });
    await address.waitFor();
    const addressBounds = await hitArea(address, "Address chooser");
    const bounds = await hitArea(erf, "Erf chooser");
    assert.ok(
      bounds && bounds.x >= 0 && bounds.x + bounds.width <= width + 1,
      "Chooser fits screen width",
    );
    assert.ok(bounds.y + bounds.height < height, "Chooser visible in viewport");
    assert.ok(addressBounds.y + addressBounds.height < height, "Address chooser visible");
    if (width < 768 || height <= 500) {
      await page
        .getByRole("button", { name: "Investigate it myself", exact: true })
        .waitFor({ state: "hidden" });
      const closeBounds = await hitArea(
        page.getByRole("button", { name: "Close property search", exact: true }),
        "Close search",
      );
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
      await checkActions(page);
      await page.screenshot({ path: `${output}/${width}x${height}-closed.png` });
      await search.click();
    } else {
      await page.screenshot({ path: `${output}/${width}x${height}-chooser.png` });
    }
    await address.click();
    await page.getByPlaceholder("Enter street address or place name").fill("ab");
    await page.getByText("Type at least 3 characters to search addresses.").waitFor();
    await page.getByPlaceholder("Enter street address or place name").fill("Synthetic mobile");
    await page.getByRole("button", { name: /Synthetic mobile test address/ }).click();
    await page.getByText("Address found only", { exact: true }).waitFor();
    const marker = page.locator('.mapboxgl-marker[title="Synthetic mobile test address"]');
    await marker.waitFor();
    // Wait past the application's 1000ms flyTo before measuring actual rendered movement.
    await page.waitForTimeout(1200);
    let scrolledClose = false;
    if (width < 768 || height <= 500) {
      const close = page.getByRole("button", { name: "Close property search", exact: true });
      const scroll = close.locator("../..");
      await scroll.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      assert.ok(
        await scroll.evaluate((element) => element.scrollTop > 0),
        "Long form actually scrolls",
      );
      await hitArea(close, "Sticky Close after scrolling");
      await page.screenshot({ path: `${output}/${width}x${height}-scrolled.png` });
      await close.click();
      scrolledClose = true;
      await checkActions(page);
    } else {
      await page.getByRole("button", { name: "Clear search", exact: true }).click();
    }
    const beforePan = await settleMarker(page, marker);
    const canvas = page.locator(".mapboxgl-canvas");
    const canvasBox = await canvas.boundingBox();
    const panStart = await canvas.evaluate((element) => {
      const { width, height } = element.getBoundingClientRect();
      for (const yFraction of [0.7, 0.8, 0.6, 0.45]) {
        for (const xFraction of [0.5, 0.2, 0.8, 0.93]) {
          const point = { x: width * xFraction, y: height * yFraction };
          if (document.elementFromPoint(point.x, point.y) === element) return point;
        }
      }
      return null;
    });
    assert.ok(canvasBox && panStart, "Pan starts on uncovered map canvas");
    await page.mouse.move(panStart.x, panStart.y);
    await page.mouse.down();
    await page.mouse.move(panStart.x + 50, panStart.y + 25, { steps: 10 });
    await page.mouse.up();
    const afterPan = await settleMarker(page, marker);
    assert.ok(
      Math.hypot(afterPan.x - beforePan.x, afterPan.y - beforePan.y) > 15,
      "Actual rendered map pans",
    );
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await page.waitForTimeout(400);
    const afterZoom = await settleMarker(page, marker);
    assert.ok(
      Math.hypot(afterZoom.x - afterPan.x, afterZoom.y - afterPan.y) > 10,
      "Actual rendered map zooms around an off-center marker",
    );
    const mapMotion = { beforePan, afterPan, afterZoom };
    await search.click();
    if (await page.getByRole("button", { name: "Search type", exact: true }).isVisible())
      await page.getByRole("button", { name: "Search type", exact: true }).click();
    const rotation = [];
    if (width < 768 || height <= 500) {
      // Each breakpoint uses a separate responsive search instance. Neither may leave actions hidden.
      for (const rotated of [
        { width: 844, height: 390 },
        { width: 767, height: 640 },
        { width: 768, height: 640 },
        { width, height },
      ]) {
        await page.setViewportSize(rotated);
        const close = page.getByRole("button", { name: "Close property search", exact: true });
        if (await close.isVisible()) await close.click();
        const lane = page.getByRole("button", { name: /^Address Search/ });
        if (await lane.isVisible()) {
          await lane.click();
          await page.getByRole("button", { name: "Clear search", exact: true }).click();
        }
        await checkActions(page);
        const rotatedSearch = page
          .getByRole("button", {
            name: /Search address, erf number, suburb, LPI, or parcel key|Synthetic mobile/,
          })
          .filter({ visible: true });
        await rotatedSearch.click();
        if (await page.getByRole("button", { name: "Search type", exact: true }).isVisible())
          await page.getByRole("button", { name: "Search type", exact: true }).click();
        await hitArea(
          page.getByRole("button", { name: /^Address Search/ }),
          "Rotated address chooser",
        );
        await hitArea(page.getByRole("button", { name: /^Erf Search/ }), "Rotated erf chooser");
        rotation.push(rotated);
      }
    }

    await erf.click();
    await page.getByPlaceholder("LPI or parcel key", { exact: true }).fill("C03400140000157000000");
    await page
      .getByRole("button", { name: "Search official parcel identity", exact: true })
      .click();
    await page.getByRole("button", { name: /^Open Erf 1570/ }).click();
    await page.getByText("Property first read", { exact: true }).waitFor();
    await page.screenshot({ path: `${output}/${width}x${height}-selected.png` });
    assert.deepEqual(
      addressRequests,
      ["autocomplete", "details"],
      "Synthetic address success uses both transport steps",
    );
    assert.deepEqual(writes, [], "Search and selection do not write investigation records");
    results.push({
      width,
      height,
      chooserBounds: bounds,
      initialActions,
      scrolledClose,
      rotation,
      addressRequests,
      mapMotion,
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
