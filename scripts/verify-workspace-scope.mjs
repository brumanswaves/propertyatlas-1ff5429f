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
const out = process.env.WORKSPACE_EVIDENCE_DIR || "artifacts/workspace-scope";
await mkdir(out, { recursive: true });
const results = [];
let external = 0;
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const id = (i) => `csg:lpi:synthetic-${i}`;
const select = (p, i) => p.getByRole("button", { name: `Select ${i}`, exact: true }).click();
const snapshot = (p) => p.evaluate(() => fixture.snapshot());
const settle = (p) => p.waitForTimeout(150);
const waitTable = (p, table, count = 1) =>
  p.waitForFunction(
    ({ table, count }) => fixture.requests.filter((r) => r.table === table).length >= count,
    { table, count },
  );
const loaded = async (p, i = 1) => {
  await select(p, i);
  await waitTable(p, "erf_assets");
  await settle(p);
};
const noMutations = async (p) => assert.equal((await snapshot(p)).mutations.length, 0);
async function run(name, action, query = "") {
  const context = await browser.newContext({
    serviceWorkers: "block",
    viewport: { width: 1280, height: 900 },
  });
  await context.route("**/*", (r) => {
    if (new URL(r.request().url()).hostname !== "127.0.0.1") {
      external++;
      return r.abort();
    }
    return r.continue();
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto(`http://127.0.0.1:4190/scripts/fixtures/workspace-scope/index.html${query}`);
    await page.waitForFunction(() => !!window.fixture?.routeTo);
    await settle(page);
    await action(page);
    assert.deepEqual(errors, []);
    const state = await snapshot(page);
    results.push({
      name,
      status: "passed",
      requests: state.requests,
      mutations: state.mutations,
      flushes: state.flushes,
      recordHashes: state.records.map((r) => ({ parcel: r.parcel_id, sha256: hash(r) })),
    });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, status: "failed", error: error.message, errors });
    throw error;
  } finally {
    await writeFile(
      `${out}/results.json`,
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
    await context.close();
  }
}
try {
  await run(
    "unresolved-auth-defers-direct-selection",
    async (p) => {
      assert.equal((await snapshot(p)).requests.length, 0);
      await p.evaluate(() => fixture.loading(false));
      await waitTable(p, "erf_assets");
      assert(
        (await snapshot(p)).requests.every(
          (r) => r.query.user_id === "eq.synthetic-owner-A" && r.query.parcel_id === `eq.${id(1)}`,
        ),
      );
      await noMutations(p);
    },
    "?authPending=1&officialParcel=csg%3Alpi%3Asynthetic-1&fromSaved=1",
  );
  await run("no-selection-signin-report-only", async (p) => {
    await p.evaluate(() => fixture.owner(null));
    await settle(p);
    await p.evaluate(() => fixture.owner("synthetic-owner-A"));
    await settle(p);
    assert.equal((await snapshot(p)).requests.length, 0);
    await p.evaluate(() => fixture.routeTo("report"));
    await settle(p);
    assert.equal((await snapshot(p)).requests.length, 0);
    await noMutations(p);
  });
  await run("unresolved-coordinate-is-not-selected-identity", async (p) => {
    await p.evaluate(() =>
      fixture.mapProps.onSelectOfficial({
        source: "CSG",
        layer: "csg-parcels",
        properties: {},
        lngLat: [25, -34],
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [25, -34],
              [25.1, -34],
              [25, -34.1],
              [25, -34],
            ],
          ],
        },
      }),
    );
    await settle(p);
    assert.equal((await snapshot(p)).requests.length, 0);
    await noMutations(p);
  });
  await run("selected-only-nine-property-byte-preservation", async (p) => {
    const before = await snapshot(p);
    await loaded(p);
    await p.waitForTimeout(1100);
    const after = await snapshot(p);
    assert.equal(after.requests.filter((r) => r.table === "saved_properties").length, 1);
    for (const r of after.requests) {
      assert.equal(r.query.user_id, "eq.synthetic-owner-A");
      assert.equal(r.query.parcel_id, `eq.${id(1)}`);
      assert(r.returned.every((x) => x.owner === "synthetic-owner-A" && x.parcel === id(1)));
    }
    assert.equal(after.requests[0].bodyCount, 1);
    assert.equal(hash(before.records), hash(after.records));
    for (const [key, value] of Object.entries(before.storage))
      assert.equal(after.storage[key], value, `Untouched draft ${key}`);
    assert.equal(after.mutations.length, 0);
    await p.screenshot({ path: `${out}/selected-only.png`, fullPage: true });
    await writeFile(
      `${out}/preservation.json`,
      JSON.stringify(
        {
          recordsBefore: hash(before.records),
          recordsAfter: hash(after.records),
          otherEightDraftsBefore: hash(before.storage),
          otherEightDraftsAfter: hash(
            Object.fromEntries(Object.keys(before.storage).map((k) => [k, after.storage[k]])),
          ),
        },
        null,
        2,
      ),
    );
  });
  await run("unselected-events-and-flush-not-acknowledged", async (p) => {
    await loaded(p);
    const before = await snapshot(p);
    await p.evaluate(() => {
      fixture.event(2);
      fixture.flush(2);
    });
    await p.waitForTimeout(1100);
    const after = await snapshot(p);
    assert.equal(after.requests.length, before.requests.length);
    assert.equal(after.flushes[0].status, "rejected");
    await noMutations(p);
  });
  for (const mode of [
    "wrong-owner",
    "wrong-parcel",
    "duplicate",
    "wrong-projection",
    "failure",
    "missing",
  ])
    await run(`read-${mode}`, async (p) => {
      const before = await snapshot(p);
      await p.evaluate((mode) => fixture.delay("saved_properties", 1, 0, mode), mode);
      await select(p, 1);
      await settle(p);
      await p.evaluate(() => fixture.flush(1));
      await settle(p);
      const after = await snapshot(p);
      assert.equal(after.flushes[0].status, "rejected");
      assert.deepEqual(after.storage, before.storage);
      assert.equal(after.mutations.length, 0);
    });
  for (const change of ["parcel", "account", "signout", "deselect", "report"])
    await run(`delayed-hydration-${change}`, async (p) => {
      await p.evaluate(() => fixture.delay("saved_properties", 1, 600));
      await select(p, 1);
      await waitTable(p, "saved_properties");
      if (change === "parcel") await select(p, 2);
      if (change === "account") await p.evaluate(() => fixture.owner("synthetic-owner-B"));
      if (change === "signout") await p.evaluate(() => fixture.owner(null));
      if (change === "deselect")
        await p.getByRole("button", { name: "Deselect", exact: true }).click();
      if (change === "report") await p.evaluate(() => fixture.routeTo("report"));
      await p.waitForTimeout(750);
      assert.equal(
        await p.evaluate(() => fixture.workspace(1, "synthetic-owner-A").planning.zoneCode),
        null,
      );
      assert(
        !(await snapshot(p)).requests.some(
          (r) => r.table === "erf_site_projects" && r.query.parcel_id === `eq.${id(1)}`,
        ),
      );
      await noMutations(p);
    });
  await run("delayed-hydration-A-B-A-generation", async (p) => {
    await p.evaluate(() => fixture.delay("saved_properties", 1, 650));
    await select(p, 1);
    await waitTable(p, "saved_properties");
    await select(p, 2);
    await p.evaluate(() => {
      fixture.records[0].user_data.easyErfInvestigation.planning.zoneCode = "NEW-A";
    });
    await select(p, 1);
    await p.waitForTimeout(900);
    assert.equal(await p.evaluate(() => fixture.workspace(1).planning.zoneCode), "NEW-A");
    await noMutations(p);
  });
  await run("delayed-reconciliation-A-B-A-generation", async (p) => {
    await p.evaluate(() => fixture.delay("erf_site_projects", 1, 650));
    await select(p, 1);
    await waitTable(p, "erf_site_projects");
    await select(p, 2);
    await select(p, 1);
    await p.waitForTimeout(900);
    const requests = (await snapshot(p)).requests;
    assert.equal(
      requests.filter((r) => r.table === "erf_assets" && r.query.parcel_id === `eq.${id(1)}`)
        .length,
      1,
    );
    await noMutations(p);
  });
  for (const change of ["account", "signout", "deselect"])
    await run(`delayed-reconciliation-${change}`, async (p) => {
      await p.evaluate(() => fixture.delay("erf_site_projects", 1, 600));
      await select(p, 1);
      await waitTable(p, "erf_site_projects");
      if (change === "account") await p.evaluate(() => fixture.owner("synthetic-owner-B"));
      if (change === "signout") await p.evaluate(() => fixture.owner(null));
      if (change === "deselect")
        await p.getByRole("button", { name: "Deselect", exact: true }).click();
      await p.waitForTimeout(750);
      assert(!(await snapshot(p)).requests.some((r) => r.table === "erf_assets"));
      await noMutations(p);
    });
  await run("delayed-assets-A-B-A-cannot-restore-old-project", async (p) => {
    await p.evaluate(() => fixture.delay("erf_assets", 1, 650));
    await select(p, 1);
    await waitTable(p, "erf_assets");
    await select(p, 2);
    await p.evaluate(() => {
      fixture.projectVersion = "new";
    });
    await select(p, 1);
    await p.waitForTimeout(850);
    assert.equal(
      await p.evaluate(() => fixture.workspace(1).sitePotential.projectId),
      "project-row-1-new",
    );
    await noMutations(p);
  });
  await run("selected-recheck-cancelled-on-deselection", async (p) => {
    await p.evaluate(() => {
      fixture.generationStatus = "generating";
    });
    await select(p, 1);
    await waitTable(p, "erf_assets");
    await waitTable(p, "erf_site_projects", 2);
    await waitTable(p, "erf_assets", 2);
    const before = await snapshot(p);
    assert.equal(before.requests.filter((r) => r.table === "erf_site_projects").length, 2);
    await p.getByRole("button", { name: "Deselect", exact: true }).click();
    await p.waitForTimeout(16000);
    assert.equal((await snapshot(p)).requests.length, before.requests.length);
    await noMutations(p);
  });
  await run("debounced-save-cancelled-draft-retained", async (p) => {
    await loaded(p);
    await p.evaluate(() => fixture.edit(1, "UNSENT-DRAFT"));
    await select(p, 2);
    await p.waitForTimeout(1100);
    await noMutations(p);
    assert.equal(await p.evaluate(() => fixture.workspace(1).planning.zoneCode), "UNSENT-DRAFT");
  });
  await run("pending-flush-settles-on-switch-without-save", async (p) => {
    await p.evaluate(() => fixture.delay("saved_properties", 1, 650));
    await select(p, 1);
    await waitTable(p, "saved_properties");
    await p.evaluate(() => fixture.flush(1));
    await select(p, 2);
    await settle(p);
    assert.equal((await snapshot(p)).flushes[0].status, "rejected");
    await p.waitForTimeout(750);
    await noMutations(p);
  });
  await run("queued-save-A-B-A-is-not-new-generation", async (p) => {
    await loaded(p);
    await p.evaluate(() => {
      fixture.delay("erf_site_projects", 1, 650);
      fixture.edit(1, "QUEUED-A");
      fixture.flush(1);
      fixture.flush(1);
    });
    await waitTable(p, "erf_site_projects", 2);
    await select(p, 2);
    await select(p, 1);
    await p.waitForTimeout(900);
    assert((await snapshot(p)).flushes.every((f) => f.status === "rejected"));
    await noMutations(p);
  });
  await run("account-change-before-dispatch", async (p) => {
    await loaded(p);
    await p.evaluate(() => {
      fixture.sessionDelay = 500;
      fixture.edit(1, "ACCOUNT-DRAFT");
      fixture.flush(1);
    });
    await p.waitForTimeout(70);
    await p.evaluate(() => fixture.owner("synthetic-owner-B"));
    await p.waitForTimeout(750);
    await noMutations(p);
    assert.equal((await snapshot(p)).flushes[0].status, "rejected");
    assert.equal(await p.locator("[data-selected]").count(), 0);
    await select(p, 1);
    await p.waitForFunction(() =>
      fixture.requests.some((r) => r.query.user_id === "eq.synthetic-owner-B"),
    );
    await noMutations(p);
  });
  await run("inflight-save-keeps-original-target-no-stale-baseline", async (p) => {
    await loaded(p);
    const baseline = await p.evaluate(() => fixture.baseline(1));
    await p.evaluate(() => {
      fixture.delay("patch_saved_property_user_data_if_unchanged", 1, 650);
      fixture.edit(1, "IN-FLIGHT-A");
      fixture.flush(1);
    });
    await waitTable(p, "patch_saved_property_user_data_if_unchanged");
    await p.evaluate(() => fixture.owner("synthetic-owner-B"));
    await p.waitForTimeout(850);
    const state = await snapshot(p);
    assert.deepEqual(state.mutations, [{ owner: "synthetic-owner-A", parcel: id(1) }]);
    assert.equal(state.flushes[0].status, "rejected");
    assert.equal(await p.evaluate(() => fixture.baseline(1, "synthetic-owner-A")), baseline);
  });
  for (const legacy of [false, true])
    await run(
      `guarded-save-reload-${legacy ? "legacy-empty" : "meaningful-inputs"}`,
      async (p) => {
        await loaded(p);
        const before = await snapshot(p);
        await p.evaluate(() => {
          fixture.edit(1, "USER-SAVED");
          fixture.flush(1);
        });
        await p.waitForFunction(() => fixture.flushes[0]?.status !== "pending");
        assert.equal((await snapshot(p)).flushes[0].status, "resolved");
        assert.deepEqual(
          (await snapshot(p)).records[0].user_data.unrelated,
          before.records[0].user_data.unrelated,
        );
        await p.reload();
        await p.waitForFunction(() => !!window.fixture?.routeTo);
        await settle(p);
        assert.equal(await p.evaluate(() => fixture.workspace(1).planning.zoneCode), "USER-SAVED");
        assert.equal((await snapshot(p)).mutations.length, 0);
        assert.deepEqual(
          await p.evaluate(() => fixture.inputs(1)),
          legacy ? {} : { maxCoveragePct: 35 },
        );
      },
      legacy ? "?legacy=1" : "",
    );
  await run("competing-edit-conflict-explicit-restore-preserves-draft", async (p) => {
    await loaded(p);
    await p.evaluate(() => {
      fixture.records[0].user_data.easyErfInvestigation.planning.zoneCode = "OTHER-SESSION";
      fixture.edit(1, "LOCAL-DRAFT");
      fixture.flush(1);
    });
    await p.waitForFunction(() => fixture.flushes[0]?.status !== "pending");
    assert.equal((await snapshot(p)).flushes[0].status, "rejected");
    await noMutations(p);
    assert.equal(await p.evaluate(() => fixture.workspace(1).planning.zoneCode), "LOCAL-DRAFT");
    await p.getByRole("button", { name: "Keep a draft backup and load saved version" }).click();
    await settle(p);
    assert.equal(await p.evaluate(() => fixture.workspace(1).planning.zoneCode), "OTHER-SESSION");
    assert(
      Object.entries((await snapshot(p)).storage).some(
        ([k, v]) => k.includes("conflict-backups") && v.includes("LOCAL-DRAFT"),
      ),
    );
    await noMutations(p);
  });
  await run("initial-browser-conflict-is-not-force-restored", async (p) => {
    await p.evaluate(() => fixture.edit(1, "PREEXISTING-DRAFT"));
    await select(p, 1);
    await settle(p);
    assert.equal(
      await p.evaluate(() => fixture.workspace(1).planning.zoneCode),
      "PREEXISTING-DRAFT",
    );
    await p.evaluate(() => fixture.flush(1));
    await settle(p);
    assert.equal((await snapshot(p)).flushes[0].status, "rejected");
    await noMutations(p);
  });
  await run("delayed-explicit-restore-cancelled", async (p) => {
    await loaded(p);
    await p.evaluate(() => {
      fixture.records[0].user_data.easyErfInvestigation.planning.zoneCode = "OTHER";
      fixture.edit(1, "LOCAL-KEEP");
      fixture.flush(1);
    });
    await p.waitForFunction(() => fixture.flushes[0]?.status === "rejected");
    await p.evaluate(() => fixture.delay("saved_properties", 1, 650));
    await p.getByRole("button", { name: "Keep a draft backup and load saved version" }).click();
    await select(p, 2);
    await select(p, 1);
    await p.waitForTimeout(850);
    assert.equal(await p.evaluate(() => fixture.workspace(1).planning.zoneCode), "LOCAL-KEEP");
    await noMutations(p);
  });
  await run("history-back-forward-and-account-provenance", async (p) => {
    await loaded(p);
    await select(p, 2);
    await settle(p);
    await p.goBack();
    await settle(p);
    assert.equal(await p.locator("[data-selected]").getAttribute("data-selected"), id(1));
    await p.goForward();
    await settle(p);
    assert.equal(await p.locator("[data-selected]").getAttribute("data-selected"), id(2));
    await p.evaluate(() => fixture.owner("synthetic-owner-B"));
    await settle(p);
    assert.equal(await p.locator("[data-selected]").count(), 0);
    const count = (await snapshot(p)).requests.length;
    await p.evaluate(() => window.dispatchEvent(new PopStateEvent("popstate")));
    await settle(p);
    assert.equal((await snapshot(p)).requests.length, count);
    await select(p, 3);
    await settle(p);
    assert.equal(await p.locator("[data-selected]").getAttribute("data-selected"), id(3));
    await noMutations(p);
  });
  await run(
    "direct-selected-property-navigation",
    async (p) => {
      await waitTable(p, "erf_assets");
      const state = await snapshot(p);
      assert(state.requests.every((r) => r.query.parcel_id === `eq.${id(1)}`));
      await noMutations(p);
    },
    "?officialParcel=csg%3Alpi%3Asynthetic-1&fromSaved=1",
  );
  assert.equal(external, 0);
  console.log(`Verified ${results.length} focused cases; no external requests.`);
} finally {
  await browser.close();
}
