import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const base = process.env.EASY_ERF_BROWSER_BASE_URL || "http://127.0.0.1:4174";
assert.equal(new URL(base).hostname, "127.0.0.1");
const artifacts = resolve(process.env.EASY_ERF_BROWSER_ARTIFACTS || "artifacts/account-access", "account-access");
await mkdir(artifacts, { recursive: true });
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const keys = ["sb-127-auth-token", "sb-fixture-auth-token", "sb-easyerf-auth-token", "sb-xiqpfhsdlvwrwhclonsg-auth-token"];
const draftKey = "easyerf.user." + owner + ".strategy-workspace.v1.synthetic";
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const session = id => ({
  access_token: encode({ alg: "HS256", typ: "JWT" }) + "." + encode({ sub: id, exp: 4102444800, aud: "authenticated", role: "authenticated" }) + ".fixture-only",
  refresh_token: "fixture-only", expires_at: 4102444800, expires_in: 36000000, token_type: "bearer",
  user: { id, email: id === owner ? "owner@example.invalid" : "other@example.invalid", aud: "authenticated", role: "authenticated", app_metadata: { provider: "google" }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
});
const checks = [], errors = [];
let acceptancePassed = false;
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function requestGate() { return { entered: deferred(), released: deferred() }; }
const browser = await chromium.launch({ headless: true, channel: process.env.EASY_ERF_BROWSER_CHANNEL || undefined });
async function fixture(width, signedIn = true) {
  const state = { id: owner, expired: false, logoutFail: false, resetFail: false, passwordFail: false, writes: [], passwordTargets: [], oauth: false, authKey: null, verificationGate: null, mutationGate: null };
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
  await context.addInitScript(({ keys, session, draftKey }) => {
    if (!sessionStorage.getItem("fixture-initialized")) {
      for (const key of keys) if (session) localStorage.setItem(key, JSON.stringify(session));
      localStorage.setItem(draftKey, "original unsaved synthetic draft");
      sessionStorage.setItem("fixture-initialized", "yes");
    }
  }, { keys, session: signedIn ? session(owner) : null, draftKey });
  await context.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname.startsWith("/auth/v1/")) state.authKey = "sb-" + url.hostname.split(".")[0] + "-auth-token";
    const json = (value, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });
    if (url.pathname === "/auth/v1/authorize") {
      assert.equal(url.searchParams.get("provider"), "google");
      assert.equal(url.searchParams.get("prompt"), "select_account");
      assert.equal(new URL(url.searchParams.get("redirect_to")).origin, base);
      state.oauth = true;
      return route.fulfill({ contentType: "text/html", body: "<h1>Synthetic account chooser request captured</h1>" });
    }
    if (url.pathname === "/auth/v1/logout") {
      assert.equal(request.method(), "POST");
      assert.equal(url.searchParams.get("scope"), "local");
      state.writes.push("logout");
      return state.logoutFail ? json({ message: "synthetic unavailable" }, 503) : route.fulfill({ status: 204 });
    }
    if (url.pathname === "/auth/v1/recover") {
      assert.equal(request.method(), "POST");
      assert.equal(request.postDataJSON().email, "owner@example.invalid");
      assert.equal(url.searchParams.get("redirect_to"), base + "/account/password");
      state.writes.push("recover");
      return state.resetFail ? json({ message: "synthetic unavailable" }, 429) : json({});
    }
    if (url.pathname === "/auth/v1/token") {
      assert.equal(url.searchParams.get("grant_type"), "password");
      assert.equal(request.postDataJSON().email, "owner@example.invalid");
      assert.equal(request.postDataJSON().password, "synthetic-password-123");
      assert(state.writes.includes("password"), "Password login before setting password");
      state.writes.push("password-login");
      return json(session(owner));
    }
    if (url.pathname === "/auth/v1/user") {
      const requestId = [owner, other].find(id => request.headers().authorization === "Bearer " + session(id).access_token);
      assert.ok(requestId, "Only known synthetic credentials may reach Auth");
      if (request.method() === "PUT") {
        assert.equal(state.expired, false);
        const body = request.postDataJSON();
        assert.equal(body.password, "synthetic-password-123");
        assert.deepEqual(Object.keys(body).filter(key => !["code_challenge", "code_challenge_method"].includes(key)), ["password"]);
        state.writes.push("password");
        state.passwordTargets.push(requestId);
        if (state.mutationGate) {
          const gate = state.mutationGate; state.mutationGate = null;
          gate.entered.resolve(); await gate.released.promise;
        }
        return state.passwordFail ? json({ message: "synthetic policy failure" }, 422) : json(session(requestId).user);
      }
      if (state.verificationGate) {
        const gate = state.verificationGate; state.verificationGate = null;
        gate.entered.resolve(); await gate.released.promise;
      }
      return state.expired ? json({ message: "expired", code: "bad_jwt" }, 401) : json(session(requestId).user);
    }
    if (url.pathname === "/rest/v1/user_roles") return json([]);
    if (url.pathname.startsWith("/rest/v1/") && request.method() === "GET") return json([]);
    if (url.origin === base && !url.pathname.startsWith("/api/") && !url.pathname.startsWith("/auth/v1/")) return route.continue();
    if (!["GET", "HEAD"].includes(request.method())) errors.push("Unexpected write " + request.method() + " " + url.pathname);
    return route.abort();
  });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  page.setDefaultTimeout(15000);
  return { page, context, state };
}
async function screenshot(page, name) {
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: resolve(artifacts, name + ".png"), fullPage: true });
}
async function changeSession(f, id) {
  f.state.id = id;
  await f.page.evaluate(({ keys, session }) => {
    for (const key of keys) {
      if (session) localStorage.setItem(key, JSON.stringify(session));
      else localStorage.removeItem(key);
      const channel = new BroadcastChannel(key);
      channel.postMessage({ event: session ? "SIGNED_IN" : "SIGNED_OUT", session }); channel.close();
    }
  }, { keys: [f.state.authKey], session: id ? session(id) : null });
}
try {
  for (const phase of ["verification", "mutation"]) {
    for (const replacement of [other, null]) {
      for (const failed of phase === "mutation" ? [false, true] : [false]) {
        const f = await fixture(replacement ? 1440 : 390);
        await f.page.goto(base + "/account/password");
        await f.page.getByLabel("New password", { exact: true }).fill("synthetic-password-123");
        await f.page.getByLabel("Confirm password", { exact: true }).fill("synthetic-password-123");
        const gate = requestGate();
        f.state[phase + "Gate"] = gate;
        f.state.passwordFail = failed;
        await f.page.getByRole("button", { name: "Save password", exact: true }).click();
        let timer;
        try {
          await Promise.race([gate.entered.promise, new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`No ${phase} request received`)), 15000);
          })]);
        } finally { clearTimeout(timer); }
        await changeSession(f, replacement);
        if (phase === "mutation" && replacement) {
          await f.page.getByText(/Password for other@example.invalid/).waitFor();
          await f.page.getByLabel("New password", { exact: true }).fill("replacement-account-draft");
          await f.page.getByLabel("Confirm password", { exact: true }).fill("replacement-account-draft");
        }
        gate.released.resolve();
        if (replacement) await f.page.getByText(/Password for other@example.invalid/).waitFor();
        else await f.page.getByRole("alert").filter({ hasText: "Sign in" }).waitFor();
        await f.page.waitForTimeout(500);
        assert.deepEqual(f.state.passwordTargets, phase === "verification" ? [] : [owner], "Pending A submission must never write B");
        assert.equal(await f.page.getByText(/Password saved/).count(), 0, "No stale completion in replacement session");
        assert.equal(await f.page.getByText(/could not be saved/).count(), 0, "No stale error in replacement session");
        assert.equal(await f.page.evaluate(key => {
          const saved = localStorage.getItem(key);
          return saved ? JSON.parse(saved).user.id : null;
        }, f.state.authKey), replacement, "Late password response cannot resurrect the previous session");
        assert.deepEqual(f.state.writes, phase === "verification" ? [] : ["password"]);
        if (phase === "mutation" && replacement) {
          assert.equal(await f.page.getByLabel("New password", { exact: true }).inputValue(), "replacement-account-draft");
          assert.equal(await f.page.getByLabel("Confirm password", { exact: true }).inputValue(), "replacement-account-draft");
        }
        if (!replacement) assert.equal(await f.page.getByRole("button", { name: "Save password", exact: true }).count(), 0);
        await screenshot(f.page, `pending-${phase}-${replacement ? "switch" : "logout"}-${failed ? "error" : "success"}`);
        checks.push(`Pending ${phase}, ${replacement ? "switch" : "logout"}, late ${failed ? "error" : "success"}: original credential only; no stale completion/error or replacement draft loss`);
        await f.context.close();
      }
    }
  }
  for (const width of [1440, 390]) {
    const f = await fixture(width);
    await f.page.goto(base + "/profile");
    await f.page.getByRole("link", { name: "Set or change password", exact: true }).click();
    await f.page.getByLabel("New password", { exact: true }).fill("synthetic-password-123");
    await f.page.getByLabel("Confirm password", { exact: true }).fill("synthetic-password-123");
    await screenshot(f.page, "set-password-" + width);
    await f.page.getByRole("button", { name: "Save password", exact: true }).click();
    await f.page.getByRole("status").filter({ hasText: "Password saved" }).waitFor();
    assert.deepEqual(f.state.writes, ["password"]);
    await f.page.getByRole("link", { name: "Back to Account" }).click();
    if (width < 1280) await f.page.getByRole("button", { name: "Open menu" }).click();
    await f.page.getByRole("button", { name: "Sign out", exact: true }).click();
    await f.page.waitForURL(url => url.pathname === "/auth", { waitUntil: "networkidle" });
    assert.equal(await f.page.evaluate(key => localStorage.getItem(key), draftKey), "original unsaved synthetic draft");
    assert.equal(await f.page.evaluate(keys => keys.some(key => {
      const data = localStorage.getItem(key); return data && JSON.parse(data).user;
    }), [f.state.authKey]), false);
    await screenshot(f.page, "signed-out-" + width);
    await f.page.goto(base + "/auth?redirect=/profile");
    await f.page.getByLabel("Email", { exact: true }).fill("owner@example.invalid");
    await f.page.getByLabel("Password", { exact: true }).fill("synthetic-password-123");
    await f.page.getByRole("button", { name: "Sign in", exact: true }).click();
    await f.page.getByRole("heading", { name: "Your Easy Erf account" }).waitFor();
    assert.equal(await f.page.getByLabel("Email", { exact: true }).inputValue(), "owner@example.invalid");
    assert.equal(await f.page.evaluate(key => localStorage.getItem(key), draftKey), "original unsaved synthetic draft");
    if (width < 1280) await f.page.getByRole("button", { name: "Open menu" }).click();
    await f.page.getByRole("button", { name: "Sign out", exact: true }).click();
    await f.page.waitForURL(url => url.pathname === "/auth", { waitUntil: "networkidle" });
    await f.page.getByRole("button", { name: "Forgot password?" }).click();
    await f.page.getByLabel("Email", { exact: true }).fill("owner@example.invalid");
    await f.page.getByRole("button", { name: "Send reset link" }).click();
    await f.page.getByRole("status").filter({ hasText: "If an account" }).waitFor();
    await screenshot(f.page, "recovery-request-" + width);
    assert.deepEqual(f.state.writes, ["password", "logout", "password-login", "logout", "recover"]);
    await f.page.getByRole("button", { name: "Continue with Google" }).click();
    await f.page.getByRole("heading", { name: "Synthetic account chooser request captured" }).waitFor();
    assert.equal(f.state.oauth, true);
    await f.context.close();
    checks.push("Desktop/mobile " + width + ": Google account password on same identity, local sign-out, drafts preserved, recovery request and explicit OAuth account choice");
  }
  const denied = await fixture(390, false);
  await denied.page.goto(base + "/account/password");
  await denied.page.getByRole("alert").filter({ hasText: "Sign in" }).waitFor();
  assert.equal(await denied.page.getByRole("button", { name: "Save password" }).count(), 0);
  assert.deepEqual(denied.state.writes, []);
  await denied.context.close();
  checks.push("Signed-out password update denied");

  const expired = await fixture(1440);
  expired.state.expired = true;
  await expired.page.goto(base + "/account/password");
  await expired.page.getByRole("alert").waitFor();
  assert.equal(await expired.page.getByRole("button", { name: "Save password" }).count(), 0);
  assert.deepEqual(expired.state.writes, []);
  await expired.context.close();
  checks.push("Expired session cannot update password");

  const invalid = await fixture(390);
  await invalid.page.goto(base + "/account/password#error=access_denied&error_code=otp_expired");
  await invalid.page.getByRole("alert").filter({ hasText: "invalid or expired" }).waitFor();
  assert.equal(new URL(invalid.page.url()).hash, "");
  assert.equal(await invalid.page.getByRole("button", { name: "Save password" }).count(), 0);
  await invalid.context.close();
  checks.push("Invalid recovery link cannot reuse an unrelated existing session");

  const recovery = await fixture(390, false);
  const recovered = session(owner);
  await recovery.page.goto(base + "/account/password#access_token=" + recovered.access_token + "&refresh_token=fixture-only&expires_in=3600&token_type=bearer&type=recovery");
  await recovery.page.getByLabel("New password", { exact: true }).fill("synthetic-password-123");
  await recovery.page.getByLabel("Confirm password", { exact: true }).fill("synthetic-password-123");
  assert.equal(new URL(recovery.page.url()).hash, "");
  await recovery.page.getByRole("button", { name: "Save password", exact: true }).click();
  await recovery.page.getByRole("status").filter({ hasText: "Password saved" }).waitFor();
  assert.deepEqual(recovery.state.writes, ["password"]);
  await recovery.context.close();
  checks.push("Real SDK consumes synthetic recovery callback, removes fragment and saves only recovered account password");

  const switched = await fixture(1440);
  await switched.page.goto(base + "/account/password");
  await switched.page.getByLabel("New password", { exact: true }).fill("unsaved-old-account-password");
  switched.state.id = other;
  await switched.page.evaluate(({ keys, session }) => {
    for (const key of keys) {
      localStorage.setItem(key, JSON.stringify(session));
      const channel = new BroadcastChannel(key); channel.postMessage({ event: "SIGNED_IN", session }); channel.close();
    }
  }, { keys, session: session(other) });
  await switched.page.getByText(/Password for other@example.invalid/).waitFor();
  assert.equal(await switched.page.getByLabel("New password", { exact: true }).inputValue(), "");
  assert.deepEqual(switched.state.writes, []);
  await switched.context.close();
  checks.push("Account change clears old password draft and requires fresh deliberate submission");

  const failure = await fixture(1440);
  failure.state.passwordFail = true;
  await failure.page.goto(base + "/account/password");
  await failure.page.getByLabel("New password", { exact: true }).fill("synthetic-password-123");
  await failure.page.getByLabel("Confirm password", { exact: true }).fill("synthetic-password-123");
  await failure.page.getByRole("button", { name: "Save password", exact: true }).click();
  await failure.page.getByRole("alert").filter({ hasText: "could not be saved" }).waitFor();
  assert.equal(await failure.page.getByLabel("New password", { exact: true }).inputValue(), "synthetic-password-123");
  assert.deepEqual(failure.state.writes, ["password"]);
  await failure.page.goto(base + "/profile");
  failure.state.logoutFail = true;
  await failure.page.getByRole("button", { name: "Sign out", exact: true }).click();
  // SDK versions differ on whether remote failure also clears the local session.
  // In either case the visible message must honestly match the remaining access.
  const logoutError = failure.page.getByRole("alert").filter({
    hasText: /server sign-out could not be confirmed|Sign-out did not complete/,
  });
  await logoutError.waitFor();
  const retainedSession = await failure.page.evaluate(key => Boolean(localStorage.getItem(key)), failure.state.authKey);
  if (retainedSession) {
    assert.match(await logoutError.innerText(), /Sign-out did not complete/);
    assert.equal(new URL(failure.page.url()).pathname, "/profile");
  } else {
    assert.match(await logoutError.innerText(), /server sign-out could not be confirmed/);
    assert.equal(new URL(failure.page.url()).pathname, "/auth");
  }
  await failure.context.close();
  checks.push("Rejected password update retains input; failed logout is visible and not presented as success");
  assert.deepEqual(errors, []);
  acceptancePassed = true;
} catch (error) {
  for (const context of browser.contexts()) for (const page of context.pages()) {
    await page.screenshot({ path: resolve(artifacts, "failure.png"), fullPage: true });
  }
  throw error;
} finally {
  await browser.close();
  await writeFile(resolve(artifacts, "receipt.json"), JSON.stringify({
    source: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    acceptancePassed, authSdkVersion: createRequire(import.meta.url)("@supabase/auth-js/package.json").version,
    checks, errors, isolation: "Synthetic identities; all backend requests intercepted; external browser traffic blocked",
  }, null, 2));
}
console.log(JSON.stringify({ checks, errors }, null, 2));
