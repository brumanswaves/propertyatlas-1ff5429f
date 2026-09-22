# PR #189 exact-candidate release decision packet

Prepared 2026-09-22. **Decision: HOLD. Do not approve merge or publication while the changed-file lint gate fails.** This packet is preparation only, not release authority.

## Candidate and change

- Repository: [brumanswaves/propertyatlas-1ff5429f](https://github.com/brumanswaves/propertyatlas-1ff5429f).
- Draft [PR #189](https://github.com/brumanswaves/propertyatlas-1ff5429f/pull/189), branch `codex/rehearsal-repairs-review`.
- Exact reviewed and locally validated application candidate: `9dd0f100299c5b235c125395f1a958cc79eef64c`.
- Exact base: `84a6e99f7985ba7d5b1b3a29d2c19c76acae2b95`.
- Tested repair parent: `3016bb735f6e63baca493309c93ca454ddabeaed`.
- Application tree: `74c4693a34827fe3a520cbf6b06fa5fc55dcf678`; scripts tree: `fa9973794285ff50e613be72631e798b43a5b028`.
- The commit adding this packet is a documentation-only successor. Its exact hash is the enclosing GitHub commit and the final candidate receipt distributed with this packet. Application, scripts, backend, workflows, dependencies and tracked environment must remain identical to the reviewed candidate. This equivalence does not waive the failed lint gate.

The candidate normalizes legacy empty investigation inputs without hiding genuine save conflicts. Delivered-report printing waits for selected SG/map settlement, coalesces repeated requests and cancels stale account/order/version exports. Ask Easy Erf placement and report design remain preserved.

## Verified checks and remaining blocker

Commands used existing local dependencies, Node 24.16.0 and the committed external-network guard. No package installation, remote runner dispatch, paid provider request or deployment was performed. Full command arguments, UTC start/end times and process exit codes are retained in the linked JSON receipts. Packaged logs normalize line endings/trailing whitespace, redact credential patterns and replace local home paths; empty TypeScript output is backed by its explicit exit-code receipt.

| Gate | Exact result | Evidence |
| --- | --- | --- |
| Final production-mode build | Exit 0, 2026-09-22 16:57:48Z to 16:59:05Z; `node node_modules/vite/bin/vite.js build`, `NITRO_PRESET=node-server`, original tracked configuration restored | [Commands](commands.json), [build output](production-build.txt), [output hashes](build-manifest.json) |
| TypeScript | Exit 0; `node node_modules/typescript/bin/tsc --noEmit --pretty false` | [First-pass commands](isolated-first-pass-commands.json), [output](typecheck.txt) |
| Full local regression coverage | First invocation exit 1: 171 files, 1,745 passed / 6 failed out of 1,751 tests. All failures were confined to three files requiring the withheld tracked `.env`. After restoring it, those three files passed all 12 tests, exit 0. Unaffected 168 files reused. This is split-run coverage, not a single green full-suite invocation | [Initial output](full-regression-initial.txt), [corrected-environment commands](commands.json), [12-test recheck](environment-dependent-recheck.txt) |
| Changed TypeScript lint, same scope as Guided workflow | **Exit 1, BLOCKED:** `scripts/fixtures/print-readiness/index.tsx:12:19`, `@typescript-eslint/no-explicit-any`. Four warnings: one fixture fast-refresh warning plus three existing map hook warnings | [Command](changed-lint-command.json), [complete output](changed-lint.txt) |
| Candidate whitespace | `git diff --check 84a6e99f7985ba7d5b1b3a29d2c19c76acae2b95 HEAD`, exit 0 before documentation update; documentation checked again at finalization | Final candidate receipt |
| Reviewed source reuse | 14 original source hashes match retained source.json, and LF-normalized originals equal candidate Git blobs. Candidate and tested parent differ only in docs | [Verification](evidence-verification.json), [provenance](provenance.json) |
| Binary/evidence integrity | All 49 prior checksum entries verified before the README correction; historical ZIP/PDF unchanged | [Verification](evidence-verification.json) |
| Backend/workflows/dependencies | `git diff --quiet 84a6e99f HEAD -- supabase .github package.json package-lock.json bun.lock`, exit 0 | [Tree identities](provenance.json) |
| Exact-head remote CI | GitHub returned zero runs for reviewed head. No dispatch, CI pass or branch-protection waiver claimed | [Provenance](provenance.json) |

**Required next engineering action:** a narrowly scoped correction to the fixture's explicit `any`, followed by changed-file lint and appropriate source-binding verification. It is intentionally not folded into this checks-and-packet-only pass. Any source successor must receive a new exact-candidate receipt; this packet is not transferable release authority.

The isolated checkout began at the exact reviewed commit. The original worktree's route generator has line-ending-only dirty status and untracked rehearsal scripts/artifacts; all were preserved. Local builds also regenerate route-file line endings without a content diff. Existing installed dependencies were reused, not freshly installed from the lockfile. Build warnings include ignored dependency `use client` directives and large chunks. This Node-server build does not prove a hosted Lovable build, served production bytes or runtime acceptance.

The initial launcher exited 1 before Vite started because a Windows absolute import required a file URL. [Initial receipt](launcher-initial-commands.json) and [error](launcher-initial-failure.txt) are retained. The corrected launcher produced an initial exit-0 build with dotenv withheld, then a final exit-0 build with the original configuration restored. No source fix was required for these tooling/environment corrections. The final configured build is the release build evidence; the [earlier isolated build](isolated-no-dotenv-build.txt) is diagnostic history.

## Reused independent and journey evidence

[Independent review 5780415182](https://github.com/brumanswaves/propertyatlas-1ff5429f/pull/189#issuecomment-5780415182) clears the export-readiness blocker at the reviewed candidate. Its nine independent reduced Chromium probes and all-page visual review are attributed to the reviewer, not represented as fresh executions here. The retained 11 actual-component browser cases and 21 focused report/context checks remain valid source-bound evidence. No unchanged full rehearsal or browser case was repeated.

The new delayed-visual PDF has **18 pages**, SHA256 `369ea5bc732b5a80c4a0d95e6a980e7f311605410267e55e7ee4974d9010dfa5`. The corrected [README](../print-readiness/README.md) and its checksum replace the inaccurate 17-page statement. Original run-16 PDF remains 21 pages. Historical export ZIP SHA256 stays `557f7b23672949f4a2f4ba43c31245375f471b8b4c395dd5f8c6be2a21174dac`; it is an immutable historical packet and still contains its old README. The new correction is outside that ZIP.

- [New PDF](../print-readiness/delayed-ready-export.pdf), [component evidence](../print-readiness/results.json), [source hashes](../print-readiness/source.json).
- [Original run-16 journey receipt](../rehearsal-run16/REHEARSAL.md), [persistence/handoff/delivery/denial evidence](../rehearsal-run16/evidence/persistence-handoff-delivery-denial.json), [historical source limitation](../rehearsal-run16/source-identification.json).
- Existing accessible [old/new ZIP in Drive](https://drive.google.com/file/d/1HTCFtCnW3EBJ-6_4kUE5HUQZ1oxGwtXH/view) and [18-page PDF in Drive](https://drive.google.com/file/d/1lX2bbV2nikTLfoSloaRqHWADbTUBrsAk/view), as retrieved and checked by the independent reviewer. No upload or sharing change in this pass.

Run-16 used historical HEAD `23ff503828db85b68d56ed5c15c8f5b6f1926ac7` with uncommitted repairs, not a contemporaneous clean committed candidate. Its unaffected persistence/security evidence is reused with that limitation. Its old export does not validate the repaired readiness path. Green/orange map/SG assets are synthetic timing probes. Payments are simulated. Real Mapbox imagery, operating-system print dialog, genuine Stripe/Sandbox events, natural authentication expiry, paid-provider quality and production acceptance remain unverified.

## One combined release boundary, pending a passing candidate and explicit approval

**Not executable for this failed-gate candidate.** Once the lint gate is resolved and a new exact candidate is verified, the owner may consider one combined authorization covering these related actions. Approval must name the replacement head; it must not silently carry forward from this document.

1. Recheck sole-writer status, exact PR head/base, GitHub protection requirements and source equivalence. Preserve draft status until explicit authorization includes marking it ready and merging. No forced merge or protection bypass. Stop if paid remote CI would be required without an approved allowance.
2. If all gates and applicable approvals hold, merge only the approved candidate into `main`; record merge SHA and resulting application tree.
3. Before publication, inspect the existing [Lovable project](https://lovable.dev/projects/8680b46b-3325-4395-9767-a8c0ae2a3a50), its current deployment/source and stable served baseline. Publish that merged candidate once through the existing project only if the owner has explicitly authorized this specific publication and it incurs no additional discretionary charge. No Lovable implementation/build prompt or new project. A pending, timed-out or ambiguous response consumes that one-shot action; inspect it and do not retry.
4. Read-only verification on [easyerf.co.za](https://easyerf.co.za) and [easyerf.lovable.app](https://easyerf.lovable.app): record deployment ID/status and source, fetch served application assets and identify the approved repair in the served bytes, then inspect safe public navigation for rendering failures without submitting forms or invoking paid/map/provider actions. Provider metadata alone is not deployment proof. Authenticated saves, uploads, report generation, payment, email and provider-triggering acceptance require separate explicit scope and are excluded.

Preserved backend: existing canonical [Supabase project xiqpfhsdlvwrwhclonsg](https://supabase.com/dashboard/project/xiqpfhsdlvwrwhclonsg). No database migration, Edge Function deployment, data write, Stripe setting/event, live or Sandbox test, real email, document upload, paid AI/Lightstone/other provider, credentials, permissions, billing, DNS, new cloud resource or Vercel use. Prior consumed TEST/upload/publication allowances are not renewed.

Rollback boundary: capture current deployment ID/source and served-asset baseline before any newly authorized publication. On a failed or ambiguous release, stop and preserve the evidence. No automatic rollback, compensating deployment, destructive reset, backend change or second publication is included. A frontend-only rollback to the recorded prior deployment needs explicit owner authorization.

Cost: additional discretionary cap **$0**, no new recurring service. Local preparation initiated no paid service call. Account-level Codex metered cost is UNKNOWN. Future GitHub runner allowance and Lovable publication cost must be verified before use; if nonzero or unknown, stop and obtain a specific service/cap decision. The zero-cost alternative is to keep this draft and retain the existing deployment.

Stop on competing writer, head/base/source mismatch, unresolved gate, broader repair, unavailable evidence/tool, unapproved cost, provider call, production/backend/credential/permission change beyond the exact approval, or a pending/ambiguous publication. Successful release evidence would establish only the exact merged and served frontend plus the named read-only checks, not genuine commercial or full product acceptance.

## Execution status

Local build/check processes finished. No background builder, CI dispatch or publication was started by this pass. PR remains draft. Release is **BLOCKED by changed-file lint** and is not authorized. Next actor: the existing sole Codex writer under a bounded fixture-correction scope, then the owner for a new exact-candidate release decision. Model/reasoning inspected as GPT-6 Astra / low and unchanged; additional discretionary spend initiated $0, account charges UNKNOWN.
