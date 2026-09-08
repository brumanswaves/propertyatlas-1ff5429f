import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

// No production credentials or service calls. This regression measures Back
// BEFORE any action that could scroll it into view on the user's behalf.
const baseUrl = process.env.EASY_ERF_BROWSER_BASE_URL || "http://127.0.0.1:4174";
assert.equal(new URL(baseUrl).hostname, "127.0.0.1");
const artifacts = resolve(process.env.EASY_ERF_BROWSER_ARTIFACTS || "artifacts/founder-fulfillment", "pinned-navigation");
await mkdir(artifacts, { recursive: true });
const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim();
const A = "33333333-3333-4333-8333-333333333333";
const B = "11111111-1111-4111-8111-111111111111";
const LEGACY = "55555555-5555-4555-8555-555555555555";
const user = { id: B, email: "fixture-founder@example.invalid", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const session = { access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: B, exp: 4102444800, role: "authenticated", aud: "authenticated" })}.fixture-only`, refresh_token: "fixture-only", expires_at: 4102444800, expires_in: 36000000, token_type: "bearer", user };
const checklistIds = ["parcel_identity", "cadastral_evidence", "ownership_title", "zoning_planning", "property_checks", "market_evidence", "strategy_calculations", "site_potential", "reviewed_report"];
const rows = [A, B, LEGACY].map((id) => ({
  id, user_id: B, parcel_id: "csg:lpi:c03400140000157000000", report_type: "human_review", provider: "stripe",
  status: "processing", status_enum: "fulfilling", price_cents: 99900,
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", completed_at: null, review_content_updated_at: null,
  review_focus: id === LEGACY ? null : "property_check",
  payload: { propertyReference: id === LEGACY ? "1570" : `Erf 1570, synthetic navigation fixture ${id === A ? "A" : "B"}`, customerEmail: "owner@example.invalid", livemode: false, privateProbe: `PRIVATE_${id}` },
  review_content: { bottomLine: `Persisted report ${id}`, known: ["Fixture known"], potential: ["Fixture potential"], risks: ["Fixture risk"], unknowns: ["Fixture unknown"], nextSteps: ["Fixture next"], investigationChecklist: Object.fromEntries(checklistIds.map((key) => [key, "complete"])) },
}));
const originalRows = JSON.stringify(rows);
const summaries = rows.map((row) => ({
  id: row.id, parcel_id: row.parcel_id, report_type: row.report_type, status: row.status, status_enum: row.status_enum,
  provider: row.provider, price_cents: row.price_cents, created_at: row.created_at, updated_at: row.updated_at, completed_at: row.completed_at,
  payment_mode: "TEST", has_property_reference: row.id !== LEGACY, has_review_focus: row.id !== LEGACY, has_report_content: true,
}));
const failures = [];
const checks = [];
const measurements = [];
const detailReads = [];
const mutations = [];
let context;
const browser = await chromium.launch({ headless: true, channel: process.env.EASY_ERF_BROWSER_CHANNEL || undefined, executablePath: process.env.EASY_ERF_BROWSER_EXECUTABLE || undefined });
try {
  context = await browser.newContext({ viewport: { width: 1920, height: 975 }, hasTouch: true, serviceWorkers: "block" });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  await context.addInitScript(({ session }) => {
    for (const key of ["sb-fixture-auth-token", "sb-easyerf-auth-token", "sb-xiqpfhsdlvwrwhclonsg-auth-token"]) localStorage.setItem(key, JSON.stringify(session));
  }, { session });
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    try {
      if (url.pathname.startsWith("/functions/v1/")) {
        mutations.push({ path: url.pathname, method: request.method() });
        return route.abort();
      }
      if (url.pathname.startsWith("/auth/v1/")) return json(user);
      if (url.pathname === "/rest/v1/rpc/list_easy_erf_founder_queue") {
        assert.equal(request.method(), "POST");
        assert.deepEqual(request.postDataJSON(), { p_limit: 100 });
        return json(summaries);
      }
      if (url.pathname.startsWith("/rest/v1/")) {
        assert.ok(["GET", "HEAD"].includes(request.method()), "Navigation must not mutate data");
        if (url.pathname.endsWith("/user_roles")) return json({ role: "admin" });
        if (url.pathname.endsWith("/report_orders")) {
          const ids = url.searchParams.getAll("id");
          assert.equal(ids.length, 1);
          const id = ids[0].slice(3);
          assert.equal(ids[0], `eq.${id}`);
          assert.ok([A, B].includes(id), "Never fetch legacy or unselected report content");
          assert.equal(new URL(request.frame().url()).hash, `#order-${id}`);
          assert.equal(url.searchParams.get("provider"), "eq.stripe");
          const fields = url.searchParams.get("select").split(",");
          assert.ok(!fields.includes("*"));
          const row = rows.find((entry) => entry.id === id);
          const detail = Object.fromEntries(fields.map((key) => [key, row[key] ?? null]));
          detailReads.push({ id, fields });
          return json(request.headers().accept?.includes("object+json") ? detail : [detail]);
        }
        return json(request.headers().accept?.includes("object+json") ? null : []);
      }
      if (url.origin === new URL(baseUrl).origin) return route.continue();
      return route.abort();
    } catch (error) {
      failures.push(String(error));
      await route.abort();
    }
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => failures.push(error.message));
  const workbench = () => page.getByRole("region", { name: "Exact order workbench", exact: true });
  const back = () => page.getByRole("button", { name: "Back to read-only queue", exact: true });
  const scenarios = [
    { width: 1920, height: 975, input: "mouse", scroll: 975 },
    { width: 1440, height: 900, input: "mouse", scroll: 40 },
    { width: 1440, height: 900, input: "mouse", scroll: "bottom" },
    { width: 390, height: 844, input: "touch", scroll: 1600 },
    { width: 320, height: 568, input: "touch", scroll: 975 },
    { width: 390, height: 844, input: "keyboard", scroll: 975 },
    { width: 844, height: 390, input: "keyboard", scroll: 975 },
    { width: 320, height: 568, input: "space", scroll: 0 },
  ];
  for (const scenario of scenarios) {
    const name = `${scenario.width}x${scenario.height}-${scenario.input}-${scenario.scroll}`;
    await page.setViewportSize({ width: scenario.width, height: scenario.height });
    await page.goto(`${baseUrl}/admin/fulfillment`);
    await page.locator("article").filter({ hasText: A }).getByRole("button", { name: "Open exact order", exact: true }).click();
    await workbench().waitFor();
    await page.reload();
    await workbench().waitFor();
    assert.equal(await workbench().getAttribute("data-order-id"), A);
    // Local unsaved text must not be saved merely by leaving the order.
    await page.locator("textarea").first().fill("UNSAVED NAVIGATION FIXTURE A");
    // Blur the textarea before Ctrl+Home, which otherwise moves its caret.
    // This is setup only, before the final measured scroll below.
    await page.getByRole("heading", { name: "Erf 1570, synthetic navigation fixture A", exact: true }).click();
    if (["keyboard", "space"].includes(scenario.input)) {
      let reached = false;
      for (let step = 0; step < 100; step++) {
        if (await back().evaluate((element) => element === document.activeElement)) { reached = true; break; }
        await page.keyboard.press("Shift+Tab");
      }
      assert.ok(reached, "Back must participate in the actual keyboard tab order");
    }
    // Complete setup before the measured scroll. Nothing below may focus a
    // locator, fill a field, scroll to the top or auto-scroll Back into view.
    await page.keyboard.press("Control+Home");
    await page.waitForFunction(() => scrollY === 0);
    await page.mouse.move(4, scenario.height / 2);
    if (scenario.scroll !== 0) await page.mouse.wheel(0, scenario.scroll === "bottom" ? 100000 : scenario.scroll);
    await page.waitForFunction((requested) => {
      const maximum = document.documentElement.scrollHeight - innerHeight;
      const expected = requested === "bottom" ? maximum : Math.min(requested, maximum);
      return Math.abs(scrollY - expected) < 3;
    }, scenario.scroll);
    const measured = await back().evaluate((button) => {
      const bounds = button.getBoundingClientRect();
      const header = document.querySelector('header[aria-label="Selected order identity"]');
      const h = header?.getBoundingClientRect();
      const points = [[0.5, 0.5], [0.2, 0.5], [0.8, 0.5], [0.5, 0.25], [0.5, 0.75]].map(([x, y]) => ({ x: bounds.x + bounds.width * x, y: bounds.y + bounds.height * y }));
      return {
        scrollY, viewport: { width: innerWidth, height: innerHeight }, back: bounds.toJSON(), header: h?.toJSON(),
        insideIdentity: header?.contains(button), focused: button === document.activeElement,
        fitsViewport: bounds.top >= 0 && bounds.left >= 0 && bounds.bottom <= innerHeight && bounds.right <= innerWidth,
        receivesPointer: points.every(({ x, y }) => button.contains(document.elementFromPoint(x, y))),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    measurements.push({ scenario, measured });
    await page.screenshot({ path: resolve(artifacts, `${name}-before.png`) });
    assert.ok(measured.fitsViewport, `Back left the viewport after scroll: ${JSON.stringify(measured)}`);
    assert.ok(measured.insideIdentity, "Back must share the selected identity's sticky boundary");
    assert.ok(measured.receivesPointer, "Back is obstructed at its visible pointer targets");
    assert.ok(!measured.horizontalOverflow, "Narrow-screen navigation must not overflow horizontally");
    assert.ok(measured.header.bottom < scenario.height, "Pinned identity must leave room for the workbench");
    const x = measured.back.x + measured.back.width / 2;
    const y = measured.back.y + measured.back.height / 2;
    if (scenario.input === "touch") await page.touchscreen.tap(x, y);
    else if (["keyboard", "space"].includes(scenario.input)) {
      assert.ok(measured.focused);
      await page.keyboard.press(scenario.input === "space" ? "Space" : "Enter");
    } else await page.mouse.click(x, y);
    await page.getByRole("heading", { name: "Property investigation queue", exact: true }).waitFor({ timeout: 5000 });
    assert.equal(new URL(page.url()).hash, "");
    assert.equal(await workbench().count(), 0);
    assert.equal(await page.locator('header[aria-label="Selected order identity"]').count(), 0);
    assert.equal(await page.locator("main input, main textarea, main select").count(), 0);
    await page.screenshot({ path: resolve(artifacts, `${name}-queue.png`) });
    await page.locator("article").filter({ hasText: B }).getByRole("button", { name: "Open exact order", exact: true }).click();
    await workbench().waitFor();
    assert.equal(await workbench().getAttribute("data-order-id"), B);
    assert.equal(await page.locator("textarea").first().inputValue(), `Persisted report ${B}`);
    assert.deepEqual(mutations, []);
    assert.equal(JSON.stringify(rows), originalRows);
    assert.deepEqual(failures, []);
    checks.push(name);
    console.log(`PASS pinned queue exit ${name}`);
  }
} catch (error) {
  failures.push(error.stack || String(error));
  process.exitCode = 1;
} finally {
  if (context) await context.tracing.stop({ path: resolve(artifacts, "trace.zip") });
  await browser.close();
  await writeFile(resolve(artifacts, "receipt.json"), JSON.stringify({ sha, dirty: Boolean(dirty), checks, measurements, detailReads, mutations, failures, productionAccess: false }, null, 2));
  if (failures.length) console.error(failures.join("\n"));
}
