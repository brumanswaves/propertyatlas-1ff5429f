import { chromium } from "playwright";
import UTIF from "utif2";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const base = process.env.EASY_ERF_BROWSER_BASE_URL || "http://127.0.0.1:4173";
assert.equal(new URL(base).hostname, "127.0.0.1");
const out = resolve(process.env.EASY_ERF_SG_ARTIFACTS || "artifacts/sg-receipt-preview");
await mkdir(out, { recursive: true });
const uid = "00000000-0000-4000-8000-000000000157";
const parcelId = "csg:lpi:c03400140000157000000";
const registry = JSON.parse(
  await readFile("public/data/kouga-st-francis-pilot-parcels.json", "utf8"),
);
const record = registry.records.find((item) => item.id === parcelId);
const [west, south, east, north] = record.bounds;
const feature = {
  type: "Feature",
  properties: record.properties,
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  },
};
const at = "2026-09-19T00:00:00.000Z";
const user = {
  id: uid,
  email: "sg-fixture@easyerf.invalid",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email" },
  user_metadata: {},
  identities: [],
  created_at: at,
};
const enc = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const session = {
  access_token: `${enc({ alg: "HS256" })}.${enc({ sub: uid, exp: 4102444800, role: "authenticated" })}.synthetic`,
  refresh_token: "synthetic-only",
  expires_at: 4102444800,
  expires_in: 99999999,
  token_type: "bearer",
  user,
};
// Permission-cleared synthetic survey-sheet pixels, not a customer document.
const width = 1200,
  height = 1600;
const rgba = new Uint8Array(width * height * 4).fill(255);
for (let y = 200; y < 1400; y++)
  for (let x = 180; x < 1020; x++) {
    if (x < 190 || x > 1010 || y < 210 || y > 1390 || Math.abs(x - y / 2) < 4) {
      const p = (y * width + x) * 4;
      rgba[p] = 20;
      rgba[p + 1] = 30;
      rgba[p + 2] = 40;
    }
  }
const tiff = Buffer.from(UTIF.encodeImage(rgba, width, height));
const hash = (data) => createHash("sha256").update(data).digest("hex");
const group3 = JSON.parse(await readFile("scripts/fixtures/sg-group3-2d.json", "utf8"));
const group3Bytes = Buffer.from(group3.base64, "base64");
const result = {
  source: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  dirty: Boolean(
    execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], {
      encoding: "utf8",
    }).trim(),
  ),
  fixture: { sha256: hash(tiff), bytes: tiff.length, width, height },
  checks: [],
  externalPassthrough: 0,
  providerCalls: 0,
};
const browser = await chromium.launch({
  headless: true,
  channel: process.env.EASY_ERF_BROWSER_CHANNEL || undefined,
});
let currentPage;
try {
  for (const screen of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport: screen, serviceWorkers: "block" });
    context.setDefaultTimeout(30_000);
    const assets = [],
      files = new Map(),
      errors = [],
      unexpected = [];
    let uploads = 0,
      reads = 0,
      holdReader;
    let row = {
      id: "00000000-0000-4000-8000-000000001570",
      user_id: uid,
      parcel_id: parcelId,
      status: "saved",
      created_at: at,
      tags: [],
      user_data: {
        erfNumber: "1570",
        erf: "1570",
        portion: "0",
        lpi: "C03400140000157000000",
        province: "Eastern Cape",
        municipality: "Kouga Local Municipality",
        town: "St Francis Bay",
        address: "Synthetic SG fixture address",
        displayTitle: "Synthetic SG fixture",
        lat: "-34.17924",
        lng: "24.84226",
      },
    };
    await context.addInitScript(
      ({ session }) => {
        for (const key of [
          "sb-127-auth-token",
          "sb-fixture-auth-token",
          "sb-easyerf-auth-token",
          "sb-xiqpfhsdlvwrwhclonsg-auth-token",
        ])
          localStorage.setItem(key, JSON.stringify(session));
      },
      { session },
    );
    await context.route("**/*", async (route) => {
      const req = route.request(),
        url = new URL(req.url()),
        path = url.pathname,
        method = req.method();
      const json = (data) => route.fulfill({ json: data });
      try {
        if (path.startsWith("/auth/v1/")) return json(path.endsWith("/user") ? user : session);
        if (path.startsWith("/rest/v1/")) {
          if (path.endsWith("/saved_properties") && method === "GET") {
            const select = url.searchParams.get("select") || "*";
            return json(
              req.headers().accept?.includes("object+json") || select === "id" ? row : [row],
            );
          }
          if (path.endsWith("/patch_saved_property_user_data_if_unchanged")) {
            const payload = req.postDataJSON();
            assert.equal(payload.p_parcel_id, parcelId);
            row.user_data = { ...row.user_data, ...payload.p_user_data_patch };
            return json(row.user_data);
          }
          if (path.endsWith("/erf_assets")) {
            if (method === "POST") {
              const data = req.postDataJSON();
              assert.equal(data.user_id, uid);
              assert.equal(data.parcel_id, parcelId);
              const asset = { ...data, checksum_sha256: null, created_at: at, updated_at: at };
              assets.unshift(asset);
              return json(asset);
            }
            assert.equal(url.searchParams.get("user_id"), `eq.${uid}`);
            assert.equal(url.searchParams.get("parcel_id"), `eq.${parcelId}`);
            const category = url.searchParams.get("asset_category");
            return json(assets.filter((a) => !category || category.includes(a.asset_category)));
          }
          if (method === "GET" || method === "HEAD")
            return json(req.headers().accept?.includes("object+json") ? null : []);
        }
        if (path.startsWith("/storage/v1/object/sign/"))
          return json({ signedURL: `/object/authenticated/${path.split("/sign/")[1]}` });
        if (path.startsWith("/storage/v1/object/authenticated/")) {
          const stored = files.get(decodeURIComponent(path.split("/authenticated/")[1]));
          assert.ok(stored);
          return route.fulfill({ body: stored, contentType: "image/tiff" });
        }
        if (path.startsWith("/storage/v1/object/") && method === "POST") {
          uploads++;
          // Supabase sends multipart bytes. Parse the synthetic file, not just metadata.
          const data = await new Response(req.postDataBuffer(), {
            headers: { "content-type": req.headers()["content-type"] },
          }).formData();
          const file = [...data.values()].find((value) => typeof value !== "string");
          const bytes = Buffer.from(await file.arrayBuffer());
          files.set(decodeURIComponent(path.split("/object/")[1]), bytes);
          return json({ Key: path.split("/object/")[1] });
        }
        if (path.endsWith("/arcgis-public-proxy"))
          return json({
            type: "FeatureCollection",
            features: req.postDataJSON().layer === "csg-parcels" ? [feature] : [],
          });
        if (path.endsWith("/extract-erf-asset")) {
          reads++;
          assert.equal(req.postDataJSON().expectedParcelId, parcelId);
          await new Promise((resolve) => {
            holdReader = resolve;
          });
          return route.fulfill({
            status: 503,
            json: { error: "Synthetic temporary reader failure" },
          });
        }
        if (url.hostname === "api.mapbox.com" && path.includes("/styles/"))
          return json({
            version: 8,
            sources: {},
            layers: [
              { id: "background", type: "background", paint: { "background-color": "#e5e7eb" } },
            ],
          });
        if (url.hostname === "events.mapbox.com" || path === "/map-sessions/v1") return json({});
        if (url.origin === new URL(base).origin && !path.startsWith("/api/"))
          return route.continue();
        if (method !== "GET" && !path.startsWith("/api/")) unexpected.push(`${method} ${path}`);
        return route.abort();
      } catch (error) {
        errors.push(error.message);
        return route.fulfill({
          status: 500,
          json: { error: "Synthetic fixture assertion failed" },
        });
      }
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    currentPage = page;
    console.log(`Starting ${screen.width} dashboard`);
    await page.goto(`${base}/dashboard`);
    await page.getByRole("button", { name: "Start Investigation", exact: true }).click();
    await page.getByRole("button", { name: /Yes, this is the correct erf/ }).click();
    await page
      .getByLabel("Street address or location label", { exact: true })
      .fill("Synthetic SG fixture address");
    await page
      .getByRole("button", { name: "Save and continue to SG diagram", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Upload SG diagram / General Plan", exact: true })
      .waitFor();
    await page.waitForTimeout(1000);
    console.log(`Uploading ${screen.width}`);
    const start = performance.now();
    await page.locator('input[type="file"]').setInputFiles({
      name: "SYNTHETIC-NOT-A-REAL-SG.tiff",
      mimeType: "image/tiff",
      buffer: tiff,
    });
    await page.getByText("File stored, SG evidence not yet verified.", { exact: false }).waitFor();
    const receiptMs = Math.round(performance.now() - start);
    const preview = page.getByRole("img", { name: /SG file preview/ });
    await preview.waitFor({ timeout: 15000 });
    await page.waitForFunction(() =>
      [...document.images].some(
        (img) => img.alt.startsWith("SG file preview") && img.complete && img.naturalWidth > 0,
      ),
    );
    const pixelCheck = await preview.evaluate((img) => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let dark = 0;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 100) dark++;
      return { dark, total: canvas.width * canvas.height };
    });
    assert.ok(
      pixelCheck.dark > 100 && pixelCheck.dark < pixelCheck.total / 2,
      "Preview must contain the synthetic sheet, not blank pixels",
    );
    const previewMs = Math.round(performance.now() - start);
    console.log(`Preview ${screen.width}: receipt ${receiptMs}ms, pixels ${previewMs}ms`);
    assert.equal(reads, 0);
    assert.equal(uploads, 1);
    assert.equal(hash([...files.values()][0]), hash(tiff), "Original bytes must be retained");
    assert.equal(assets[0].metadata.sgReceiptSha256, hash(tiff));
    assert.ok(await page.getByRole("button", { name: "Read diagram", exact: true }).isDisabled());
    await preview.scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(out, `receipt-preview-${screen.width}.png`) });
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: "same-bytes-renamed.tif", mimeType: "image/tiff", buffer: tiff });
    await page.getByText("This file is already attached to this erf.", { exact: false }).waitFor();
    assert.equal(uploads, 1);
    assert.equal(assets.length, 1);
    assert.equal(reads, 0);
    await page.getByRole("button", { name: "Continue to Check title", exact: true }).click();
    console.log(`Continued ${screen.width}`);
    await page.getByRole("button", { name: "Continue to Confirm zoning", exact: true }).waitFor();
    await page.goBack();
    await page.getByRole("button", { name: "Preview file", exact: true }).click();
    await preview.waitFor();
    // Reproduce retrying an old failed extraction, not only a fresh upload.
    assets[0].metadata.extractionStatus = "failed";
    assets[0].metadata.extractedAt = at;
    await page.reload();
    await page.getByRole("button", { name: "Preview file", exact: true }).click();
    await preview.waitFor();
    assert.equal(uploads, 1);
    assert.equal(reads, 0);
    // Delayed interpretation is an intercepted synthetic request, never a provider call.
    await page.getByRole("checkbox", { name: /I have permission/ }).check();
    await page.getByRole("button", { name: "Retry reading", exact: true }).click();
    await page.waitForTimeout(100);
    assert.equal(reads, 1);
    assert.ok(
      await page.getByRole("button", { name: "Continue to Check title", exact: true }).isEnabled(),
    );
    await page.waitForTimeout(31000);
    await page.getByRole("button", { name: "Refresh file status", exact: true }).waitFor();
    await page.getByRole("button", { name: "Refresh file status", exact: true }).click();
    assert.equal(reads, 1);
    const lateResponse = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith("/extract-erf-asset"),
    );
    holdReader();
    await lateResponse;
    await page.waitForTimeout(200);
    const refreshStatus = page.getByRole("button", { name: "Refresh file status", exact: true });
    for (let click = 0; click < 3; click++) {
      const refreshed = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname.endsWith("/erf_assets") &&
          response.request().method() === "GET",
      );
      await refreshStatus.click();
      await refreshed;
      await page.waitForTimeout(100);
      assert.ok(
        await refreshStatus.isVisible(),
        "Unchanged failed metadata must not unlock another start",
      );
      assert.equal(
        await page.getByRole("button", { name: "Retry reading", exact: true }).count(),
        0,
      );
      assert.equal(reads, 1);
    }
    await page.screenshot({ path: resolve(out, `reading-unacknowledged-${screen.width}.png`) });
    // A genuinely newer authoritative result clears uncertainty without an automatic retry.
    assets[0].metadata.extractedAt = "2026-09-19T00:01:00.000Z";
    await refreshStatus.click();
    await page.getByRole("button", { name: "Retry reading", exact: true }).waitFor();
    assert.equal(reads, 1);
    await page.getByRole("button", { name: "Continue to Check title", exact: true }).click();
    await page.getByRole("button", { name: "Continue to Confirm zoning", exact: true }).waitFor();
    assert.equal(reads, 1);
    assert.equal(assets[0].metadata.identityMatchStatus, undefined);
    assert.equal(assets[0].metadata.aiProcessingAllowed, undefined);
    await page.getByRole("button", { name: /Step 3 SG/ }).click();
    await page.getByRole("button", { name: "Preview file", exact: true }).waitFor();
    await page.waitForTimeout(1000);
    // A saved prohibition cannot be overridden by the local consent checkbox.
    assets[0].metadata.aiProcessingAllowed = false;
    await page.reload();
    await page
      .getByText("AI processing is not permitted for this file.", { exact: false })
      .waitFor();
    await page.getByRole("checkbox", { name: /I have permission/ }).check();
    assert.ok(await page.getByRole("button", { name: "Retry reading", exact: true }).isDisabled());
    // The actual bundled worker must retain Group3Options, not render a blank 1-D interpretation.
    const group3Start = performance.now();
    await page
      .locator('input[type="file"]')
      .setInputFiles({
        name: "SYNTHETIC-GROUP3-2D.tiff",
        mimeType: "image/tiff",
        buffer: group3Bytes,
      });
    const group3Preview = page
      .locator("article")
      .filter({ has: page.getByText("SYNTHETIC-GROUP3-2D.tiff", { exact: true }) })
      .getByRole("img", { name: /SG file preview/ });
    await group3Preview.waitFor();
    await group3Preview.evaluate((img) => img.decode());
    const group3Pixels = await group3Preview.evaluate((img) => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      return Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
    });
    assert.deepEqual(
      group3Pixels,
      group3.rows.flatMap((row) =>
        [...row].flatMap((bit) => (bit === "1" ? [0, 0, 0, 255] : [255, 255, 255, 255])),
      ),
    );
    const group3PreviewMs = Math.round(performance.now() - group3Start);
    assert.equal(hash([...files.values()][1]), hash(group3Bytes));
    await group3Preview.scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(out, `group3-known-pixels-${screen.width}.png`) });
    const failures = [];
    for (const [name, bytes] of [
      ["malformed.tiff", Buffer.from("synthetic malformed TIFF")],
      [
        "oversized-sheet.tiff",
        Buffer.from(UTIF.encode([{ t256: [20000], t257: [20000], t258: [1], t277: [1] }])),
      ],
    ]) {
      const started = performance.now();
      await page
        .locator('input[type="file"]')
        .setInputFiles({ name, mimeType: "image/tiff", buffer: bytes });
      await page
        .locator("article")
        .filter({ has: page.getByText(name, { exact: true }) })
        .getByRole("region", { name: "Stored SG file preview" })
        .getByText("This TIFF cannot be previewed", { exact: false })
        .waitFor();
      failures.push({ name, fallbackMs: Math.round(performance.now() - started) });
      assert.ok(
        await page
          .getByRole("button", { name: "Continue to Check title", exact: true })
          .isEnabled(),
      );
    }
    await page
      .getByRole("button", { name: "Continue to Check title", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(out, `manual-fallback-continue-${screen.width}.png`) });
    assert.equal(uploads, 4);
    assert.equal(assets.length, 4);
    assert.equal(reads, 1);
    assert.deepEqual(errors, []);
    assert.deepEqual(unexpected, []);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    result.checks.push({
      viewport: screen,
      receiptMs,
      previewMs,
      pixelCheck,
      failures,
      duplicateUploads: 0,
      originalBytesRetained: true,
      providerCalls: 0,
      syntheticReaderRequests: reads,
      continuedUnread: true,
      reopenedPreview: true,
      deadlineDidNotRetry: true,
      lateFailureUnchangedRefreshRepeatClickBlocked: true,
      newerAuthoritativeResultReleasedWithoutRetry: true,
      group3: { sha256: hash(group3Bytes), previewMs: group3PreviewMs, all32PixelsMatched: true },
      noIdentityPromotion: true,
      prohibitedProcessingRemainedDisabled: true,
    });
    await context.close();
  }
  result.passed = true;
} catch (error) {
  if (currentPage && !currentPage.isClosed()) {
    await currentPage.screenshot({ path: resolve(out, "failure.png") });
    console.error((await currentPage.locator("body").innerText()).slice(-6000));
  }
  throw error;
} finally {
  await writeFile(resolve(out, "receipt.json"), JSON.stringify(result, null, 2));
  await browser.close();
}
console.log(JSON.stringify(result, null, 2));
