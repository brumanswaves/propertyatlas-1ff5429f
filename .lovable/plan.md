# Exporting `erf-files` and migrating Easy Erf to a founder-owned backend

## Verified current state (read-only)

Queried the live storage catalogue just now:

- Bucket `erf-files` (private): **58 objects, ~71.8 MB total**
  - `ae0ac2f4-8449-4ae9-bbe8-09f230a02ba5/` — 45 objects, ~53.9 MB
  - `dd556ed0-ac6d-4545-9589-88203f852430/` — 13 objects, ~17.9 MB
- Bucket `database_export_13_08_26` (private): 1 object, a `.backup` file (~1.2 MB) — precedent that a database dump was already staged into storage.

## Answer to the direct question

**There is no built-in Lovable Cloud "download bucket" or "export storage as ZIP" UI action.** The storage UI is per-object. So there are no exact UI steps to give for a bulk export — that capability does not exist today, and I should not invent one.

What *is* supported, and avoids 58 manual downloads: I can run a **read-only export pass** from the agent sandbox. It lists every object in `erf-files`, downloads each one using the backend's own credentials (never printed, never committed), rebuilds the identical path tree, and packages it as a single archive you download from chat. Nothing in the bucket, database, or deployment is touched.

## Proposed export (when you approve leaving plan mode)

1. List all 58 objects with full paths, sizes, MIME types, timestamps and metadata.
2. Download each object into `/tmp/erf-files-export/<exact/object/path>` — byte-identical, original filenames, both UUID folders preserved as top-level directories.
3. Write a `manifest.csv` / `manifest.json` next to the tree recording, per object: path, size, MIME type, created/updated timestamps, and a SHA-256 checksum.
4. Verify: object count = 58, total bytes = 71,765,300, no zero-byte files, checksums recomputed from disk.
5. Produce `erf-files-export-<date>.zip` in `/mnt/documents` so you can download it in one click, plus the manifest as a separate file.

Note on metadata: object *paths*, filenames, content types, sizes and timestamps are all preserved in the archive + manifest. ZIP itself cannot carry Supabase-side fields (owner id, `metadata` JSON) — that is exactly what the manifest is for, and it is what a re-upload script reads to restore content types on the new project.

## Migration path to a founder-owned Supabase project

Lowest-risk sequence, storage-focused:

1. **Freeze-free export first** (above). No production interaction beyond reads.
2. **Create the new founder-owned project**, then recreate the `erf-files` bucket as **private** with the same name.
3. **Preserve user UUIDs** when migrating auth users. Every storage path starts with a user UUID and `erf_assets.storage_path` embeds it, so a changed UUID silently breaks every file link. This is the single highest-risk item in the whole migration.
4. **Re-upload** from the export tree, path-for-path, setting content type from the manifest, then re-verify count/bytes/checksums against the manifest.
5. **Apply schema migrations** from the repo (tables, RLS, grants, triggers, functions), then import row data.
6. **Re-enter secrets** in the new project and re-deploy edge functions.
7. Point the app at the new project and smoke-test signed-URL access for one SG diagram and one paid report per user.

### Can storage be copied server-side, project-to-project?

Not directly. Supabase Storage has no cross-project server-side copy; `copy`/`move` operate within one project. Any transfer is download-then-upload. Two options:

- **Via the sandbox (recommended)**: credentials stay in the sandbox environment, never in chat, files never leave a trusted path. Requires the new project's key to be added as a secret when the upload step comes.
- **Via your machine**: you download the ZIP I produce and upload with your own new-project key. Nothing sensitive ever reaches me. Slightly more manual, maximum key isolation.

Either way, no secret needs to be displayed, logged, or committed.

## Scope of this step

Read-only. Approving this plan authorises only the export + manifest + ZIP. Creating the new project, uploading, schema apply and cutover are separate approvals.
