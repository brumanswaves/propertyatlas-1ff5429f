// Preload for unchanged Guided synthetic scripts. No application/provider credentials.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = new URL(process.env.EASY_ERF_BROWSER_BASE_URL);
assert.equal(base.hostname, "127.0.0.1");
const registry = JSON.parse(await readFile("public/data/kouga-st-francis-pilot-parcels.json", "utf8"));
const record = registry.records.find((entry) => entry.id === "csg:lpi:c03400140000157000000");
assert.ok(record);
const [west, south, east, north] = record.bounds;
const fixture = { type: "FeatureCollection", features: [{
  type: "Feature", properties: record.properties,
  geometry: { type: "Polygon", coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] },
}] };
const launch = chromium.launch.bind(chromium);
chromium.launch = async (options = {}) => {
  const browser = await launch({ ...options, channel: undefined, executablePath: process.env.EASY_ERF_BROWSER_EXECUTABLE });
  const writes = [];
  const close = browser.close.bind(browser);
  browser.close = async () => {
    await close();
    assert.deepEqual(writes, [], "Guest journey must not attempt persistence writes to the synthetic backend");
  };
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (options = {}) => {
    const context = await newContext({ ...options, serviceWorkers: "block" });
    if (process.env.EASY_ERF_GUEST_NO_WRITES === "1") context.on("request", (request) => {
      const url = new URL(request.url());
      if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method()) &&
          ["/rest/v1/", "/storage/v1/", "/functions/v1/"].some((prefix) => url.pathname.startsWith(prefix)) &&
          !url.pathname.endsWith("/functions/v1/arcgis-public-proxy")) writes.push(`${request.method()} ${url.pathname}`);
    });
    // Installed before pages exist. Script-specific synthetic routes override this fallback.
    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname.endsWith("/functions/v1/arcgis-public-proxy"))
        return route.fulfill({ json: request.postDataJSON().layer === "csg-parcels" ? fixture : { type: "FeatureCollection", features: [] } });
      if (url.pathname.startsWith("/rest/v1/")) return route.fulfill({ json: [] });
      if (url.hostname === "api.mapbox.com" && url.pathname.includes("/styles/"))
        return route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: "fixture", type: "background", paint: { "background-color": "#e5e7eb" } }] } });
      if (url.hostname === "events.mapbox.com" || (url.hostname === "api.mapbox.com" && url.pathname === "/map-sessions/v1"))
        return route.fulfill({ json: {} });
      if (url.origin === base.origin && !url.pathname.startsWith("/api/") && ["GET", "HEAD"].includes(request.method()))
        return route.continue();
      return route.abort();
    });
    return context;
  };
  // Browser.newPage uses an internal context rather than the public patched method.
  browser.newPage = async (options = {}) => (await browser.newContext(options)).newPage();
  return browser;
};
