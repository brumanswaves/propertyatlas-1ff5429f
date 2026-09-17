import { chromium } from "playwright";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const baseUrl = process.env.EASY_ERF_BROWSER_BASE_URL || "http://127.0.0.1:4173";
const USER_ID = "00000000-0000-4000-8000-000000000157";
const USER_EMAIL = "guided-cloud-acceptance@easyerf.invalid";
const LPI = "C03400140000157000000";
const PARCEL_KEY = "E108C034001400001570000000";
const PARCEL_ID = "csg:lpi:c03400140000157000000";
const AUTH_STORAGE_KEYS = ["sb-127-auth-token", "sb-fixture-auth-token", "sb-easyerf-auth-token", "sb-xiqpfhsdlvwrwhclonsg-auth-token"];
const ACCEPTANCE_AT = "2026-08-29T08:00:00.000Z";
assert.equal(new URL(baseUrl).hostname, "127.0.0.1");
const artifacts = resolve(process.env.EASY_ERF_BROWSER_ARTIFACTS || "artifacts/guided-cloud");
await mkdir(artifacts, { recursive: true });
const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const dirty = Boolean(execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim());
const registry = JSON.parse(await readFile("public/data/kouga-st-francis-pilot-parcels.json", "utf8"));
const parcelFixture = registry.records.find((record) => record.id === PARCEL_ID);
assert.ok(parcelFixture);
// Synthetic test geometry only. Identity comes from the committed public registry;
// this persistence test is not proof of live cadastral geometry or provider uptime.
const [west, south, east, north] = parcelFixture.bounds;
const targetFeature = {
  type: "Feature",
  properties: parcelFixture.properties,
  geometry: { type: "Polygon", coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] },
};
const mapChecks = [];
const contexts = [];
const topOfferChecks = [];
const handoffChecks = [];
let acceptancePassed = false;

async function installIsolatedMap(context, name) {
  const state = { name, requests: 0, staleSettled: false };
  mapChecks.push(state);
  let releaseInitial;
  const targetReturned = new Promise((resolve) => { releaseInitial = resolve; });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "api.mapbox.com" && url.pathname.includes("/styles/")) {
      return route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: "fixture-background", type: "background", paint: { "background-color": "#e5e7eb" } }] } });
    }
    // Local-only acknowledgements: aborting these vendor requests can call a
    // removed map's error callback. No telemetry or session reaches Mapbox.
    if (url.hostname === "events.mapbox.com" ||
        (url.hostname === "api.mapbox.com" && url.pathname === "/map-sessions/v1")) {
      return route.fulfill({ status: 200, json: {} });
    }
    if (url.origin === new URL(baseUrl).origin) return route.continue();
    // Supabase mock routes registered below take precedence. All other traffic
    // (map tiles, fonts, telemetry, direct ArcGIS fallback) stays off production.
    return route.abort();
  });
  return async (route) => {
    const { layer } = route.request().postDataJSON();
    if (layer !== "csg-parcels") return route.fulfill({ json: { type: "FeatureCollection", features: [] } });
    state.requests += 1;
    if (state.requests === 1) {
      // Deliberately return the pre-pan viewport AFTER the saved target viewport.
      await targetReturned;
      await route.fulfill({ json: { type: "FeatureCollection", features: [{
        ...targetFeature, properties: { ...targetFeature.properties, ID: "OTHER-PARCEL", PRCL_KEY: "OTHER-PARCEL" },
      }] } });
      state.staleSettled = true;
      return;
    }
    await route.fulfill({ json: { type: "FeatureCollection", features: [targetFeature] } });
    releaseInitial();
  };
}

function encodeJwtPart(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

const accessToken = `${encodeJwtPart({ alg: "HS256", typ: "JWT" })}.${encodeJwtPart({
  aud: "authenticated",
  exp: 4_102_444_800,
  iat: 1_787_963_200,
  iss: "https://easyerf.supabase.co/auth/v1",
  role: "authenticated",
  sub: USER_ID,
  email: USER_EMAIL,
})}.acceptance-signature`;

const fakeUser = {
  id: USER_ID,
  aud: "authenticated",
  role: "authenticated",
  email: USER_EMAIL,
  email_confirmed_at: ACCEPTANCE_AT,
  phone: "",
  confirmed_at: ACCEPTANCE_AT,
  last_sign_in_at: ACCEPTANCE_AT,
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "Guided Cloud Acceptance" },
  identities: [],
  created_at: ACCEPTANCE_AT,
  updated_at: ACCEPTANCE_AT,
  is_anonymous: false,
};

const fakeSession = {
  access_token: accessToken,
  token_type: "bearer",
  expires_in: 2_314_481_600,
  expires_at: 4_102_444_800,
  refresh_token: "acceptance-refresh-token",
  user: fakeUser,
};
const renewedToken = `${encodeJwtPart({ alg: "HS256", typ: "JWT" })}.${encodeJwtPart({ aud: "authenticated", exp: 4_102_444_801, iat: 1_787_963_201, role: "authenticated", sub: USER_ID, email: USER_EMAIL })}.${encodeJwtPart("renewed-fixture-signature")}`;
const otherUser = { ...fakeUser, id: "00000000-0000-4000-8000-000000000158", email: "other-self-service@easyerf.invalid" };
const otherToken = `${encodeJwtPart({ alg: "HS256", typ: "JWT" })}.${encodeJwtPart({ aud: "authenticated", exp: 4_102_444_801, role: "authenticated", sub: otherUser.id, email: otherUser.email })}.${encodeJwtPart("other-fixture-signature")}`;

const durableRow = {
  id: "00000000-0000-4000-8000-000000001570",
  user_id: USER_ID,
  parcel_id: PARCEL_ID,
  created_at: ACCEPTANCE_AT,
  research_status: null,
  status: "saved",
  tags: [],
  user_data: {
    displayTitle: "24 Padrone Crescent",
    address: "24 Padrone Crescent, Sea Vista, St Francis Bay",
    researchQuery: "Erf 1570 St Francis Bay",
    erfNumber: "1570",
    erf: "1570",
    portion: "0",
    municipality: "Kouga Local Municipality",
    town: "St Francis Bay",
    majorRegion: "Humansdorp",
    province: "Eastern Cape",
    lat: "-34.17924",
    lng: "24.84226",
    lpi: LPI,
    parcelKey: PARCEL_KEY,
  },
};

const rpcCalls = [];
const unexpectedMutations = [];
const routeErrors = [];
const pageErrors = [];
const selfServiceChecks = [];
let rejectNextStrategySave = false;
let simulateOffline = false;
let holdNextStrategySave = null;
let rejectNextZoningSave = false;
let holdNextZoningSave = null;
let zoningAssets = [];

function isObjectResponse(request) {
  const accept = request.headers().accept || "";
  return accept.includes("application/vnd.pgrst.object+json");
}

function filterValue(url, key) {
  const value = url.searchParams.get(key);
  return value?.startsWith("eq.") ? value.slice(3) : value;
}

async function installSyntheticSignedInSupabase(context, name) {
  contexts.push({ context, name });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const serveMap = await installIsolatedMap(context, name);
  await context.addInitScript(
    ({ storageKeys, session }) => {
      for (const key of storageKeys) {
        try {
          window.localStorage.setItem(key, JSON.stringify(session));
        } catch {
          // The same script also runs in frames without storage access.
        }
      }
    },
    { storageKeys: AUTH_STORAGE_KEYS, session: fakeSession },
  );

  await context.route("**/auth/v1/**", async (route) => {
    if (simulateOffline) return route.abort("internetdisconnected");
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname.endsWith("/auth/v1/user")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(request.headers().authorization === `Bearer ${otherToken}` ? otherUser : fakeUser),
      });
      return;
    }
    if (request.method() === "POST" && url.pathname.endsWith("/auth/v1/token")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fakeSession),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await context.route("**/rest/v1/**", async (route) => {
    if (simulateOffline) return route.abort("internetdisconnected");
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();

    try {
      if (url.pathname === "/rest/v1/saved_properties" && method === "GET") {
        const requestedUserId = filterValue(url, "user_id");
        const requestedParcelId = filterValue(url, "parcel_id");
        if (request.headers().authorization === `Bearer ${otherToken}`) assert.notEqual(requestedUserId, USER_ID, "Account B must not request account A's saved properties");
        const userMatches = !requestedUserId || requestedUserId === USER_ID;
        const parcelMatches = !requestedParcelId || requestedParcelId === PARCEL_ID;
        const found = userMatches && parcelMatches;
        const select = url.searchParams.get("select") || "";
        const objectResponse = isObjectResponse(request) || select.trim() === "id";

        if (objectResponse) {
          await route.fulfill({
            status: found ? 200 : 406,
            contentType: "application/json",
            body: found
              ? JSON.stringify(Object.fromEntries(select.split(",").map((key) => [key, durableRow[key]])))
              : JSON.stringify({
                  code: "PGRST116",
                  details: "The result contains 0 rows",
                  hint: null,
                  message: "JSON object requested, multiple (or no) rows returned",
                }),
          });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "content-range": found ? "0-0/1" : "*/0" },
          body: JSON.stringify(found ? [durableRow] : []),
        });
        return;
      }

      if (
        url.pathname === "/rest/v1/rpc/patch_saved_property_user_data_if_unchanged" &&
        method === "POST"
      ) {
        const payload = request.postDataJSON();
        const patch = payload?.p_user_data_patch;
        const parcelId = payload?.p_parcel_id;
        const bodyText = JSON.stringify(payload ?? {});
        const call = {
          parcelId,
          patch,
          hasBrowserUserId: bodyText.includes('"user_id"'),
          authorization: request.headers().authorization || "",
        };
        rpcCalls.push(call);
        if (patch?.easyErfInvestigation?.planning && holdNextZoningSave) {
          const held = holdNextZoningSave;
          holdNextZoningSave = null;
          held.started();
          await held.release;
        }
        if (patch?.easyErfInvestigation?.planning && rejectNextZoningSave) {
          rejectNextZoningSave = false;
          await route.fulfill({ status: 503, json: { code: "FIXTURE_OFFLINE", message: "Synthetic zoning save failure" } });
          return;
        }
        if (patch?.strategyWorkspace && holdNextStrategySave) {
          const held = holdNextStrategySave;
          holdNextStrategySave = null;
          held.started();
          await held.release;
        }
        if (patch?.strategyWorkspace && rejectNextStrategySave) {
          rejectNextStrategySave = false;
          await route.fulfill({ status: 503, json: { code: "FIXTURE_OFFLINE", message: "Synthetic offline save" } });
          return;
        }

        if (parcelId !== PARCEL_ID || !patch || typeof patch !== "object") {
          await route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({ message: "Invalid acceptance RPC payload" }),
          });
          return;
        }

        for (const key of Object.keys(patch)) {
          if (JSON.stringify(payload.p_expected?.[key]) !== JSON.stringify(durableRow.user_data[key])) {
            await route.fulfill({ status: 409, json: { code: "40001", message: "Fixture rejected stale baseline" } });
            return;
          }
        }

        durableRow.user_data = { ...durableRow.user_data, ...patch };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(durableRow.user_data),
        });
        return;
      }

      if (method === "GET" || method === "HEAD") {
        if (url.pathname === "/rest/v1/erf_assets") {
          const categories = url.searchParams.get("asset_category");
          const matches = filterValue(url, "parcel_id") === PARCEL_ID && filterValue(url, "user_id") === USER_ID
            && (!categories || categories.includes("zoning_document"));
          return route.fulfill({ json: matches ? zoningAssets : [] });
        }
        const body = isObjectResponse(request) ? "null" : "[]";
        await route.fulfill({ status: 200, contentType: "application/json", body });
        return;
      }

      unexpectedMutations.push(`${method} ${url.pathname}`);
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ message: "Unexpected mocked persistence mutation" }),
      });
    } catch (error) {
      routeErrors.push(error instanceof Error ? error.message : String(error));
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Acceptance route handler failed" }),
      });
    }
  });

  await context.route("**/storage/v1/**", async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      unexpectedMutations.push(`${method} ${new URL(request.url()).pathname}`);
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await context.route("**/functions/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith("/functions/v1/arcgis-public-proxy")) {
      await serveMap(route);
      return;
    }

    unexpectedMutations.push(`${request.method().toUpperCase()} ${url.pathname}`);
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ message: "Unexpected function invocation" }),
    });
  });
}

async function firstVisible(page, locator, description, timeout = 60_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const count = await locator.count();
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      if (await candidate.isVisible().catch(() => false)) return candidate;
    }
    await page.waitForTimeout(100);
  }

  const bodyText = await page.locator("body").innerText().catch(() => "");
  throw new Error(
    `Could not find visible ${description}. Body excerpt: ${JSON.stringify(bodyText.slice(0, 3500))}`,
  );
}

async function waitForRpc(predicate, page, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const call = rpcCalls.find(predicate);
    if (call) return call;
    await page.waitForTimeout(100);
  }
  throw new Error(`Expected cloud persistence RPC was not observed. Calls: ${JSON.stringify(rpcCalls)}`);
}

function attachPageDiagnostics(page) {
  page.on("pageerror", (error) => pageErrors.push(error.stack ?? error.message));
}

async function verifyTopOffer(page, label, width) {
  await page.setViewportSize({ width, height: 900 });
  const offer = page.locator("[data-done-for-you-top]");
  await offer.waitFor();
  // Reset the real Workbench scroller, not the page behind the dossier.
  await offer.evaluate((element) => {
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (getComputedStyle(parent).overflowY === "auto") parent.scrollTop = 0;
    }
  });
  const action = offer.getByRole("link", { name: "Investigate it for me · R999", exact: true });
  const box = await action.boundingBox();
  assert.ok(box && box.y >= 0 && box.y + box.height < 900, `${label}/${width}: offer requires scrolling`);
  assert.equal(await offer.evaluate((el) => getComputedStyle(el).position), "static");
  assert.ok((await action.getAttribute("href")).includes(encodeURIComponent(PARCEL_ID)));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await action.click({ trial: true });
  await page.screenshot({ path: resolve(artifacts, `top-r999-${label}-${width}.png`) });
  topOfferChecks.push({ label, width, box, selectedParcel: PARCEL_ID, inFlow: true });
}

const browser = await chromium.launch({ headless: true, channel: process.env.EASY_ERF_BROWSER_CHANNEL || undefined });

try {
  const firstContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await installSyntheticSignedInSupabase(firstContext, "initial");
  const firstPage = await firstContext.newPage();
  attachPageDiagnostics(firstPage);

  await firstPage.goto(`${baseUrl}/dashboard`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await firstPage.getByRole("heading", { name: /My Investigations/i }).waitFor({
    state: "visible",
    timeout: 30_000,
  });
  await firstPage.getByText("24 Padrone Crescent", { exact: true }).first().waitFor({
    state: "visible",
    timeout: 30_000,
  });
  await firstVisible(
    firstPage,
    firstPage.locator("button").filter({ hasText: /^Start Investigation$/i }),
    "Start Investigation button",
  ).then((button) => button.click());

  await firstVisible(
    firstPage,
    firstPage.locator("h4").filter({ hasText: /^Confirm this is the correct erf$/i }),
    "Guided property confirmation heading",
  );
  await firstVisible(
    firstPage,
    firstPage.locator("button").filter({ hasText: /Yes, this is the correct erf/i }),
    "confirm correct erf button",
  ).then((button) => button.click());
  await firstVisible(
    firstPage,
    firstPage.locator("h4").filter({ hasText: /^Add the address people use to find this erf$/i }),
    "Guided working-address heading",
  );

  const persistedCall = await waitForRpc(
    (call) =>
      call.parcelId === PARCEL_ID &&
      call.patch?.easyErfInvestigation?.identityStatus === "looks_correct" &&
      call.patch?.easyErfInvestigation?.investigation?.currentStepId === "add-address",
    firstPage,
  );

  const projection = persistedCall.patch.easyErfInvestigation;
  await firstPage.goBack();
  await firstPage.getByRole("heading", { name: "Confirm this is the correct erf", exact: true }).waitFor();
  await firstPage.goForward();
  await firstPage.getByRole("heading", { name: "Add the address people use to find this erf", exact: true }).waitFor();
  assert.equal(await firstPage.evaluate(() => history.state.easyErfJourney.stepId), "add-address");
  if (persistedCall.hasBrowserUserId) {
    throw new Error("Guided persistence RPC included a browser-supplied user_id.");
  }
  if (!persistedCall.authorization.startsWith("Bearer ")) {
    throw new Error("Guided persistence RPC was not sent through the signed-in Supabase client.");
  }
  if (projection.parcelId !== PARCEL_ID || projection.version !== 1) {
    throw new Error(`Unexpected durable projection identity: ${JSON.stringify(projection)}`);
  }
  if (!projection.investigation.startedAt || !projection.workspaceUpdatedAt || !projection.syncedAt) {
    throw new Error(`Durable projection is missing timestamps: ${JSON.stringify(projection)}`);
  }

  const scopedWorkspaceKey = `easyerf.user.${encodeURIComponent(USER_ID)}.workspace.${encodeURIComponent(PARCEL_ID)}`;
  const anonymousWorkspaceKey = `easyerf.anonymous.workspace.${encodeURIComponent(PARCEL_ID)}`;
  const firstStorage = await firstPage.evaluate(
    ({ scopedKey, anonymousKey }) => ({
      scoped: window.localStorage.getItem(scopedKey),
      anonymous: window.localStorage.getItem(anonymousKey),
    }),
    { scopedKey: scopedWorkspaceKey, anonymousKey: anonymousWorkspaceKey },
  );
  const firstWorkspace = firstStorage.scoped ? JSON.parse(firstStorage.scoped) : null;
  if (
    firstWorkspace?.identityStatus !== "looks_correct" ||
    firstWorkspace?.investigation?.currentStepId !== "add-address"
  ) {
    throw new Error(`Signed-in browser workspace was not updated correctly: ${firstStorage.scoped}`);
  }
  const anonymousWorkspace = firstStorage.anonymous ? JSON.parse(firstStorage.anonymous) : null;
  const anonymousHasMaterialGuidedProgress = Boolean(
    anonymousWorkspace &&
      (anonymousWorkspace.identityStatus !== "none" ||
        anonymousWorkspace.dirty ||
        anonymousWorkspace.investigation?.currentStepId ||
        anonymousWorkspace.investigation?.lastMeaningfulActionAt ||
        anonymousWorkspace.investigation?.intentionallyVisitedStepIds?.length),
  );
  if (anonymousHasMaterialGuidedProgress) {
    throw new Error(
      `Signed-in Guided progress leaked into the anonymous browser namespace: ${firstStorage.anonymous}`,
    );
  }

  await firstPage.screenshot({ path: resolve(artifacts, "initial-add-address.png"), fullPage: true });
  for (const width of [1440, 390]) {
    await firstPage.setViewportSize({ width, height: 950 });
    const offer = firstPage.locator("[data-done-for-you-top]");
    await offer.waitFor();
    const action = offer.getByRole("link", { name: "Investigate it for me · R999", exact: true });
    await verifyTopOffer(firstPage, "address", width);
    assert.ok((await action.getAttribute("href")).includes(encodeURIComponent(PARCEL_ID)));
    assert.equal(await offer.locator("details").count(), 0);
    assert.ok(await firstPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await firstPage.screenshot({ path: resolve(artifacts, `prominent-r999-${width}.png`) });
    await firstPage.getByRole("button", { name: "Save and continue to SG diagram", exact: true }).click({ trial: true, timeout: 5000 });
    await firstPage.getByRole("button", { name: "Open full research workspace", exact: true }).scrollIntoViewIfNeeded();
    await firstPage.getByRole("button", { name: "Open full research workspace", exact: true }).click({ trial: true });
    await firstPage.screenshot({ path: resolve(artifacts, `guided-controls-${width}.png`) });
  }
  await firstPage.setViewportSize({ width: 1440, height: 1000 });
  await firstPage.locator("[data-done-for-you-top]").getByRole("link", { name: "Investigate it for me · R999", exact: true }).click();
  await firstPage.waitForURL((url) => url.pathname === "/pricing");
  assert.equal(new URL(firstPage.url()).searchParams.get("parcelId"), PARCEL_ID);
  await firstPage.screenshot({ path: resolve(artifacts, "r999-selected-property-destination.png"), fullPage: true });
  // Keep both contexts until their traces are saved in finally.

  const reopenContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await installSyntheticSignedInSupabase(reopenContext, "reopened");
  const reopenPage = await reopenContext.newPage();
  attachPageDiagnostics(reopenPage);

  await reopenPage.goto(`${baseUrl}/dashboard`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await reopenPage.getByRole("heading", { name: /My Investigations/i }).waitFor({
    state: "visible",
    timeout: 30_000,
  });
  await reopenPage.getByText(/Step 2 of 10.*Add address/i).first().waitFor({
    state: "visible",
    timeout: 30_000,
  });
  await reopenPage.getByText(/Saved status synced/i).first().waitFor({
    state: "visible",
    timeout: 30_000,
  });

  const hydrationDeadline = Date.now() + 20_000;
  let hydratedWorkspace = null;
  while (Date.now() < hydrationDeadline) {
    const raw = await reopenPage.evaluate(
      (key) => window.localStorage.getItem(key),
      scopedWorkspaceKey,
    );
    hydratedWorkspace = raw ? JSON.parse(raw) : null;
    if (
      hydratedWorkspace?.identityStatus === "looks_correct" &&
      hydratedWorkspace?.investigation?.currentStepId === "add-address"
    ) {
      break;
    }
    await reopenPage.waitForTimeout(100);
  }
  if (
    hydratedWorkspace?.identityStatus !== "looks_correct" ||
    hydratedWorkspace?.investigation?.currentStepId !== "add-address"
  ) {
    throw new Error(`Fresh browser context did not hydrate durable Guided progress.`);
  }

  await firstVisible(
    reopenPage,
    reopenPage.locator("button").filter({ hasText: /^Continue Investigation$/i }),
    "Continue Investigation button",
  ).then((button) => button.click());
  await firstVisible(
    reopenPage,
    reopenPage.locator("h4").filter({ hasText: /^Add the address people use to find this erf$/i }),
    "reopened Guided working-address heading",
  );

  for (const label of (process.env.EASY_ERF_SELF_SERVICE_ONLY ? [] : ["Confirm", "Address", "SG", "Title", "Zoning", "Checks", "Market", "Strategy", "Potential", "Report"])) {
    const navigator = reopenPage.getByRole("region", { name: "Guided investigation steps" });
    const step = navigator.getByRole("button", { name: new RegExp(`Step \\d+ ${label}$`) });
    await step.click();
    await reopenPage.waitForFunction((text) =>
      [...document.querySelectorAll('[aria-current="step"]')].some((el) => el.textContent.endsWith(text)), label);
    await reopenPage.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.ok(await reopenPage.locator("[data-done-for-you-top]").evaluate((el) => {
      for (let parent = el.parentElement; parent; parent = parent.parentElement) {
        if (getComputedStyle(parent).overflowY === "auto") return parent.scrollTop <= 1;
      }
      return false;
    }), `${label}: changing step must open at the top without manual scrolling`);
    for (const width of [1440, 390]) await verifyTopOffer(reopenPage, label.toLowerCase(), width);
    const offer = reopenPage.locator("[data-done-for-you-top]");
    assert.ok(await offer.evaluate((el) => Boolean(el.compareDocumentPosition(
      document.querySelector('[aria-label="Guided investigation steps"]')) & Node.DOCUMENT_POSITION_FOLLOWING)));
    const before = structuredClone(durableRow.user_data);
    const browserBefore = JSON.parse(await reopenPage.evaluate((key) => localStorage.getItem(key), scopedWorkspaceKey));
    await offer.getByRole("link", { name: "Investigate it for me · R999", exact: true }).click();
    await reopenPage.waitForURL((url) => url.pathname === "/pricing");
    assert.equal(new URL(reopenPage.url()).searchParams.get("parcelId"), PARCEL_ID);
    assert.equal(durableRow.user_data.easyErfInvestigation.identityStatus, "looks_correct");
    for (const [key, value] of Object.entries(durableRow.user_data.easyErfInvestigation.investigation)) {
      assert.deepEqual(value, browserBefore.investigation[key], `${label} handoff must flush current ${key}`);
    }
    for (const key of Object.keys(before).filter((key) => key !== "easyErfInvestigation")) {
      // Existing handoff normalizes an absent envelope to an empty object, not lost work.
      if (key === "buildEnvelopeInputs" && before[key] === null) {
        assert.deepEqual(durableRow.user_data[key], {});
        continue;
      }
      if (key === "normalizedParcel") {
        const actual = structuredClone(durableRow.user_data[key]);
        const expected = structuredClone(before[key]);
        delete actual.rawProperties.propertyatlas_fetched_at;
        delete expected.rawProperties.propertyatlas_fetched_at;
        assert.deepEqual(actual, expected, `${label} handoff changed parcel identity`);
        continue;
      }
      assert.deepEqual(durableRow.user_data[key], before[key], `${label} handoff lost ${key}`);
    }
    handoffChecks.push({ label, sameParcel: true, currentDraftFlushed: true, priorWorkPreserved: true });
    await reopenPage.goto(`${baseUrl}/dashboard`);
    await reopenPage.getByRole("button", { name: /^Continue Investigation$/i }).first().click();
    await reopenPage.getByRole("region", { name: "Guided investigation steps" }).waitFor();
  }

  // Opening the selected parcel without a saved-workspace entry is zero-commit First Read.
  await reopenPage.goto(baseUrl);
  // The launcher is server-rendered before its click handler is hydrated.
  // Match the existing official-search fixture's mounted-map readiness gate.
  await reopenPage.getByText(/CSG parcels loaded:/i).first().waitFor();
  await reopenPage.getByRole("button", { name: /Search address, erf number, suburb, LPI, or parcel key/i }).click();
  await reopenPage.getByRole("button", { name: /^Erf Search/ }).click();
  await reopenPage.getByPlaceholder("LPI or parcel key", { exact: true }).fill(LPI);
  await reopenPage.getByRole("button", { name: "Search official parcel identity", exact: true }).click();
  await reopenPage.getByRole("button", { name: /^Open Erf 1570/ }).click();
  await reopenPage.getByText("Property first read", { exact: true }).waitFor();
  for (const width of [1440, 390]) await verifyTopOffer(reopenPage, "first-read", width);
  assert.ok(await reopenPage.locator("[data-done-for-you-top]").evaluate((el) =>
    Boolean(el.compareDocumentPosition(document.getElementById("property-facts-heading")) & Node.DOCUMENT_POSITION_FOLLOWING)));

  // The real root-route First Read entry must survive same-parcel traversal.
  assert.equal(await reopenPage.evaluate(() => history.state.easyErfJourney.parcelId), PARCEL_ID);
  const secondParcel = registry.records.find((record) => record.lpi && record.id !== PARCEL_ID && record.erf !== "1570");
  assert.ok(secondParcel);
  const selectFromSearch = async (record) => {
    await reopenPage.getByRole("button", { name: "Back to full map", exact: true }).first().click();
    await reopenPage.getByRole("button", { name: /Search address, erf number, suburb, LPI, or parcel key/i }).click();
    await reopenPage.getByRole("button", { name: /^Erf Search/ }).click();
    await reopenPage.getByPlaceholder("LPI or parcel key", { exact: true }).fill(record.lpi);
    await reopenPage.getByRole("button", { name: "Search official parcel identity", exact: true }).click();
    await reopenPage.getByRole("button", { name: new RegExp(`^Open Erf ${record.erf}`) }).click();
    await reopenPage.getByText("Property first read", { exact: true }).waitFor();
  };
  for (const width of [1440, 390]) {
    await reopenPage.setViewportSize({ width, height: 1000 });
    await reopenPage.waitForTimeout(1000);
    const beforeNavigation = rpcCalls.length;
    const storedWork = await reopenPage.evaluate((key) => localStorage.getItem(key), scopedWorkspaceKey);
    await selectFromSearch(secondParcel);
    assert.equal(await reopenPage.evaluate(() => history.state.easyErfJourney.parcelId), secondParcel.id);
    await reopenPage.goBack();
    await reopenPage.waitForFunction(() => history.state?.easyErfJourney?.selection === null);
    await reopenPage.goBack();
    await reopenPage.waitForFunction((id) => history.state?.easyErfJourney?.parcelId === id, PARCEL_ID);
    await reopenPage.getByText("Property first read", { exact: true }).waitFor();
    await reopenPage.goForward();
    await reopenPage.waitForFunction(() => history.state?.easyErfJourney?.selection === null);
    await reopenPage.goForward();
    await reopenPage.waitForFunction((id) => history.state?.easyErfJourney?.parcelId === id, secondParcel.id);
    await reopenPage.goBack();
    await reopenPage.waitForFunction(() => history.state?.easyErfJourney?.selection === null);
    await reopenPage.goBack();
    await reopenPage.getByText("Property first read", { exact: true }).waitFor();
    await reopenPage.waitForTimeout(1000);
    assert.equal(rpcCalls.length, beforeNavigation, "History replay must not save investigation data");
    assert.equal(await reopenPage.evaluate((key) => localStorage.getItem(key), scopedWorkspaceKey), storedWork);
    await reopenPage.screenshot({ path: resolve(artifacts, `first-read-history-${width}.png`) });
  }
  await reopenPage.getByRole("button", { name: /^(Investigate this property|Continue investigation)$/i }).first().click();
  await reopenPage.getByRole("region", { name: "Guided investigation steps" }).waitFor();
  const guidedEntry = await reopenPage.evaluate(() => history.state.easyErfJourney);
  await reopenPage.goBack();
  await reopenPage.getByText("Property first read", { exact: true }).waitFor();
  await reopenPage.goBack();
  await reopenPage.getByText("Property first read", { exact: true }).waitFor({ state: "hidden" });
  assert.equal(await reopenPage.evaluate(() => history.state.easyErfJourney.selection), null);
  await reopenPage.goForward();
  await reopenPage.getByText("Property first read", { exact: true }).waitFor();
  await reopenPage.goForward();
  await reopenPage.getByRole("region", { name: "Guided investigation steps" }).waitFor();
  assert.deepEqual(await reopenPage.evaluate(() => history.state.easyErfJourney), guidedEntry);
  await reopenPage.goBack();
  await reopenPage.reload();
  await reopenPage.getByText("Property first read", { exact: true }).waitFor();
  assert.equal(await reopenPage.evaluate(() => history.state.easyErfJourney.parcelId), PARCEL_ID);

  for (const width of [1440, 390]) {
    await reopenPage.setViewportSize({ width, height: 1000 });
    if (width === 1440) await reopenPage.getByRole("button", { name: /^(Investigate this property|Continue investigation)$/i }).first().click();
    const step = (label) => reopenPage.getByRole("region", { name: "Guided investigation steps" })
      .getByRole("button", { name: new RegExp(`Step \\d+ ${label}$`) });
    if (width === 1440) {
      await step("Address").click();
      await reopenPage.getByRole("button", { name: "Skip for now", exact: true }).click();
      await reopenPage.waitForFunction(() => [...document.querySelectorAll('[aria-current="step"]')].some((el) => el.textContent.endsWith("SG")));
      await waitForRpc((call) => call.patch?.easyErfInvestigation?.investigation?.skippedStepIds.includes("add-address"), reopenPage);
      await reopenPage.waitForTimeout(1000);
      const beforeReplay = rpcCalls.length;
      await reopenPage.goBack();
      await reopenPage.getByRole("heading", { name: "Add the address people use to find this erf", exact: true }).waitFor();
      await reopenPage.goForward();
      await reopenPage.waitForFunction(() => [...document.querySelectorAll('[aria-current="step"]')].some((el) => el.textContent.endsWith("SG")));
      await reopenPage.waitForTimeout(1000);
      assert.equal(rpcCalls.length, beforeReplay, "Replaying a skipped step must not save again");
    }
    await step("Zoning").click();
    if (width === 1440) {
      await reopenPage.getByText("No supported zoning match for this erf", { exact: false }).waitFor();
      await reopenPage.getByRole("region", { name: "Zoning decision" }).scrollIntoViewIfNeeded();
      await reopenPage.screenshot({ path: resolve(artifacts, "zoning-no-match-1440.png") });
      await reopenPage.setViewportSize({ width: 390, height: 1000 });
      await reopenPage.screenshot({ path: resolve(artifacts, "zoning-no-match-390.png") });
      await reopenPage.setViewportSize({ width, height: 1000 });
      await reopenPage.getByRole("button", { name: "Not sure - continue without confirming", exact: true }).click();
      await reopenPage.getByText("No optional property-check files have been added.", { exact: false }).waitFor();
      assert.equal(durableRow.user_data.easyErfInvestigation.planning.userConfirmedZoneCode, null);
      assert.ok(durableRow.user_data.easyErfInvestigation.investigation.skippedStepIds.includes("zoning"));
      await step("Zoning").click();
    }
    const zoningChooser = reopenPage.getByRole("button", { name: /^(Choose zoning|Change zoning)$/ });
    if (await zoningChooser.getAttribute("aria-expanded") !== "true") await zoningChooser.click();
    await reopenPage.getByRole("radio", { name: /^RES1 / }).click();
    await reopenPage.getByRole("region", { name: "Zoning decision" }).scrollIntoViewIfNeeded();
    await reopenPage.screenshot({ path: resolve(artifacts, `zoning-working-option-${width}.png`) });
    if (width === 1440) {
      await reopenPage.waitForTimeout(1200);
      rejectNextZoningSave = true;
      await reopenPage.getByRole("button", { name: "Use this zoning and continue", exact: true }).click();
      await reopenPage.getByRole("alert").filter({ hasText: /Your selection is retained/ }).waitFor();
      assert.equal(await reopenPage.getByRole("radio", { name: /^RES1 / }).getAttribute("aria-checked"), "true");
    }
    let zoningStarted, releaseZoning;
    const zoningPending = new Promise((resolve) => { zoningStarted = resolve; });
    holdNextZoningSave = { started: zoningStarted, release: new Promise((resolve) => { releaseZoning = resolve; }) };
    await reopenPage.getByRole("button", { name: "Use this zoning and continue", exact: true }).click();
    await Promise.race([zoningPending, new Promise((_, reject) => setTimeout(() => reject(new Error("Zoning save did not start")), 15000))]);
    assert.ok(await reopenPage.getByRole("region", { name: "Zoning decision" }).isVisible());
    assert.equal(await reopenPage.getByRole("button", { name: "Saving zoning...", exact: true }).isDisabled(), true);
    releaseZoning();
    await reopenPage.getByText("No optional property-check files have been added.", { exact: false }).waitFor();
    assert.equal(durableRow.user_data.easyErfInvestigation.planning.userConfirmedZoneCode, "RES1");
    await reopenPage.getByRole("button", { name: "Continue without additional documents", exact: true }).click();
    await step("Checks").click();
    await reopenPage.getByText("Done - Optional checks reviewed. Property evidence remains unverified.", { exact: true }).waitFor();
    await reopenPage.getByText("No optional property-check files have been added.", { exact: false }).waitFor();
    await reopenPage.screenshot({ path: resolve(artifacts, `self-service-checks-complete-${width}.png`) });
    await step("Strategy").click();
    assert.ok(durableRow.user_data.easyErfInvestigation.investigation.acknowledgedTaskIds.includes("property-checks"));
    await reopenPage.getByRole("button", { name: "Open Strategy & Calculators", exact: true }).click();
    const price = reopenPage.getByLabel("Purchase price", { exact: true });
    if (width === 1440) {
      await reopenPage.getByText(/Cloud draft restored|Draft saved/i).first().waitFor();
      simulateOffline = true;
      await price.fill("1220000");
      await price.blur();
      await reopenPage.getByText("Offline draft saved in this browser", { exact: false }).waitFor();
      assert.equal(await price.inputValue(), "1220000");
      simulateOffline = false;
      await reopenPage.getByRole("button", { name: "Retry", exact: true }).click();
      await reopenPage.getByText(/Draft saved at/i).first().waitFor();
      assert.equal(durableRow.user_data.strategyWorkspace.draftInputs.purchasePrice, "1220000");
    }
    rejectNextStrategySave = true;
    await price.fill(String(1234000 + width));
    await price.blur();
    await reopenPage.getByRole("alert").filter({ hasText: /draft is still kept locally/ }).waitFor();
    assert.equal(await price.inputValue(), String(1234000 + width));
    await reopenPage.getByRole("button", { name: "Retry", exact: true }).click();
    await reopenPage.getByText(/Draft saved at/i).first().waitFor();
    assert.equal(durableRow.user_data.strategyWorkspace.draftInputs.purchasePrice, String(1234000 + width));
    let signalStarted, releaseSave;
    const started = new Promise((resolve) => { signalStarted = resolve; });
    holdNextStrategySave = { started: signalStarted, release: new Promise((resolve) => { releaseSave = resolve; }) };
    await price.fill(String(1235000 + width));
    await price.blur();
    await started;
    await reopenPage.goBack();
    await reopenPage.getByRole("button", { name: "Open Strategy & Calculators", exact: true }).waitFor();
    await reopenPage.goForward();
    await price.waitFor();
    assert.equal(await price.inputValue(), String(1235000 + width));
    releaseSave();
    await reopenPage.getByText(/Cloud draft restored|Draft saved at/i).first().waitFor();
    assert.equal(durableRow.user_data.strategyWorkspace.draftInputs.purchasePrice, String(1235000 + width));
    await price.fill(String(1236000 + width));
    await reopenPage.evaluate(async ({ access_token, refresh_token }) => {
      const { supabase } = await import("/src/integrations/supabase/client.ts");
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) throw new Error(`Synthetic renewal failed: ${error.name}: ${error.message}`);
    }, { access_token: renewedToken, refresh_token: "renewed-fixture-refresh" });
    assert.equal(await price.inputValue(), String(1236000 + width));
    await price.blur();
    await waitForRpc((call) => call.patch?.strategyWorkspace?.draftInputs.purchasePrice === String(1236000 + width) && call.authorization === `Bearer ${renewedToken}`, reopenPage);
    await reopenPage.screenshot({ path: resolve(artifacts, `self-service-strategy-${width}.png`) });
    await reopenPage.getByRole("button", { name: "Use this scenario and continue", exact: true }).click();
    await reopenPage.getByRole("button", { name: /Open Site Potential/i }).click();
    if (width === 1440) {
      await reopenPage.getByText("Review inputs and technical details", { exact: true }).click();
      await reopenPage.getByRole("checkbox", { name: /The outline shown matches the erf/ }).check();
      await reopenPage.getByRole("button", { name: /^Boundary 1(?: ·|$)/ }).click();
      await reopenPage.getByRole("button", { name: "Accept this Site Potential", exact: true }).click();
      await reopenPage.screenshot({ path: resolve(artifacts, `self-service-envelope-accepted-${width}.png`) });
      await reopenPage.getByRole("button", { name: "Save this envelope and continue", exact: true }).click();
      await reopenPage.waitForFunction(() => [...document.querySelectorAll('[aria-current="step"]')].some((el) => el.textContent.endsWith("Report")));
      assert.ok(durableRow.user_data.buildEnvelopeInputs.acceptedInputSignature);
    } else {
      await reopenPage.getByRole("button", { name: "Skip Site Potential", exact: true }).click();
    }
    await reopenPage.waitForFunction(() => [...document.querySelectorAll('[aria-current="step"]')].some((el) => el.textContent.endsWith("Report")));
    assert.equal(durableRow.user_data.easyErfInvestigation.sitePotential.skipped, width !== 1440);
    await reopenPage.screenshot({ path: resolve(artifacts, `self-service-report-${width}.png`) });
    const beforeHistory = structuredClone(durableRow.user_data);
    await reopenPage.goBack();
    await reopenPage.getByRole("button", { name: "Skip Site Potential", exact: true }).waitFor();
    await reopenPage.goForward();
    await reopenPage.waitForFunction(() => [...document.querySelectorAll('[aria-current="step"]')].some((el) => el.textContent.endsWith("Report")));
    assert.equal(durableRow.user_data.strategyWorkspace.draftInputs.purchasePrice, beforeHistory.strategyWorkspace.draftInputs.purchasePrice);
    await reopenPage.reload();
    await reopenPage.waitForFunction(() => [...document.querySelectorAll('[aria-current="step"]')].some((el) => el.textContent.endsWith("Report")));
    await step("Zoning").click();
    await reopenPage.getByText("Working zoning confirmed by you", { exact: false }).waitFor();
    await reopenPage.getByRole("button", { name: "Change zoning", exact: true }).click();
    await reopenPage.getByRole("radio", { name: /^RES1 / }).click();
    await reopenPage.getByText("Working zoning confirmed by you", { exact: false }).waitFor();
    selfServiceChecks.push({ width, noFileChecksComplete: true, zoningReloaded: true, offlineDraftRetained: width === 1440 ? true : "covered at desktop", retryPersisted: true, siteDisposition: width === 1440 ? "accepted and saved" : "skip saved", historyRestored: true });
  }

  // Existing matched, readable subject evidence is a suggestion, never municipal approval.
  zoningAssets = [{ id: "00000000-0000-4000-8000-000000000942", user_id: USER_ID, parcel_id: PARCEL_ID,
    asset_category: "zoning_document", asset_type: "zoning_certificate", source_label: "Synthetic municipal record",
    original_file_name: "synthetic-zoning.pdf", storage_bucket: "erf-files", storage_path: "synthetic/not-requested.pdf",
    mime_type: "application/pdf", size_bytes: 1024, status: "ready", created_at: ACCEPTANCE_AT, updated_at: ACCEPTANCE_AT,
    metadata: { extractionStatus: "ready", identityMatchStatus: "matched", extractedClaims: [{
      domain: "planning", key: "zoning", label: "Zoning", value: "RES1", scope: "subject", confidence: "high", interpretation: false,
    }] } }];
  await reopenPage.reload();
  await reopenPage.getByText("Suggested zoning for this erf", { exact: true }).waitFor();
  for (const width of [1440, 390]) {
    await reopenPage.setViewportSize({ width, height: 1000 });
    await reopenPage.getByRole("region", { name: "Zoning decision" }).scrollIntoViewIfNeeded();
    await reopenPage.screenshot({ path: resolve(artifacts, `zoning-supported-${width}.png`) });
    await reopenPage.getByRole("button", { name: "Use this zoning and continue", exact: true }).click();
    await reopenPage.getByText("No optional property-check files have been added.", { exact: false }).waitFor();
    assert.equal(durableRow.user_data.easyErfInvestigation.planning.userConfirmedZoneCode, "RES1");
    await reopenPage.getByRole("region", { name: "Guided investigation steps" }).getByRole("button", { name: /Step \d+ Zoning$/ }).click();
  }
  zoningAssets = [];
  await reopenPage.reload();
  await reopenPage.getByRole("button", { name: "Change zoning", exact: true }).click();
  selfServiceChecks.push({ noSupportedMatch: true, notSureSavedWithoutConfirmation: true, supportedSuggestionDesktopMobile: true,
    zoningDelayedSaveBlocksContinue: true, zoningFailureRetainsSelection: true });

  // A second session changes the acknowledged record; the browser must not overwrite it.
  const remoteIdentity = "uncertain";
  durableRow.user_data.easyErfInvestigation.identityStatus = remoteIdentity;
  await reopenPage.getByRole("radio", { name: /^RES1 / }).click();
  await reopenPage.getByRole("region", { name: "This property's save status" })
    .getByRole("alert").filter({ hasText: /changed in another session/ }).waitFor();
  assert.equal(durableRow.user_data.easyErfInvestigation.identityStatus, remoteIdentity);
  const draftBeforeResolution = await reopenPage.evaluate((key) => JSON.parse(localStorage.getItem(key)), scopedWorkspaceKey);
  assert.equal(draftBeforeResolution.identityStatus, "looks_correct");
  await reopenPage.getByRole("button", { name: "Keep a draft backup and load saved version", exact: true }).click();
  await reopenPage.getByRole("button", { name: "Download preserved drafts", exact: true }).waitFor();
  const backups = await reopenPage.evaluate(({ userId, parcelId }) => JSON.parse(localStorage.getItem(
    `easyerf.user.${encodeURIComponent(userId)}.investigation-conflict-backups.${encodeURIComponent(parcelId)}`)), { userId: USER_ID, parcelId: PARCEL_ID });
  assert.equal(backups.at(-1).local.workspace.identityStatus, "looks_correct");
  assert.equal(backups.at(-1).remote.easyErfInvestigation.identityStatus, remoteIdentity);
  selfServiceChecks.push({ concurrentEditRejected: true, localAndRemoteDraftsPreserved: true });
  await reopenPage.evaluate(async ({ access_token, refresh_token }) => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) throw new Error("Synthetic account switch failed");
  }, { access_token: otherToken, refresh_token: "other-fixture-refresh" });
  await reopenPage.getByRole("heading", { name: "Confirm this is the correct erf", exact: true }).waitFor();
  assert.equal(await reopenPage.getByRole("button", { name: "Download preserved drafts", exact: true }).count(), 0);
  await reopenPage.evaluate(async ({ access_token, refresh_token }) => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) throw new Error("Synthetic account restore failed");
  }, { access_token: renewedToken, refresh_token: "renewed-fixture-refresh" });
  await reopenPage.getByRole("button", { name: "Download preserved drafts", exact: true }).waitFor();
  selfServiceChecks.push({ sameUserRenewalRetainsInput: true, renewedCredentialUsed: true, otherAccountCannotSeeDrafts: true, originalAccountDraftsReturn: true });

  if (routeErrors.length > 0) {
    throw new Error(`Acceptance route handlers failed: ${routeErrors.join(" | ")}`);
  }
  if (unexpectedMutations.length > 0) {
    throw new Error(
      `Signed-in persistence acceptance observed unexpected mutations: ${unexpectedMutations.join(", ")}`,
    );
  }
  if (pageErrors.length > 0) {
    throw new Error(`Browser errors occurred: ${pageErrors.join(" | ")}`);
  }
  assert.ok(mapChecks.every((state) => state.requests >= 2 && state.staleSettled),
    "Both browser contexts must exercise late pre-pan parcel responses");
  await reopenPage.screenshot({ path: resolve(artifacts, "reopened-add-address.png"), fullPage: true });
  acceptancePassed = true;

  console.log(
    `Guided cloud persistence verified: confirm, durable save, fresh hydration; self-service desktop/mobile saves, history, conflicts and account isolation. R999 handoff steps checked: ${handoffChecks.length}. No production persistence mutation.`,
  );

} finally {
  for (const { context, name } of contexts) {
    if (!acceptancePassed) {
      for (const page of context.pages()) {
        await page.screenshot({ path: resolve(artifacts, `${name}-failure.png`), fullPage: true }).catch(() => {});
      }
    }
    await context.tracing.stop({ path: resolve(artifacts, `${name}-trace.zip`) });
  }
  await writeFile(resolve(artifacts, "receipt.json"), JSON.stringify({
    sha, dirty, acceptancePassed, topOfferChecks, handoffChecks, selfServiceChecks, mapChecks, routeErrors, pageErrors, unexpectedMutations,
    productionAccess: false, geometry: "synthetic test-only bounds; not cadastral proof",
    checks: acceptancePassed ? ["signed-in confirm and atomic persistence", "fresh-context hydration", "dashboard reopen at Add address", "late pre-pan response isolation"] : [],
  }, null, 2));
  await browser.close();
}
