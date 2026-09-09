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
let delayedRead = null;
function delayNextOrderRead(orderId) {
  let reached, release;
  const ready = new Promise((resolve) => { reached = resolve; });
  const settled = new Promise((resolve) => { release = resolve; });
  delayedRead = { orderId, reached, settled, release };
  return { ready, release };
}
const allowedFunctions = new Set(["ask-easy-erf-openai", "easy-erf-founder-fulfillment", "easy-erf-founder-customer-notification", "extract-erf-asset"]);
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
    if (delayedRead && url.pathname === "/rest/v1/rpc/read_order_investigation" &&
        JSON.parse(body.toString()).p_order_id === delayedRead.orderId) {
      const held = delayedRead; delayedRead = null;
      held.reached(); await held.settled;
    }
    requests.push({ path: url.pathname, method: req.method, status: response.status,
      // Capture actual persistence/function bodies, never Auth tokens or request headers.
      response: url.pathname.startsWith("/auth/") ? "Auth response withheld" : redact(bytes.toString("utf8")) });
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
const fixtureLpi = "C00000000000004200000";
const parcelA = `csg:lpi:${fixtureLpi.toLowerCase()}`, parcelB = "manual:isolated-investigation-b";
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
const normalizedParcel = { id: parcelA, source: "csg", sourceLabel: "Synthetic public-source fixture", erfNumber: "42", portion: "0", lpi: fixtureLpi,
  municipality: "Kouga Local Municipality", province: "Eastern Cape", town: "Fixture town", coordinates: { lng: 24.83, lat: -34.16 }, knownFields: [], missingFields: [], rawProperties: { area_m2: 600 } };
const dataA = { normalizedParcel, parcelRing: [[24.83,-34.16],[24.8303,-34.16],[24.8303,-34.1602],[24.83,-34.1602],[24.83,-34.16]],
  privateNote: "CUSTOMER_A_PRIVATE_NOTE", approximateAddress: "42 Synthetic Street", displayTitle: "42 Synthetic Street",
  erfNumber: "42", portion: "0", municipality: "Kouga Local Municipality", province: "Eastern Cape", lat: "-34.16", lng: "24.83",
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
    if (url.hostname === "api.mapbox.com" && url.pathname.includes("/styles/")) {
      return route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: "synthetic-background", type: "background", paint: { "background-color": "#e5e7eb" } }] } });
    }
    // Public map-provider evidence is synthetic; Auth, private REST and Storage
    // still reach the actual isolated services without mocked permission checks.
    if (url.origin === gatewayUrl && url.pathname === "/functions/v1/arcgis-public-proxy") {
      const { layer } = route.request().postDataJSON() ?? {};
      return route.fulfill({ json: { type: "FeatureCollection", features: layer === "csg-parcels" ? [{
        type: "Feature", properties: { ID: fixtureLpi, PARCEL_NO: "42", PORTION: "0", GEOM_AREA: 600,
          MAJ_REGION: "Fixture town", MIN_REGION: "Synthetic locality", MUNICIPALITY: "Kouga Local Municipality", PROVINCE: "Eastern Cape" },
        geometry: { type: "Polygon", coordinates: [dataA.parcelRing] },
      }] : [] } });
    }
    if ([appUrl, gatewayUrl].includes(url.origin) || ["blob:", "data:"].includes(url.protocol)) return route.continue();
    requests.push({ blockedExternalBrowserRequest: `${url.origin}${url.pathname}` }); return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`${actor}: ${redact(error.message)}`));
  return page;
}
async function verifyCustomerEntry() {
  const page = await open("a");
  await page.goto(appUrl);
  await page.getByRole("link", { name: "Do it for me · R999", exact: true }).click();
  await page.waitForURL("**/pricing");
  await page.goto(appUrl);
  await page.getByRole("button", { name: "Investigate it myself", exact: true }).click();
  await page.getByRole("button", { name: /^Erf Search/ }).click();
  await page.getByPlaceholder("LPI or parcel key", { exact: true }).fill(fixtureLpi);
  await page.getByRole("button", { name: "Search official parcel identity", exact: true }).click();
  await page.getByRole("button", { name: /^Open Erf 42/ }).click();
  await page.getByText("Property first read", { exact: true }).waitFor();
  // Overview intentionally repeats the CTA below its facts. Use its first,
  // primary entry action rather than ambiguously matching both controls.
  await page.getByRole("button", { name: "Continue investigation", exact: true }).first().click();
  await page.getByRole("button", { name: "Open full research workspace", exact: true }).click();
  await page.getByRole("button", { name: "Easy Erf Report", exact: true }).click();
  await page.getByText("Self-service investigation · Not human reviewed.", { exact: true }).waitFor();
  await page.screenshot({ path: resolve(artifacts, "customer-self-service-desktop.png"), fullPage: true });
  const before = await rpc("a", "read_customer_investigation", { p_parcel_id: parcelA });
  const offer = page.getByRole("complementary", { name: "Done-for-You Property Investigation option" });
  await offer.locator("summary").click();
  await offer.getByRole("link", { name: /Yes.*investigate it for me/ }).click();
  await page.waitForURL("**/pricing?**");
  assert.equal(new URL(page.url()).searchParams.get("parcelId"), parcelA);
  const after = await rpc("a", "read_customer_investigation", { p_parcel_id: parcelA });
  for (const key of ["strategyWorkspace", "savedMarketEvidence", "buildEnvelopeInputs", "investigationWork"]) {
    assert.deepEqual(after.userData[key], before.userData[key], `Paid handoff lost ${key}`);
  }
  assert.equal(after.assets.length, before.assets.length);
  assert.equal(must(await clients.a.from("saved_properties").select("user_data").eq("parcel_id", parcelA).single()).user_data.privateNote, "CUSTOMER_A_PRIVATE_NOTE");
  results.push("Both map choices reached the existing flows; free self-service common report rendered; paid handoff preserved the customer's saved investigation without checkout or a new order");
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
async function step(page, name) {
  await page.getByRole("navigation", { name: "Customer investigation steps" }).getByRole("button", { name }).click();
}
async function savedAction(page, action, rpcName = "patch_order_investigation", matches = () => true) {
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith(`/rpc/${rpcName}`) && r.request().method() === "POST" && matches(r)),
    action(),
  ]);
  assert.equal(response.status(), rpcName === "change_order_investigation_asset" ? 204 : 200);
  await page.getByRole("button", { name: "Reload saved evidence", exact: true }).and(page.locator(":enabled")).waitFor();
}
function syntheticPdf() {
  const text = "SYNTHETIC TEST EVIDENCE ONLY. Erf 42 Portion 0. Extent 600 m2. Deed T42/2026.";
  const stream = `BT /F1 10 Tf 30 750 Td (${text}) Tj ET`;
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((body, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((n) => `${String(n).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}
async function gatherSections(page) {
  await page.getByLabel("I have permission to process this document with the existing AI document reader.", { exact: true }).check();
  await page.getByLabel("The document license permits sharing the original with this customer.", { exact: true }).check();
  for (const [category, name, accept] of [["sg_diagram", /Add SG diagram/, "image"], ["paid_report", /Check title/, ".pdf,application/pdf"]]) {
    await step(page, name);
    if (category === "paid_report") {
      assert.equal(await page.getByText("Included evidence, no second customer charge", { exact: true }).count(), 1);
      // The provider original is licensed for worker review, not customer redistribution.
      await page.getByLabel("The document license permits sharing the original with this customer.", { exact: true }).uncheck();
    }
    const extracted = page.waitForResponse((r) => r.url().endsWith("/functions/v1/extract-erf-asset") && r.request().method() === "POST");
    const input = category === "sg_diagram" ? page.locator('input[type="file"]').first() : page.locator(`input[type="file"][accept="${accept}"]`);
    await input.setInputFiles({ name: `SYNTHETIC-${category}.pdf`, mimeType: "application/pdf", buffer: syntheticPdf() });
    const response = await extracted; assert.equal(response.status(), 200);
    const result = await response.json(); assert.equal(result.success, true, JSON.stringify(result)); assert.equal(result.identityMatchStatus, "unverified");
    if (category === "sg_diagram") {
      // The existing SG policy records the deliberate upload as user attachment,
      // never an automatic identity match. Paid/title files require a separate decision.
      await page.getByText("Identity: user-attached", { exact: true }).waitFor();
      assert.equal(await page.getByRole("button", { name: "Yes, this document is for or supports Erf 42", exact: true }).count(), 0);
    } else {
      await page.getByRole("button", { name: "Yes, this document is for or supports Erf 42", exact: true }).waitFor();
      await savedAction(page, () => page.getByRole("button", { name: "Yes, this document is for or supports Erf 42", exact: true }).click(), "change_order_investigation_asset");
    }
    const scope = await rpc("a", "read_customer_investigation", { p_parcel_id: parcelA });
    const asset = scope.assets.find((a) => a.asset_category === category);
    assert.equal(asset.metadata.identityBinding, "user_confirmed"); assert.equal(asset.user_id, ids.a);
    assert.equal(asset.metadata.aiProcessingAllowed, true);
    const bytes = must(await adminClient.storage.from("erf-files").download(asset.storage_path));
    assert.equal(createHash("sha256").update(Buffer.from(await bytes.arrayBuffer())).digest("hex"), asset.checksum_sha256);
  }
  await step(page, /Confirm zoning/);
  await savedAction(page, () => page.getByRole("radio", { name: /^RES1 / }).click());
  await savedAction(page, () => page.getByRole("button", { name: "Confirm working zoning", exact: true }).click());
  assert.equal(await page.getByText("Working zoning confirmed by you", { exact: true }).count(), 1);
  await step(page, /Market evidence/);
  await page.getByRole("button", { name: "Add manual evidence", exact: true }).click();
  await page.getByPlaceholder("Listing or comp URL required", { exact: true }).fill("https://example.invalid/synthetic-comparable");
  await page.getByPlaceholder("Asking price", { exact: true }).fill("1200000");
  await page.getByPlaceholder("Land size m2", { exact: true }).fill("600");
  await page.getByPlaceholder("Notes", { exact: true }).fill("Synthetic comparable, not a real listing or valuation.");
  await savedAction(page, () => page.getByRole("button", { name: "Save evidence", exact: true }).click());
  await step(page, /Strategy & Calculators/);
  await page.getByLabel("Purchase price", { exact: true }).fill("1000000");
  // Wait for the actual draft write before choosing it. Scrolling to the
  // completion button can overlap the debounce and disable its fieldset.
  await savedAction(page, () => page.getByLabel("Monthly rent", { exact: true }).fill("10000"), "patch_order_investigation",
    (r) => r.request().postDataJSON()?.p_patch?.strategyWorkspace?.draftInputs?.monthlyRent === "10000");
  await savedAction(page, () => page.getByRole("button", { name: "Use this scenario and continue", exact: true }).click());
  await page.getByRole("heading", { name: "Where could a building potentially fit?", exact: true }).waitFor();
  await page.getByText("Review inputs and technical details", { exact: true }).click();
  await page.getByRole("checkbox", { name: /The outline shown matches the erf/ }).check();
  await page.getByRole("button", { name: /^Boundary 1/ }).click();
  await page.getByRole("button", { name: /^My own assumption/ }).click();
  for (const [label, value] of [["Street (m)", "5"], ["Side (m)", "3"], ["Rear (m)", "3"], ["Max coverage (%)", "50"], ["Max height (m)", "8"]]) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
  await savedAction(page, () => page.getByRole("button", { name: "Accept this Site Potential", exact: true }).click());
  await page.locator('[data-site-potential-acceptance="accepted"]').waitFor();
  await page.screenshot({ path: resolve(artifacts, "worker-site-desktop.png"), fullPage: true });
  await page.getByRole("heading", { name: "Where could a building potentially fit?", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(artifacts, "worker-site-viewport.png") });
  const all = await rpc("a", "read_customer_investigation", { p_parcel_id: parcelA });
  assert.equal(all.assets.length, 2); assert.equal(all.userData.savedMarketEvidence.length, 1);
  assert(all.userData.strategyWorkspace.chosenScenarioId); assert(all.userData.buildEnvelopeInputs.acceptedInputSignature);
  results.push("Actual worker uploads/extraction with fixture provider, user-bound SG/paid evidence, working zoning, comparable, chosen Strategy and accepted deterministic Site Potential persisted in customer file");
}
async function reviewRequest(actor, body) {
  const response = await fetch(`${appUrl}/api/investigations/review`, { method: "POST", headers: {
    Authorization: `Bearer ${sessions[actor].access_token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
async function verifySignoffFailures() {
  const original = await rpc("a", "read_customer_investigation", { p_parcel_id: parcelA });
  async function replaceWork(work) {
    const current = await rpc("a", "read_customer_investigation", { p_parcel_id: parcelA });
    await rpc("a", "patch_saved_property_user_data_if_unchanged", { p_parcel_id: parcelA,
      p_user_data_patch: { investigationWork: work }, p_expected: current.userData });
  }
  async function generateAndReject(expected) {
    const generated = await reviewRequest("worker", { action: "generate", orderId: orderA });
    assert.equal(generated.status, 200, JSON.stringify(generated.body));
    const denied = await reviewRequest("admin", { action: "approve", orderId: orderA,
      versionId: generated.body.versionId, briefRevision: 1 });
    assert.equal(denied.status, 409); assert.match(JSON.stringify(denied.body.blockers), expected);
    const version = await rpc("admin", "read_investigation_review", { p_order_id: orderA, p_version_id: generated.body.versionId });
    assert.equal(version.approved_at, null); assert.equal(version.delivered_at, null);
    return version;
  }
  await replaceWork({ ...original.userData.investigationWork, property_checks: { disposition: "reviewed" } });
  const incomplete = await generateAndReject(/property checks/i);
  await replaceWork(original.userData.investigationWork);
  const stale = await reviewRequest("admin", { action: "approve", orderId: orderA, versionId: incomplete.id, briefRevision: 1 });
  assert.equal(stale.status, 409); assert.match(stale.body.error, /evidence or brief changed/i);
  const sg = original.assets.find((asset) => asset.asset_category === "sg_diagram");
  // Simulate an actual extractor's conflicting identity finding in the isolated
  // database. Keep stale user attachment metadata to exercise fail-closed policy.
  must(await adminClient.from("erf_assets").update({ metadata: { ...sg.metadata, identityMatchStatus: "mismatch" } }).eq("id", sg.id));
  await generateAndReject(/wrong-property evidence/i);
  must(await adminClient.from("erf_assets").update({ metadata: sg.metadata }).eq("id", sg.id));
  results.push("Actual application approval rejects unsupported completion, stale evidence and wrong-property SG despite stale user attachment; no rejected version was approved or delivered");
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
    { id: orderA, user_id: ids.a, parcel_id: parcelA, provider: "stripe", report_type: "human_review", status: "processing", status_enum: "fulfilling", price_cents: 99900,
      review_focus: "property_check", payload: { orderKind: "easy_erf_investigation", livemode: false, erfNumber: "42", address: "42 Synthetic Street", propertyReference: "Erf 42, 42 Synthetic Street", customerEmail: "isolated-a@example.invalid" } },
    { id: orderB, user_id: ids.b, parcel_id: parcelB, provider: "stripe", report_type: "human_review", status: "processing", status_enum: "fulfilling", price_cents: 99900, payload: { orderKind: "easy_erf_investigation", livemode: false } },
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
    // The unchanged email handler requires this canonical HTTPS link. It is only
    // rendered into intercepted synthetic mail; no request may reach that host.
    EASY_ERF_REPORT_FROM_EMAIL: "Fixture <reports@example.invalid>", EASY_ERF_APP_URL: "https://easyerf.co.za" };
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
  await gatherSections(worker);
  await verifySignoffFailures();
  await worker.reload();
  await worker.getByRole("navigation", { name: "Customer investigation steps" }).getByRole("button", { name: /Review report/ }).click();
  await worker.getByRole("button", { name: "Generate investigation brief", exact: true }).click();
  await worker.getByLabel("Bottom line 1", { exact: true }).waitFor();
  assert.equal(await worker.getByRole("button", { name: "Approve this evidence and brief version", exact: true }).count(), 0);
  await worker.getByLabel("Bottom line 1", { exact: true }).fill("SYNTHETIC_HUMAN_EDIT: approval is conditional on the clearly recorded missing evidence.");
  const editSaved = worker.waitForResponse((r) => r.url().endsWith("/rpc/edit_investigation_brief") && r.request().method() === "POST");
  await worker.getByRole("button", { name: "Save review edits", exact: true }).click();
  assert.equal((await editSaved).status(), 200);
  await worker.getByRole("button", { name: "Generate investigation brief", exact: true }).and(worker.locator(":enabled")).waitFor();
  await worker.getByLabel("Bottom line 1", { exact: true }).and(worker.locator(":enabled")).waitFor();
  const draft = await rpc("worker", "read_investigation_review", { p_order_id: orderA });
  assert.equal(draft.approved_at, null); assert(draft.edited_brief.bottomLine.text.includes("SYNTHETIC_HUMAN_EDIT"));
  assert.equal(await rpc("a", "read_investigation_review", { p_order_id: orderA }), null);
  await worker.screenshot({ path: resolve(artifacts, "worker-draft-desktop.png"), fullPage: true });
  await worker.getByLabel("Bottom line 1", { exact: true }).scrollIntoViewIfNeeded();
  await worker.screenshot({ path: resolve(artifacts, "worker-draft-viewport.png") });
  results.push("Assigned non-admin worker saved real customer records, generated fixture AI, edited draft; customer cannot read draft");

  const admin = await open("admin");
  await admin.goto(`${appUrl}/admin/fulfillment#order-${orderA}`);
  await admin.getByRole("navigation", { name: "Customer investigation steps" }).getByRole("button", { name: /Review report/ }).click();
  const approvedResponse = admin.waitForResponse((r) => r.url().endsWith("/api/investigations/review") && r.request().postDataJSON()?.action === "approve");
  await admin.getByRole("button", { name: "Approve this evidence and brief version", exact: true }).click();
  assert.equal((await approvedResponse).status(), 200);
  const approved = await rpc("admin", "read_investigation_review", { p_order_id: orderA });
  assert.equal(approved.approved_by, ids.admin); assert(approved.approved_at);
  const frozenHash = createHash("sha256").update(JSON.stringify(approved.report_assembly)).digest("hex");
  // Actual existing delivery Edge handler and notification receipt; only Resend is replaced.
  const delivered = must(await clients.admin.functions.invoke("easy-erf-founder-fulfillment", { body: { orderId: orderA, action: "mark_ready" } }));
  assert.equal(delivered.ok, true); assert.equal(delivered.notification.ok, true);
  // The normal existing success contract records a sent receipt. emailAccepted
  // is an auxiliary flag used when provider acceptance outlives receipt failure.
  assert.equal(delivered.notification.receipt.status, "sent");
  assert.equal(delivered.notification.receipt.providerMessageId, "isolated-provider-receipt");
  const duplicate = must(await clients.admin.functions.invoke("easy-erf-founder-customer-notification", { body: { orderId: orderA, action: "send" } }));
  assert.equal(duplicate.alreadySent, true);
  const customer = await open("a", true);
  await customer.goto(`${appUrl}/orders?report=${orderA}`);
  await customer.locator(`[data-review-version="${approved.id}"]`).waitFor();
  assert((await customer.locator("body").innerText()).includes("SYNTHETIC_HUMAN_EDIT"));
  assert((await customer.locator("body").innerText()).includes("SYNTHETIC_PERSISTED_CHECK"));
  assert.equal(await customer.getByText("Human-reviewed investigation.", { exact: true }).count(), 1);
  const report = customer.locator(`[data-review-version="${approved.id}"]`);
  for (const section of ["Property identity and address", "Zoning, planning and building controls", "Sources checked and remaining limitations"]) {
    await report.getByRole("heading", { name: section, exact: true }).waitFor();
  }
  assert((await report.innerText()).includes("T42/2026"));
  assert((await report.innerText()).includes("SYNTHETIC-sg_diagram.pdf"));
  assert.equal(await report.locator("#investigation-site svg").count() > 0, true);
  await customer.getByPlaceholder("Example: What information is missing before I make an offer?", { exact: true }).fill("What evidence remains uncertain in this reviewed report?");
  const asked = customer.waitForResponse((r) => r.url().endsWith("/api/investigations/review") && r.request().postDataJSON()?.action === "ask");
  await customer.getByRole("button", { name: "Ask", exact: true }).tap();
  assert.equal((await asked).status(), 200);
  await customer.getByText("Synthetic answer: this saved evidence still has recorded limitations.", { exact: true }).waitFor();
  await customer.screenshot({ path: resolve(artifacts, "customer-combined-mobile.png"), fullPage: true });
  await customer.getByText("Human-reviewed investigation.", { exact: true }).scrollIntoViewIfNeeded();
  await customer.screenshot({ path: resolve(artifacts, "customer-combined-mobile-viewport.png") });
  const persisted = await rpc("a", "read_investigation_review", { p_order_id: orderA, p_version_id: approved.id });
  assert(persisted.delivered_at); assert.equal(createHash("sha256").update(JSON.stringify(persisted.report_assembly)).digest("hex"), frozenHash);
  const current = await rpc("a", "read_customer_investigation", { p_parcel_id: parcelA });
  await rpc("a", "patch_saved_property_user_data_if_unchanged", { p_parcel_id: parcelA,
    p_user_data_patch: { easyErfInvestigation: { ...current.userData.easyErfInvestigation, identityStatus: "uncertain" } }, p_expected: current.userData });
  const later = await rpc("a", "read_investigation_review", { p_order_id: orderA, p_version_id: approved.id });
  assert.equal(createHash("sha256").update(JSON.stringify(later.report_assembly)).digest("hex"), frozenHash);
  const assets = current.assets;
  for (const actor of ["a", "b", "stranger", "worker"]) {
    for (const asset of assets) {
      const read = await fetch(`${appUrl}/api/investigations/asset`, { method: "POST", headers: {
        Authorization: `Bearer ${sessions[actor].access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderA, assetId: asset.id, versionId: approved.id }) });
      const permitted = actor === "worker" || (actor === "a" && asset.asset_category === "sg_diagram");
      assert.equal(read.status, permitted ? 200 : 403, `${actor} ${asset.asset_category}`);
      if (permitted) assert.equal(createHash("sha256").update(Buffer.from(await read.arrayBuffer())).digest("hex"), asset.checksum_sha256);
    }
  }
  results.push("Combined report contains actual stored findings and envelope; version-bound Ask uses controlled provider; customer original-sharing rights and exact-order asset route enforced");
  results.push("Actual approval, existing delivery, synthetic email receipt and duplicate protection; fresh customer combined report; later work cannot rewrite delivered version");

  await verifyCustomerEntry();

  const delayed = delayNextOrderRead(orderA);
  let delayTimeout;
  try {
    await worker.reload();
    await Promise.race([delayed.ready, new Promise((_, reject) => {
      delayTimeout = setTimeout(() => reject(new Error("The expected actual delayed order read did not begin")), 30_000);
    })]);
    const back = worker.getByRole("button", { name: "Back to read-only queue", exact: true });
    await back.focus(); await back.press("Enter");
    delayed.release();
    await worker.getByRole("heading", { name: "Property investigation queue", exact: true }).waitFor();
    assert.equal(new URL(worker.url()).hash, "");
    assert.equal(await worker.getByRole("region", { name: "Customer investigation workspace" }).count(), 0);
    assert.equal(await worker.locator("[data-investigation-report]").count(), 0);
    assert(!(await worker.locator("body").innerText()).includes("NONSELECTED_PRIVATE_SENTINEL"));
    results.push("Delayed actual customer-file response cannot restore a workbench after ordinary Back to queue");
  } finally { clearTimeout(delayTimeout); delayed.release(); delayedRead = null; }

  const path = `${ids.a}/${parcelA}/other/${randomUUID()}/fixture.png`;
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jh/kAAAAASUVORK5CYII=", "base64");
  must(await adminClient.storage.from("erf-files").upload(path, png, { contentType: "image/png" }));
  for (const actor of ["b", "worker", "stranger"]) assert((await clients[actor].storage.from("erf-files").download(path)).error, `${actor} bypassed file permission`);
  await rpc("admin", "assign_order_investigator", { p_order_id: orderA, p_worker_id: ids.worker, p_can_approve: false, p_revoke: true });
  await denied("worker", "read_order_investigation", { p_order_id: orderA });
  await worker.goto(`${appUrl}/admin/fulfillment#order-${orderA}`);
  await worker.getByRole("alert").first().waitFor();
  assert.equal(await worker.locator("[data-investigation-report]").count(), 0);
  results.push("Real Storage denies non-owner direct reads; revocation clears worker access");
  assert(!JSON.stringify(requests).includes("NONSELECTED_PRIVATE_SENTINEL"), "Another customer's private content crossed the application boundary");
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
  await Promise.all(processes.map(({ child }) => new Promise((done) => {
    if (child.exitCode !== null || child.signalCode !== null) return done();
    child.once("exit", done); child.kill("SIGTERM");
  })));
  gateway.closeAllConnections(); await new Promise((done) => gateway.close(done));
  const receipt = { source: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    result: process.exitCode ? "failed" : "passed", proof: "Real isolated Auth/REST/Storage with synthetic external providers; not production acceptance",
    results, errors, productionAccess: false, liveProviderCalls: 0 };
  await writeFile(resolve(artifacts, "receipt.json"), JSON.stringify(receipt, null, 2));
  await writeFile(resolve(artifacts, "network.json"), JSON.stringify(requests, null, 2));
  await writeFile(resolve(artifacts, "processes.log"), redact(processes.map((p) => p.log.join("")).join("\n")));
  console.log(JSON.stringify(receipt, null, 2));
}
