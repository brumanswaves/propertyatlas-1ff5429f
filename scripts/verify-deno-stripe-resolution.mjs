import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

// Type-check only. This script never executes an Edge Function or calls Stripe.
const root = process.cwd();
const deno = resolve(process.env.DENO_BIN || './deno');
const artifacts = resolve('artifacts/deno-stripe-resolution');
const scratch = mkdtempSync(join(tmpdir(), 'easy-erf-deno-'));
const entries = [
  'supabase/functions/easy-erf-stripe-webhook/index.ts',
  'supabase/functions/easy-erf-r999-checkout/index.ts',
  'supabase/functions/easy-erf-founder-launch-readiness/index.ts',
];
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const receipt = {
  candidateSha: git('rev-parse', 'HEAD'),
  trackedDirtyBefore: git('status', '--porcelain', '--untracked-files=no') !== '',
  productionActions: false,
  scope: 'Deno type checking only; dependency-registry downloads are permitted',
  checks: [],
  failures: [],
};
mkdirSync(artifacts, { recursive: true });
const childEnv = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  DENO_DIR: join(scratch, 'cache'),
  DENO_NO_UPDATE_CHECK: '1',
  NO_COLOR: '1',
  CI: 'true',
};

function check(name, cwd, file) {
  const args = ['check', '--no-lock', file];
  const result = spawnSync(deno, args, {
    cwd, env: childEnv, encoding: 'utf8', timeout: 120_000, maxBuffer: 16 * 1024 * 1024,
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  const log = `${name}.log`;
  writeFileSync(join(artifacts, log), output);
  const item = { name, command: ['deno', ...args], exitCode: result.status, signal: result.signal, log };
  receipt.checks.push(item);
  console.log(`${name}: exit=${result.status}, signal=${result.signal || 'none'}; log=${log}`);
  assert.ifError(result.error);
  assert.equal(result.signal, null, `${name} terminated by a signal`);
  return { item, output };
}

try {
  assert.equal(receipt.trackedDirtyBefore, false, 'Tracked candidate must be clean');
  const configText = readFileSync(join(root, 'deno.json'), 'utf8');
  assert.deepEqual(JSON.parse(configText), { nodeModulesDir: 'auto' });
  receipt.configSha256 = createHash('sha256').update(configText).digest('hex');
  receipt.denoVersion = execFileSync(deno, ['--version'], { env: childEnv, encoding: 'utf8' }).trim();
  for (const file of entries) {
    assert.match(readFileSync(join(root, file), 'utf8'), /npm:stripe@22\.6\.0/);
  }

  // Reproduce the reported manual-node_modules failure with no inherited repo config.
  const fixture = join(scratch, 'fixture');
  const nested = join(fixture, 'supabase/functions/probe');
  mkdirSync(join(fixture, 'node_modules'), { recursive: true });
  mkdirSync(nested, { recursive: true });
  writeFileSync(join(fixture, 'package.json'), '{"private":true,"type":"module"}\n');
  const probe = join(nested, 'index.ts');
  writeFileSync(probe, 'import Stripe from "npm:stripe@22.6.0";\nvoid Stripe.createFetchHttpClient;\n');
  const baseline = check('baseline-without-config', fixture, probe);
  assert.notEqual(baseline.item.exitCode, 0, 'Baseline unexpectedly resolved Stripe');
  assert.match(baseline.output, /Could not find a matching package/);
  assert.match(baseline.output, /npm:stripe@22\.6\.0/);
  assert.match(baseline.output, /node_modules/);
  baseline.item.expectedMissingPackageFailure = true;

  writeFileSync(join(fixture, 'deno.json'), configText);
  const configured = check('same-fixture-with-repository-config', fixture, probe);
  assert.equal(configured.item.exitCode, 0, configured.output);

  // A separate empty local tree prevents prior installation from hiding discovery errors.
  const nestedFixture = join(scratch, 'nested-fixture');
  const nestedCwd = join(nestedFixture, 'supabase/functions/probe');
  mkdirSync(nestedCwd, { recursive: true });
  writeFileSync(join(nestedFixture, 'package.json'), '{"private":true,"type":"module"}\n');
  writeFileSync(join(nestedFixture, 'deno.json'), configText);
  writeFileSync(join(nestedCwd, 'index.ts'), readFileSync(probe));
  const discovered = check('nested-config-discovery', nestedCwd, 'index.ts');
  assert.equal(discovered.item.exitCode, 0, discovered.output);

  // Real source, not just the minimal reproduction. No auto-install CLI override.
  for (const file of entries) {
    const name = dirname(file).split('/').at(-1);
    const actual = check(name, root, file);
    assert.equal(actual.item.exitCode, 0, actual.output);
  }
} catch (error) {
  receipt.failures.push(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  receipt.trackedDirtyAfter = git('status', '--porcelain', '--untracked-files=no') !== '';
  if (receipt.trackedDirtyAfter) {
    receipt.failures.push('Type checking changed tracked source');
    process.exitCode = 1;
  }
  receipt.passed = receipt.failures.length === 0;
  writeFileSync(join(artifacts, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify(receipt, null, 2));
  rmSync(scratch, { recursive: true, force: true });
}
