import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const { chromium } = await import(process.env.EASY_ERF_PLAYWRIGHT_MODULE || "playwright");
const base = new URL(process.env.EASY_ERF_BROWSER_BASE_URL);
assert.equal(base.hostname, "127.0.0.1");
const output = resolve(
  process.env.EASY_ERF_BROWSER_ARTIFACTS || "artifacts/r999-offline",
  "checkout",
);
await mkdir(output, { recursive: true });
const owner = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "owner@example.invalid",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
};
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const session = {
  access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: owner.id, exp: 4102444800, role: "authenticated", aud: "authenticated" })}.synthetic`,
  refresh_token: "synthetic",
  expires_at: 4102444800,
  expires_in: 36000000,
  token_type: "bearer",
  user: owner,
};
const parcel = "csg:lpi:synthetic-offline-parcel";
const requests = [],
  checks = [],
  failures = [],
  pageErrors = [];
let outcome = "valid",
  signedIn = true;
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.EASY_ERF_BROWSER_EXECUTABLE,
});
const context = await browser.newContext({ serviceWorkers: "block" });
await context.addInitScript((value) => {
  for (const key of [
    "sb-127-auth-token",
    "sb-fixture-auth-token",
    "sb-xiqpfhsdlvwrwhclonsg-auth-token",
  ])
    localStorage.setItem(key, JSON.stringify(value));
}, session);
await context.route("**/*", async (route) => {
  const request = route.request(),
    url = new URL(request.url());
  const json = (body, status = 200) => route.fulfill({ status, json: body });
  try {
    if (url.pathname.startsWith("/auth/v1/"))
      return json(signedIn ? owner : { message: "Synthetic signed-out" }, signedIn ? 200 : 401);
    if (url.pathname === "/functions/v1/easy-erf-r999-checkout") {
      assert.equal(request.method(), "POST");
      const body = request.postDataJSON();
      assert.equal(body.parcelId, parcel);
      assert.equal(body.focus, "property_check");
      assert.equal(body.scopeAcknowledged, true);
      assert.equal(body.intendedUse, null);
      assert.ok(request.headers().authorization?.startsWith("Bearer "));
      requests.push(body);
      if (outcome === "unavailable")
        return json({ ok: false, error: "Synthetic checkout unavailable" }, 503);
      return json({
        ok: true,
        mode: "test",
        url:
          outcome === "invalid"
            ? "https://example.invalid/unsafe"
            : "https://buy.stripe.com/synthetic?client_reference_id=22222222-2222-4222-8222-222222222222",
      });
    }
    if (url.hostname === "buy.stripe.com") {
      assert.equal(url.pathname, "/synthetic");
      assert.equal(
        url.searchParams.get("client_reference_id"),
        "22222222-2222-4222-8222-222222222222",
      );
      return route.fulfill({
        contentType: "text/html",
        body: "<h1>Synthetic payment boundary — no payment performed</h1>",
      });
    }
    if (url.pathname.startsWith("/rest/v1/")) {
      assert.ok(["GET", "HEAD"].includes(request.method()));
      return json([]);
    }
    if (
      url.origin === base.origin &&
      !url.pathname.startsWith("/api/") &&
      ["GET", "HEAD"].includes(request.method())
    )
      return route.continue();
    assert.fail(
      `Unexpected provider/action request: ${request.method()} ${url.origin}${url.pathname}`,
    );
  } catch (error) {
    failures.push(String(error));
    return route.abort();
  }
});
const page = await context.newPage();
page.on("pageerror", (error) => pageErrors.push(error.message));
const button = () =>
  page.getByRole("button", { name: /^Investigate this property for me · R999$/i });
async function prepare() {
  await page.goto(
    `${base.origin}/pricing?parcelId=${encodeURIComponent(parcel)}&propertyReference=Synthetic%20parcel&source=isolated-acceptance`,
  );
  await button().waitFor();
  assert.equal(await button().isDisabled(), true);
  await page.getByRole("button", { name: /^Overall Property Check/i }).click();
  assert.equal(await button().isDisabled(), true);
  await page
    .getByRole("checkbox", {
      name: /I understand the done-for-you Easy Erf investigation provides property research/i,
    })
    .check();
  assert.equal(await button().isEnabled(), true);
}
try {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    outcome = "valid";
    await prepare();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({
      path: resolve(output, `prepared-${viewport.width}.png`),
      fullPage: true,
    });
    const before = requests.length;
    await button().click();
    await page
      .getByRole("heading", { name: "Synthetic payment boundary — no payment performed" })
      .waitFor();
    assert.equal(requests.length, before + 1);
    checks.push(`authenticated parcel-bound TEST handoff ${viewport.width}x${viewport.height}`);
  }
  for (const value of ["unavailable", "invalid"]) {
    outcome = value;
    await prepare();
    await button().click();
    await page
      .getByText(
        value === "unavailable"
          ? "Synthetic checkout unavailable"
          : "Secure checkout returned an invalid destination.",
        { exact: true },
      )
      .waitFor();
    assert.equal(new URL(page.url()).pathname, "/pricing");
    assert.equal(await button().isEnabled(), true);
    checks.push(`${value} checkout remains on property and permits deliberate retry`);
  }
  await prepare();
  signedIn = false;
  const before = requests.length;
  await button().click();
  await page
    .getByText(
      "Sign in before checkout so your done-for-you investigation and completed report stay attached to your Easy Erf account.",
      { exact: true },
    )
    .first()
    .waitFor();
  assert.equal(requests.length, before);
  checks.push("lost authentication cannot initiate checkout");
  assert.deepEqual(failures, []);
  assert.deepEqual(pageErrors, []);
} finally {
  await browser.close();
  await writeFile(
    resolve(output, "receipt.json"),
    JSON.stringify(
      {
        checks,
        requests,
        failures,
        pageErrors,
        providerRequests: 0,
        actualPayments: 0,
        limitations:
          "Production frontend with synthetic Auth/SDK transport/payment boundary; not live Stripe, payment or backend proof.",
      },
      null,
      2,
    ),
  );
}
