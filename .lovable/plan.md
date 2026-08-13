# SG TIFF preview not persisted — diagnosis (read-only)

## What the data shows

Asset `9c1d7ac4-0b72-45a2-a405-0743e8066b89` (`image/tiff`, `sg_diagram`, created 12:27:31Z, extracted 12:32:29Z):

- `extractionStatus = partial`, `identityMatchStatus = unverified`, `identityBinding = user_confirmed`, 15 claims, `extractedDocumentType = GENERAL PLAN`, model `gpt-5.6-sol`.
- `sgPreviewStoragePath`, `sgPreviewMimeType`, `sgPreviewGeneratedAt` are all `null`.
- `openaiResponseId` / `openaiFileId` / `openaiContainerId` / `extractionProvider` are already cleared (normal post-finalisation cleanup), so the completed payload can no longer be re-inspected for this run.

So the asset did complete through the background Code Interpreter path, and `previewPatch` came back empty from `storeTiffPreview`.

## Logs are insufficient — and that is a code defect

`storeTiffPreview` in `supabase/functions/extract-erf-asset/index.ts` (lines 159-192) has **five silent `return null` branches and a bare `catch { return null }`**, and emits no `log(...)` line at all. The finalisation path spreads `previewPatch` unconditionally, so an empty patch is indistinguishable from success. Production logs for this asset show only `auth_ok`, `identity_inputs`, `identity_requires_review` — nothing about the preview. Therefore the logs **cannot** discriminate between causes 1-4; that is by itself the first thing to fix.

## Most likely cause from code inspection: (1), with (2) as the immediate second failure

`responseImageOutputUrl` (`openAiTiffBackground.ts:79-94`) only accepts `output[].outputs[]` entries shaped `{ type: "image", url: "..." }`.

- The current OpenAI Responses API does not return Code Interpreter image artefacts that way. Generated files surface as **container files** — `container_file_citation` annotations on the `output_text` part (and/or `outputs` entries carrying `file_id` + `container_id`), with no `url` field. The matcher therefore finds nothing, `previewUrl` is `null`, and `storeTiffPreview` returns at its first line. This fits the observed all-null preview fields with no other symptom.
- Even if a URL were present, `fetch(previewUrl)` is issued with **no `Authorization: Bearer $OPENAI_API_KEY`**, so any `api.openai.com` container/file URL would answer 401/404 and be swallowed as a `!response.ok` return. Container file bytes must be read from `GET /v1/containers/{container_id}/files/{file_id}/content` with the OpenAI bearer token, and that endpoint returns `application/octet-stream` / no useful `content-type`, which the strict MIME allow-list in `storeTiffPreview` would also reject (cause 3 waiting behind cause 2).
- Storage upload (cause 4) is unlikely to be the failure: it uses the service key with `x-upsert`, and the same bucket/path scheme already works for the source asset.

## Smallest safe proposed fix (no edits made)

1. **Instrument first, one line per outcome.** Add `log("sg_preview_skipped"|"sg_preview_failed", requestId, { reason, status, mimeType, bytes })` to each `return null` in `storeTiffPreview`, plus a `log("sg_preview_stored", …)` on success, and log whether `poll.previewUrl` was null. This makes the next run self-diagnosing at essentially zero cost.
2. **Read container files, not URLs.** Extend the payload reader to also collect `{ container_id, file_id }` from `container_file_citation` annotations / `outputs` entries, and fetch bytes from `/v1/containers/{container_id}/files/{file_id}/content` with `Authorization: Bearer OPENAI_API_KEY`. Keep the existing `url` branch as a fallback, and send the bearer header when the URL host is `api.openai.com`.
3. **Relax MIME validation to sniffing.** When the response has no usable `content-type`, detect PNG/JPEG/WebP from the leading magic bytes and store with the sniffed type; only reject when no image signature matches. Keep the 5 MB ceiling.
4. Preview persistence stays strictly non-blocking — a preview failure must never change `extractionStatus`, claims, or identity outcome.

Scope: `supabase/functions/extract-erf-asset/openAiTiffBackground.ts` and the `storeTiffPreview` helper in `supabase/functions/extract-erf-asset/index.ts` only. No schema, secret, or frontend change. Verifying it requires one fresh background run on a SG TIFF after deploy, since the prior response ids are already cleaned up.
