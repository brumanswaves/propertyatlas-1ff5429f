import assert from "node:assert/strict";
import fs from "node:fs";
import { start } from "./server.mjs";
const { chromium } = await import(process.env.EASY_ERF_PLAYWRIGHT_MODULE);
const server = await start();
const browser = await chromium.launch(
  process.env.EASY_ERF_CHROMIUM ? { executablePath: process.env.EASY_ERF_CHROMIUM } : {},
);
const A = "33333333-3333-4333-8333-333333333333",
  B = "44444444-4444-4444-8444-444444444444";
const results = [];
function order(id, label = id) {
  return {
    id,
    user_id: "actor-a",
    parcel_id: "csg:lpi:test",
    report_type: "human_review",
    status: "processing",
    status_enum: "fulfilling",
    provider: "stripe",
    payload: { propertyReference: label, paymentMode: "test" },
    price_cents: 99900,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    completed_at: null,
    review_focus: "purchase",
    intended_use: null,
    review_context: null,
    review_content: null,
  };
}
async function run(name, hash, fn, options = {}) {
  const c = await browser.newContext({ serviceWorkers: "block" });
  const p = await c.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await c.route("**/*", (r) =>
    new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort(),
  );
  await p.addInitScript((options) => {
    window.fixture = {
      user: "actor-a",
      loading: false,
      admin: true,
      requests: [],
      pending: [],
      errors: [],
      mutations: [],
      ...options,
    };
    localStorage.setItem("synthetic-scoped-draft:actor-a:order-a", "preserve draft");
  }, options);
  try {
    await p.goto(
      "http://127.0.0.1:4195/src/lib/humanReview/__tests__/exact-order/index.html" + hash,
    );
    await p.waitForFunction(() => Boolean(window.fixture.render));
    await fn(p);
    assert.deepEqual(errors, []);
    assert.deepEqual(await p.evaluate(() => window.fixture.mutations), []);
    assert.equal(
      await p.evaluate(() => localStorage.getItem("synthetic-scoped-draft:actor-a:order-a")),
      "preserve draft",
    );
    results.push({ name, pass: true });
    console.log("PASS", name);
  } catch (e) {
    console.error(
      "FIXTURE",
      errors,
      await p.locator("body").innerText(),
      await p.evaluate(() => ({
        errors: window.fixture?.errors,
        requests: window.fixture?.requests.map((r) => ({ kind: r.kind, id: r.id })),
      })),
    );
    throw e;
  } finally {
    await c.close();
  }
}
const count = async (p, kind) =>
  p.evaluate((kind) => window.fixture.requests.filter((r) => r.kind === kind).length, kind);
const queueCount = (p) =>
  p.evaluate(() => window.fixture.requests.filter((r) => r.kind.includes("queue")).length);
const waitRequests = (p, n) => p.waitForFunction((n) => window.fixture.requests.length >= n, n);
async function settle(p, index, value, error = false) {
  await p.evaluate(
    ({ index, value, error }) => {
      const r = window.fixture.requests[index];
      error ? r.reject(new Error(typeof error === "string" ? error : "denied")) : r.resolve(value);
    },
    { index, value, error },
  );
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}
async function change(p, patch) {
  await p.evaluate((patch) => {
    Object.assign(window.fixture, patch);
    window.fixture.render();
  }, patch);
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}
async function hash(p, id) {
  await p.evaluate((id) => {
    location.hash = id ? "order-" + id : "";
  }, id);
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}
try {
  await run(
    "SSR hydration exact link and focused refresh/readback never read queue",
    "#order-" + A,
    async (p) => {
      await waitRequests(p, 1);
      assert.equal(await p.evaluate(() => window.fixture.ssrRequests), 0);
      assert.equal(await queueCount(p), 0);
      await settle(p, 0, order(A));
      await p.getByText("Synthetic post-save readback " + A, { exact: true }).click();
      await waitRequests(p, 2);
      assert.equal(await queueCount(p), 0);
      await settle(p, 1, order(A));
      await p.getByText("Synthetic post-save readback " + A, { exact: true }).waitFor();
    },
  );
  for (const h of ["#order-bad", "#order-", "#unrecognized"])
    await run("invalid target " + h, h, async (p) => {
      await p.getByText("This investigation link is invalid. No orders were loaded.").waitFor();
      assert.equal(await p.evaluate(() => window.fixture.requests.length), 0);
    });
  await run(
    "unresolved hook and explicit retry do not read queue",
    "",
    async (p) => {
      await p.getByText("Probe refresh").click();
      assert.equal(await p.evaluate(() => window.fixture.requests.length), 0);
    },
    { probe: true },
  );
  for (const admin of [true, false])
    await run(
      "overview and deliberate back use correct queue " + admin,
      "#order-" + A,
      async (p) => {
        await waitRequests(p, 1);
        assert.equal(await queueCount(p), 0);
        assert.equal(
          await p.evaluate(() => window.fixture.requests[0].kind),
          admin ? "report_orders" : "read_assigned_investigation_header",
        );
        await settle(p, 0, order(A));
        await p.getByRole("button", { name: "Back to investigation queue", exact: true }).click();
        await waitRequests(p, 2);
        assert.equal(
          await p.evaluate(() => window.fixture.requests[1].kind),
          admin ? "list_easy_erf_founder_queue" : "list_assigned_investigation_queue",
        );
        await settle(p, 1, []);
      },
      { admin },
    );
  for (const fail of [false, true])
    await run(
      "late queue " + (fail ? "failure" : "success") + " cannot hide exact detail",
      "",
      async (p) => {
        await waitRequests(p, 1);
        await hash(p, A);
        await waitRequests(p, 2);
        assert.equal(await p.evaluate(() => window.fixture.requests[0].signal.aborted), true);
        await settle(p, 1, order(A));
        await settle(p, 0, [], fail);
        await p.getByText("Synthetic post-save readback " + A, { exact: true }).waitFor();
        assert.equal(
          await p.getByText("Investigation queue unavailable", { exact: true }).count(),
          0,
        );
      },
    );
  await run("queue error remains honest but selected order is independent", "", async (p) => {
    await waitRequests(p, 1);
    await settle(p, 0, null, true);
    await p.getByText("Investigation queue unavailable", { exact: true }).waitFor();
    await hash(p, A);
    await waitRequests(p, 2);
    await settle(p, 1, order(A));
    await p.getByText("Synthetic post-save readback " + A, { exact: true }).waitFor();
  });
  await run("unauthorized exact detail fails closed without fallback", "#order-" + A, async (p) => {
    await waitRequests(p, 1);
    await settle(p, 0, null, true);
    await p.getByText("Could not load this investigation", { exact: true }).waitFor();
    assert.equal(
      await p.getByText("No accessible investigation found", { exact: true }).count(),
      0,
    );
    assert.equal((await p.locator("body").innerText()).includes("denied"), false);
    assert.equal(await queueCount(p), 0);
  });
  for (const admin of [true, false])
    await run(
      "failed read retry recovers exact investigation " + admin,
      "#order-" + A,
      async (p) => {
        await waitRequests(p, 1);
        await settle(p, 0, null, "private backend diagnostics");
        await p
          .getByRole("heading", { name: "Could not load this investigation", exact: true })
          .waitFor();
        assert.equal(
          (await p.locator("body").innerText()).includes("private backend diagnostics"),
          false,
        );
        assert.equal(
          await p.getByText("Synthetic post-save readback " + A, { exact: true }).count(),
          0,
        );
        await p
          .getByRole("button", { name: "Retry this investigation", exact: true })
          .evaluate((button) => {
            button.click();
            button.click();
            button.click();
          });
        await waitRequests(p, 2);
        assert.equal(await p.evaluate(() => window.fixture.requests.length), 2);
        await p.getByText("Loading the exact order…", { exact: true }).waitFor();
        assert.equal(
          await p.getByRole("button", { name: "Retry this investigation", exact: true }).count(),
          0,
        );
        assert.equal(
          await p.getByText("Could not load this investigation", { exact: true }).count(),
          0,
        );
        assert.equal(await p.evaluate(() => location.hash), "#order-" + A);
        await settle(p, 1, order(A, "RECOVERED"));
        await p.getByText("RECOVERED", { exact: true }).waitFor();
        assert.deepEqual(
          await p.evaluate(() =>
            window.fixture.requests.map((r) => ({ id: r.id, assigned: r.assigned })),
          ),
          [
            { id: A, assigned: !admin },
            { id: A, assigned: !admin },
          ],
        );
        assert.equal(await queueCount(p), 0);
      },
      { admin },
    );
  await run(
    "successful empty read is distinct and overview remains deliberate",
    "#order-" + A,
    async (p) => {
      await waitRequests(p, 1);
      await settle(p, 0, null);
      await p
        .getByRole("heading", { name: "No accessible investigation found", exact: true })
        .waitFor();
      assert.equal(
        await p.getByRole("button", { name: "Retry this investigation", exact: true }).count(),
        0,
      );
      assert.equal(await queueCount(p), 0);
      assert.deepEqual(await p.evaluate(() => window.fixture.errors), []);
      await p.getByRole("button", { name: "Return to queue", exact: true }).click();
      await waitRequests(p, 2);
      assert.equal(await queueCount(p), 1);
      await settle(p, 1, []);
    },
  );
  await run("retry failure stays unavailable with no automatic retry", "#order-" + A, async (p) => {
    await waitRequests(p, 1);
    await settle(p, 0, null, true);
    await p.getByRole("button", { name: "Retry this investigation", exact: true }).click();
    await waitRequests(p, 2);
    await settle(p, 1, null, true);
    await p
      .getByRole("heading", { name: "Could not load this investigation", exact: true })
      .waitFor();
    await change(p, {});
    assert.equal(await p.evaluate(() => window.fixture.requests.length), 2);
    assert.equal(await queueCount(p), 0);
    assert.equal(
      await p.getByText("Synthetic post-save readback " + A, { exact: true }).count(),
      0,
    );
    await p.getByRole("button", { name: "Retry this investigation", exact: true }).click();
    await waitRequests(p, 3);
    await settle(p, 2, null);
    await p
      .getByRole("heading", { name: "No accessible investigation found", exact: true })
      .waitFor();
  });
  await run(
    "failed revalidation removes actionable old detail and retry restores it",
    "#order-" + A,
    async (p) => {
      await waitRequests(p, 1);
      await settle(p, 0, order(A, "OLD_DETAIL"));
      await p.getByText("Synthetic post-save readback " + A, { exact: true }).click();
      await waitRequests(p, 2);
      assert.equal(await p.getByText("OLD_DETAIL", { exact: true }).count(), 0);
      await settle(p, 1, null, true);
      assert.equal(
        await p.getByText("Synthetic post-save readback " + A, { exact: true }).count(),
        0,
      );
      await p.getByRole("button", { name: "Retry this investigation", exact: true }).click();
      await waitRequests(p, 3);
      await settle(p, 2, order(A, "FRESH_DETAIL"));
      await p.getByText("FRESH_DETAIL", { exact: true }).waitFor();
      assert.equal(await queueCount(p), 0);
      assert.deepEqual(await p.evaluate(() => window.fixture.requests.map((r) => r.id)), [A, A, A]);
    },
  );
  for (const kind of ["order", "account", "role"])
    for (const fail of [false, true])
      await run(
        "pending retry " + kind + " change ignores stale " + (fail ? "failure" : "success"),
        "#order-" + A,
        async (p) => {
          await waitRequests(p, 1);
          await settle(p, 0, null, true);
          await p.getByRole("button", { name: "Retry this investigation", exact: true }).click();
          await waitRequests(p, 2);
          if (kind === "order") await hash(p, B);
          else await change(p, kind === "account" ? { user: "actor-b" } : { admin: false });
          await waitRequests(p, 3);
          assert.equal(await p.evaluate(() => window.fixture.requests[1].signal.aborted), true);
          await settle(p, 2, order(kind === "order" ? B : A, "CURRENT_SCOPE"));
          await settle(p, 1, order(A, "STALE_SCOPE"), fail);
          await p.getByText("CURRENT_SCOPE", { exact: true }).waitFor();
          assert.equal(await p.getByText("STALE_SCOPE", { exact: true }).count(), 0);
          assert.equal(
            await p.getByText("Could not load this investigation", { exact: true }).count(),
            0,
          );
          assert.equal(await p.evaluate(() => window.fixture.errors.length), 1);
          assert.equal(await queueCount(p), 0);
        },
      );
  for (const fail of [false, true])
    await run(
      "logout during retry ignores late " + (fail ? "failure" : "success"),
      "#order-" + A,
      async (p) => {
        await waitRequests(p, 1);
        await settle(p, 0, null, true);
        await p.getByRole("button", { name: "Retry this investigation", exact: true }).click();
        await waitRequests(p, 2);
        await change(p, { user: null });
        await settle(p, 1, order(A, "PRIVATE_AFTER_LOGOUT"), fail);
        assert.equal(await p.getByText("PRIVATE_AFTER_LOGOUT", { exact: true }).count(), 0);
        assert.equal(
          await p.getByRole("button", { name: "Retry this investigation", exact: true }).count(),
          0,
        );
        assert.equal(await p.evaluate(() => window.fixture.errors.length), 1);
        assert.equal(await p.evaluate(() => window.fixture.requests.length), 2);
        assert.equal(await queueCount(p), 0);
      },
    );
  await run("A B A discards earlier matching response", "#order-" + A, async (p) => {
    await waitRequests(p, 1);
    await hash(p, B);
    await waitRequests(p, 2);
    await hash(p, A);
    await waitRequests(p, 3);
    await settle(p, 2, order(A, "CURRENT"));
    await settle(p, 0, order(A, "STALE"));
    await settle(p, 1, order(B, "STALE_B"));
    await p.getByText("CURRENT", { exact: true }).waitFor();
    assert.equal(await p.getByText("STALE", { exact: true }).count(), 0);
    assert.equal(await queueCount(p), 0);
  });
  for (const kind of ["account", "role"])
    await run(kind + " A B A rejects stale lifetime", "#order-" + A, async (p) => {
      await waitRequests(p, 1);
      await change(p, kind === "account" ? { user: "actor-b" } : { admin: false });
      await waitRequests(p, 2);
      await change(p, kind === "account" ? { user: "actor-a" } : { admin: true });
      await waitRequests(p, 3);
      await settle(p, 2, order(A, "CURRENT"));
      await settle(p, 0, order(A, "STALE"));
      await settle(p, 1, order(A, "STALE_OTHER"));
      await p.getByText("CURRENT", { exact: true }).waitFor();
      assert.equal(await p.getByText("STALE", { exact: true }).count(), 0);
      assert.equal(await queueCount(p), 0);
    });
  await run(
    "auth loading and logout expose no stale detail",
    "#order-" + A,
    async (p) => {
      assert.equal(await p.evaluate(() => window.fixture.requests.length), 0);
      await change(p, { loading: false });
      await waitRequests(p, 1);
      await settle(p, 0, order(A, "PRIVATE"));
      await change(p, { user: null });
      assert.equal(await p.getByText("PRIVATE", { exact: true }).count(), 0);
      assert.equal(await queueCount(p), 0);
    },
    { loading: true },
  );
  await run("remount exact link stays detail only", "#order-" + A, async (p) => {
    await waitRequests(p, 1);
    await change(p, { mount: 1 });
    await waitRequests(p, 2);
    assert.equal(await queueCount(p), 0);
  });
} finally {
  const output = process.env.EASY_ERF_FIXTURE_OUTPUT ?? "artifacts/exact-order";
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(output + "/component-results.json", JSON.stringify(results, null, 2));
  await browser.close();
  await server.close();
}
