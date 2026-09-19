# SG Receipt and Preview, Issue #181 Item 7

## Product contract

Secure receipt, visual preview and interpretation are separate. Guided SG upload retains the original in the existing account/parcel File Vault and does not start extraction. Once receipt is acknowledged, Continue opens Check title even if interpretation is pending, failed or unavailable. This is navigation, not SG verification. The existing evidence model, subject identity gate and parent General Plan policy remain unchanged.

An explicit local permission acknowledgement enables optional Read diagram, but cannot override a saved `aiProcessingAllowed=false` restriction. Shared investigation server permission checks remain authoritative. This change does not grant document-processing rights or change saved permissions.

TIFF preview uses the same pinned MIT `utif2@4.1.0` decoder already used by the deterministic server renderer, in a terminable browser worker. It renders pixels only. It does not use AI, establish cadastral identity or save extracted evidence. PDF/image preview uses the stored original. The original bytes are never replaced by the preview.

## Bounded behavior

- Local source limit: existing 25 MB upload limit. TIFF preview: at most 32 pages, 12 million pixels per selected page, up to four 1/2/4/8-bit samples, 1600-pixel display edge. Decode deadline eight seconds; signed-original retrieval plus preview has a twelve-second UI bound.
- Unsupported, corrupt, oversized or slow previews retain Open file/manual review and Continue. Large historical sheets may exceed these limits. No promise is made that every SG TIFF will preview locally.
- Local TIFF decoding accepts strip-based uncompressed, CCITT Group 3/4 and PackBits images. Tiled, JPEG, Deflate, LZW and camera-specific encodings fall back to manual review to avoid decoder allocations outside validated dimensions. Private camera tags are not passed to the pixel decoder.
- Group 3 preserves standard tag 292. Only 1-D/2-D and EOL-fill flags (0, 1, 4, 5) are allowed; the uncompressed extension, reserved bits and malformed options fail before pixel decoding. `scripts/fixtures/sg-group3-2d.json` is an original synthetic 8x4 sheet with explicit expected pixels, not a property document. Its actual pinned-decoder worker output and built-browser output are checked, not just the tag list.
- Exact-byte SHA-256 prevents repeat uploads in the mounted Guided step and finds previously attached files bearing the receipt hash. Legacy files without a checksum and simultaneous separate-browser uploads are not content-deduplicated. Existing server extraction locks remain in place.
- Manual and automatic reading requests coalesce by account, parcel, assigned order and asset. A thirty-second acknowledgement deadline is not job cancellation. An ambiguous request stays refresh-only until a changed extraction status/revision is observed; an unchanged old failure cannot authorize a retry.
- The real extraction client carries outcome certainty independently of an HTTP status/error code. Uncoded JSON 503, gateway WORKER_LIMIT, invalid response bodies and similar unacknowledged starts remain uncertain. Explicit contract validation/permission rejections and recorded terminal outcomes remain definitive. Existing known-job retrieval may retry quietly. Refreshing unchanged old metadata never starts or unlocks a new review; a newer authoritative result can release the guard without starting another request. Continue/manual review remains available while status is unresolved.
- Automatic TIFF checks require an existing response ID, wait eight seconds initially, then twenty seconds, and stop at ninety seconds. They cannot turn an unstarted upload into an automatic paid review. Leaving the step stops polling, not an already acknowledged server job.
- Reopened self-service previews fetch the private original through existing Storage authorization. Reopened delegated files retain the existing authorized Open file path; inline delegated preview is available only for the just-uploaded local file. No new delegated Storage permission is introduced.

## Evidence and timing limits

`scripts/verify-sg-receipt-preview.mjs` uses the real app, canonical hooks and Guided controls, synthetic accounts and a generated 1200x1600 TIFF. Browser requests are intercepted; all nonlocal traffic is blocked. The local application server runs with `verify-shared-investigation-network.mjs` to block nonlocal server traffic too. No production credentials or documents are used.

The receipt records source SHA, dirty flag, original hash/size, measured receipt/preview/fallback milliseconds, preview pixel checks, duplicate prevention, reload, continuation, denied consent and a delayed synthetic reading request. It exercises late HTTP failure, repeated unchanged refresh/clicks and recovery on newer metadata, plus every expected pixel of a 2-D Group 3 sheet. Desktop/mobile screenshots accompany it. Initial local measurements were about 1.1-1.2 seconds to receipt and 1.3-1.5 seconds to visible pixels for a 7.3 MB synthetic TIFF. Final exact-head measurements and screenshots belong to the PR/CI artifact, not a guaranteed SLA.

The owner's long real-document wait is reported evidence. Current live download, decoder and model stage timings are not established by this tranche. No real document extraction, paid canary or production upload is authorized here. Deep interpretation quality and live latency remain unverified. Report refinement, including Ask Easy Erf at the top, remains the next separately scoped issue #181 batch; a paid-canary blocker does not block that source work.

## Release boundary

One draft source PR from `3185ca05bff997cb224499ab17feac9672d45914`. No backend function, schema or permission change. Independent review and a separate exact-candidate rollout decision precede any publication. PR #184 publication and acceptance save are consumed and must not be replayed. Preserve the original dirty worktree, live drafts and separate report-design preview.
