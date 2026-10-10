// Exact-head commercial proof, reusing a previously verified identical frontend build.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { readFile, writeFile, mkdir, mkdtemp, symlink, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
const repository = process.cwd();
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const head = git("rev-parse", "HEAD");
assert.equal(head, process.env.EASY_ERF_EXPECTED_HEAD, "Exact-head acknowledgement required");
assert.equal(
  git("status", "--porcelain", "--untracked-files=no"),
  "",
  "Commit tracked changes first",
);
const baseReceiptPath = resolve(process.env.EASY_ERF_BASE_BUILD_RECEIPT);
const baseReceipt = JSON.parse(await readFile(baseReceiptPath, "utf8"));
assert.equal(baseReceipt.result, "local checks passed");
assert.ok(baseReceipt.commands.some((entry) => entry.name === "build" && entry.code === 0));
assert.equal(
  git(
    "diff",
    "--name-only",
    baseReceipt.head,
    head,
    "--",
    "src",
    "public",
    "vite.config.ts",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
  ),
  "",
  "Reused frontend build must have identical tracked inputs",
);
const output = resolve(process.env.EASY_ERF_BROWSER_ARTIFACTS || "artifacts/r999-isolated");
await mkdir(output, { recursive: true });
const root = await mkdtemp(join(tmpdir(), "easyerf-r999-"));
const browserTmp = await mkdtemp(join(tmpdir(), "easyerf-r999-browser-"));
execFileSync("git", ["archive", "--format=tar", "-o", join(root, "source.tar"), head]);
execFileSync("tar", ["-xf", join(root, "source.tar"), "-C", root]);
await rm(join(root, "source.tar"));
for (const file of git("ls-files").split("\n"))
  if (/(^|\/)\.env($|\.)/.test(file) || file === ".dev.vars")
    await rm(join(root, file), { force: true });
await symlink(resolve("node_modules"), join(root, "node_modules"), "dir");
const egress = join(output, "server-egress.jsonl");
await writeFile(egress, "");
const env = {
  PATH: process.env.PATH,
  HOME: root,
  TMPDIR: browserTmp,
  NODE_ENV: "production",
  NODE_OPTIONS: `--import=${join(root, "scripts/verify-mobile-network.mjs")}`,
  EASY_ERF_EGRESS_LOG: egress,
  VITE_SUPABASE_URL: "http://127.0.0.1:55433",
  SUPABASE_URL: "http://127.0.0.1:55433",
  VITE_SUPABASE_PUBLISHABLE_KEY: "synthetic-public-key",
  SUPABASE_PUBLISHABLE_KEY: "synthetic-public-key",
  VITE_MAPBOX_ACCESS_TOKEN: "pk.synthetic-local-only",
  EASY_ERF_BROWSER_BASE_URL: "http://127.0.0.1:4199",
  EASY_ERF_BROWSER_ARTIFACTS: output,
  EASY_ERF_PLAYWRIGHT_MODULE:
    process.env.EASY_ERF_PLAYWRIGHT_MODULE || resolve("node_modules/playwright/index.mjs"),
  EASY_ERF_BROWSER_EXECUTABLE: process.env.EASY_ERF_BROWSER_EXECUTABLE || "/usr/bin/chromium",
  GIT_DIR: git("rev-parse", "--absolute-git-dir"),
  GIT_WORK_TREE: repository,
};
const receipt = {
  head,
  tree: git("rev-parse", "HEAD^{tree}"),
  commands: [],
  reusedBuild: { head: baseReceipt.head, receipt: baseReceiptPath, identicalFrontendInputs: true },
  limitations:
    "Synthetic SDK/Auth/database/payment boundaries; reused identical production frontend. No live acceptance, Deno SDK integration, SQL/RLS, actual payments or protected documents.",
};
async function run(name, args) {
  const stream = createWriteStream(join(output, `${name}.log`));
  const child = spawn(process.execPath, args, {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(stream, { end: false });
  child.stderr.pipe(stream, { end: false });
  const code = await new Promise((done, reject) => {
    child.once("error", reject);
    child.once("exit", done);
  });
  await new Promise((done) => stream.end(done));
  receipt.commands.push({ name, args, code });
  await writeFile(join(output, "receipt.json"), JSON.stringify(receipt, null, 2));
  assert.equal(code, 0, `See ${name}.log`);
}
let server;
try {
  await run("edge-handlers", ["scripts/verify-r999-offline.mjs"]);
  await run("payment-regressions", [
    "node_modules/vitest/vitest.mjs",
    "run",
    "src/lib/payments",
    "src/lib/humanReview/__tests__",
  ]);
  await run("types", ["node_modules/typescript/bin/tsc", "--noEmit"]);
  const stream = createWriteStream(join(output, "server.log"));
  server = spawn(process.execPath, [join(baseReceipt.root, ".output/server/index.mjs")], {
    cwd: baseReceipt.root,
    env: { ...env, HOST: "127.0.0.1", PORT: "4199" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.pipe(stream);
  server.stderr.pipe(stream);
  let listening = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error("Isolated server exited");
    try {
      if ((await fetch(`${env.EASY_ERF_BROWSER_BASE_URL}/auth`)).ok) {
        listening = true;
        break;
      }
    } catch {}
    await new Promise((done) => setTimeout(done, 500));
  }
  assert.ok(listening);
  await run("checkout-browser", ["scripts/verify-r999-checkout-browser.mjs"]);
  // This existing script imports Playwright directly; the verified dependency is installed locally.
  await run("delivery-browser", [
    "--import",
    join(root, "scripts/verify-guided-browser-isolation.mjs"),
    "scripts/verify-customer-report-link-browser.mjs",
  ]);
  assert.equal(await readFile(egress, "utf8"), "", "No server-side external egress attempts");
  assert.equal(git("rev-parse", "HEAD"), head);
  assert.equal(git("status", "--porcelain", "--untracked-files=no"), "");
  receipt.result = "isolated commercial checks passed";
  receipt.serverEgressAttempts = 0;
} finally {
  if (server && server.exitCode === null && server.signalCode === null) {
    server.kill("SIGTERM");
    await new Promise((done) => server.once("exit", done));
  }
  receipt.serverStopped = !server || server.exitCode !== null || server.signalCode !== null;
  await rm(root, { recursive: true, force: true });
  await rm(browserTmp, { recursive: true, force: true });
  receipt.temporaryDirectoriesRemoved = true;
  await writeFile(join(output, "receipt.json"), JSON.stringify(receipt, null, 2));
}
console.log(`Exact-head isolated commercial proof: ${head}`);
