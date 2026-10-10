// Non-deploying exact-commit proof. Exported source excludes dotenv and all inherited credentials.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile, symlink, rm, readFile, cp } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const repository = process.cwd();
const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
assert.match(process.env.EASY_ERF_EXPECTED_HEAD || "", /^[a-f0-9]{40}$/);
assert.equal(head, process.env.EASY_ERF_EXPECTED_HEAD, "Exact requested commit required");
assert.equal(
  execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }),
  "",
  "Tracked source must be committed",
);
const output = resolve(process.env.EASY_ERF_BROWSER_ARTIFACTS || "artifacts/pr205-repair");
await mkdir(output, { recursive: true });
const root = await mkdtemp(join(tmpdir(), "easyerf-mobile-"));
const browserTmp = await mkdtemp(join(tmpdir(), "erf-browser-"));
execFileSync("git", ["archive", "--format=tar", "-o", join(root, "source.tar"), head]);
execFileSync("tar", ["-xf", join(root, "source.tar"), "-C", root]);
await rm(join(root, "source.tar"));
for (const file of execFileSync("git", ["ls-files"], { encoding: "utf8" }).trim().split("\n")) {
  if (/(^|\/)\.env($|\.)/.test(file) || file === ".dev.vars")
    await rm(join(root, file), { force: true });
}
await symlink(resolve("node_modules"), join(root, "node_modules"), "dir");
if (process.env.EASY_ERF_GUIDED_SYNTHETIC === "1") {
  // Existing scripts import Playwright by package name. Resolve the same pinned tool.
  const modulePath = process.env.EASY_ERF_PLAYWRIGHT_MODULE;
  assert.ok(modulePath, "Pinned Playwright module required for Guided checks");
  const playwrightDirectory = resolve(fileURLToPath(new URL(".", `file://${modulePath}`)));
  try {
    await symlink(playwrightDirectory, resolve("node_modules/playwright"), "dir");
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
}
const egress = join(output, "server-egress.jsonl");
await writeFile(egress, "");
const env = {
  PATH: process.env.PATH,
  HOME: root,
  TMPDIR: root,
  NODE_ENV: "production",
  NODE_OPTIONS: `--import=${join(root, "scripts/verify-mobile-network.mjs")}`,
  EASY_ERF_EGRESS_LOG: egress,
  NITRO_PRESET: "node-server",
  VITE_SUPABASE_URL: "http://127.0.0.1:55433",
  SUPABASE_URL: "http://127.0.0.1:55433",
  VITE_SUPABASE_PUBLISHABLE_KEY: "synthetic-public-key",
  SUPABASE_PUBLISHABLE_KEY: "synthetic-public-key",
  VITE_MAPBOX_ACCESS_TOKEN: "pk.synthetic-local-only",
};
const receipt = {
  head,
  tree: execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim(),
  root,
  commands: [],
  limitations:
    "Synthetic local Chromium only; no real providers, private documents, production acceptance or Safari proof",
};
async function run(name, args, extra = {}, cwd = root) {
  const started = new Date().toISOString();
  const log = join(output, `${name}.log`);
  const { createWriteStream } = await import("node:fs");
  const stream = createWriteStream(log);
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...env, ...extra },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(stream, { end: false });
  child.stderr.pipe(stream, { end: false });
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", resolve);
  });
  await new Promise((resolve) => stream.end(resolve));
  receipt.commands.push({ name, args, started, ended: new Date().toISOString(), code, log });
  await writeFile(join(output, "commands.json"), JSON.stringify(receipt, null, 2));
  if (code !== 0 && (name === "browser" || name === "commercial" || name.startsWith("verify-")))
    console.error(await readFile(log, "utf8"));
  assert.equal(code, 0, `${name}: see ${log}`);
}
let server;
let guidedServer;
try {
  await run("focused", [
    "node_modules/vitest/vitest.mjs",
    "run",
    "src/lib/search/__tests__/propertySearch.test.ts",
    "src/lib/search/__tests__/erfSearchContext.test.ts",
    "src/components/property/__tests__/dossierUx.test.ts",
    "src/lib/workbench/__tests__/workspaceEntryHydration.test.ts",
    "src/lib/workbench/__tests__/investigationSyncBaseline.test.ts",
    "src/lib/workbench/__tests__/propertyOverviewEntry.test.ts",
  ]);
  await run("types", ["node_modules/typescript/bin/tsc", "--noEmit"]);
  await run("lint", [
    "node_modules/eslint/bin/eslint.js",
    "src/routes/index.tsx",
    "src/components/map/SearchBar.tsx",
  ]);
  await run("restoration-lint", ["node_modules/eslint/bin/eslint.js", "--rule", "prettier/prettier: off", "src/components/property/OfficialParcelPanel.tsx", "src/components/workbench/WorkspaceCloudSync.tsx"]);
  await run("provenance-lint", ["node_modules/eslint/bin/eslint.js", "src/lib/workbench/workspaceEntryHydration.ts", "src/lib/workbench/__tests__/workspaceEntryHydration.test.ts"]);
  await run("build", ["node_modules/vite/bin/vite.js", "build"]);
  // These two existing suites inspect tracked .env text only. Run unchanged assertions
  // in the clean source checkout under the same egress guard, never in the browser export.
  const configTests = [
    "src/lib/auth/__tests__/canonicalBackendOwnership.test.ts",
    "src/lib/auth/__tests__/founderBackendCutoverConfig.test.ts",
  ];
  await run(
    "static-config",
    ["node_modules/vitest/vitest.mjs", "run", ...configTests],
    {},
    repository,
  );
  await run("regression", [
    "node_modules/vitest/vitest.mjs",
    "run",
    ...configTests.flatMap((file) => ["--exclude", file]),
  ]);
  const { createWriteStream } = await import("node:fs");
  const serverLog = createWriteStream(join(output, "server.log"));
  server = spawn(process.execPath, [".output/server/index.mjs"], {
    cwd: root,
    env: { ...env, HOST: "127.0.0.1", PORT: "4197" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.pipe(serverLog);
  server.stderr.pipe(serverLog);
  let listening = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error("Isolated server exited");
    try {
      if ((await fetch("http://127.0.0.1:4197/auth")).ok) {
        listening = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(listening, "Local server listening");
  const browserEnv = {
    // Trace HTML must stay outside the Vite source tree to avoid HMR reloads.
    TMPDIR: browserTmp,
    NODE_OPTIONS: "",
    EASY_ERF_BROWSER_BASE_URL: "http://127.0.0.1:4197",
    EASY_ERF_BROWSER_ARTIFACTS: join(output, "browser"),
    EASY_ERF_PLAYWRIGHT_MODULE:
      process.env.EASY_ERF_PLAYWRIGHT_MODULE || resolve("node_modules/playwright/index.mjs"),
    EASY_ERF_BROWSER_EXECUTABLE: process.env.EASY_ERF_BROWSER_EXECUTABLE || "/usr/bin/chromium",
  };
  await run("browser", ["scripts/verify-mobile-search.mjs"], browserEnv);
  await run("commercial", ["scripts/verify-commercial-browser.mjs"], browserEnv);
  if (process.env.EASY_ERF_GUIDED_SYNTHETIC === "1") {
    // Existing Guided account-switch checks import Vite source modules. Keep this
    // exact-head dev server isolated; mobile/commercial continue using production.
    const guidedLog = createWriteStream(join(output, "guided-server.log"));
    guidedServer = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "4198", "--strictPort"], {
      cwd: root, env: { ...env, NODE_ENV: "development" }, stdio: ["ignore", "pipe", "pipe"],
    });
    guidedServer.stdout.pipe(guidedLog); guidedServer.stderr.pipe(guidedLog);
    let guidedListening = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (guidedServer.exitCode !== null) throw new Error("Isolated Guided server exited");
      try { if ((await fetch("http://127.0.0.1:4198/auth")).ok) { guidedListening = true; break; } } catch {}
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.ok(guidedListening, "Isolated source-module Guided server listening");
    receipt.guidedRuntime = "Exact-head Vite development server; production build/mobile proof retained";
    for (const script of [
      "verify-auth-screen-local",
      "verify-erf1570-first-read",
      "verify-erf1570-guided-start",
      "verify-guided-cloud-persistence",
      "verify-selected-parcel-boundary",
      "verify-sg-receipt-preview",
    ]) {
      await run(script, [
        "--import", join(root, "scripts/verify-mobile-network.mjs"),
        "--import", join(root, "scripts/verify-guided-browser-isolation.mjs"),
        `scripts/${script}.mjs`,
      ], {
        ...browserEnv,
        EASY_ERF_BROWSER_BASE_URL: script === "verify-guided-cloud-persistence" ? "http://127.0.0.1:4198" : browserEnv.EASY_ERF_BROWSER_BASE_URL,
        EASY_ERF_BROWSER_ARTIFACTS: join(output, script),
        EASY_ERF_SG_ARTIFACTS: join(output, script),
        EASY_ERF_GUEST_NO_WRITES: ["verify-erf1570-first-read", "verify-erf1570-guided-start"].includes(script) ? "1" : "0",
        // Scripts' identity receipts refer to the verified source checkout. Runtime
        // scripts/fixtures still execute from the immutable dotenv-free export.
        GIT_DIR: execFileSync("git", ["rev-parse", "--absolute-git-dir"], { encoding: "utf8" }).trim(),
        GIT_WORK_TREE: repository,
      });
    }
    await cp(join(root, "artifacts/selected-parcel-boundary"), join(output, "verify-selected-parcel-boundary"), { recursive: true });
  }
  assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), head);
  assert.equal(execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }), "", "Source identity unchanged during verification");
  await run("whitespace", ["-e", "require('node:child_process').execFileSync('git', ['diff', '--check', 'origin/main', 'HEAD'], {stdio:'inherit'})"], {}, repository);
  assert.equal(
    await readFile(egress, "utf8"),
    "",
    "No server external egress attempts during exact-head proof",
  );
  receipt.serverEgressAttempts = 0;
  receipt.result = "local checks passed";
} finally {
  if (guidedServer && guidedServer.exitCode === null && guidedServer.signalCode === null) {
    guidedServer.kill("SIGTERM"); await new Promise((resolve) => guidedServer.once("exit", resolve));
  }
  receipt.guidedServerStopped = !guidedServer || guidedServer.exitCode !== null || guidedServer.signalCode !== null;
  if (server) {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.once("exit", resolve));
  }
  receipt.serverStopped = !server || server.exitCode !== null || server.signalCode !== null;
  await rm(browserTmp, { recursive: true, force: true });
  receipt.browserTemporaryDirectoryRemoved = true;
  await writeFile(join(output, "commands.json"), JSON.stringify(receipt, null, 2));
}
console.log(`Exact-head local proof: ${head}; evidence: ${output}`);
