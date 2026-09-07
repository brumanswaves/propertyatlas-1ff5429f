import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

// Only the selected-report email path is under test, not the owner's general
// report list. No production order, credential or provider is used.
const baseUrl = process.env.EASY_ERF_BROWSER_BASE_URL || "http://127.0.0.1:4173";
assert.equal(new URL(baseUrl).hostname, "127.0.0.1");
const artifacts = resolve(process.env.EASY_ERF_BROWSER_ARTIFACTS || "artifacts/founder-fulfillment", "customer-link");
await mkdir(artifacts, { recursive: true });
const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const dirty = Boolean(execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim());
assert.equal(dirty, false, "Customer-link evidence requires a clean tracked tree");
const A = "33333333-3333-4333-8333-333333333333";
const B = "44444444-4444-4444-8444-444444444444";
const LEGACY = "55555555-5555-4555-8555-555555555555";
const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "66666666-6666-4666-8666-666666666666";
const authKeys = ["sb-fixture-auth-token", "sb-easyerf-auth-token", "sb-xiqpfhsdlvwrwhclonsg-auth-token"];
const user = { id: OWNER, email: "fixture-owner@example.invalid", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
function sessionFor(account) {
  return { access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: account.id, exp: 4102444800, role: "authenticated", aud: "authenticated" })}.fixture-only`, refresh_token: "fixture-only", expires_at: 4102444800, expires_in: 36000000, token_type: "bearer", user: account };
}
const rows = [A, B, LEGACY].map((id) => ({
  id, user_id: OWNER, parcel_id: "csg:lpi:c03400140000157000000", provider: "stripe", report_type: "human_review",
  status: "ready", status_enum: "ready", price_cents: 99900, created_at: "2026-01-01T00:00:00Z", completed_at: "2026-01-02T00:00:00Z",
  pdf_storage_path: null, failure_reason: null, review_focus: "property_check", intended_use: null,
  payload: { propertyReference: `Erf 1570 synthetic report ${id}`, livemode: false, privateProbe: `PRIVATE_PAYLOAD_${id}` },
  review_context: `PRIVATE_CONTEXT_${id}`,
  review_content: { bottomLine: `PRIVATE_REPORT_${id}`, known: ["Synthetic evidence"], potential: ["Synthetic potential"], risks: ["Synthetic risk"], unknowns: ["Synthetic unknown"], nextSteps: ["Synthetic next action"] },
}));
const requests = [];
const responses = [];
const checks = [];
const failures = [];
const pageErrors = [];
const settlements = [];
let activeUser = user;
let failRead = false;
let delayed = null;
const requestScope = new WeakMap();
const browser = await chromium.launch({ headless: true, channel: process.env.EASY_ERF_BROWSER_CHANNEL || undefined });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: "block" });
await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
await context.addInitScript(({ session, keys }) => {
  if (location.hostname !== "127.0.0.1") return;
  for (const key of keys) localStorage.setItem(key, JSON.stringify(session));
}, { session: sessionFor(user), keys: authKeys });
await context.route("**/*", async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  try {
    if (url.pathname.startsWith("/auth/v1/")) return json(activeUser);
    if (url.pathname === "/rest/v1/report_orders") {
      assert.equal(request.method(), "GET", "Customer retrieval must not mutate an order");
      const selected = new URL(request.frame().url()).searchParams.get("report")?.trim().toLowerCase();
      assert.ok(selected && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(selected));
      assert.deepEqual(url.searchParams.getAll("id"), [`eq.${selected}`], "No unfiltered/partial report read is permitted");
      assert.equal(url.searchParams.get("user_id"), `eq.${activeUser.id}`);
      assert.equal(url.searchParams.get("provider"), "eq.stripe");
      assert.notEqual(selected, LEGACY, "Protected legacy details must never be requested");
      const columns = url.searchParams.get("select")?.split(",");
      assert.ok(columns?.length && !columns.includes("*"));
      const scope = { id: selected, userId: activeUser.id, columns };
      requestScope.set(request, scope);
      requests.push(scope);
      if (failRead) return json({ message: "Synthetic unavailable read" }, 503);
      const row = rows.find((entry) => entry.id === selected && entry.user_id === activeUser.id);
      const body = row ? [Object.fromEntries(columns.map((key) => [key, structuredClone(row[key] ?? null)]))] : [];
      if (delayed?.id === selected) {
        const pending = delayed;
        pending.started();
        await pending.gate;
        try { await json(body); } finally { pending.finished(); }
        return;
      }
      return json(body);
    }
    if (url.pathname.startsWith("/rest/v1/")) {
      assert.ok(["GET", "HEAD"].includes(request.method()), "Unexpected customer data write/RPC");
      return json(url.pathname.endsWith("/user_roles") ? { role: "admin" } : []);
    }
    if (url.pathname.startsWith("/functions/v1/") || url.pathname.startsWith("/storage/v1/")) {
      assert.fail(`Unexpected provider/function/storage action: ${url.pathname}`);
    }
    if (url.origin === new URL(baseUrl).origin) return route.continue();
    return route.abort();
  } catch (error) {
    failures.push(error.stack || String(error));
    return route.abort();
  }
});
const page = await context.newPage();
page.setDefaultTimeout(10000);
page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("response", (response) => {
  if (new URL(response.url()).pathname !== "/rest/v1/report_orders") return;
  settlements.push((async () => {
    let body;
    try { body = await response.json(); } catch { return; }
    const scope = requestScope.get(response.request());
    assert.ok(scope);
    if (response.ok()) {
      assert.ok(Array.isArray(body));
      assert.ok(body.length <= 1);
      for (const row of body) {
        assert.equal(row.id, scope.id);
        assert.equal(row.user_id, scope.userId);
      }
      const text = JSON.stringify(body);
      for (const id of [A, B, LEGACY].filter((id) => id !== scope.id)) {
        for (const prefix of ["PRIVATE_REPORT_", "PRIVATE_PAYLOAD_", "PRIVATE_CONTEXT_"]) assert.ok(!text.includes(prefix + id));
      }
    }
    responses.push({ ...scope, status: response.status(), actualBodyInspected: true });
  })().catch((error) => failures.push(error.stack || String(error))));
});
const report = () => page.getByRole("region", { name: "Opened finished report" });
async function check(name, operation) { await operation(); checks.push(name); console.log(`PASS ${name}`); }
async function selectInCurrentDocument(id) {
  await page.evaluate((value) => {
    const url = new URL(location.href);
    url.searchParams.set("report", value);
    history.pushState({}, "", url);
    dispatchEvent(new PopStateEvent("popstate"));
  }, id);
}
async function unavailable() { await page.getByText(/This exact report is not available to this account/).waitFor(); }
try {
  await check("email deep link and refresh read only the exact owner report", async () => {
    await page.goto(`${baseUrl}/orders?report=${A}`);
    await report().waitFor();
    assert.ok((await report().innerText()).includes(`PRIVATE_REPORT_${A}`));
    await page.reload();
    await report().waitFor();
    assert.ok(requests.length >= 2);
    assert.ok(requests.every((request) => request.id === A));
    await page.screenshot({ path: resolve(artifacts, "selected-desktop.png") });
  });
  await check("mobile exact-report output fits without horizontal overflow", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: resolve(artifacts, "selected-mobile.png"), fullPage: true });
  });
  await check("invalid, empty and absent selected records never fall back to other reports", async () => {
    for (const id of ["partial", "", "77777777-7777-4777-8777-777777777777"]) {
      const before = requests.length;
      await selectInCurrentDocument(id);
      await unavailable();
      assert.equal(await report().count(), 0);
      if (!id || id === "partial") assert.equal(requests.length, before);
    }
  });
  await check("failed selected read clears prior report without a bulk fallback", async () => {
    await selectInCurrentDocument(A);
    await report().waitFor();
    failRead = true;
    await selectInCurrentDocument(B);
    await unavailable();
    assert.ok(!(await page.locator("body").innerText()).includes(`PRIVATE_REPORT_${A}`));
    failRead = false;
  });
  await check("delayed A cannot overwrite B after in-document report selection", async () => {
    let release, start, finish;
    const started = new Promise((resolve) => { start = resolve; });
    const finished = new Promise((resolve) => { finish = resolve; });
    delayed = { id: A, gate: new Promise((resolve) => { release = resolve; }), started: start, finished: finish };
    await selectInCurrentDocument(A);
    await started;
    await selectInCurrentDocument(B);
    await report().waitFor();
    assert.ok((await report().innerText()).includes(`PRIVATE_REPORT_${B}`));
    release();
    await finished;
    delayed = null;
    assert.ok(!(await report().innerText()).includes(`PRIVATE_REPORT_${A}`));
  });
  await check("account switch cannot display or reload the former owner's report", async () => {
    activeUser = { ...user, id: OTHER, email: "other-fixture@example.invalid" };
    await page.evaluate(({ keys, session }) => {
      for (const key of keys) {
        localStorage.setItem(key, JSON.stringify(session));
        const channel = new BroadcastChannel(key);
        channel.postMessage({ event: "SIGNED_IN", session });
        channel.close();
      }
    }, { keys: authKeys, session: sessionFor(activeUser) });
    await unavailable();
    assert.equal(await report().count(), 0);
    assert.ok(!(await page.locator("body").innerText()).includes(`PRIVATE_REPORT_${B}`));
    assert.ok(requests.some((request) => request.userId === OTHER));
  });
  await Promise.all(settlements);
  assert.deepEqual(failures, []);
  assert.deepEqual(pageErrors, []);
  assert.ok(responses.some((response) => response.id === A && response.status === 200));
  assert.ok(responses.some((response) => response.id === B && response.status === 200));
} catch (error) {
  failures.push(error.stack || String(error));
  await page.screenshot({ path: resolve(artifacts, "failure.png"), fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await context.tracing.stop({ path: resolve(artifacts, "trace.zip") });
  await browser.close();
  await writeFile(resolve(artifacts, "receipt.json"), JSON.stringify({ sha, dirty, checks, failures, pageErrors, requests, responses, productionAccess: false, backend: "isolated fixtures", customerGeneralListTested: false }, null, 2));
}
