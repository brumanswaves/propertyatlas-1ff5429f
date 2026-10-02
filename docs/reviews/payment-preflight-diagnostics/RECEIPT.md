# Payment preflight diagnostic source receipt
Scope: PR #202 comment 5961338895. Base f952b349de9b4177d552b8afd17739f82e9bb2bc. Sole existing checkout easy-erf-issue193; branch codex/payment-preflight-diagnostics. Existing untracked artifacts preserved; no other checkout edited. Open-PR inventory empty before implementation. Related inspected Node processes were CUA runtimes, not build/writer processes; no competing source edits observed. App thread inventory call did not return, so app-wide task status is unavailable.

## Result
Existing authenticated/admin-gated account GET now retains actual account ID. New existing-UI check rows expose ID, configured key mode and business name/website pass/fail/unknown, bound to existing request ID/time. No raw profile values. Missing/null fields stay UNKNOWN/blocking, explicit invalid values FAIL, exact expected values PASS. Missing/malformed identity blocks readiness. Failed retrieval cannot inherit a prior request's identity. Error-name logging uses a fixed allowlist.
No frontend runtime change, new endpoint, additional Stripe account call, secret/configuration/permission change or production invocation.

## Executed evidence
- 32 focused canonical/model and actual handler tests passed, service doubles only. Authorization, one retrieval, failed retrieval after success, serialization sentinels, missing/null/invalid/matching fields and TEST/LIVE/disarmed states.
- Original ESLint rules including prettier/prettier enabled on all four changed TypeScript files: exit 0.
- TypeScript --noEmit: exit 0.
- git diff --check: exit 0.
- Exact function plus shared imports TypeScript check with cached Stripe22.6.0 worker types and cached pinned Supabase2.108.0 types and its cached dependencies: zero diagnostics. Initial harness used a nonexistent old Stripe type path and failed resolution; corrected to the package's actual worker declaration. Source did not change for that harness repair. The initial resolution-failure log is retained. An intermediate check against installed Supabase2.116.0 was not used as pinned-runtime evidence; the final check maps the cached2.108.0 dependencies explicitly.
- No native Deno executable available in PATH or targeted existing tool locations. Native Deno resolution/deployed execution is NOT established by the TypeScript substitute. No installation, downloads or remote CI dispatched. Remote CI unrun is not a pass.

## Evidence reuse and rollout limits
Frontend/runtime, build configuration, dependencies and workflows unchanged. Prior reviewed PR202 frontend build and geometry/browser evidence retain their original attribution; they do not verify this changed Edge function. No full suite/build/browser/map/report replay. Applicable focused source checks completed; native Deno dependency resolution and independent exact-candidate review remain rollout prerequisites. No production-contacting workflow may be dispatched to obtain them.
Existing Founder checks renderer displays every returned check's label/status/detail and existing observation/request ID; therefore no frontend publication is required. A later approved deployment must name easy-erf-founder-launch-readiness and its shared modules in xiqpfhsdlvwrwhclonsg, retain verify_jwt=true and all pinned imports, then bind deployed definition and one authorized Founder result to that source.
The activation package here is a sanitized mirror of the existing local customer-payment-finish/ACTIVATION-PACKAGE.md, updated in place. It supersedes the obsolete request to retrieve unavailable historical Stripe log bodies. Control-room TEST-link/account evidence is attributed, not promoted to runtime credential proof.

## Ledger
Additional discretionary spending initiated $0; account billing unknown. Original USD10 acceptance cap unchanged. Maps10/10, geometry save1/1 and report delivery consumed. No charge, signed event, deployment, publication, report rewrite/delivery or provider account call. Source/tests and package preparation only. MVP still lacks a saleable source-backed report and non-admin isolation proof. Next actor: independent reviewer, then separately authorized diagnostic rollout if retained evidence is insufficient.

Implementation commit: a17eb8db241d6c9d4daac22f2b61d47fd8efa970. Final evidence commit retains these same four TypeScript blobs.
