import { chromium } from "playwright";

const baseUrl = process.env.EASY_ERF_BROWSER_BASE_URL || "http://127.0.0.1:4173";
const USER_ID = "00000000-0000-4000-8000-000000000157";
const USER_EMAIL = "guided-cloud-acceptance@easyerf.invalid";
const LPI = "C03400140000157000000";
const PARCEL_KEY = "E108C034001400001570000000";
const PARCEL_ID = "csg:lpi:c03400140000157000000";
const AUTH_STORAGE_KEYS = ["sb-easyerf-auth-token", "sb-xiqpfhsdlvwrwhclonsg-auth-token"];
const ACCEPTANCE_AT = "2026-08-29T08:00:00.000Z";

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

function isObjectResponse(request) {
  const accept = request.headers().accept || "";
  return accept.includes("application/vnd.pgrst.object+json");
}

function filterValue(url, key) {
  const value = url.searchParams.get(key);
  return value?.startsWith("eq.") ? value.slice(3) : value;
}

async function installSyntheticSignedInSupabase(context) {
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
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname.endsWith("/auth/v1/user")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fakeUser),
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
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();

    try {
      if (url.pathname === "/rest/v1/saved_properties" && method === "GET") {
        const requestedUserId = filterValue(url, "user_id");
        const requestedParcelId = filterValue(url, "parcel_id");
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
              ? JSON.stringify({ id: durableRow.id })
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
        url.pathname === "/rest/v1/rpc/patch_saved_property_user_data" &&
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

        if (parcelId !== PARCEL_ID || !patch || typeof patch !== "object") {
          await route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({ message: "Invalid acceptance RPC payload" }),
          });
          return;
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
      const headers = { ...request.headers() };
      const apiKey = headers.apikey;
      if (apiKey) headers.authorization = `Bearer ${apiKey}`;
      await route.continue({ headers });
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
  page.on("pageerror", (error) => pageErrors.push(error.message));
}

const browser = await chromium.launch({ headless: true });

try {
  const firstContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await installSyntheticSignedInSupabase(firstContext);
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

  await firstContext.close();

  const reopenContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await installSyntheticSignedInSupabase(reopenContext);
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

  console.log(
    "Guided cloud persistence verified: signed-in saved Erf 1570 -> confirm -> durable projection RPC -> fresh browser hydration -> dashboard and Guided reopen at Add address, with no production persistence mutation.",
  );

  await reopenContext.close();
} finally {
  await browser.close();
}
