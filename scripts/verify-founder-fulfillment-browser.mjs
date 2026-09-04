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
const A = "384be2fe-f7aa-4687-970c-5a6db34cfeba";
const B = "11111111-1111-4111-8111-111111111111";
const LEGACY = "4e51dfbb-e931-4500-a622-2a766be398fc";
const parcel = "csg:lpi:c03400140000157000000";
const property = "Erf 1570, 24 Padrone Crescent, St Francis Bay";
const email = "brumanswaves@gmail.com";
const user = { id: B, email: "fixture-founder@example.invalid", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const session = { access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: B, exp: 4102444800, role: "authenticated", aud: "authenticated" })}.fixture-only`, refresh_token: "fixture-only", expires_at: 4102444800, expires_in: 36000000, token_type: "bearer", user };
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
const requests = [];
const failures = [];
const checks = [];
let notification = { ok: true, emailAccepted: true };
const browser = await chromium.launch({ headless: true, channel: process.env.EASY_ERF_BROWSER_CHANNEL || undefined });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: "block" });
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
  if (url.pathname.startsWith("/auth/v1/")) return json(user);
  if (url.pathname.startsWith("/rest/v1/")) {
    if (request.method() !== "GET" && request.method() !== "HEAD") {
      failures.push(`Unexpected data mutation: ${url.pathname}`);
      return route.abort();
    }
    if (url.pathname.endsWith("/user_roles")) return json({ role: "admin" });
    if (url.pathname.endsWith("/report_orders")) return json(rows);
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
async function check(name, fn) { await fn(); checks.push(name); console.log(`PASS ${name}`); }
const identity = () => page.locator('header[aria-label="Selected order identity"]');
const workbench = () => page.getByRole("region", { name: "Exact order workbench" });
async function open(id) {
  await page.goto(`${baseUrl}/admin/fulfillment#order-${id}`);
  await workbench().waitFor();
  assert.equal(await workbench().getAttribute("data-order-id"), id);
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
  await check("accessible exact-order reopen modal and status change preserve selection", async () => {
    await reopen(A);
    assert.equal(await workbench().getAttribute("data-order-id"), A);
    assert.equal(requests.at(-1).orderId, A);
    assert.equal(requests.at(-1).action, "reopen_review");
  });
  await check("report, checklist, failure, file and modal state cannot leak between orders", async () => {
    await page.locator("textarea").first().fill("UNSAVED A ONLY");
    await page.locator("select").first().selectOption("blocked");
    await page.getByText("Record an investigation failure", { exact: true }).click();
    await page.getByRole("textbox", { name: "Failure reason for this exact order" }).fill("A-only failure");
    await page.getByText("Optional PDF delivery", { exact: true }).click();
    await page.getByLabel("Optional report PDF for this order").setInputFiles({ name: "A-only.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-fixture") });
    // A hash change exercises reconciliation without remounting the whole page.
    rows[1].status = rows[1].status_enum = "processing";
    await page.getByRole("button", { name: /Back to read-only queue/ }).click();
    await page.locator("article").filter({ hasText: B }).getByRole("button", { name: "Open exact order" }).click();
    // Existing fetched B is ready; reopen refreshes it, preserving selected B.
    await reopen(B);
    assert.equal(await page.locator("textarea").first().inputValue(), "Persisted report B");
    assert.equal(await page.locator("select").first().inputValue(), "complete");
    await page.getByText("Record an investigation failure", { exact: true }).click();
    assert.equal(await page.getByRole("textbox", { name: "Failure reason for this exact order" }).inputValue(), "");
    await page.getByText("Optional PDF delivery", { exact: true }).click();
    assert.equal(await page.getByLabel("Optional report PDF for this order").inputValue(), "");
    await page.evaluate((id) => { location.hash = `order-${id}`; }, A);
    await page.waitForFunction((id) => document.querySelector('[data-order-id]')?.getAttribute("data-order-id") === id, A);
    assert.equal(await page.locator("textarea").first().inputValue(), "Persisted report A");
    assert.equal(await page.locator("select").first().inputValue(), "complete");
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
    assert.ok(await page.getByRole("button", { name: "Mark this exact report ready" }).isDisabled());
    await page.getByText("Optional PDF delivery", { exact: true }).click();
    assert.ok(await page.getByRole("button", { name: "Upload PDF and deliver this exact report" }).isDisabled());
    assert.ok((await workbench().innerText()).includes("Delivery blocked:"));
    await page.getByRole("button", { name: /Back to read-only queue/ }).click();
    assert.equal(await workbench().count(), 0);
    assert.equal(await page.locator("main input, main textarea, main select").count(), 0);
  });
  assert.deepEqual(failures, []);
  console.log(`VERIFIED built-browser fixture acceptance: ${checks.length} groups; candidate ${sha}; dirty=${Boolean(dirty)}; external backend requests: 0`);
} catch (error) {
  failures.push(error.stack || String(error));
  await page.screenshot({ path: resolve(artifacts, "failure.png"), fullPage: true });
  throw error;
} finally {
  await context.tracing.stop({ path: resolve(artifacts, "trace.zip") });
  await writeFile(resolve(artifacts, "receipt.json"), JSON.stringify({ sha, dirty: Boolean(dirty), checks, failures, mockedRequests: requests, productionAccess: false }, null, 2));
  await browser.close();
}
