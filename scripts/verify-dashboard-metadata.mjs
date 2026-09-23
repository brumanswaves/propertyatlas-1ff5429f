import "./verify-shared-investigation-network.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
const { chromium } = await import(
  process.env.EASY_ERF_PLAYWRIGHT_MODULE ||
    "../artifacts/rehearsal/browser-tools/node_modules/playwright/index.mjs"
);
const browser = await chromium.launch({
  executablePath:
    process.env.EASY_ERF_CHROMIUM ||
    resolve("artifacts/rehearsal/browser/chrome-win/headless_shell.exe"),
});
const out = "artifacts/dashboard-metadata";
await mkdir(out, { recursive: true });
const results = [];
let external = 0;
const url = "http://127.0.0.1:4191/scripts/fixtures/dashboard-metadata/index.html";
const snapshot = (p) => p.evaluate(() => fixture.snapshot());
const hash = (v) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const loaded = (p, n = 9) =>
  p.waitForFunction((n) => document.querySelectorAll("article").length === n, n);
async function run(name, fn, options = {}, mobile = false) {
  if (process.env.DASHBOARD_CASE && !name.includes(process.env.DASHBOARD_CASE)) return;
  const c = await browser.newContext({
    serviceWorkers: "block",
    viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
  });
  await c.route("**/*", (r) =>
    new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : (external++, r.abort()),
  );
  await c.addInitScript((options) => {
    window.fixtureOptions = options;
  }, options);
  const p = await c.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  try {
    await p.goto(url);
    await p.waitForFunction(() => !!window.fixture);
    const before = await snapshot(p);
    await fn(p);
    const after = await snapshot(p);
    assert.deepEqual(errors, []);
    assert.deepEqual(after.mutations, []);
    // List-only cases must preserve every synthetic record and browser draft.
    if (!name.startsWith("navigate")) {
      assert.equal(hash(before.records), hash(after.records));
      assert.equal(hash(before.drafts), hash(after.drafts));
      assert.equal(JSON.stringify(after.requests).includes("FORBIDDEN_"), false);
      assert(after.requests.every((r) => ["saved_properties", "property_notes"].includes(r.table)));
    }
    results.push({
      name,
      status: "passed",
      requests: after.requests,
      recordHashBefore: hash(before.records),
      recordHashAfter: hash(after.records),
      draftsBefore: hash(before.drafts),
      draftsAfter: hash(after.drafts),
    });
    console.log("PASS " + name);
  } catch (e) {
    results.push({ name, status: "failed", error: e.message, errors });
    throw e;
  } finally {
    await writeFile(
      `${out}/results${process.env.DASHBOARD_CASE ? "-" + process.env.DASHBOARD_CASE : ""}.json`,
      JSON.stringify(
        {
          source: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
          synthetic: true,
          externalRequests: external,
          results,
        },
        null,
        2,
      ),
    );
    await c.close();
  }
}
try {
  await run("nine properties scalar response and preservation", async (p) => {
    await loaded(p);
    const s = await snapshot(p);
    const r = s.requests.find((r) => r.table === "saved_properties");
    assert.equal(r.body.length, 9);
    assert.equal(r.query.user_id, "eq.synthetic-owner-A");
    assert(
      r.body.every((r) =>
        Object.values(r).every(
          (v) => v === null || ["number", "string", "boolean"].includes(typeof v),
        ),
      ),
    );
    assert.equal(await p.getByText("Portion 0", { exact: true }).count(), 9);
    assert.equal(
      await p.getByRole("button", { name: "Open Market evidence", exact: true }).count(),
      9,
    );
    await p.screenshot({ path: `${out}/desktop.png`, fullPage: true });
    await p.screenshot({ path: `${out}/desktop-viewport.png` });
  });
  await run(
    "mobile cards and no horizontal overflow",
    async (p) => {
      await loaded(p);
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await p.screenshot({ path: `${out}/mobile.png`, fullPage: true });
      await p.screenshot({ path: `${out}/mobile-viewport.png` });
    },
    {},
    true,
  );
  await run(
    "legacy missing metadata remains unknown",
    async (p) => {
      await loaded(p);
      const card = p.locator("article").filter({ hasText: "Synthetic A property 1" });
      assert((await card.innerText()).includes("Status unavailable"));
      assert(!(await card.innerText()).includes("Not started"));
      assert.equal(
        await card
          .getByRole("button", { name: "Start / Continue Investigation", exact: true })
          .count(),
        1,
      );
    },
    { missing: true },
  );
  await run(
    "genuine empty distinct from failure",
    async (p) => {
      await p.getByText("No saved properties yet", { exact: true }).waitFor();
    },
    { empty: true },
  );
  for (const mode of [
    "failure",
    "wrong-owner",
    "duplicate",
    "wrong-projection",
    "bad-scalar",
    "malformed",
  ]) {
    await run(
      `${mode} rejects data and retries safely`,
      async (p) => {
        await p.getByRole("alert").waitFor();
        assert.equal(await p.locator("article").count(), 0);
        assert.equal(await p.getByText("No saved properties yet", { exact: true }).count(), 0);
        await p.getByRole("button", { name: "Try loading again" }).click();
        await loaded(p);
      },
      { rules: [{ table: "saved_properties", mode }] },
    );
  }
  await run(
    "server page cap loads remaining scalar pages",
    async (p) => {
      await loaded(p);
      const r = (await snapshot(p)).requests.filter((r) => r.table === "saved_properties");
      assert.deepEqual(
        r.map((r) => r.query.offset),
        ["0", "4", "8"],
      );
      assert.equal(r.flatMap((r) => r.body).length, 9);
    },
    { cap: 4 },
  );
  await run(
    "bounded pagination shows honest partial list",
    async (p) => {
      await loaded(p, 20);
      await p
        .getByText("Showing a partial list. Totals and recent activity are unavailable.")
        .waitFor();
      assert.equal(await p.getByText("Recent activity", { exact: true }).count(), 0);
      assert.equal(await p.getByText("Not loaded", { exact: true }).count(), 4);
    },
    { cap: 2, size: 25 },
  );
  await run("account switch and sign-out clear cards", async (p) => {
    await loaded(p);
    await p.evaluate(() => {
      fixture.rules.push({ table: "saved_properties", delay: 400 });
      fixture.owner("synthetic-owner-B");
    });
    await p.waitForFunction(() => !document.body.textContent.includes("Synthetic A property"));
    await loaded(p, 1);
    assert((await p.locator("article").innerText()).includes("Synthetic B"));
    await p.evaluate(() => fixture.owner(null));
    await p.waitForFunction(() => !!fixture.redirect);
    assert.equal(await p.locator("article").count(), 0);
  });
  await run(
    "delayed A B A cannot resurrect old A response",
    async (p) => {
      await p.waitForFunction(() => fixture.requests.length >= 2);
      await p.evaluate(() => fixture.owner("synthetic-owner-B"));
      await loaded(p, 1);
      await p.evaluate(() => fixture.owner("synthetic-owner-A"));
      await loaded(p);
      await p.waitForTimeout(650);
      await loaded(p);
      assert.equal(await p.getByRole("alert").count(), 0);
      assert((await snapshot(p)).requests[0].aborted);
    },
    { rules: [{ table: "saved_properties", delay: 600, mode: "wrong-owner" }] },
  );
  await run("auth refresh hides old rows until reloaded", async (p) => {
    await loaded(p);
    await p.evaluate(() => fixture.loading(true));
    await p.waitForFunction(() => document.querySelectorAll("article").length === 0);
    await p.evaluate(() => fixture.loading(false));
    await loaded(p);
  });
  for (const mode of ["missing-count", "missing-page"]) {
    await run(
      `${mode} is a read failure`,
      async (p) => {
        await p.getByRole("alert").waitFor();
        assert.equal(await p.locator("article").count(), 0);
      },
      { rules: [{ table: "saved_properties", mode }] },
    );
  }
  await run(
    "changed page count fails closed",
    async (p) => {
      await p.getByRole("alert").waitFor();
      assert.equal(await p.locator("article").count(), 0);
    },
    {
      cap: 4,
      rules: [{ table: "saved_properties" }, { table: "saved_properties", mode: "changed-count" }],
    },
  );
  await run(
    "note owner mismatch fails closed",
    async (p) => {
      await p.getByRole("alert").waitFor();
      assert.equal(await p.locator("article").count(), 0);
    },
    { rules: [{ table: "property_notes", mode: "wrong-owner" }] },
  );
  await run(
    "sign-out while a read is pending denies late rows",
    async (p) => {
      await p.waitForFunction(() => fixture.requests.length >= 2);
      await p.evaluate(() => fixture.owner(null));
      await p.waitForFunction(() => !!fixture.redirect);
      await p.waitForTimeout(650);
      assert.equal(await p.locator("article").count(), 0);
    },
    { rules: [{ table: "saved_properties", delay: 600 }] },
  );
  await run("cancelled removal preserves every record", async (p) => {
    await loaded(p);
    p.once("dialog", (d) => d.dismiss());
    await p.getByRole("button", { name: "Remove Synthetic A property 1", exact: true }).click();
    await loaded(p);
  });
  for (const [label, tab] of [
    ["Continue Investigation", "investigation"],
    ["Open Report", "stoep-report"],
    ["Open Market evidence", "listings"],
    ["keyboard", null],
  ]) {
    await run(
      `navigate ${label} to exact selected parcel then return`,
      async (p) => {
        await loaded(p);
        const card = p.locator("article").filter({ hasText: "Synthetic A property 1" });
        if (label === "keyboard") {
          await card.getByRole("link").focus();
          await p.keyboard.press("Enter");
        } else await card.getByRole("button", { name: label, exact: true }).click();
        await p.waitForURL((u) => u.pathname === "/");
        const u = new URL(p.url());
        assert.equal(u.searchParams.get("officialParcel"), "csg:lpi:synthetic-1");
        if (tab) assert.equal(u.searchParams.get("tab"), tab);
        await p.waitForFunction(() => fixture.requests.some((r) => r.table === "saved_properties"));
        const detail = (await snapshot(p)).requests.find((r) => r.table === "saved_properties");
        assert.equal(detail.query.user_id, "eq.synthetic-owner-A");
        assert.equal(detail.query.parcel_id, "eq.csg:lpi:synthetic-1");
        assert.equal(detail.body.length, 1);
        await writeFile(
          `${out}/navigation-${tab || "keyboard"}.json`,
          JSON.stringify({ url: p.url(), detail }, null, 2),
        );
        for (let i = 0; i < 4 && new URL(p.url()).pathname === "/"; i++) await p.goBack();
        // The fixture router has no SPA history outlet. Reload the returned list
        // to mount the actual route at its restored URL.
        assert.equal(new URL(p.url()).pathname, new URL(url).pathname);
        await p.reload();
        await loaded(p);
        const back = await snapshot(p);
        assert(!JSON.stringify(back.requests).includes("FORBIDDEN_"));
      },
      {},
      label === "Open Market evidence",
    );
  }
  assert.equal(external, 0);
} finally {
  await browser.close();
}
