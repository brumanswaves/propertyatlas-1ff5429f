import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

// This operates the built app, but never sends a request to a real backend.
const baseUrl = process.env.EASY_ERF_BROWSER_BASE_URL || "http://127.0.0.1:4173";
assert.equal(new URL(baseUrl).hostname, "127.0.0.1");
const artifacts = resolve(process.env.EASY_ERF_BROWSER_ARTIFACTS || "artifacts/founder-fulfillment");
await mkdir(artifacts, { recursive: true });
const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim();
const A = "33333333-3333-4333-8333-333333333333";
const B = "11111111-1111-4111-8111-111111111111";
const LEGACY = "55555555-5555-4555-8555-555555555555";
const parcel = "csg:lpi:c03400140000157000000";
const property = "Erf 1570, synthetic founder fixture";
const email = "founder@example.invalid";
const user = { id: B, email: "fixture-founder@example.invalid", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const session = { access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: B, exp: 4102444800, role: "authenticated", aud: "authenticated" })}.fixture-only`, refresh_token: "fixture-only", expires_at: 4102444800, expires_in: 36000000, token_type: "bearer", user };
let activeUser = user;
const checklistIds = ["parcel_identity", "cadastral_evidence", "ownership_title", "zoning_planning", "property_checks", "market_evidence", "strategy_calculations", "site_potential", "reviewed_report"];
function report(label) {
  return { bottomLine: label, known: ["Fixture known"], potential: ["Fixture potential"], risks: ["Fixture risk"], unknowns: ["Fixture unknown"], nextSteps: ["Fixture next"],
    investigationChecklist: Object.fromEntries(checklistIds.map((id) => [id, "complete"])) };
}
const rows = [
  { id: A, review_content: report("Persisted report A"), payload: { propertyReference: property, customerEmail: email, livemode: false } },
  { id: B, review_content: report("Persisted report B"), payload: { propertyReference: "Erf 1570, different fixture", customerEmail: "other@example.invalid", livemode: false } },
  { id: LEGACY, parcel_id: null, review_focus: null, review_content: null, payload: { propertyReference: "1570", customerEmail: "legacy@example.invalid", livemode: false } },
].map((row) => ({ user_id: B, parcel_id: parcel, report_type: "human_review", provider: "stripe", status: "ready", status_enum: "ready", price_cents: 99900, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", review_content_updated_at: null, review_focus: "property_check", ...row }));
for (const row of rows) {
  row.payload.privateProbe = `PRIVATE_PAYLOAD_${row.id}`;
  row.review_context = `PRIVATE_CONTEXT_${row.id}`;
  if (row.review_content) row.review_content.privateProbe = `PRIVATE_REPORT_${row.id}`;
}
rows[2].review_content = report("PRIVATE_LEGACY_REPORT");
const detailReads = [];
const summaryReads = [];
let detailFailure = null;
let delayedDetail = null;
let queueFailure = false;
function queueMetadata(row) {
  const content = row.review_content;
  const hasText = (value) => typeof value === "string" && Boolean(value.trim());
  return {
    id: row.id, parcel_id: row.parcel_id, report_type: row.report_type,
    status: row.status, status_enum: row.status_enum, provider: row.provider,
    price_cents: row.price_cents, created_at: row.created_at, updated_at: row.updated_at,
    completed_at: row.completed_at ?? null,
    payment_mode: row.payload.livemode === true ? "LIVE" : row.payload.livemode === false ? "TEST" : "UNKNOWN",
    has_property_reference: typeof row.payload.propertyReference === "string" && /[a-z]/i.test(row.payload.propertyReference),
    has_review_focus: hasText(row.review_focus),
    has_report_content: Boolean(content && (hasText(content.bottomLine) ||
      ["known", "potential", "risks", "unknowns", "nextSteps"].some((key) => Array.isArray(content[key]) && content[key].some(hasText)))),
  };
}
const requests = [];
const failures = [];
const checks = [];
const navigationChecks = [];
const networkResponses = [];
const responseSettlements = [];
const selectionAtRequest = new WeakMap();
let notification = { ok: true, emailAccepted: true };
const browser = await chromium.launch({ headless: true, channel: process.env.EASY_ERF_BROWSER_CHANNEL || undefined });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: true, serviceWorkers: "block" });
await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
await context.addInitScript(({ session }) => {
  // Local build uses a reserved .invalid URL; other keys support existing CI builds.
  for (const key of ["sb-fixture-auth-token", "sb-easyerf-auth-token", "sb-xiqpfhsdlvwrwhclonsg-auth-token"]) {
    localStorage.setItem(key, JSON.stringify(session));
  }
}, { session });
await context.route("**/*", async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  if (url.pathname.startsWith("/auth/v1/")) return json(activeUser);
  if (["/rest/v1/rpc/read_order_investigation", "/rest/v1/rpc/read_investigation_review"].includes(url.pathname)) {
    const { p_order_id: id } = request.postDataJSON();
    assert.equal(new URL(request.frame().url()).hash, `#order-${id}`);
    const row = rows.find((entry) => entry.id === id);
    assert.ok(row, "Shared investigation read requires the selected complete order UUID");
    if (url.pathname.endsWith("read_investigation_review")) return json(null);
    return json({ schemaVersion: 1, orderId: id, customerId: row.user_id, parcelId: parcel,
      revision: 1, canWork: true, canApprove: true, assets: [], siteProject: null,
      userData: { erfNumber: "1570", investigationWork: { property_checks: {
        source: "Synthetic recorded source", checkedAt: "2026-01-01T00:00:00.000Z",
        result: activeUser.id === user.id ? row.review_content.bottomLine : "OTHER ACCOUNT ONLY",
        reason: "Synthetic investigation relevance", limitation: "Synthetic remaining check", disposition: "reviewed",
      } } },
    });
  }
  if (url.pathname === "/rest/v1/rpc/list_easy_erf_founder_queue") {
    assert.equal(request.method(), "POST");
    assert.deepEqual(request.postDataJSON(), { p_limit: 100 });
    if (queueFailure) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "fixture queue unavailable" }) });
    const response = rows.map(queueMetadata);
    const serialized = JSON.stringify(response);
    for (const forbidden of ["PRIVATE_", "customerEmail", "review_content", "review_context", "payload", "customerNotification"]) {
      assert.ok(!serialized.includes(forbidden), `Queue response leaked ${forbidden}`);
    }
    summaryReads.push({ count: response.length, keys: Object.keys(response[0]) });
    return json(response);
  }
  if (url.pathname.startsWith("/rest/v1/")) {
    if (request.method() !== "GET" && request.method() !== "HEAD") {
      failures.push(`Unexpected data mutation: ${url.pathname}`);
      return route.abort();
    }
    if (url.pathname.endsWith("/user_roles")) return json({ role: "admin" });
    if (url.pathname.endsWith("/report_orders")) {
      const ids = url.searchParams.getAll("id");
      const match = ids.length === 1 && /^eq\.([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.exec(ids[0]);
      assert.ok(match, "Report details require exactly one full UUID filter, never a bulk read");
      assert.equal(url.searchParams.get("provider"), "eq.stripe");
      for (const key of url.searchParams.keys()) assert.ok(["select", "id", "provider"].includes(key), `Unexpected detail query key ${key}`);
      const id = match[1].toLowerCase();
      const selectedHash = new URL(request.frame().url()).hash;
      selectionAtRequest.set(request, selectedHash);
      assert.equal(selectedHash, `#order-${id}`, "Detailed read must match the deliberately selected order");
      detailReads.push({ id, selectedHash, select: url.searchParams.get("select") });
      if (detailFailure === id) return route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ message: "fixture read denied" }) });
      const row = rows.find((entry) => entry.id === id);
      const columns = url.searchParams.get("select")?.split(",");
      assert.ok(columns?.length && !columns.includes("*"), "Details must use an explicit projection");
      // Honor the actual projection, rather than returning an unrestricted fixture.
      const result = row ? Object.fromEntries(columns.map((key) => [key, structuredClone(row[key] ?? null)])) : null;
      if (result && activeUser.id !== user.id) result.review_content = report("OTHER ACCOUNT ONLY");
      if (delayedDetail?.id === id) {
        const pending = delayedDetail;
        pending.started();
        await pending.gate;
        try { await json(request.headers().accept?.includes("object+json") ? result : result ? [result] : []); }
        finally { pending.finished(); }
        return;
      }
      return json(request.headers().accept?.includes("object+json") ? result : result ? [result] : []);
    }
    return json(request.headers().accept?.includes("object+json") ? null : []);
  }
  if (url.pathname.startsWith("/functions/v1/")) {
    const body = request.postDataJSON();
    requests.push({ endpoint: url.pathname, ...body });
    const row = rows.find((entry) => entry.id === body.orderId);
    assert.ok(row, "Every write must target a complete fixture UUID");
    if (url.pathname.endsWith("/easy-erf-founder-fulfillment")) {
      row.status = row.status_enum = body.action === "mark_ready" ? "ready" : body.action === "mark_failed" ? "failed" : "processing";
      row.updated_at = new Date(Date.now() + requests.length).toISOString();
      return json({ ok: true, notification });
    }
    if (url.pathname.endsWith("/easy-erf-founder-review-content")) {
      if (body.action === "save_report") Object.assign(row.review_content, body.content);
      if (body.action === "save_checklist") row.review_content.investigationChecklist = body.checklist;
      row.review_content_updated_at = new Date(Date.now() + requests.length).toISOString();
      return json({ ok: true });
    }
    failures.push(`Unexpected fixture function: ${url.pathname}`);
    return route.abort();
  }
  if (url.origin === new URL(baseUrl).origin) return route.continue();
  // Fonts, telemetry, imagery and all other external traffic are blocked.
  return route.abort();
});
const page = await context.newPage();
page.on("pageerror", (error) => failures.push(error.message));
page.on("response", (response) => {
  const path = new URL(response.url()).pathname;
  if (!["/rest/v1/rpc/list_easy_erf_founder_queue", "/rest/v1/report_orders"].includes(path)) return;
  responseSettlements.push((async () => {
    let body;
    try { body = await response.json(); } catch { return; } // Aborted reads deliver no body.
    const text = JSON.stringify(body);
    const id = path.endsWith("/report_orders") ? new URL(response.url()).searchParams.get("id")?.slice(3) : null;
    if (response.ok()) {
      if (!id) {
        assert.ok(!text.includes("PRIVATE_"), "Actual queue response contained private fixture content");
        for (const row of body) assert.deepEqual(Object.keys(row).sort(), Object.keys(queueMetadata(rows[0])).sort());
      } else {
        assert.equal(selectionAtRequest.get(response.request()), `#order-${id}`);
        const result = Array.isArray(body) ? body[0] : body;
        if (result) assert.equal(result.id, id);
        for (const other of rows.filter((row) => row.id !== id)) {
          for (const prefix of ["PRIVATE_PAYLOAD_", "PRIVATE_CONTEXT_", "PRIVATE_REPORT_"]) {
            assert.ok(!text.includes(prefix + other.id), "Actual detail response leaked a nonselected private sentinel");
          }
        }
        if (id !== LEGACY) assert.ok(!text.includes("PRIVATE_LEGACY_REPORT"));
      }
    }
    networkResponses.push({ path, status: response.status(), id, received: true, privateBoundaryPassed: true });
  })().catch((error) => { failures.push(error.stack || String(error)); }));
});
async function broadcastAuth(nextSession) {
  activeUser = nextSession?.user ?? null;
  await page.evaluate((value) => {
    for (const key of ["sb-fixture-auth-token", "sb-easyerf-auth-token", "sb-xiqpfhsdlvwrwhclonsg-auth-token"]) {
      if (value) localStorage.setItem(key, JSON.stringify(value));
      else localStorage.removeItem(key);
      const channel = new BroadcastChannel(key);
      channel.postMessage({ event: value ? "SIGNED_IN" : "SIGNED_OUT", session: value });
      channel.close();
    }
  }, nextSession);
}
async function check(name, fn) { await fn(); checks.push(name); console.log(`PASS ${name}`); }
const identity = () => page.locator('header[aria-label="Selected order identity"]');
const workbench = () => page.getByRole("region", { name: "Exact order workbench" });
async function sourceEditor() {
  const summary = page.getByText("Record checks, unavailable evidence and limitations", { exact: true });
  await summary.waitFor();
  if (!(await summary.locator("..").evaluate((details) => details.open))) await summary.click();
  return page.getByRole("textbox", { name: "Actual result and findings", exact: true });
}
async function scrollPageBy(amount) {
  // A viewport resize can leave the pointer outside the new window. Use the
  // page gutter, not a textarea's independent scrolling surface.
  await page.mouse.move(4, page.viewportSize().height / 2);
  await page.mouse.wheel(0, amount);
}
async function open(id) {
  await page.goto(`${baseUrl}/admin/fulfillment#order-${id}`);
  await workbench().waitFor();
  assert.equal(await workbench().getAttribute("data-order-id"), id);
}
async function keyboardReach(locator) {
  // Prove the control participates in the real tab order, without JS focus/click.
  for (let step = 0; step < 80; step++) {
    if (await locator.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  assert.fail("Navigation control was not reachable by keyboard");
}
async function reopen(id) {
  await page.getByRole("button", { name: "Reopen this exact report", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.waitFor();
  const text = await dialog.innerText();
  for (const value of [id, id === A ? property : "different fixture", id === A ? email : "other@example.invalid", parcel, "TEST", "return to investigation status"]) assert.ok(text.includes(value), value);
  await dialog.getByRole("button", { name: "Reopen this exact report", exact: true }).click();
  await page.getByRole("button", { name: "Mark this exact report ready", exact: true }).waitFor();
}
try {
  await page.goto(`${baseUrl}/admin/fulfillment`);
  await page.getByRole("heading", { name: "Property investigation queue" }).waitFor();
  await page.getByRole("button", { name: "Open exact order" }).first().waitFor();
  await check("compact read-only queue, including legacy cards", async () => {
    await page.getByText(/Legacy-format orders, excluded/).click();
    assert.equal(await page.locator("main input, main textarea, main select").count(), 0);
    const buttons = await page.locator("main button").allTextContents();
    assert.ok(buttons.every((text) => text.trim().startsWith("Open exact order")));
    assert.equal(requests.length, 0);
    assert.equal(detailReads.length, 0, "Opening or expanding the queue must not retrieve any report body");
    assert.ok(summaryReads.length > 0);
    assert.ok(!(await page.locator("main").innerText()).includes("PRIVATE_"));
    await page.screenshot({ path: resolve(artifacts, "queue-desktop.png"), fullPage: true });
    await page.locator("article").filter({ hasText: A }).getByRole("button", { name: "Open exact order" }).click();
  });
  await check("exact selection and pinned identity; no other order controls", async () => {
    await workbench().waitFor();
    assert.equal(await workbench().count(), 1);
    const text = await identity().innerText();
    for (const value of [A, property, email, parcel, "TEST"]) assert.ok(text.includes(value), value);
    assert.ok(!(await page.locator("main").innerText()).includes(LEGACY));
    assert.ok(!(await page.locator("main").innerText()).includes(B));
    await page.screenshot({ path: resolve(artifacts, "selected-desktop.png"), fullPage: true });
  });
  await check("refresh keeps exact selected order", async () => {
    await page.reload(); await workbench().waitFor();
    assert.equal(await workbench().getAttribute("data-order-id"), A);
  });
  for (const scenario of [
    { width: 1440, height: 1000, input: "mouse", scroll: 15 },
    { width: 484, height: 828, input: "mouse", scroll: 15 },
    { width: 390, height: 844, input: "touch", scroll: 40 },
    { width: 320, height: 740, input: "keyboard", scroll: 15 },
    { width: 390, height: 844, input: "touch", scroll: 1600 },
    { width: 1920, height: 975, input: "mouse", scroll: 975 },
    { width: 1440, height: 1000, input: "mouse", scroll: 1600 },
    { width: 320, height: 740, input: "keyboard", scroll: 1600 },
  ]) {
    await check(`refresh/scroll return and isolated reselection: ${scenario.width}px ${scenario.input} ${scenario.scroll}px`, async () => {
      const name = `navigation-${scenario.width}-${scenario.input}-${scenario.scroll}`;
      rows[0].status = rows[0].status_enum = "processing";
      rows[1].status = rows[1].status_enum = "processing";
      await page.setViewportSize({ width: scenario.width, height: scenario.height });
      await page.goto(`${baseUrl}/admin/fulfillment`);
      await page.locator("article").filter({ hasText: A }).getByRole("button", { name: "Open exact order" }).click();
      await workbench().waitFor();
      await page.waitForFunction(() => scrollY === 0);
      await scrollPageBy(scenario.scroll);
      await page.waitForFunction((amount) => scrollY >= amount, scenario.scroll);
      await page.reload();
      await workbench().waitFor();
      assert.equal(await workbench().getAttribute("data-order-id"), A);
      const restoredScrollY = await page.evaluate(() => scrollY);
      // Also exercise a user scroll after refresh: hydration can reset native
      // restoration, which must not make a formerly safe control interceptable.
      await page.keyboard.press("Control+Home");
      await page.waitForFunction(() => scrollY === 0);
      await scrollPageBy(scenario.scroll);
      await page.waitForFunction((amount) => scrollY >= amount, scenario.scroll);
      if (scenario.scroll > 500) {
        const pinned = await identity().boundingBox();
        assert.ok(pinned && pinned.y >= 0 && pinned.y + pinned.height < scenario.height);
        await page.screenshot({ path: resolve(artifacts, `${name}-pinned.png`) });
      }
      await (await sourceEditor()).fill("UNSAVED A ONLY");
      await page.getByLabel("Recorded outcome", { exact: true }).selectOption("unavailable");
      await page.getByText("Record an investigation failure", { exact: true }).click();
      await page.getByRole("textbox", { name: "Failure reason for this exact order" }).fill("A-only failure");
      await page.getByText("Optional PDF delivery", { exact: true }).click();
      await page.getByLabel("Optional report PDF for this order").setInputFiles({ name: "A-only.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-fixture") });
      await page.getByRole("heading", { name: property, exact: true }).click();
      await page.keyboard.press("Control+Home");
      await page.waitForFunction(() => scrollY === 0);
      await scrollPageBy(scenario.scroll);
      await page.waitForFunction((amount) => scrollY >= amount, scenario.scroll);
      const back = page.getByRole("button", { name: "Back to read-only queue", exact: true });
      // Measure before focus/click: locator auto-scroll must not hide an off-screen Back.
      const atRequestedScroll = await back.boundingBox();
      assert.ok(atRequestedScroll && atRequestedScroll.y >= 0 &&
        atRequestedScroll.y + atRequestedScroll.height <= scenario.height,
      "Back must be fully visible at the actual requested scroll position");
      if (scenario.input === "keyboard") await keyboardReach(back);
      // Tab navigation may scroll form fields. Return to the same depth while
      // retaining keyboard focus, then exercise Enter without a locator click.
      const focusedScroll = await page.evaluate(() => scrollY);
      await scrollPageBy(scenario.scroll - focusedScroll);
      await page.waitForFunction((amount) => Math.abs(scrollY - amount) <= 1, scenario.scroll);
      const box = await back.boundingBox();
      assert.ok(box);
      const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const before = await back.evaluate((button, { x, y }) => {
        const target = document.elementFromPoint(x, y);
        const nav = document.querySelector('nav[aria-label="Founder Operations"]');
        return { hash: location.hash, scrollY, target: target?.outerHTML, receivesPointer: button.contains(target), navBounds: nav?.getBoundingClientRect().toJSON(), backBounds: button.getBoundingClientRect().toJSON() };
      }, point);
      navigationChecks.push({ scenario, restoredScrollY, before });
      await page.screenshot({ path: resolve(artifacts, `${name}-before.png`) });
      assert.ok(before.receivesPointer, "Back button must receive the real pointer, not the operations bar");
      assert.ok(before.navBounds.bottom <= before.backBounds.top, "Operations navigation must not overlap Back");
      assert.ok(before.backBounds.top >= 0 && before.backBounds.bottom <= scenario.height);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (scenario.input === "touch") await page.touchscreen.tap(point.x, point.y);
      else if (scenario.input === "keyboard") await page.keyboard.press("Enter");
      else await page.mouse.click(point.x, point.y);
      await page.getByRole("heading", { name: "Property investigation queue", exact: true }).waitFor({ timeout: 5000 });
      assert.equal(new URL(page.url()).hash, "");
      assert.equal(await workbench().count(), 0);
      assert.equal(await identity().count(), 0);
      assert.equal(await page.locator("main input, main textarea, main select").count(), 0);
      await page.screenshot({ path: resolve(artifacts, `${name}-queue.png`) });
      await page.locator("article").filter({ hasText: B }).getByRole("button", { name: "Open exact order" }).click();
      await workbench().waitFor();
      assert.equal(await workbench().getAttribute("data-order-id"), B);
      assert.equal(await (await sourceEditor()).inputValue(), "Persisted report B");
      assert.equal(await page.getByLabel("Recorded outcome", { exact: true }).inputValue(), "reviewed");
      await page.getByText("Record an investigation failure", { exact: true }).click();
      assert.equal(await page.getByRole("textbox", { name: "Failure reason for this exact order" }).inputValue(), "");
      await page.getByText("Optional PDF delivery", { exact: true }).click();
      assert.equal(await page.getByLabel("Optional report PDF for this order").inputValue(), "");
      assert.equal(await workbench().getByRole("status").count(), 0);
      assert.equal(requests.length, 0, "Navigation must not submit order or notification requests");
    });
  }
  await check("shared operations navigation remains usable on Users and Entitlements", async () => {
    await page.keyboard.press("Control+Home");
    await page.waitForFunction(() => scrollY === 0);
    const operations = page.getByRole("navigation", { name: "Founder Operations", exact: true });
    await operations.getByRole("link", { name: "Users", exact: true }).click();
    await page.getByRole("heading", { name: "User support", exact: true }).waitFor();
    await keyboardReach(operations.getByRole("link", { name: "Entitlements", exact: true }));
    await page.keyboard.press("Enter");
    await page.getByRole("heading", { name: "Entitlements", exact: true }).waitFor();
    const nav = await operations.boundingBox();
    const heading = await page.getByRole("heading", { name: "Entitlements", exact: true }).boundingBox();
    assert.ok(nav && heading && nav.y + nav.height <= heading.y);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: resolve(artifacts, "operations-entitlements-mobile.png") });
    assert.equal(requests.length, 0);
  });
  await check("delayed nonselected details are discarded and failures are non-actionable", async () => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${baseUrl}/admin/fulfillment`);
    await page.locator("article").filter({ hasText: A }).waitFor();
    let start;
    let release;
    let finish;
    const started = new Promise((resolve) => { start = resolve; });
    const finished = new Promise((resolve) => { finish = resolve; });
    delayedDetail = { id: A, started: start, finished: finish, gate: new Promise((resolve) => { release = resolve; }) };
    await page.locator("article").filter({ hasText: A }).getByRole("button", { name: "Open exact order" }).click();
    await started;
    // Address-bar hash navigation exercises an in-flight selection change. This
    // is not substituted for the mouse/touch/keyboard Back tests above.
    await page.evaluate((id) => { location.hash = `order-${id}`; }, B);
    await workbench().waitFor();
    assert.equal(await workbench().getAttribute("data-order-id"), B);
    assert.equal(await (await sourceEditor()).inputValue(), "Persisted report B");
    release();
    await finished;
    delayedDetail = null;
    assert.equal(await workbench().getAttribute("data-order-id"), B);
    assert.equal(await (await sourceEditor()).inputValue(), "Persisted report B");
    await page.getByRole("button", { name: "Back to read-only queue", exact: true }).click();
    await page.getByRole("heading", { name: "Property investigation queue", exact: true }).waitFor();
    assert.equal(await workbench().count(), 0);
    detailFailure = A;
    await page.locator("article").filter({ hasText: A }).getByRole("button", { name: "Open exact order" }).click();
    await page.getByRole("heading", { name: "The requested order was not found", exact: true }).waitFor();
    assert.equal(await workbench().count(), 0);
    assert.equal(await page.locator("main input, main textarea, main select").count(), 0);
    await page.getByRole("button", { name: "Return to queue", exact: true }).click();
    await page.getByRole("heading", { name: "Property investigation queue", exact: true }).waitFor();
    detailFailure = null;
    assert.equal(requests.length, 0, "Detail navigation and read failures must submit zero mutations");
    await page.screenshot({ path: resolve(artifacts, "queue-after-private-read-regression.png") });
  });
  await check("account change clears loaded detail before another account can receive it", async () => {
    await open(A);
    let release;
    let start;
    let finish;
    const started = new Promise((resolve) => { start = resolve; });
    const finished = new Promise((resolve) => { finish = resolve; });
    delayedDetail = { id: A, started: start, finished: finish, gate: new Promise((resolve) => { release = resolve; }) };
    const nextUser = { ...user, id: "66666666-6666-4666-8666-666666666666" };
    await broadcastAuth({ ...session, user: nextUser, access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: nextUser.id, exp: 4102444800, role: "authenticated", aud: "authenticated" })}.fixture-only` });
    await started;
    assert.equal(await workbench().count(), 0, "Old account detail must clear while the new account request is pending");
    assert.ok(!(await page.locator("main").innerText()).includes("Persisted report A"));
    release();
    await finished;
    delayedDetail = null;
    await workbench().waitFor();
    assert.equal(await (await sourceEditor()).inputValue(), "OTHER ACCOUNT ONLY");
    assert.equal(requests.length, 0);
    activeUser = user;
    await page.reload();
    await workbench().waitFor();
    assert.equal(await (await sourceEditor()).inputValue(), "Persisted report A");
  });
  await check("exit and sign-out discard pending private details", async () => {
    for (const exit of ["queue", "sign-out"]) {
      activeUser = user;
      await page.goto(`${baseUrl}/admin/fulfillment`);
      await page.locator("article").filter({ hasText: A }).waitFor();
      let release;
      let start;
      let finish;
      const started = new Promise((resolve) => { start = resolve; });
      const finished = new Promise((resolve) => { finish = resolve; });
      delayedDetail = { id: A, started: start, finished: finish, gate: new Promise((resolve) => { release = resolve; }) };
      await page.locator("article").filter({ hasText: A }).getByRole("button", { name: "Open exact order" }).click();
      await started;
      const count = detailReads.length;
      if (exit === "queue") {
        await page.evaluate(() => { location.hash = ""; });
        await page.getByRole("heading", { name: "Property investigation queue", exact: true }).waitFor();
      } else {
        await broadcastAuth(null);
        await page.waitForURL(/\/auth/);
      }
      release();
      await finished;
      delayedDetail = null;
      assert.equal(await workbench().count(), 0);
      assert.equal(detailReads.length, count);
      assert.ok(!(await page.locator("body").innerText()).includes("Persisted report A"));
      assert.equal(requests.length, 0);
    }
    activeUser = user;
  });
  await check("metadata request failure never falls back to private bulk reads", async () => {
    const count = detailReads.length;
    queueFailure = true;
    await page.goto(`${baseUrl}/admin/fulfillment`);
    await page.getByText("Could not load the done-for-you investigation queue.", { exact: true }).waitFor();
    assert.equal(detailReads.length, count);
    assert.equal(await workbench().count(), 0);
    assert.equal(await page.locator("article").count(), 0);
    assert.equal(requests.length, 0);
    queueFailure = false;
    await page.getByRole("button", { name: "Retry queue", exact: true }).click();
    await page.locator("article").filter({ hasText: A }).waitFor();
    assert.equal(detailReads.length, count, "Queue retry must not read a private report");
    assert.equal(requests.length, 0);
  });
  await Promise.all(responseSettlements);
  assert.ok(networkResponses.some((entry) => !entry.id && entry.status === 200));
  assert.ok(networkResponses.some((entry) => entry.id === A && entry.status === 200));
  assert.ok(networkResponses.some((entry) => entry.id === B && entry.status === 200));
  assert.ok(!detailReads.some((entry) => entry.id === LEGACY));
  assert.deepEqual(failures, []);
  rows[0].status = rows[0].status_enum = "ready";
  rows[1].status = rows[1].status_enum = "ready";
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(A);
  await check("accessible exact-order reopen modal and status change preserve selection", async () => {
    await reopen(A);
    assert.equal(await workbench().getAttribute("data-order-id"), A);
    assert.equal(requests.at(-1).orderId, A);
    assert.equal(requests.at(-1).action, "reopen_review");
  });
  await check("report, checklist, failure, file and modal state cannot leak between orders", async () => {
    await (await sourceEditor()).fill("UNSAVED A ONLY");
    await page.getByLabel("Recorded outcome", { exact: true }).selectOption("unavailable");
    await page.getByText("Record an investigation failure", { exact: true }).click();
    await page.getByRole("textbox", { name: "Failure reason for this exact order" }).fill("A-only failure");
    await page.getByText("Optional PDF delivery", { exact: true }).click();
    await page.getByLabel("Optional report PDF for this order").setInputFiles({ name: "A-only.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-fixture") });
    // A hash change exercises reconciliation without remounting the whole page.
    // B is still ready in persisted fixture state; selection must fetch it now.
    await page.getByRole("button", { name: /Back to read-only queue/ }).click();
    await page.locator("article").filter({ hasText: B }).getByRole("button", { name: "Open exact order" }).click();
    // A fresh exact-order read finds B ready; reopening must preserve B.
    await reopen(B);
    assert.equal(await (await sourceEditor()).inputValue(), "Persisted report B");
    assert.equal(await page.getByLabel("Recorded outcome", { exact: true }).inputValue(), "reviewed");
    await page.getByText("Record an investigation failure", { exact: true }).click();
    assert.equal(await page.getByRole("textbox", { name: "Failure reason for this exact order" }).inputValue(), "");
    await page.getByText("Optional PDF delivery", { exact: true }).click();
    assert.equal(await page.getByLabel("Optional report PDF for this order").inputValue(), "");
    await page.evaluate((id) => { location.hash = `order-${id}`; }, A);
    await page.waitForFunction((id) => document.querySelector('[data-order-id]')?.getAttribute("data-order-id") === id, A);
    assert.equal(await (await sourceEditor()).inputValue(), "Persisted report A");
    assert.equal(await page.getByLabel("Recorded outcome", { exact: true }).inputValue(), "reviewed");
  });
  await check("mobile pinned identity and primary action fit without horizontal overflow", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Mark this exact report ready" }).scrollIntoViewIfNeeded();
    const box = await identity().boundingBox();
    assert.ok(box && box.y >= 0 && box.y + box.height < 600);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: resolve(artifacts, "selected-mobile.png"), fullPage: true });
    await page.screenshot({ path: resolve(artifacts, "selected-mobile-viewport.png") });
  });
  await check("mark-ready outcomes distinguish acceptance, failure, disabled and already-sent", async () => {
    for (const [response, expected] of [
      [{ ok: true, emailAccepted: true }, "customer email accepted"],
      [{ ok: false, code: "EMAIL_SEND_FAILED" }, "customer email failed"],
      [{ ok: false, code: "EMAIL_NOT_CONFIGURED" }, "service is disabled"],
      [{ ok: true, alreadySent: true, receipt: { status: "sent" } }, "email already recorded"],
    ]) {
      notification = response;
      if (rows[0].status === "ready") await reopen(A);
      await page.getByRole("button", { name: "Mark this exact report ready", exact: true }).click();
      await workbench().getByRole("status").filter({ hasText: expected }).waitFor();
      assert.equal(await workbench().getAttribute("data-order-id"), A);
      assert.equal(requests.at(-1).orderId, A);
    }
    await page.screenshot({ path: resolve(artifacts, "delivery-result.png"), fullPage: true });
  });
  await check("legacy is deliberate; unknown/partial selection exposes no other workbench", async () => {
    await open(LEGACY);
    assert.ok((await workbench().innerText()).includes("legacy-format order"));
    await page.goto(`${baseUrl}/admin/fulfillment#order-22222222-2222-4222-8222-222222222222`);
    await page.getByRole("heading", { name: "The requested order was not found" }).waitFor();
    assert.equal(await workbench().count(), 0);
    await page.goto(`${baseUrl}/admin/fulfillment#order-384be2fe`);
    await page.getByRole("heading", { name: "Property investigation queue" }).waitFor();
    assert.equal(await workbench().count(), 0);
  });
  await check("incomplete saved content blocks both delivery controls", async () => {
    rows[1].status = rows[1].status_enum = "processing";
    rows[1].review_content.bottomLine = "";
    await open(B);
    // The fixture changed persisted content out of band; reload like the operator
    // would, rather than expecting a hash-only navigation to refetch the queue.
    await page.reload();
    await workbench().waitFor();
    assert.ok(await page.getByRole("button", { name: "Mark this exact report ready" }).isDisabled());
    await page.getByText("Optional PDF delivery", { exact: true }).click();
    assert.ok(await page.getByRole("button", { name: "Upload PDF and deliver this exact report" }).isDisabled());
    assert.ok((await workbench().innerText()).includes("Delivery blocked:"));
    await page.getByRole("button", { name: /Back to read-only queue/ }).click();
    assert.equal(await workbench().count(), 0);
    assert.equal(await page.locator("main input, main textarea, main select").count(), 0);
  });
  await Promise.all(responseSettlements);
  assert.deepEqual(failures, []);
  console.log(`VERIFIED built-browser fixture acceptance: ${checks.length} groups; candidate ${sha}; dirty=${Boolean(dirty)}; external backend requests: 0`);
} catch (error) {
  failures.push(error.stack || String(error));
  await page.screenshot({ path: resolve(artifacts, "failure.png"), fullPage: true });
  throw error;
} finally {
  await context.tracing.stop({ path: resolve(artifacts, "trace.zip") });
  await writeFile(resolve(artifacts, "receipt.json"), JSON.stringify({ sha, dirty: Boolean(dirty), checks, navigationChecks, summaryReads, detailReads, networkResponses, failures, mockedRequests: requests, productionAccess: false }, null, 2));
  await browser.close();
}
