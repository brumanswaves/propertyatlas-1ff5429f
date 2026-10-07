import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { resolve } from "node:path";

const bounded = async (promise, label, timeout = 30000) => {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timed out: ${label}`)), timeout);
    })]);
  } finally { clearTimeout(timer); }
};

function browserTerminal(page, requestId) {
  let exactRequest, resolveTerminal, rejectTerminal;
  const terminal = new Promise((resolve, reject) => { resolveTerminal = resolve; rejectTerminal = reject; });
  // A failure can be reported while account UI work is still in progress.
  terminal.catch(() => {});
  const finished = async request => {
    if (request !== exactRequest) return;
    try {
      const response = await request.response();
      assert(response, "Finished held request has no response");
      const bytes = await response.body();
      resolveTerminal({ requestId, terminal: "completed-body", status: response.status(),
        bodyBytes: bytes.length, bodySha256: createHash("sha256").update(bytes).digest("hex") });
    } catch (error) { rejectTerminal(error); }
  };
  const failed = request => {
    if (request !== exactRequest) return;
    const error = request.failure()?.errorText;
    if (error !== "net::ERR_ABORTED") return rejectTerminal(new Error(`Held request did not complete or cancel: ${error}`));
    resolveTerminal({ requestId, terminal: "cancelled", cancellation: error });
  };
  page.on("requestfinished", finished); page.on("requestfailed", failed);
  return {
    bind(request) { assert(!exactRequest); exactRequest = request; },
    wait: (timeout) => bounded(terminal, `${requestId} browser terminal`, timeout),
    close() { page.off("requestfinished", finished); page.off("requestfailed", failed); },
  };
}

export async function verifyMissingTerminalSignal() {
  const page = new EventEmitter();
  const tracked = browserTerminal(page, "negative-control-no-terminal");
  tracked.bind({});
  try {
    // Neither a server release nor an unrelated cancellation can settle it.
    page.emit("requestfailed", { failure: () => ({ errorText: "net::ERR_ABORTED" }) });
    page.emit("requestfinished", {});
    page.emit("server-release");
    await assert.rejects(tracked.wait(20), /Timed out: negative-control-no-terminal browser terminal/);
  } finally { tracked.close(); }
  const unfinishedBody = browserTerminal(page, "negative-control-no-body");
  const request = { response: async () => ({ body: () => new Promise(() => {}) }) };
  unfinishedBody.bind(request);
  try {
    page.emit("requestfinished", request);
    await assert.rejects(unfinishedBody.wait(20), /Timed out: negative-control-no-body browser terminal/);
  } finally { unfinishedBody.close(); }
  return { caseId: "missing-terminal-negative-control", unrelatedEventsIgnored: true,
    missingSignalRejected: true, missingCompletedBodyRejected: true };
}

async function holdBrowserResponse(page, control, spec) {
  const requestId = randomUUID();
  const terminal = browserTerminal(page, requestId);
  const held = control.hold({ ...spec, requestId });
  let bound = false;
  const pattern = "http://127.0.0.1:54325/rest/v1/**";
  const routeHandler = async route => {
    const request = route.request(), url = new URL(request.url());
    const review = spec.path.endsWith("/read_investigation_review");
    const args = request.method() === "POST" ? request.postDataJSON() : {};
    const matches = url.pathname === spec.path && (review
      ? request.method() === "POST" && args.p_order_id === spec.orderId && args.p_version_id === spec.versionId
      : request.method() === "GET" && url.searchParams.get("id") === `eq.${spec.orderId}` && url.searchParams.get("user_id") === `eq.${spec.actorId}`);
    if (bound || !matches) return route.fallback();
    bound = true; terminal.bind(request);
    // Correlation only. The gateway removes this test header before forwarding
    // to the real backend. The existing context isolation route still runs.
    await route.fallback({ headers: { ...request.headers(), "x-ee-test-request-id": requestId } });
  };
  await page.route(pattern, routeHandler);
  return { ...held,
    async terminal() {
      const outcome = await terminal.wait();
      control.ledger.push({ caseId: spec.caseId, actorId: spec.actorId, orderId: spec.orderId,
        versionId: spec.versionId, ...outcome });
      return outcome;
    },
    async close() { held.release(); terminal.close(); await page.unroute(pattern, routeHandler); },
  };
}

async function watchNoReport(page) {
  await page.evaluate(() => {
    window.__accessLeaks = [];
    const inspect = () => {
      if (document.querySelector("[data-review-version]") || ["SYNTHETIC_HUMAN_EDIT", "SYNTHETIC_B_DELIVERED"].some(marker => document.body.innerText.includes(marker))) window.__accessLeaks.push("foreign-report");
    };
    window.__accessObserver = new MutationObserver(inspect);
    window.__accessObserver.observe(document.body, { subtree: true, childList: true, characterData: true });
    inspect();
  });
  return async () => {
    assert.deepEqual(await page.evaluate(() => {
      // Flush pending mutation records before disconnecting.
      if (window.__accessObserver.takeRecords().length && (document.querySelector("[data-review-version]") || ["SYNTHETIC_HUMAN_EDIT", "SYNTHETIC_B_DELIVERED"].some(marker => document.body.innerText.includes(marker)))) window.__accessLeaks.push("foreign-report");
      window.__accessObserver.disconnect(); return window.__accessLeaks;
    }), []);
  };
}

// Delay only an actual, completed local backend response. Never replace its
// status/body or simulate permission decisions. The ledger is an allowlist.
export function customerResponseControl() {
  let pending;
  const ledger = [];
  return {
    ledger,
    hold(spec) {
      assert(!pending, "Only one customer response may be held");
      let reached, release;
      const ready = new Promise(resolve => { reached = resolve; });
      const wait = new Promise(resolve => { release = resolve; });
      const held = { ...spec, reached, wait };
      pending = held;
      return { ready: () => bounded(ready, spec.caseId),
        release: () => { if (pending === held) pending = undefined; release(); } };
    },
    async response({ url, method, body, status, bytes, requestId }) {
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
      if (!held || held.requestId !== requestId || held.path !== url.pathname || entry.orderId !== held.orderId
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
      entry.caseId = held.caseId; entry.requestId = requestId; entry.actorId = held.actorId; entry.held = true;
      held.reached();
      await held.wait;
      entry.released = true;
    },
  };
}

export async function verifyCustomerAccess({ open, appUrl, gatewayUrl, anon, createClient, options,
  clients, adminClient, ids, orderA, orderB, approved, frozenHash, password, rpc, must, reviewRequest,
  control, artifacts, results }) {
  const evidence = control.ledger;
  evidence.push(await verifyMissingTerminalSignal());
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
  const heldB = await holdBrowserResponse(page, control, { caseId: "delayed-orders-B-A", path: "/rest/v1/report_orders", actorId: ids.b, orderId: orderB });
  try {
    await page.goto(`${appUrl}/orders?report=${orderB}`); await heldB.ready();
    await switchTo("a"); await unavailable();
    const finishWatching = await watchNoReport(page);
    heldB.release(); const outcome = await heldB.terminal();
    await unavailable(); await absent(page);
    assert(!(await page.locator("body").innerText()).includes(reference(orderB)));
    await finishWatching();
    evidence.push({ caseId: "delayed-orders-B-A", requestId: outcome.requestId, postSwitchActorId: ids.a, postSwitchState: "foreign-order-unavailable", observationThroughTerminalAndAssertions: true });
    await list("a"); await openCard(); await report("delayed-B-to-A-positive-control");
  } finally { await heldB.close(); }

  for (const endpoint of ["report_orders", "rpc/read_investigation_review"]) {
    for (const roundTrip of [false, true]) {
      const caseId = `delayed-${endpoint.replaceAll("/", "-")}-${roundTrip ? "A-B-A" : "A-B"}`;
      const held = await holdBrowserResponse(page, control, { caseId, path: `/rest/v1/${endpoint}`, actorId: ids.a,
        orderId: orderA, versionId: approved.id });
      try {
        await page.goto(`${appUrl}/orders?report=${orderA}`);
        await held.ready(); // Real owner response exists before the account changes.
        await switchTo("b");
        await unavailable();
        const finishWatching = await watchNoReport(page);
        held.release(); const outcome = await held.terminal();
        await unavailable(); await absent(page);
        await finishWatching();
        evidence.push({ caseId, requestId: outcome.requestId, postSwitchActorId: ids.b,
          postSwitchState: "foreign-report-unavailable", observationThroughTerminalAndAssertions: true });
        await list("b");
        await switchTo("a"); await list("a"); await openCard(); await report(`${caseId}-fresh-A`);
        if (roundTrip) {
          // This second hold spans the whole A -> B -> A cycle, including a
          // fresh A read. Require the exact old browser request to be cancelled
          // before reentry; an identical frozen hash alone cannot prove this.
          const again = await holdBrowserResponse(page, control, { caseId: `${caseId}-full-cycle`, path: `/rest/v1/${endpoint}`,
            actorId: ids.a, orderId: orderA, versionId: approved.id });
          try {
            await page.reload(); await again.ready();
            await switchTo("b"); await unavailable();
            const finishWatchingRoundTrip = await watchNoReport(page);
            const outcome = await again.terminal();
            assert.equal(outcome.terminal, "cancelled", "Full-cycle old request must be closed before reentry");
            await unavailable(); await absent(page);
            await finishWatchingRoundTrip();
            evidence.push({ caseId: `${caseId}-full-cycle`, requestId: outcome.requestId,
              postSwitchActorId: ids.b, postSwitchState: "foreign-report-unavailable",
              observationThroughTerminalAndAssertions: true, cancelledBeforeReentry: true });
            await switchTo("a"); await report(`${caseId}-new-response`);
            again.release(); await report(`${caseId}-after-old-response`);
          } finally { await again.close(); }
        }
        evidence.push({ caseId, actorId: ids.a, orderId: orderA, versionId: approved.id, passed: true });
      } finally { await held.close(); }
    }
  }
  await page.screenshot({ path: resolve(artifacts, "customer-access-account-switch.png"), fullPage: true });
  results.push("Same unseeded browser loaded and in-flight A/B/A switches hold real order and review responses; no stale foreign report and fresh account-bound positive reads");

  // Add B's distinct delivered fixture only after the accepted one-delivered
  // matrix. Use the real human-only approval gate and existing local delivery
  // lifecycle; no frozen row edits, model generation, or real provider calls.
  const contentB = {
    bottomLine: "SYNTHETIC_B_DELIVERED: this separate customer property has explicit unresolved evidence gaps.",
    known: ["The synthetic customer confirmed the separate Erf 84 property identity and address."],
    potential: ["The property needs further investigation before any consequential decision."],
    risks: ["Planning, title, market and site evidence remain unavailable in this fixture."],
    unknowns: ["Unavailable evidence is unverified and does not establish development permission."],
    nextSteps: ["Obtain and review the missing evidence before relying on the report."],
  };
  const rejectedB = await reviewRequest("admin", { action: "human_approve", orderId: orderB, content: contentB });
  assert.equal(rejectedB.status, 409); assert(rejectedB.body.blockers.length > 0);
  const currentB = await rpc("b", "read_customer_investigation", { p_parcel_id: snapshotB.parcelId });
  const checkedAt = new Date().toISOString();
  const attemptB = disposition => ({ source: "Synthetic B review fixture", checkedAt, disposition,
    result: disposition === "reviewed" ? "The separate synthetic property checks were reviewed." : "No reliable record exists in this isolated fixture.",
    reason: "Record the actual limited scope of this synthetic review.", limitation: "Real evidence is unavailable and remains unverified." });
  // Fixture preparation uses the ordinary reviewer projection, which preserves
  // the private-note sentinel without returning that owner-only field in logs.
  await rpc("admin", "patch_order_investigation", { p_order_id: orderB, p_expected_revision: currentB.revision,
    p_patch: {
      normalizedParcel: { id: snapshotB.parcelId, source: "manual", sourceLabel: "Separate synthetic customer B property",
        erfNumber: "84", portion: "0", municipality: "Synthetic B municipality", town: "Synthetic B town", knownFields: [], missingFields: [] },
      easyErfInvestigation: { version: 1, parcelId: snapshotB.parcelId, syncedAt: checkedAt, workspaceUpdatedAt: checkedAt,
        identityStatus: "looks_correct", marketAddressSaved: true, sgDiagramAttachmentCount: 0, marketEvidenceStarted: false,
        strategyScenarioCount: 0, chosenScenarioId: null, reportStarted: false,
        planning: { zoneCode: null, userConfirmedZoneCode: null, userConfirmedAt: null },
        sitePotential: { skipped: false, conceptCount: 0, selectedDesignAssetId: null, progressState: "not_started" },
        investigation: { startedAt: checkedAt, lastViewedAt: checkedAt, currentStepId: "review-report", skippedStepIds: [], lastMeaningfulActionAt: null } },
      investigationWork: { ...Object.fromEntries(["cadastral_evidence", "ownership_title", "zoning_planning", "market_evidence", "strategy_calculations", "site_potential"].map(key => [key, attemptB("unavailable")])),
        property_checks: attemptB("reviewed") },
    } });
  const approvalB = await reviewRequest("admin", { action: "human_approve", orderId: orderB, content: contentB });
  assert.equal(approvalB.status, 200, JSON.stringify(approvalB.body));
  assert.equal(approvalB.body.approved, true); assert.equal(approvalB.body.delivered, false);
  const deliveryB = must(await clients.admin.functions.invoke("easy-erf-founder-fulfillment", { body: { orderId: orderB, action: "mark_ready" } }));
  assert.equal(deliveryB.ok, true); assert.equal(deliveryB.notification.receipt.providerMessageId, "isolated-provider-receipt");
  const deliveredB = await rpc("b", "read_investigation_review", { p_order_id: orderB, p_version_id: approvalB.body.versionId });
  assert.equal(deliveredB.customer_id, ids.b); assert.equal(deliveredB.order_id, orderB); assert.equal(deliveredB.parcel_id, snapshotB.parcelId);
  assert(deliveredB.approved_at && deliveredB.delivered_at); assert.equal(deliveredB.approved_by, ids.admin);
  assert.notEqual(deliveredB.parcel_id, approved.parcel_id); assert.notEqual(deliveredB.id, approved.id);
  for (const actor of ["a", "b"]) {
    assert.equal(must(await adminClient.from("user_roles").select("role").eq("user_id", ids[actor])).length, 0);
  }
  const fixtures = {
    a: { orderId: orderA, versionId: approved.id, parcelId: approved.parcel_id, marker, hash: frozenHash },
    b: { orderId: orderB, versionId: deliveredB.id, parcelId: deliveredB.parcel_id, marker: "SYNTHETIC_B_DELIVERED",
      hash: createHash("sha256").update(JSON.stringify(deliveredB.report_assembly)).digest("hex") },
  };
  assert.notEqual(fixtures.a.hash, fixtures.b.hash);
  const ownReport = async (actor, caseId) => {
    const own = fixtures[actor], other = fixtures[actor === "a" ? "b" : "a"];
    await page.locator(`[data-review-version="${own.versionId}"]`).waitFor();
    assert.equal(await page.locator("[data-review-version]").count(), 1);
    const text = await page.locator("body").innerText();
    assert(text.includes(own.marker)); assert(!text.includes(other.marker));
    const row = await rpc(actor, "read_investigation_review", { p_order_id: own.orderId, p_version_id: own.versionId });
    assert.equal(row.customer_id, ids[actor]); assert.equal(row.order_id, own.orderId); assert.equal(row.parcel_id, own.parcelId);
    assert.equal(row.id, own.versionId); assert(row.delivered_at && row.approved_at);
    assert.equal(createHash("sha256").update(JSON.stringify(row.report_assembly)).digest("hex"), own.hash);
    evidence.push({ caseId, actorId: ids[actor], orderId: own.orderId, versionId: own.versionId,
      parcelId: own.parcelId, assemblySha256: own.hash, ownMarkerVisible: true, foreignMarkerAbsent: true, passed: true });
  };
  const ownCard = actor => page.getByRole("button", { name: new RegExp(`^Open order ${reference(fixtures[actor].orderId)} for `) });
  for (const actor of ["a", "b"]) {
    if (actor === "b") await switchTo("b");
    await list(actor); await ownCard(actor).click(); await ownReport(actor, `two-delivered-${actor}-open`);
    await page.getByRole("button", { name: "Back to reports", exact: true }).click();
    await ownCard(actor).waitFor(); assert.equal(await page.locator("[data-review-version]").count(), 0);
    await ownCard(actor).click(); await ownReport(actor, `two-delivered-${actor}-reopen`);
    await page.reload(); await ownReport(actor, `two-delivered-${actor}-reload`);
    await page.screenshot({ path: resolve(artifacts, `two-delivered-${actor}.png`), fullPage: true });
    const own = fixtures[actor], other = fixtures[actor === "a" ? "b" : "a"];
    for (const [kind, orderId, versionId, expectedStatus] of [
      ["foreign-order", other.orderId, other.versionId, 403],
      ["foreign-order-own-version", other.orderId, own.versionId, 403],
      ["own-order-foreign-delivered-version", own.orderId, other.versionId, 200],
      ["own-order-undelivered-version", own.orderId, actor === "a" ? undelivered.id : foreignVersion, 200],
    ]) {
      const response = await clients[actor].rpc("read_investigation_review", { p_order_id: orderId, p_version_id: versionId });
      assert.equal(response.status, expectedStatus); assert.equal(response.data, null);
      assert.equal(response.error?.code ?? null, expectedStatus === 403 ? "42501" : null);
      evidence.push({ caseId: `two-delivered-${actor}-${kind}`, actorId: ids[actor], orderId, versionId,
        status: response.status, code: response.error?.code ?? null, returnedNull: true, passed: true });
    }
    const foreignOrder = await clients[actor].from("report_orders").select("id,user_id").eq("id", other.orderId);
    assert.equal(foreignOrder.error, null); assert.deepEqual(foreignOrder.data, []);
    await ownReport(actor, `two-delivered-${actor}-positive-after-denials`);
  }
  results.push("Two distinct synthetic customers each list/open/reopen/reload their own frozen delivered report; reciprocal actual foreign order/delivered-version and retained undelivered denials pass");

  // Both reports now exist. Exercise each direction and both real endpoints,
  // retaining the accepted exact-request terminal and no-report observation.
  let active = "b";
  for (const from of ["b", "a"]) for (const endpoint of ["report_orders", "rpc/read_investigation_review"]) {
    if (active !== from) { await switchTo(from); active = from; }
    const to = from === "a" ? "b" : "a", own = fixtures[from];
    await list(from); await ownCard(from).click(); await ownReport(from, `two-delivered-${from}-${endpoint}-before`);
    const caseId = `two-delivered-${from}-${to}-${endpoint.replaceAll("/", "-")}`;
    const held = await holdBrowserResponse(page, control, { caseId, path: `/rest/v1/${endpoint}`,
      actorId: ids[from], orderId: own.orderId, versionId: own.versionId });
    try {
      await page.reload(); await held.ready();
      await switchTo(to); active = to; await unavailable();
      const finishWatching = await watchNoReport(page);
      held.release(); const outcome = await held.terminal();
      await unavailable(); await absent(page);
      assert(!(await page.locator("body").innerText()).includes(fixtures.b.marker));
      await finishWatching();
      evidence.push({ caseId, requestId: outcome.requestId, postSwitchActorId: ids[to],
        postSwitchState: "foreign-delivered-report-unavailable", observationThroughTerminalAndAssertions: true });
      await list(to); await ownCard(to).click(); await ownReport(to, `${caseId}-own-positive`);
    } finally { await held.close(); }
  }
  results.push("Both delivered reports remain usable through same-browser A/B switches with four exact correlated order/review terminal outcomes and no foreign report content");
  await authPage.close(); await context.close();
}
