// Real isolated Supabase Auth/REST/Storage. Only external providers are fixtures.
// Never run against a linked or remote project; never write tokens to artifacts.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { spawn, execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import "./verify-shared-investigation-network.mjs";

const runtime = JSON.parse(await readFile(process.env.EASY_ERF_ISOLATED_RUNTIME, "utf8"));
const backend = runtime.API_URL;
const anon = runtime.ANON_KEY;
const service = runtime.SERVICE_ROLE_KEY;
assert.equal(new URL(backend).origin, "http://127.0.0.1:54321", "Only the isolated CLI API is permitted");
assert.equal(typeof anon, "string"); assert.equal(typeof service, "string");
const gatewayUrl = "http://127.0.0.1:54325";
const appUrl = "http://127.0.0.1:4177";
const artifacts = resolve(process.env.EASY_ERF_BROWSER_ARTIFACTS ?? "artifacts/shared-investigation");
await mkdir(artifacts, { recursive: true });
const secrets = [anon, service];
const redact = (text) => secrets.reduce((safe, key) => safe.split(key).join("[REDACTED]"), String(text))
  .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED JWT]");
const results = [];
const requests = [];
const processes = [];
const contexts = [];
const errors = [];
let browser;
const allowedFunctions = new Set(["ask-easy-erf-openai", "easy-erf-founder-fulfillment", "easy-erf-founder-customer-notification"]);
const gateway = createServer(async (req, res) => {
  try {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const url = new URL(req.url, gatewayUrl);
    let target;
    if (url.pathname.startsWith("/functions/v1/")) {
      assert(allowedFunctions.has(url.pathname.split("/").at(-1)), "Unapproved function request blocked");
      target = `http://127.0.0.1:54326${url.pathname}${url.search}`;
    } else {
      assert(/^\/(auth|rest|storage)\/v1\//.test(url.pathname), "Unexpected backend path blocked");
      target = `${backend}${url.pathname}${url.search}`;
    }
    const headers = { ...req.headers }; delete headers.host; delete headers.connection; delete headers["content-length"];
    const response = await fetch(target, { method: req.method, headers, ...(body.length ? { body } : {}) });
    const bytes = Buffer.from(await response.arrayBuffer());
    requests.push({ path: url.pathname, method: req.method, status: response.status,
      // Capture actual persistence/function bodies, never Auth tokens or request headers.
      response: url.pathname.startsWith("/auth/") ? "Auth response withheld" : redact(bytes.toString("utf8")).slice(0, 180000) });
    res.writeHead(response.status, { "content-type": response.headers.get("content-type") ?? "application/json",
      "access-control-allow-origin": appUrl, "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, prefer, range, x-upsert",
      "access-control-allow-methods": "GET,POST,PATCH,DELETE,PUT,OPTIONS", "access-control-expose-headers": "content-range", "cache-control": "no-store" });
    res.end(bytes);
  } catch (error) { errors.push(redact(error.message)); res.writeHead(502); res.end("Isolated gateway rejected the request"); }
});
await new Promise((done) => gateway.listen(54325, "127.0.0.1", done));
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const adminClient = createClient(backend, service, options);
const ids = { a: randomUUID(), b: randomUUID(), admin: randomUUID(), worker: randomUUID(), stranger: randomUUID() };
const orderA = randomUUID(), orderB = randomUUID();
const parcelA = "manual:isolated-investigation-a", parcelB = "manual:isolated-investigation-b";
const password = `Isolated-${randomUUID()}!`; secrets.push(password);
const sessions = {}, clients = {};
function must(result) { assert.equal(result.error, null, result.error?.message); return result.data; }
async function rpc(actor, name, args) { return must(await clients[actor].rpc(name, args)); }
async function denied(actor, name, args) { const result = await clients[actor].rpc(name, args); assert(result.error, `${actor} unexpectedly allowed ${name}`); }
const now = new Date().toISOString();
const work = Object.fromEntries(["cadastral_evidence", "ownership_title", "zoning_planning", "market_evidence", "strategy_calculations", "site_potential"].map((id) => [id, {
  source: "Synthetic unavailable-source fixture", checkedAt: now, result: "The isolated fixture has no record for this check.",
  reason: "Thin-path unavailable evidence test, not a real investigation.", limitation: "Obtain the actual evidence before making any real decision.", disposition: "unavailable",
}]));
const normalizedParcel = { id: parcelA, source: "manual", sourceLabel: "Synthetic customer property", erfNumber: "42", portion: "0",
  municipality: "Synthetic municipality", province: "Eastern Cape", town: "Fixture town", coordinates: { lng: 24.83, lat: -34.16 }, knownFields: [], missingFields: [], rawProperties: { area_m2: 600 } };
const dataA = { normalizedParcel, parcelRing: [[24.83,-34.16],[24.8303,-34.16],[24.8303,-34.1602],[24.83,-34.1602],[24.83,-34.16]],
  privateNote: "CUSTOMER_A_PRIVATE_NOTE", approximateAddress: "42 Synthetic Street",
  easyErfInvestigation: { version: 1, parcelId: parcelA, syncedAt: now, workspaceUpdatedAt: now, identityStatus: "none", marketAddressSaved: true,
    sgDiagramAttachmentCount: 0, marketEvidenceStarted: false, strategyScenarioCount: 0, chosenScenarioId: null, reportStarted: false,
    planning: { zoneCode: null, userConfirmedZoneCode: null, userConfirmedAt: null },
    sitePotential: { skipped: false, conceptCount: 0, selectedDesignAssetId: null, progressState: "not_started" },
    investigation: { startedAt: now, lastViewedAt: now, currentStepId: "confirm-property", skippedStepIds: [], lastMeaningfulActionAt: null } },
  investigationWork: work };
function start(command, args, env) {
  const child = spawn(command, args, { env, stdio: ["ignore", "pipe", "pipe"] });
  const log = []; child.stdout.on("data", (chunk) => log.push(redact(chunk))); child.stderr.on("data", (chunk) => log.push(redact(chunk)));
  processes.push({ child, log }); return child;
}
async function waitFor(url, child) {
  for (let i = 0; i < 90; i++) {
    if (child.exitCode !== null) throw new Error(`Isolated process exited: ${redact(processes.find((p) => p.child === child).log.join(""))}`);
    try { await fetch(url); return; } catch { await new Promise((done) => setTimeout(done, 500)); }
  }
  throw new Error("Isolated process did not become available");
}
async function open(actor, mobile = false) {
  const context = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 1000 } });
  contexts.push(context);
  await context.addInitScript(({ session, origin }) => { if (location.origin === origin) localStorage.setItem("sb-127-auth-token", JSON.stringify(session)); }, { session: sessions[actor], origin: appUrl });
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if ([appUrl, gatewayUrl].includes(url.origin) || ["blob:", "data:"].includes(url.protocol)) return route.continue();
    requests.push({ blockedExternalBrowserRequest: `${url.origin}${url.pathname}` }); return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`${actor}: ${redact(error.message)}`));
  return page;
}
async function saveCheck(page) {
  await page.getByText("Record checks, unavailable evidence and limitations", { exact: true }).click();
  await page.getByLabel("Source checked", { exact: true }).fill("Synthetic planning desk");
  await page.getByLabel("Date checked").fill(now.slice(0, 10));
  await page.getByLabel("Actual result and findings").fill("SYNTHETIC_PERSISTED_CHECK: no approved plan was available from the fixture.");
  await page.getByLabel("Reason and relevance to this property").fill("Compare the recorded structures with approval records.");
  await page.getByLabel("Remaining limitation or next verification").fill("Municipal approval is not verified.");
  const saved = page.waitForResponse((response) => response.url().endsWith("/rpc/patch_order_investigation") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Save source check", exact: true }).click(); assert.equal((await saved).status(), 200);
}
try {
  for (const [actor, id] of Object.entries(ids)) {
    const email = `isolated-${actor}@example.invalid`;
    must(await adminClient.auth.admin.createUser({ id, email, password, email_confirm: true, user_metadata: { full_name: `Synthetic ${actor}` } }));
    clients[actor] = createClient(gatewayUrl, anon, options);
    sessions[actor] = must(await clients[actor].auth.signInWithPassword({ email, password })).session;
    assert.equal(sessions[actor].user.id, id); secrets.push(sessions[actor].access_token, sessions[actor].refresh_token);
  }
  must(await adminClient.from("user_roles").insert({ user_id: ids.admin, role: "admin" }));
  must(await adminClient.from("saved_properties").insert([
    { user_id: ids.a, parcel_id: parcelA, user_data: dataA },
    { user_id: ids.b, parcel_id: parcelB, user_data: { normalizedParcel: { ...normalizedParcel, id: parcelB }, privateNote: "NONSELECTED_PRIVATE_SENTINEL" } },
  ]));
  must(await adminClient.from("report_orders").insert([
    { id: orderA, user_id: ids.a, parcel_id: parcelA, provider: "stripe", report_type: "human_review", status: "processing", status_enum: "fulfilling", payload: { orderKind: "easy_erf_investigation", livemode: false, erfNumber: "42", address: "42 Synthetic Street" } },
    { id: orderB, user_id: ids.b, parcel_id: parcelB, provider: "stripe", report_type: "human_review", status: "processing", status_enum: "fulfilling", payload: { orderKind: "easy_erf_investigation", livemode: false } },
  ]));
  await denied("worker", "read_order_investigation", { p_order_id: orderA });
  await rpc("admin", "assign_order_investigator", { p_order_id: orderA, p_worker_id: ids.worker, p_can_approve: false, p_revoke: false });
  const scope = await rpc("worker", "read_order_investigation", { p_order_id: orderA });
  assert.equal(scope.customerId, ids.a); assert.equal(scope.canApprove, false);
  assert(!JSON.stringify(scope).includes("PRIVATE_NOTE"));
  for (const actor of ["b", "stranger"]) await denied(actor, "read_order_investigation", { p_order_id: orderA });
  await denied("worker", "read_order_investigation", { p_order_id: orderB });
  assert.equal(must(await clients.worker.from("saved_properties").select("id")).length, 0);
  results.push("Actual five-user Auth and database delegation/cross-customer boundaries passed");

  const commonEnv = { PATH: process.env.PATH, HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE,
    TEMP: process.env.TEMP, TMP: process.env.TMP, SYSTEMROOT: process.env.SYSTEMROOT,
    NODE_ENV: "production", SUPABASE_URL: gatewayUrl, SUPABASE_ANON_KEY: anon, SUPABASE_PUBLISHABLE_KEY: anon,
    SUPABASE_SERVICE_ROLE_KEY: service, ASK_EASY_ERF_FN_SECRET: "isolated-internal-fixture",
    OPENAI_API_KEY: "isolated-model-fixture", INVESTIGATION_BRIEF_ENABLED: "true",
    EASY_ERF_CUSTOMER_EMAIL_ENABLED: "true", RESEND_API_KEY: "isolated-email-fixture",
    EASY_ERF_REPORT_FROM_EMAIL: "Fixture <reports@example.invalid>", EASY_ERF_APP_URL: appUrl };
  // Populate only public runtime dependencies before the closed-network execution.
  execFileSync("deno", ["cache", "--no-config", "--no-lock", "--node-modules-dir=none", "scripts/verify-shared-investigation-provider.ts"], { stdio: "pipe" });
  const edge = start("deno", ["run", "--no-config", "--no-lock", "--node-modules-dir=none", "--cached-only", "--allow-env", "--allow-read", "--allow-net=127.0.0.1", "scripts/verify-shared-investigation-provider.ts"], commonEnv);
  await waitFor("http://127.0.0.1:54326/health", edge);
  execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], { env: { ...commonEnv, NITRO_PRESET: "node-server", VITE_SUPABASE_URL: gatewayUrl, VITE_SUPABASE_PUBLISHABLE_KEY: anon }, stdio: "pipe", maxBuffer: 25_000_000 });
  const app = start(process.execPath, ["--import", resolve("scripts/verify-shared-investigation-network.mjs"), ".output/server/index.mjs"], { ...commonEnv, HOST: "127.0.0.1", PORT: "4177" });
  await waitFor(`${appUrl}/admin/fulfillment`, app);
  browser = await chromium.launch({ headless: true });
  const worker = await open("worker");
  await worker.goto(`${appUrl}/admin/fulfillment#order-${orderA}`);
  await worker.getByRole("button", { name: "Yes, this is the correct erf", exact: true }).waitFor();
  await worker.getByRole("button", { name: "Yes, this is the correct erf", exact: true }).click();
  await worker.getByRole("navigation", { name: "Customer investigation steps" }).getByRole("button", { name: /Add address/ }).waitFor();
  await saveCheck(worker);
  const saved = await rpc("a", "read_customer_investigation", { p_parcel_id: parcelA });
  assert.equal(saved.userData.easyErfInvestigation.identityStatus, "looks_correct");
  assert(saved.userData.investigationWork.property_checks.result.includes("SYNTHETIC_PERSISTED_CHECK"));
  assert.equal(must(await adminClient.from("saved_properties").select("id").eq("user_id", ids.worker)).length, 0);
  await worker.reload();
  await worker.getByRole("navigation", { name: "Customer investigation steps" }).getByRole("button", { name: /Report/ }).click();
  await worker.getByRole("button", { name: "Generate investigation brief", exact: true }).click();
  await worker.getByLabel("Bottom line 1", { exact: true }).waitFor();
  assert.equal(await worker.getByRole("button", { name: "Approve this evidence and brief version", exact: true }).count(), 0);
  await worker.getByLabel("Bottom line 1", { exact: true }).fill("SYNTHETIC_HUMAN_EDIT: approval is conditional on the clearly recorded missing evidence.");
  await worker.getByRole("button", { name: "Save review edits", exact: true }).click();
  await worker.getByRole("button", { name: "Generate investigation brief", exact: true }).waitFor();
  const draft = await rpc("worker", "read_investigation_review", { p_order_id: orderA });
  assert.equal(draft.approved_at, null); assert(draft.edited_brief.bottomLine.text.includes("SYNTHETIC_HUMAN_EDIT"));
  assert.equal(await rpc("a", "read_investigation_review", { p_order_id: orderA }), null);
  await worker.screenshot({ path: resolve(artifacts, "worker-draft-desktop.png"), fullPage: true });
  results.push("Assigned non-admin worker saved real customer records, generated fixture AI, edited draft; customer cannot read draft");

  const admin = await open("admin");
  await admin.goto(`${appUrl}/admin/fulfillment#order-${orderA}`);
  await admin.getByRole("navigation", { name: "Customer investigation steps" }).getByRole("button", { name: /Report/ }).click();
  const approvedResponse = admin.waitForResponse((r) => r.url().endsWith("/api/investigations/review") && r.request().postDataJSON()?.action === "approve");
  await admin.getByRole("button", { name: "Approve this evidence and brief version", exact: true }).click();
  assert.equal((await approvedResponse).status(), 200);
  const approved = await rpc("admin", "read_investigation_review", { p_order_id: orderA });
  assert.equal(approved.approved_by, ids.admin); assert(approved.approved_at);
  const frozenHash = createHash("sha256").update(JSON.stringify(approved.report_assembly)).digest("hex");
  // Actual existing delivery Edge handler and notification receipt; only Resend is replaced.
  const delivered = must(await clients.admin.functions.invoke("easy-erf-founder-fulfillment", { body: { orderId: orderA, action: "mark_ready" } }));
  assert.equal(delivered.ok, true); assert.equal(delivered.notification.emailAccepted, true);
  const duplicate = must(await clients.admin.functions.invoke("easy-erf-founder-customer-notification", { body: { orderId: orderA, action: "send" } }));
  assert.equal(duplicate.alreadySent, true);
  const customer = await open("a", true);
  await customer.goto(`${appUrl}/orders?report=${orderA}`);
  await customer.locator(`[data-review-version="${approved.id}"]`).waitFor();
  assert((await customer.locator("body").innerText()).includes("SYNTHETIC_HUMAN_EDIT"));
  assert((await customer.locator("body").innerText()).includes("SYNTHETIC_PERSISTED_CHECK"));
  assert.equal(await customer.getByText("Human-reviewed investigation.", { exact: true }).count(), 1);
  await customer.screenshot({ path: resolve(artifacts, "customer-combined-mobile.png"), fullPage: true });
  const persisted = await rpc("a", "read_investigation_review", { p_order_id: orderA, p_version_id: approved.id });
  assert(persisted.delivered_at); assert.equal(createHash("sha256").update(JSON.stringify(persisted.report_assembly)).digest("hex"), frozenHash);
  const current = await rpc("a", "read_customer_investigation", { p_parcel_id: parcelA });
  await rpc("a", "patch_saved_property_user_data_if_unchanged", { p_parcel_id: parcelA,
    p_user_data_patch: { easyErfInvestigation: { ...current.userData.easyErfInvestigation, identityStatus: "uncertain" } }, p_expected: current.userData });
  const later = await rpc("a", "read_investigation_review", { p_order_id: orderA, p_version_id: approved.id });
  assert.equal(createHash("sha256").update(JSON.stringify(later.report_assembly)).digest("hex"), frozenHash);
  results.push("Actual approval, existing delivery, synthetic email receipt and duplicate protection; fresh customer combined report; later work cannot rewrite delivered version");

  const path = `${ids.a}/${parcelA}/other/${randomUUID()}/fixture.png`;
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jh/kAAAAASUVORK5CYII=", "base64");
  must(await adminClient.storage.from("erf-files").upload(path, png, { contentType: "image/png" }));
  for (const actor of ["b", "worker", "stranger"]) assert((await clients[actor].storage.from("erf-files").download(path)).error, `${actor} bypassed file permission`);
  await rpc("admin", "assign_order_investigator", { p_order_id: orderA, p_worker_id: ids.worker, p_can_approve: false, p_revoke: true });
  await denied("worker", "read_order_investigation", { p_order_id: orderA });
  await worker.reload();
  await worker.getByRole("alert").first().waitFor();
  assert.equal(await worker.locator("[data-investigation-report]").count(), 0);
  results.push("Real Storage denies non-owner direct reads; revocation clears worker access");
  assert.equal(errors.length, 0, errors.join("\n"));
} catch (error) {
  errors.push(redact(error.stack ?? error));
  if (error.stdout) errors.push(redact(error.stdout));
  if (error.stderr) errors.push(redact(error.stderr));
  for (let index = 0; index < contexts.length; index++) for (const page of contexts[index].pages()) {
    await page.screenshot({ path: resolve(artifacts, `failure-${index}.png`), fullPage: true }).catch(() => {});
  }
  process.exitCode = 1;
} finally {
  await browser?.close();
  for (const { child } of processes) child.kill("SIGTERM");
  gateway.closeAllConnections(); await new Promise((done) => gateway.close(done));
  const receipt = { source: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    result: process.exitCode ? "failed" : "passed", proof: "Real isolated Auth/REST/Storage with synthetic external providers; not production acceptance",
    results, errors, productionAccess: false, liveProviderCalls: 0 };
  await writeFile(resolve(artifacts, "receipt.json"), JSON.stringify(receipt, null, 2));
  await writeFile(resolve(artifacts, "network.json"), JSON.stringify(requests, null, 2));
  await writeFile(resolve(artifacts, "processes.log"), redact(processes.map((p) => p.log.join("")).join("\n")));
  console.log(JSON.stringify(receipt, null, 2));
}
