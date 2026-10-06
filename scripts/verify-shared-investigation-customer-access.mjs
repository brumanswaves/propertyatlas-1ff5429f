import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const bounded = async (promise, label) => {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timed out: ${label}`)), 30000);
    })]);
  } finally { clearTimeout(timer); }
};

// Delay only an actual, completed local backend response. Never replace its
// status/body or simulate permission decisions. The ledger is an allowlist.
export function customerResponseControl() {
  let pending;
  const ledger = [];
  return {
    ledger,
    hold(spec) {
      assert(!pending, "Only one customer response may be held");
      let reached, release, finished;
      const ready = new Promise(resolve => { reached = resolve; });
      const wait = new Promise(resolve => { release = resolve; });
      const done = new Promise(resolve => { finished = resolve; });
      const held = { ...spec, reached, wait, finished };
      pending = held;
      return { ready: () => bounded(ready, spec.caseId), done: () => bounded(done, `${spec.caseId} release`),
        release: () => { if (pending === held) pending = undefined; release(); } };
    },
    async response({ url, method, body, status, bytes }) {
      const isOrders = url.pathname === "/rest/v1/report_orders" && method === "GET";
      const isReview = url.pathname === "/rest/v1/rpc/read_investigation_review" && method === "POST";
      if (!isOrders && !isReview) return;
      const args = isReview ? JSON.parse(body.toString()) : {};
      const entry = { path: url.pathname, method, status,
        actorId: isOrders ? url.searchParams.get("user_id")?.replace(/^eq\./, "") : undefined,
        orderId: isOrders ? url.searchParams.get("id")?.replace(/^eq\./, "") : args.p_order_id,
        versionId: args.p_version_id };
      ledger.push(entry);
      const held = pending;
      if (!held || held.path !== url.pathname || entry.orderId !== held.orderId
        || (isOrders && entry.actorId !== held.actorId)
        || (isReview && entry.versionId !== held.versionId)) return;
      const actual = JSON.parse(bytes.toString());
      assert.equal(status, 200, "Hold must capture a successful real backend read");
      if (isReview) {
        assert.equal(actual.customer_id, held.actorId);
        assert.equal(actual.id, held.versionId);
      } else {
        assert(actual.length > 0);
        assert(actual.every(row => row.user_id === held.actorId && row.id === held.orderId));
      }
      pending = undefined;
      entry.caseId = held.caseId; entry.actorId = held.actorId; entry.held = true;
      held.reached();
      await held.wait;
      entry.released = true;
      held.finished();
    },
  };
}

export async function verifyCustomerAccess({ open, appUrl, gatewayUrl, anon, createClient, options,
  clients, adminClient, ids, orderA, orderB, approved, frozenHash, password, rpc, must,
  control, artifacts, results }) {
  const evidence = control.ledger;
  const reportSelector = `[data-review-version="${approved.id}"]`;
  const marker = "SYNTHETIC_HUMAN_EDIT";
  const reference = id => `EE-${id.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase()}`;
  const page = await open("a", false, false);
  const context = page.context();
  // No addInitScript session seeding in this context. These are ordinary UI
  // sign-ins against real local Auth, including its cross-tab notifications.
  const login = async (target, actor) => {
    await target.goto(`${appUrl}/auth?redirect=%2Forders`);
    await target.getByLabel("Email", { exact: true }).fill(`isolated-${actor}@example.invalid`);
    await target.getByLabel("Password", { exact: true }).fill(password);
    await target.getByRole("button", { name: "Sign in", exact: true }).click();
    await target.waitForURL("**/orders");
    await target.getByRole("button", { name: "Sign out", exact: true }).waitFor();
  };
  const absent = async target => {
    assert.equal(await target.locator("[data-review-version]").count(), 0);
    assert(!await target.locator("body").innerText().then(text => text.includes(marker)));
  };
  const report = async label => {
    await page.locator(reportSelector).waitFor();
    assert((await page.locator("body").innerText()).includes(marker));
    const row = await rpc("a", "read_investigation_review", { p_order_id: orderA, p_version_id: approved.id });
    assert.equal(row.customer_id, ids.a); assert.equal(row.order_id, orderA);
    assert.equal(row.id, approved.id); assert(row.delivered_at);
    assert.equal(createHash("sha256").update(JSON.stringify(row.report_assembly)).digest("hex"), frozenHash);
    evidence.push({ caseId: label, actorId: ids.a, orderId: orderA, versionId: row.id, assemblySha256: frozenHash, passed: true });
  };
  const list = async actor => {
    const start = evidence.length;
    await page.goto(`${appUrl}/orders`);
    await page.getByText("Loading investigation status…", { exact: true }).waitFor({ state: "hidden" });
    await page.getByText(new RegExp(`Order reference ${reference(actor === "a" ? orderA : orderB)}`)).first().waitFor();
    assert(evidence.slice(start).some(entry => entry.path === "/rest/v1/report_orders" && entry.actorId === ids[actor] && entry.status === 200));
    assert(!(await page.locator("body").innerText()).includes(reference(actor === "a" ? orderB : orderA)));
  };

  await login(page, "a");
  await list("a");
  const openCard = () => page.getByRole("button", { name: new RegExp(`^Open order ${reference(orderA)} for `) }).click();
  await openCard(); await report("list-open");
  await page.getByRole("button", { name: "Back to reports", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(`^Open order ${reference(orderA)} for `) }).waitFor();
  await absent(page);
  await openCard(); await report("list-reopen");
  await page.reload(); await report("report-reload");
  await page.screenshot({ path: resolve(artifacts, "customer-access-reopened.png"), fullPage: true });
  results.push("Customer UI list/open/back/reopen/reload retains the exact delivered version and frozen assembly");

  // Create only a known, undelivered synthetic negative fixture using the
  // canonical service-only recording RPC. No generation or delivery occurs.
  const snapshotB = await rpc("admin", "read_order_investigation", { p_order_id: orderB });
  const foreignVersion = must(await adminClient.rpc("record_investigation_brief", {
    p_order_id: orderB, p_actor_id: ids.admin, p_expected_revision: snapshotB.revision,
    p_assembly: {}, p_manifest: [], p_assessment: {}, p_brief: {}, p_model: "isolated-negative-fixture",
  }));
  const undelivered = must(await adminClient.from("investigation_review_versions").select("id,order_id,customer_id,delivered_at")
    .eq("order_id", orderA).is("delivered_at", null).neq("id", approved.id).limit(1))[0];
  assert(undelivered, "A distinct retained undelivered version is required");
  assert.equal(undelivered.customer_id, ids.a); assert.equal(undelivered.delivered_at, null);
  const foreign = must(await adminClient.from("investigation_review_versions").select("id,order_id,customer_id,delivered_at")
    .eq("id", foreignVersion).single());
  assert.equal(foreign.order_id, orderB); assert.equal(foreign.customer_id, ids.b);
  for (const [caseId, actor, orderId, versionId, code] of [
    ["B-orderA-versionA", "b", orderA, approved.id, "42501"],
    ["A-orderB-versionA", "a", orderB, approved.id, "42501"],
    ["A-orderA-foreign-version", "a", orderA, foreignVersion, null],
    ["A-orderA-undelivered-version", "a", orderA, undelivered.id, null],
  ]) {
    const response = await clients[actor].rpc("read_investigation_review", { p_order_id: orderId, p_version_id: versionId });
    if (code) { assert.equal(response.error?.code, code); assert.equal(response.status, 403); }
    else { assert.equal(response.error, null); assert.equal(response.status, 200); }
    assert.equal(response.data, null);
    evidence.push({ caseId, actorId: ids[actor], orderId, versionId, status: response.status, code, passed: true });
  }
  await report("substitution-positive-control");
  results.push("Actual RPC order/version substitutions and a distinct undelivered version denied with verified fixture identities and positive owner control");

  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/auth"); await absent(page);
  await page.goto(`${appUrl}/orders?report=${orderA}`);
  await page.getByLabel("Email", { exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/auth"); await absent(page);
  await page.reload(); await page.getByLabel("Email", { exact: true }).waitFor(); await absent(page);
  const anonymous = createClient(gatewayUrl, anon, options);
  const anonReview = await anonymous.rpc("read_investigation_review", { p_order_id: orderA, p_version_id: approved.id });
  assert.equal(anonReview.status, 401); assert.equal(anonReview.error?.code, "42501"); assert.equal(anonReview.data, null);
  const anonOrders = await anonymous.from("report_orders").select("id,user_id").eq("id", orderA);
  // Default local REST SELECT grants exist, but the authenticated-only RLS
  // policy gives anon no rows. RPC EXECUTE is explicitly revoked from anon.
  assert.equal(anonOrders.status, 200); assert.equal(anonOrders.error, null); assert.deepEqual(anonOrders.data, []);
  evidence.push({ caseId: "signed-out", actorId: null, orderId: orderA, versionId: approved.id,
    rpcStatus: anonReview.status, restStatus: anonOrders.status, passed: true });
  await page.screenshot({ path: resolve(artifacts, "customer-access-signed-out.png") });
  results.push("Unseeded signed-out browser/reload exposes no report; real anonymous REST and version RPC denied");

  await login(page, "a");
  const authPage = await context.newPage();
  const switchTo = async actor => {
    await authPage.goto(`${appUrl}/orders`);
    await authPage.getByRole("button", { name: "Sign out", exact: true }).click();
    await authPage.getByLabel("Email", { exact: true }).waitFor();
    await page.getByLabel("Email", { exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/auth"); await absent(page);
    await login(authPage, actor);
  };
  const unavailable = async () => {
    await page.getByText("This exact report is not available to this account, is not yet finished, or could not be loaded. No other report was opened.", { exact: true }).waitFor();
    await absent(page);
  };
  await page.goto(`${appUrl}/orders?report=${orderA}`); await report("loaded-A-before-switch");
  await switchTo("b"); await unavailable(); await list("b");
  const heldB = control.hold({ caseId: "delayed-orders-B-A", path: "/rest/v1/report_orders", actorId: ids.b, orderId: orderB });
  try {
    await page.goto(`${appUrl}/orders?report=${orderB}`); await heldB.ready();
    await switchTo("a"); await unavailable();
    heldB.release(); await heldB.done(); await absent(page);
    assert(!(await page.locator("body").innerText()).includes(reference(orderB)));
    await list("a"); await openCard(); await report("delayed-B-to-A-positive-control");
  } finally { heldB.release(); }

  for (const endpoint of ["report_orders", "rpc/read_investigation_review"]) {
    for (const roundTrip of [false, true]) {
      const caseId = `delayed-${endpoint.replaceAll("/", "-")}-${roundTrip ? "A-B-A" : "A-B"}`;
      const held = control.hold({ caseId, path: `/rest/v1/${endpoint}`, actorId: ids.a,
        orderId: orderA, versionId: approved.id });
      try {
        await page.goto(`${appUrl}/orders?report=${orderA}`);
        await held.ready(); // Real owner response exists before the account changes.
        await switchTo("b");
        await unavailable();
        // Observe even transient stale report insertion while the old response settles.
        await page.evaluate(() => {
          window.__accessLeaks = [];
          window.__accessObserver = new MutationObserver(() => {
            if (document.querySelector("[data-review-version]") || document.body.innerText.includes("SYNTHETIC_HUMAN_EDIT")) window.__accessLeaks.push("foreign-report");
          });
          window.__accessObserver.observe(document.body, { subtree: true, childList: true, characterData: true });
        });
        held.release(); await held.done();
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await absent(page);
        assert.deepEqual(await page.evaluate(() => { window.__accessObserver.disconnect(); return window.__accessLeaks; }), []);
        await list("b");
        await switchTo("a"); await list("a"); await openCard(); await report(`${caseId}-fresh-A`);
        if (roundTrip) {
          // This second hold spans the whole A -> B -> A cycle, including a
          // fresh A read. The old response cannot replace that new result.
          const again = control.hold({ caseId: `${caseId}-full-cycle`, path: `/rest/v1/${endpoint}`,
            actorId: ids.a, orderId: orderA, versionId: approved.id });
          try {
            await page.reload(); await again.ready();
            await switchTo("b"); await unavailable();
            await switchTo("a"); await report(`${caseId}-new-response`);
            again.release(); await again.done(); await report(`${caseId}-after-old-response`);
          } finally { again.release(); }
        }
        evidence.push({ caseId, actorId: ids.a, orderId: orderA, versionId: approved.id, passed: true });
      } finally { held.release(); }
    }
  }
  await page.screenshot({ path: resolve(artifacts, "customer-access-account-switch.png"), fullPage: true });
  await authPage.close(); await context.close();
  results.push("Same unseeded browser loaded and in-flight A/B/A switches hold real order and review responses; no stale foreign report and fresh account-bound positive reads");
}
