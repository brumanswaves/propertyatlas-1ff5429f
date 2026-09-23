# Focused browser results

Synthetic data and transport, actual dashboard/request builder. No live Auth/RLS acceptance.

| Case | Result |
| --- | --- |
| nine properties scalar response and preservation | PASSED |
| mobile cards and no horizontal overflow | PASSED |
| legacy missing metadata remains unknown | PASSED |
| genuine empty distinct from failure | PASSED |
| failure rejects data and retries safely | PASSED |
| wrong-owner rejects data and retries safely | PASSED |
| duplicate rejects data and retries safely | PASSED |
| wrong-projection rejects data and retries safely | PASSED |
| bad-scalar rejects data and retries safely | PASSED |
| malformed rejects data and retries safely | PASSED |
| server page cap loads remaining scalar pages | PASSED |
| bounded pagination shows honest partial list | PASSED |
| account switch and sign-out clear cards | PASSED |
| delayed A B A cannot resurrect old A response | PASSED |
| auth refresh hides old rows until reloaded | PASSED |
| missing-count is a read failure | PASSED |
| missing-page is a read failure | PASSED |
| changed page count fails closed | PASSED |
| note owner mismatch fails closed | PASSED |
| sign-out while a read is pending denies late rows | PASSED |
| cancelled removal preserves every record | PASSED |
| navigate Continue Investigation to exact selected parcel then return | PASSED |
| navigate Open Report to exact selected parcel then return | PASSED |
| navigate Open Market evidence to exact selected parcel then return | PASSED |
| navigate keyboard to exact selected parcel then return | PASSED |

| Additional check | Result |
| --- | --- |
| Full local regression | 172 files, 1770 tests, exit 0 |
| Normal configured build | cloudflare-module, exit 0 |
| TypeScript | exit 0 |
| Changed source lint | exit 0 on canonical LF blobs; initial CRLF export attempt exit 1 |
| Live Auth/RLS, real PostgREST server, production dashboard | NOT TESTED |
| Real maps/providers, report delivery or export | NOT TESTED; unaffected prior evidence retains original limits |
