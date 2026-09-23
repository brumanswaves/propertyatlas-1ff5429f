# Selected-property workspace lifecycle: section A

Implements [corrected package comment 5786992038](https://github.com/brumanswaves/propertyatlas-1ff5429f/pull/189#issuecomment-5786992038). This is a new source tranche after merged #189, not a release or replay of its acceptance.

- Base: `5026ba639ba19bc2b9b9fec6f41301e18c5d4be9`.
- Exact tested application and fixture source: `98684f4783a00d9838d6ff4a9da945fa04ba7298`.
- Branch: `codex/selected-property-workspace`. The review head may contain a later evidence-only commit; the PR body identifies that full head. No application or fixture changes follow this tested source.
- Actual session selection verified from its turn metadata: `gpt-6-astra`, reasoning `low`, unchanged. Sole writer; no delegated agent.

## Verified behavior

The original global component requested nine bodies with only an owner filter and no selected property. [Baseline request](before.json) records the reproduction against the base source using the actual PostgREST request builder.

The root no longer mounts mutable workspace sync. The map selection owner passes the exact parcel and resolved account. Account changes remount map selection state; only matching account history can restore a selection. Unresolved Auth, unresolved coordinate identity, no selection, deselection and a report-only root do not load saved-investigation bodies.

The active lifetime applies owner and parcel filters before transmitting every workspace read. It validates response count, row owner, row parcel and embedded investigation parcel. Missing/error/ambiguous responses do not erase drafts or acknowledge successful saves. An AbortController invalidates each lifetime, including A -> B -> A, independent of whether transport honors abort.

Restore actions, debounce queues, flush events, Site Potential projects/assets and bounded database rechecks share that lifetime. Unselected events are ignored and flushes are not falsely acknowledged. Cleanup immediately rejects pending flushes, retains browser drafts and prevents stale baseline/local writes. Read-only hydration and reconciliation suppress their own update events. Existing guarded namespace patches and explicit conflict backups remain in use.

Save dispatch checks the current session and pins its existing authorization to the original request. No token is copied into evidence. A dispatched save may already have committed; cancellation does not claim to undo it. The synthetic in-flight case deliberately lets that original-owner save finish while proving no stale local confirmation or baseline update.

## Evidence and checks

- [35-case matrix](matrix.md), [full request/filter/returned-body/mutation evidence](results.json), [browser log](browser.txt).
- [Nine-record and other-eight-draft preservation hashes](preservation.json): before/after hashes equal. The selected-only case returns one body, makes zero mutations and makes no request for another parcel. Per-record hashes are also in results.
- [Command receipts with source, timestamps and exit codes](commands.json): browser, TypeScript, changed-source lint and 43 related Vitest regressions all exit 0. Lint has zero errors/warnings. [Focused log](focused.txt).
- [Isolated production-mode build receipt](build-command.json), [build log](build.txt): exit 0 from an exported copy of the exact commit, dotenv files excluded, synthetic loopback values, external-network guard, `node-server` output. Original build/preview files were not overwritten. Bundle-size/dynamic-import warnings are retained in the log.
- [Canonical Git-blob source hashes](source-files.json), [artifact hashes](SHA256SUMS), [synthetic fixture screenshot](selected-only.png).

The browser loads the actual `__root.tsx`, `index.tsx` map selection owner, `WorkspaceCloudSync`, save/conflict helpers, Site Potential readers and Supabase/PostgREST request builder. The fixture replaces Auth, transport, router plumbing, staff provider and heavy map/panel UI. Its nine-record backend honors the actual query filters; it does not add, repair or intercept missing filters. It records bodies actually returned. Delayed fixtures intentionally return after abort to exercise stale-continuation guards. Fixture persistence uses synthetic session storage and survives browser reload. Raw storage is not packaged.

The screenshot is an unstyled lifecycle fixture, not a product design or live map acceptance image. The report-only case mounts the actual root with a placeholder outlet, not a newly created delivered report. Root source coverage independently confirms that global sync is absent. No real account, report, database, provider, payment or email was created or modified.

## Remaining boundary

This proves selected-map workspace sync and absence of global sync on report-only navigation. It does **not** prove that every application route is metadata-only without a selection. `src/routes/dashboard.tsx:120` independently selects account-wide `user_data`. Its current title/address, investigation-progress and Market summary readers consume those bodies (notably lines 329, 368 and 409 onward). It is not mounted on the map/report fixture and was not silently stubbed as a passing dashboard test.

If the requirement is extended to every route, the minimum separate source tranche is that dashboard query and its summary adapters/tests: request an explicit display/navigation/progress metadata projection while excluding investigation bodies and raw Market evidence, and retain list usability. No such broader repair or new metadata schema was made here. Independent review must keep this scope limit visible.

Real Auth/RLS integration, full dashboard acceptance and production/customer acceptance are not established by these fixtures. Existing #189 report/export and run-16 rehearsal evidence is reused with its original source attribution and synthetic/simulated limits, without rerunning it. Later release gates remain required. No CI, merge, publication, rollback, account/permission change or paid service was dispatched. Additional discretionary spend: $0; account-level Codex metering was not independently measured.

## Reproduce locally

With the existing project dependencies and Chromium/Playwright installation:

```text
node scripts/workspace-scope-preview.mjs
node scripts/verify-workspace-scope.mjs
```

Fixture URL: `http://127.0.0.1:4190/scripts/fixtures/workspace-scope/index.html`. This is a test fixture, not a customer account preview. `EASY_ERF_PLAYWRIGHT_MODULE`, `EASY_ERF_CHROMIUM` and `WORKSPACE_EVIDENCE_DIR` support existing local installations/output locations. The preview ignores dotenv configuration and blocks external Node traffic; the runner blocks non-loopback browser traffic. The final runner recorded zero external requests.

The fixture server was stopped after evidence capture. No implementation worker is claimed to continue after the task. Prior unrelated work, `src/routeTree.gen.ts` status and rehearsal artifacts were preserved; the generated file has no content diff and is not in this PR.
