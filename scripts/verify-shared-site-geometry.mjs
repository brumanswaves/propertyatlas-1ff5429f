import "./verify-shared-investigation-network.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const { chromium } = await import(process.env.EASY_ERF_PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ executablePath: process.env.EASY_ERF_CHROMIUM });
const out = "artifacts/shared-site-geometry";
await mkdir(out, { recursive: true });
const results = [];
const ring = [
  [24.83, -34.17],
  [24.8303, -34.17],
  [24.8303, -34.1703],
  [24.83, -34.1703],
  [24.83, -34.17],
];
const url = `http://127.0.0.1:${process.env.GEOMETRY_PORT || 4193}/scripts/fixtures/shared-site-geometry/index.html`;
async function run(name, options, fn, mobile = false) {
  const c = await browser.newContext({
    serviceWorkers: "block",
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
  });
  let lookups = 0;
  const errors = [];
  const held = [];
  await c.addInitScript((options) => {
    window.fixtureOptions = options;
  }, options);
  await c.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === "127.0.0.1") return route.continue();
    if (u.hostname !== "services6.arcgis.com") return route.abort();
    lookups++;
    assert.equal(route.request().method(), "GET");
    const lpi = /ID='([^']+)'/.exec(u.searchParams.get("where"))?.[1];
    assert(lpi);
    assert.equal(u.searchParams.get("resultRecordCount"), "2");
    if (options.timeout) return;
    if (options.delayed) {
      await new Promise((resolve) => held.push(resolve));
    }
    const feature = {
      type: "Feature",
      properties: { ID: options.wrong ? "OTHER" : lpi },
      geometry: {
        type: "Polygon",
        coordinates: [
          options.malformed
            ? [
                [0, 0],
                [1, 1],
                [2, 2],
                [0, 0],
              ]
            : ring,
        ],
      },
    };
    await route
      .fulfill({
        status: options.failure ? 503 : 200,
        contentType: "application/json",
        body: JSON.stringify({
          type: "FeatureCollection",
          features: options.ambiguous ? [feature, feature] : [feature],
        }),
      })
      .catch(() => {});
  });
  const p = await c.newPage();
  p.setDefaultTimeout(15000);
  p.on("pageerror", (e) => {
    errors.push(e.message);
    console.error(e.message);
  });
  try {
    await p.goto(url);
    await p.getByRole("button", { name: /9\. Site Potential/ }).click();
    await fn(p, { lookups: () => lookups, release: () => held.splice(0).forEach((f) => f()) });
    assert.deepEqual(errors, []);
    results.push({ name, passed: true, lookups });
  } catch (e) {
    await p.screenshot({ path: `${out}/failure-${name}.png`, fullPage: true });
    console.error(await p.locator("body").innerText());
    throw e;
  } finally {
    held.splice(0).forEach((f) => f());
    await c.close();
  }
}
const snapshot = (p) => p.evaluate(() => fixture.snapshot());
const map = (p) =>
  p.getByRole("img", { name: "Deterministic build envelope diagram for this erf" }).first();
const unavailable = (p) =>
  p.getByRole("heading", { name: "Parcel boundary could not be loaded for this erf." });
try {
  if (process.env.GEOMETRY_BEFORE) {
    for (const mobile of [false, true])
      await run(
        `before-${mobile ? "mobile" : "desktop"}`,
        {},
        async (p, s) => {
          await p
            .getByRole("heading", { name: "Where could a building potentially fit?" })
            .waitFor();
          assert.equal(await map(p).count(), 0);
          assert.equal(s.lookups(), 0);
          assert.deepEqual((await snapshot(p)).mutations, []);
          await p.screenshot({
            path: `${out}/before-${mobile ? "mobile" : "desktop"}.png`,
            fullPage: true,
          });
        },
        mobile,
      );
  } else {
    for (const mobile of [false, true])
      await run(
        `success-${mobile ? "mobile" : "desktop"}`,
        {},
        async (p, s) => {
          await map(p).waitFor();
          assert.equal(s.lookups(), 1);
          assert.deepEqual((await snapshot(p)).mutations, []);
          assert.equal(await p.getByRole("button", { name: /Boundary [1-4]/ }).count(), 4);
          assert.equal(
            await p.getByRole("button", { name: "Accept this Site Potential" }).isDisabled(),
            true,
          );
          assert.equal(await p.getByRole("option", { name: /^Property checks/ }).count(), 1);
          await p.screenshot({
            path: `${out}/after-success-${mobile ? "mobile" : "desktop"}.png`,
            fullPage: true,
          });
          await p.getByRole("button", { name: "Boundary 1", exact: true }).click();
          await p.getByRole("button", { name: "Boundary 2", exact: true }).click();
          assert.equal(
            await p.getByRole("button", { name: "Accept this Site Potential" }).isDisabled(),
            true,
          );
          await p
            .locator("summary")
            .filter({ hasText: /site|input|boundary/i })
            .first()
            .click();
          await p.getByRole("checkbox", { name: /outline shown matches/i }).check();
          await p.getByRole("button", { name: "Save site inputs", exact: true }).click();
          await p.waitForFunction(() => fixture.snapshot().mutations.length === 1);
          const saved = (await snapshot(p)).mutations[0];
          assert.deepEqual(saved.patch.parcelRing, ring);
          assert.equal(saved.patch.normalizedParcel.id, saved.parcelId);
          assert.equal(saved.revision, 7);
          assert.equal(saved.actor, "synthetic-owner-A");
          assert.equal(saved.patch.buildEnvelopeInputs.boundaryConfirmed, true);
          assert.equal(saved.patch.buildEnvelopeInputs.streetFrontageConfirmedByUser, true);
          await p.evaluate(() => fixture.reload());
          await p.getByRole("button", { name: /9\. Site Potential/ }).click();
          await map(p).waitFor();
          assert.equal(s.lookups(), 1);
          await p.getByRole("button", { name: "Accept this Site Potential" }).click();
          await p.getByText("This exact envelope is accepted", { exact: true }).waitFor();
          await p.getByRole("img", { name: /Street-side diagram/ }).waitFor();
          await p.screenshot({
            path: `${out}/after-accepted-${mobile ? "mobile" : "desktop"}.png`,
            fullPage: true,
          });
        },
        mobile,
      );
    for (const kind of ["wrong", "ambiguous", "malformed", "failure", "timeout"])
      await run(kind, { [kind]: true }, async (p, s) => {
        await unavailable(p).waitFor({ timeout: 15000 });
        assert.equal(s.lookups(), 1);
        assert.deepEqual((await snapshot(p)).mutations, []);
        assert.equal(await map(p).count(), 0);
        await p.screenshot({ path: `${out}/after-${kind}-desktop.png`, fullPage: true });
      });
    await run(
      "failure-mobile",
      { failure: true },
      async (p) => {
        await unavailable(p).waitFor();
        await p.screenshot({ path: `${out}/after-failure-mobile.png`, fullPage: true });
        assert.deepEqual((await snapshot(p)).mutations, []);
      },
      true,
    );
    await run("existing-ring", { saved: true }, async (p, s) => {
      await map(p).waitFor();
      assert.equal(s.lookups(), 0);
      assert.deepEqual((await snapshot(p)).mutations, []);
    });
    await run("revision-conflict", { conflict: true }, async (p) => {
      await map(p).waitFor();
      await p.getByRole("button", { name: "Save site inputs", exact: true }).click();
      await p
        .getByRole("alert")
        .filter({ hasText: /changed/ })
        .waitFor();
      assert.deepEqual((await snapshot(p)).mutations, []);
    });
    await run("readback-mismatch", { badReadback: true }, async (p) => {
      await map(p).waitFor();
      await p.getByRole("button", { name: "Save site inputs", exact: true }).click();
      await p
        .getByRole("alert")
        .filter({ hasText: /could not be confirmed/ })
        .waitFor();
      assert.equal((await snapshot(p)).mutations.length, 1);
    });
    await run("delayed-A-B-A", { delayed: true }, async (p, s) => {
      await p.getByText("Loading the exact official parcel boundary", { exact: true }).waitFor();
      await p.evaluate(() => fixture.switchTo(1, "synthetic-owner-B"));
      await p.getByRole("button", { name: /9\. Site Potential/ }).click();
      await p.evaluate(() => fixture.switchTo(0, "synthetic-owner-A"));
      await p.getByRole("button", { name: /9\. Site Potential/ }).click();
      assert.equal(await map(p).count(), 0);
      s.release();
      await map(p).waitFor();
      await p.getByRole("button", { name: "Save site inputs", exact: true }).click();
      await p.waitForFunction(() => fixture.snapshot().mutations.length === 1);
      const m = (await snapshot(p)).mutations[0];
      assert.equal(m.actor, "synthetic-owner-A");
      assert.equal(m.orderId, "11111111-1111-4111-8111-111111111111");
      assert.equal(m.patch.normalizedParcel.id, m.parcelId);
    });
  }
} finally {
  await writeFile(
    `${out}/${process.env.GEOMETRY_BEFORE ? "before-results" : "results"}.json`,
    JSON.stringify({ synthetic: true, results }, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
