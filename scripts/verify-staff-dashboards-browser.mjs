import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

// Built application, synthetic accounts and intercepted backend. Real permission
// enforcement is separately exercised by verify-shared-investigation-browser.
const base = process.env.EASY_ERF_BROWSER_BASE_URL || "http://127.0.0.1:4174";
assert.equal(new URL(base).hostname, "127.0.0.1");
const artifacts = resolve(process.env.EASY_ERF_BROWSER_ARTIFACTS || "artifacts/founder-fulfillment", "staff-dashboards");
await mkdir(artifacts, { recursive: true });
const A = "33333333-3333-4333-8333-333333333333";
const B = "44444444-4444-4444-8444-444444444444";
const parcel = "csg:lpi:c03400140000157000000";
const keys = ["sb-127-auth-token", "sb-fixture-auth-token", "sb-easyerf-auth-token", "sb-xiqpfhsdlvwrwhclonsg-auth-token"];
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
function sessionFor(actor) {
  const id = actor === "founder" ? "11111111-1111-4111-8111-111111111111"
    : actor === "customer" ? "22222222-2222-4222-8222-222222222222" : "77777777-7777-4777-8777-777777777777";
  const user = { id, email: `${actor}@example.invalid`, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
  return { access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: id, exp: 4102444800, aud: "authenticated", role: "authenticated" })}.fixture-only`,
    refresh_token: "fixture-only", expires_at: 4102444800, expires_in: 36000000, token_type: "bearer", user };
}
const metadata = {
  id: A, parcel_id: parcel, report_type: "human_review", status: "processing", status_enum: "fulfilling",
  provider: "stripe", price_cents: 99900, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
  completed_at: null, payment_mode: "TEST", has_property_reference: true, has_review_focus: true, has_report_content: true,
};
const detail = { ...metadata, user_id: B, review_focus: "property_check", review_content: null,
  payload: { orderKind: "easy_erf_investigation", livemode: false, propertyReference: "Erf 1570 synthetic staff work" } };
const checks = [], network = [], errors = [];
const browser = await chromium.launch({ headless: true, channel: process.env.EASY_ERF_BROWSER_CHANNEL || undefined });
async function fixture(actor, width) {
  const state = { actor, empty: false, suspended: false, delayed: null, renewal: null, roleRevoked: false };
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
  await context.addInitScript(({ keys, session }) => {
    for (const key of keys) localStorage.setItem(key, JSON.stringify(session));
  }, { keys, session: sessionFor(actor) });
  await context.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    const json = (value, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });
    if (url.pathname.startsWith("/auth/v1/")) {
      if (url.pathname.endsWith("/user")) {
        if (state.renewal && request.headers().authorization === `Bearer ${state.renewal.session.access_token}`) {
          state.renewal.started();
          await state.renewal.gate;
        }
        return state.suspended ? json({ code: "user_banned" }, 403) : json(sessionFor(state.actor).user);
      }
      return json({ error: "Invalid or expired session" }, 401);
    }
    if (url.pathname === "/rest/v1/user_roles") return json(state.roleRevoked ? [] : state.actor === "founder" ? [{ role: "admin" }] : state.actor === "worker" ? [{ role: "moderator" }] : []);
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      const name = url.pathname.split("/").at(-1), body = request.postDataJSON();
      const allowed = ["list_easy_erf_founder_queue", "list_assigned_investigation_queue", "read_assigned_investigation_header", "read_order_investigation", "read_investigation_review"];
      assert(allowed.includes(name), `Unexpected RPC: ${name}`);
      network.push({ actor: state.actor, name, order: body.p_order_id ?? null,
        renewedCredential: Boolean(state.renewal && request.headers().authorization === `Bearer ${state.renewal.session.access_token}`) });
      if (state.actor === "customer" || state.suspended) return json({ code: "42501" }, 403);
      if (name === "list_easy_erf_founder_queue") { assert.equal(state.actor, "founder"); return json([metadata]); }
      if (name === "list_assigned_investigation_queue") return json(state.empty ? [] : [metadata]);
      assert.equal(new URL(request.frame().url()).hash, `#order-${body.p_order_id}`);
      if (body.p_order_id !== A || state.empty) return json({ code: "42501" }, 403);
      if (name === "read_assigned_investigation_header") {
        if (state.delayed) { const delayed = state.delayed; delayed.started(); await delayed.gate; }
        return json(detail);
      }
      if (name === "read_investigation_review") return json(null);
      return json({ schemaVersion: 1, orderId: A, customerId: B, parcelId: parcel, revision: 17,
        canWork: true, canApprove: state.actor === "founder", assets: [], siteProject: null, userData: {
          normalizedParcel: { id: parcel, source: "manual", sourceLabel: "Independent synthetic fixture",
            erfNumber: "1570", portion: "0", knownFields: [], missingFields: [] },
        } });
    }
    if (url.pathname === "/api/admin/support") {
      assert.equal(request.method(), "GET");
      assert.equal(state.actor, "founder");
      return json({ success: true, investigators: [], users: [] });
    }
    if (url.pathname.startsWith("/rest/v1/")) {
      assert(["GET", "HEAD"].includes(request.method()), "Dashboard visit attempted a write");
      if (url.pathname.endsWith("/report_orders") && url.searchParams.has("id")) {
        assert.equal(url.searchParams.get("id"), `eq.${A}`);
        return json(detail);
      }
      return json(request.headers().accept?.includes("object+json") ? null : []);
    }
    if (url.origin === base && !url.pathname.startsWith("/api/")) return route.continue();
    // No service request can leave the fixture. Unknown writes fail the test.
    if (!["GET", "HEAD"].includes(request.method())) errors.push(`Unexpected request: ${request.method()} ${url.pathname}`);
    return route.abort();
  });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  return { page, context, state };
}
async function visibleNav(page, width, label) {
  if (width < 1280) await page.getByRole("button", { name: "Open menu", exact: true }).click();
  const link = page.locator("header").getByRole("link", { name: label, exact: true });
  await link.waitFor({ state: "visible" });
  await page.screenshot({ path: resolve(artifacts, `nav-${label.replaceAll(" ", "-").toLowerCase()}-${width}.png`) });
  return link;
}
async function screenshot(page, name) {
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Horizontal overflow");
  await page.screenshot({ path: resolve(artifacts, name) });
}
try {
  // A new token (not a focus event) must retain the real, unsaved report editor.
  const renewal = await fixture("founder", 1440);
  await renewal.page.goto(`${base}/investigator#order-${A}`);
  const renewalWorkspace = renewal.page.getByRole("region", { name: "Customer investigation workspace", exact: true, includeHidden: true });
  await renewalWorkspace.getByRole("navigation", { name: "Customer investigation steps" }).getByRole("button", { name: /Review report/ }).click();
  const editor = renewal.page.getByRole("form", { name: "Human-only investigation review", includeHidden: true });
  const draft = "Unsaved synthetic human-only findings must survive session renewal.";
  await editor.getByLabel("Bottom line", { exact: true }).fill(draft);
  const selectedStep = await renewalWorkspace.locator('[aria-current="step"]').innerText();
  let finishRenewal, renewalStarted;
  const renewing = new Promise(done => { renewalStarted = done; });
  const renewedSession = { ...sessionFor("founder"), expires_at: 4102448400 };
  renewedSession.access_token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: renewedSession.user.id, exp: renewedSession.expires_at, aud: "authenticated", role: "authenticated", jti: "synthetic-renewal" })}.fixture-only`;
  renewal.state.renewal = { session: renewedSession, gate: new Promise(done => { finishRenewal = done; }), started: renewalStarted };
  await renewal.page.evaluate(({ keys, session }) => {
    for (const key of keys) {
      localStorage.setItem(key, JSON.stringify(session));
      const channel = new BroadcastChannel(key);
      channel.postMessage({ event: "TOKEN_REFRESHED", session }); channel.close();
    }
  }, { keys, session: renewedSession });
  await renewing;
  // Keep the request unresolved long enough to observe the intermediate render.
  await renewal.page.waitForTimeout(100);
  assert.equal(await editor.count(), 1, "Same-user renewal unmounted the unsaved human-only editor");
  assert.equal(await editor.locator("textarea").first().inputValue(), draft);
  assert.equal(await editor.isVisible(), false, "Unvalidated session must not expose actionable work");
  assert.equal(await renewal.page.locator("[data-staff-work]").getAttribute("inert"), "");
  await screenshot(renewal.page, "renewal-validation-pending.png");
  const requestsBeforeResume = network.length;
  await editor.evaluate(form => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  await renewalWorkspace.locator("button").filter({ hasText: "Generate investigation brief" }).evaluate(button => button.click());
  await renewal.page.waitForTimeout(150);
  assert.equal(network.length, requestsBeforeResume, "Pending renewal initiated a work request");
  finishRenewal();
  await editor.waitFor({ state: "visible" });
  assert.equal(await editor.locator("textarea").first().inputValue(), draft);
  assert.equal(await renewalWorkspace.locator('[aria-current="step"]').innerText(), selectedStep);
  assert.equal(new URL(renewal.page.url()).hash, `#order-${A}`);
  await editor.locator("textarea").first().scrollIntoViewIfNeeded();
  await screenshot(renewal.page, "renewed-human-only-draft.png");
  const renewedRead = renewal.page.waitForResponse(response => new URL(response.url()).pathname.endsWith("/read_order_investigation"));
  await renewalWorkspace.getByRole("button", { name: "Reload saved evidence", exact: true }).click();
  await renewedRead;
  assert(network.slice(requestsBeforeResume).some(entry => entry.name === "read_order_investigation" && entry.renewedCredential));
  await renewal.context.close();
  checks.push("Different-token same-user renewal preserves real human-only unsaved text, selected order and step; pending work is inaccessible; next evidence read uses renewed credential; no save/approval/email/provider request");
  for (const failure of ["rejected", "revoked", "logout"]) {
    const denied = await fixture("founder", 1440);
    await denied.page.goto(`${base}/investigator#order-${A}`);
    await denied.page.getByRole("navigation", { name: "Customer investigation steps" }).getByRole("button", { name: /Review report/ }).click();
    await denied.page.getByRole("form", { name: "Human-only investigation review" }).getByLabel("Bottom line", { exact: true }).fill(draft);
    denied.state.suspended = failure === "rejected";
    denied.state.roleRevoked = failure === "revoked";
    await denied.page.evaluate(({ keys, session, failure }) => {
      for (const key of keys) {
        if (failure === "logout") localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify(session));
        const channel = new BroadcastChannel(key);
        channel.postMessage({ event: failure === "logout" ? "SIGNED_OUT" : "TOKEN_REFRESHED", session: failure === "logout" ? null : session });
        channel.close();
      }
    }, { keys, session: renewedSession, failure });
    if (failure === "logout") await denied.page.waitForURL(url => url.pathname === "/auth");
    else await denied.page.getByRole("heading", { name: failure === "rejected" ? "Staff access could not be verified" : "Investigator access required", exact: true }).waitFor();
    assert.equal(await denied.page.getByRole("form", { name: "Human-only investigation review", includeHidden: true }).count(), 0);
    assert(!(await denied.page.locator("body").textContent()).includes(draft));
    await denied.context.close();
  }
  checks.push("Rejected renewed identity, revoked staff role and logout remove the retained human-only draft, not just hide it");

  for (const width of [1440, 390]) {
    const founder = await fixture("founder", width);
    await founder.page.goto(`${base}/auth`);
    await founder.page.waitForURL(`${base}/admin`);
    await founder.page.goto(`${base}/profile`);
    await founder.page.getByRole("navigation", { name: "Your work dashboards" }).getByRole("link", { name: "Founder Dashboard", exact: true }).waitFor();
    await (await visibleNav(founder.page, width, "Founder Dashboard")).click();
    await founder.page.getByRole("heading", { name: "Founder Dashboard", exact: true }).waitFor();
    await screenshot(founder.page, `founder-${width}.png`);
    await founder.page.locator("main").getByRole("link", { name: "Users & investigators", exact: true }).click();
    await founder.page.getByRole("heading", { name: "Users & Investigators", exact: true, level: 1 }).waitFor();
    await (await visibleNav(founder.page, width, "Investigator Dashboard")).click();
    await founder.page.getByRole("heading", { name: "Investigator Dashboard", exact: true }).waitFor();
    await founder.context.close();

    const { page, context, state } = await fixture("worker", width);
    await page.goto(`${base}/auth`);
    await page.waitForURL(`${base}/investigator`);
    await page.goto(`${base}/dashboard`);
    await page.getByRole("navigation", { name: "Your work dashboards" }).getByRole("link", { name: "Investigator Dashboard", exact: true }).waitFor();
    await (await visibleNav(page, width, "Investigator Dashboard")).click();
    await page.getByRole("heading", { name: "Investigator Dashboard", exact: true }).waitFor();
    await page.locator("article").filter({ hasText: A }).waitFor();
    await screenshot(page, `investigator-${width}.png`);
    assert.equal(await page.getByRole("link", { name: "Users & investigators", exact: true }).count(), 0);
    assert.equal(await page.getByRole("navigation", { name: "Founder Operations" }).count(), 0);
    await page.locator("article").filter({ hasText: A }).getByRole("button", { name: "Continue investigation", exact: true }).click();
    await page.getByRole("region", { name: "Customer investigation workspace", exact: true }).waitFor();
    assert.equal(new URL(page.url()).hash, `#order-${A}`);
    const workspace = page.getByRole("region", { name: "Customer investigation workspace", exact: true });
    await workspace.getByRole("button", { name: "Yes, this is the correct erf", exact: true }).waitFor();
    await workspace.evaluate(node => { node.dataset.focusPreservationProbe = "same-mounted-work"; });
    const rechecked = page.waitForResponse(response => new URL(response.url()).pathname === "/rest/v1/user_roles");
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await rechecked;
    assert.equal(await workspace.getAttribute("data-focus-preservation-probe"), "same-mounted-work", "Successful focus recheck discarded the current work form");
    assert.equal(await page.getByRole("button", { name: "Approve reviewed version", exact: true }).count(), 0);
    await page.getByRole("button", { name: "Back to investigation queue", exact: true }).click();
    await page.getByRole("heading", { name: "Investigator Dashboard", exact: true }).waitFor();
    assert.equal(new URL(page.url()).hash, "");
    await page.goto(`${base}/auth?redirect=${encodeURIComponent(`/admin/fulfillment#order-${A}`)}`);
    await page.getByRole("region", { name: "Customer investigation workspace", exact: true }).waitFor();
    await page.reload();
    await page.getByRole("region", { name: "Customer investigation workspace", exact: true }).waitFor();
    assert.equal(new URL(page.url()).hash, `#order-${A}`);
    await page.goto(`${base}/investigator#order-${B}`);
    await page.getByRole("heading", { name: "The requested order was not found", exact: true }).waitFor();
    assert.equal(await page.getByRole("region", { name: "Customer investigation workspace" }).count(), 0);
    await page.goto(`${base}/admin/users`);
    await page.getByRole("heading", { name: "Founder Operations access required", exact: true }).waitFor();
    await page.getByRole("link", { name: "Back to Investigator Dashboard", exact: true }).click();
    await page.getByRole("heading", { name: "Investigator Dashboard", exact: true }).waitFor();
    await page.goto(`${base}/admin`);
    await page.waitForURL(`${base}/investigator`);
    state.empty = true;
    await page.reload();
    await page.getByText("No investigations assigned yet.", { exact: false }).waitFor();
    await screenshot(page, `investigator-empty-${width}.png`);
    state.empty = false;
    await page.goto(`${base}/investigator#order-${A}`);
    await page.getByRole("region", { name: "Customer investigation workspace" }).waitFor();
    state.suspended = true;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.getByRole("heading", { name: "Staff access could not be verified", exact: true }).waitFor();
    assert.equal(await page.getByRole("region", { name: "Customer investigation workspace" }).count(), 0);
    await context.close();
    checks.push(`${width}: visible Founder/work navigation, users, exact work/back, legacy hash reload, unrelated order denial, founder separation, zero assignments and suspended-session removal`);

    const customer = await fixture("customer", width);
    for (const path of ["/investigator", "/admin/users"]) {
      await customer.page.goto(base + path);
      await customer.page.getByRole("heading", { name: path === "/investigator" ? "Investigator access required" : "Founder Operations access required", exact: true }).waitFor();
      assert.equal(await customer.page.locator("[data-order-id]").count(), 0);
    }
    await customer.context.close();
  }
  // A delayed private response must not survive an actual cross-tab auth switch.
  const { page, context, state } = await fixture("worker", 1440);
  let release, started;
  const began = new Promise(done => { started = done; });
  state.delayed = { gate: new Promise(done => { release = done; }), started };
  await page.goto(`${base}/investigator#order-${A}`);
  await began;
  state.actor = "customer";
  await page.evaluate(({ keys, session }) => {
    for (const key of keys) {
      localStorage.setItem(key, JSON.stringify(session));
      const channel = new BroadcastChannel(key);
      channel.postMessage({ event: "SIGNED_IN", session }); channel.close();
    }
  }, { keys, session: sessionFor("customer") });
  release();
  await page.getByRole("heading", { name: "Investigator access required", exact: true }).waitFor();
  assert.equal(await page.getByRole("region", { name: "Customer investigation workspace" }).count(), 0);
  assert(!(await page.locator("body").innerText()).includes("Erf 1570 synthetic staff work"));
  await context.close();
  const expiry = await fixture("worker", 1440);
  await expiry.page.goto(`${base}/investigator#order-${A}`);
  await expiry.page.getByRole("region", { name: "Customer investigation workspace" }).waitFor();
  await expiry.page.evaluate(({ keys, session }) => {
    for (const key of keys) {
      const expired = { ...session, expires_at: 1 };
      localStorage.setItem(key, JSON.stringify(expired));
      const channel = new BroadcastChannel(key);
      channel.postMessage({ event: "TOKEN_REFRESHED", session: expired }); channel.close();
    }
  }, { keys, session: sessionFor("worker") });
  await expiry.page.getByRole("heading", { name: "Staff access could not be verified", exact: true }).waitFor();
  assert.equal(await expiry.page.getByRole("region", { name: "Customer investigation workspace" }).count(), 0);
  await expiry.context.close();
  checks.push("Customer denied both staff areas; real Auth broadcast switch discards delayed previous-account detail; expiry removes private workspace; no mutation RPC or notification request");
  assert.deepEqual(errors, []);
} catch (error) { errors.push(error.stack); process.exitCode = 1; }
finally {
  await browser.close();
  const receipt = { source: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    passed: !process.exitCode, checks, errors, productionAccess: false, providerCalls: 0 };
  await writeFile(resolve(artifacts, "receipt.json"), JSON.stringify(receipt, null, 2));
  await writeFile(resolve(artifacts, "network.json"), JSON.stringify(network, null, 2));
  console.log(JSON.stringify(receipt, null, 2));
}
