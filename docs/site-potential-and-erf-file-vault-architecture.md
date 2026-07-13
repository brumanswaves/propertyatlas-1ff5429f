# Site Potential and Erf File Vault Architecture

This document records the current Easy Erf Workbench data flow and the proposed architecture for a new paid **Site Potential** feature plus a permanent cloud **Erf File Vault**.

The goal is to support vacant-land and renovation visualisation workflows without turning the Workbench into a static mockup, without losing files on another device, and without treating browser storage as the permanent source of truth.

## 1. Current-State Data-Flow Map

### Workbench navigation and UI

- `src/components/property/OfficialParcelPanel.tsx`
  - Owns the full-screen clicked-erf Workbench shell.
  - Current nav items are `Overview`, `Sources`, `Market`, `Paid Reports`, `Strategy`, `Notes`, and `Easy Erf Report`.
  - The new `Site Potential` section should be inserted after `Sources` and before `Market`.
  - Tracks local Workbench progress, source opened/reviewed state, SG diagram count, paid report count, selected tab, and dirty/save state.
- `src/components/property/ErfResearchDossier.tsx`
  - Renders the tab content used by the Workbench, including Market, Paid Reports, Strategy, Notes, and Easy Erf Report.
  - `StoepAiReportView` currently assembles a report shell from local workspace state, saved market evidence, strategy scenarios, and IndexedDB attachments.
- `src/components/property/dossier/ReportBuilderOverview.tsx`
  - Renders the Overview report-builder card, progress rows, action cards, and recommended next-step banner.
  - Reads report progress from `src/lib/workbench/reportProgress.ts`.
- `src/components/property/dossier/investorWorkflow.ts`
  - Defines the older investor workflow view model and due-diligence stage model.
  - `InvestorWorkflowView` currently does not include `site-potential`.

### Current persistence and survival model

| Data | Current storage | Survives refresh | Survives device change | User/parcel tied | Notes |
| --- | --- | --- | --- | --- | --- |
| Saved property record | Supabase `saved_properties` | Yes | Yes | Yes | Main durable parcel save table. |
| Saved property `user_data` | Supabase `saved_properties.user_data` plus local fallback | Yes | Yes if signed in and saved | Yes | Market evidence and property identity overrides can live here. |
| Market evidence/comps | `useSavedMarketEvidence`, Supabase `saved_properties.user_data.savedMarketEvidence` when possible; localStorage fallback | Yes | Yes only after Supabase save | Yes | Strongest current durable evidence path. |
| Market candidates | `saved_properties.user_data.marketEvidenceCandidates` or localStorage fallback | Yes | Yes only after Supabase save | Yes | Still metadata, not file storage. |
| Research links | Supabase `property_research_links` | Yes | Yes | Yes | Stores URL/note only, not source files. |
| Report orders/interests | Supabase `report_orders` plus localStorage `pa.reportInterests.{parcelId}` | Yes | Partly | Yes | Orders are placeholder/no payment processed today. |
| Workbench progress | `localStorage` via `erfWorkspaceState.ts` | Yes | No | Parcel key only | Identity/source/progress state is local-only. |
| Strategy scenarios | `localStorage` via `erfWorkspaceState.ts` | Yes | No | Parcel key only | Chosen strategy is local-only. |
| SG diagram uploads | IndexedDB via `erfWorkspaceFiles.ts` | Yes | No | Parcel key only | Stores `Blob` locally. |
| Lightstone/WinDeed PDFs | IndexedDB via `erfWorkspaceFiles.ts` | Yes | No | Parcel key only | Stores `Blob` locally, reference-only. |
| Easy Erf Report shell | Derived in React from current state | N/A | Depends on inputs | Parcel key | No durable generated report export yet. |

### Current uploaded-file model

`src/lib/workbench/erfWorkspaceFiles.ts` stores files in IndexedDB:

- Database: `erfstoep-workbench-files`
- Object store: `attachments`
- Kinds:
  - `sg-diagram`
  - `paid-report-lightstone`
  - `paid-report-windeed`
- Status:
  - `uploaded_reference_only`
- Metadata:
  - `id`
  - `parcelId`
  - `kind`
  - `provider`
  - `status`
  - `fileName`
  - `fileType`
  - `fileSize`
  - `uploadedAt`
  - `sourceLabel`
- Blob:
  - `file: Blob`

The report shell calls `readAllWorkspaceAttachments(parcel.id)` and opens files with `URL.createObjectURL(file.file)`. This works only on the same browser/device.

## 2. Current Storage Problems

1. Browser files are not durable enough.
   - SG diagrams, Lightstone PDFs, and WinDeed PDFs are IndexedDB blobs.
   - They disappear if the browser storage is cleared.
   - They do not appear on a second device.

2. Workbench progress is fragmented.
   - Source review, identity status, strategy scenarios, and report-started state are localStorage.
   - Saved market evidence has a better Supabase path, but the Workbench file/progress model is not yet normalized.

3. There is no unified file ledger.
   - `report_orders.pdf_storage_path` exists, but current uploads do not use it.
   - `property_research_links` stores URLs only.
   - There is no table that says, "these are all files/assets belonging to this user and parcel."

4. There is no cloud Storage bucket for erf assets.
   - No `supabase.storage.from(...)` usage was found.
   - No Storage bucket or Storage policy migration exists.

5. Generated Site Potential designs would currently have no correct home.
   - Storing generated image blobs in Postgres would be wrong.
   - Storing generated images in browser storage would break the paid-feature promise.

## 3. Exact Proposed Database Schema

Use one shared asset ledger for every file connected to an erf, with feature-specific tables pointing back to that ledger.

### 3.1 Enum/check values

Prefer check constraints over Postgres enums if this app wants easier future category additions. If strict enums are preferred, the same values can be converted to enum types.

Recommended `asset_category` values:

- `official_document`
- `sg_diagram`
- `paid_report`
- `title_deed`
- `zoning_document`
- `topography`
- `site_photo`
- `existing_house_photo`
- `architectural_plan`
- `inspiration_image`
- `generated_design`
- `report_export`
- `other`

Recommended `asset_status` values:

- `pending_upload`
- `uploaded_reference_only`
- `processing`
- `ready`
- `failed`
- `archived`
- `deleted`

### 3.2 `erf_assets`

```sql
create table public.erf_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parcel_id text not null,

  asset_category text not null check (
    asset_category in (
      'official_document',
      'sg_diagram',
      'paid_report',
      'title_deed',
      'zoning_document',
      'topography',
      'site_photo',
      'existing_house_photo',
      'architectural_plan',
      'inspiration_image',
      'generated_design',
      'report_export',
      'other'
    )
  ),
  asset_type text not null,
  source_label text,

  storage_bucket text not null default 'erf-files',
  storage_path text not null,
  original_file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  checksum_sha256 text,

  status text not null default 'uploaded_reference_only' check (
    status in (
      'pending_upload',
      'uploaded_reference_only',
      'processing',
      'ready',
      'failed',
      'archived',
      'deleted'
    )
  ),

  metadata jsonb not null default '{}'::jsonb,
  local_migration_fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (storage_bucket, storage_path)
);

create index erf_assets_user_parcel_idx
  on public.erf_assets (user_id, parcel_id, created_at desc);

create index erf_assets_user_parcel_category_idx
  on public.erf_assets (user_id, parcel_id, asset_category, created_at desc);

create unique index erf_assets_local_migration_fingerprint_idx
  on public.erf_assets (user_id, parcel_id, local_migration_fingerprint)
  where local_migration_fingerprint is not null;
```

Notes:

- Do not store file blobs or base64 file content in Postgres.
- `metadata` should hold provider-specific fields such as `provider: "lightstone"`, `reportType`, `legacyAttachmentKind`, `generatedDesignPromptId`, dimensions, concept title, warnings, or selected-design flags.
- `local_migration_fingerprint` prevents duplicate uploads during IndexedDB migration retries.

### 3.3 `erf_site_projects`

```sql
create table public.erf_site_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parcel_id text not null,

  mode text not null check (mode in ('vacant_land', 'renovation')),
  title text,
  brief text,
  target_style text,
  intended_use text,
  assumptions jsonb not null default '{}'::jsonb,

  preferred_design_asset_id uuid references public.erf_assets(id) on delete set null,
  status text not null default 'draft' check (
    status in ('draft', 'ready_for_generation', 'generation_ordered', 'generated', 'failed', 'archived')
  ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index erf_site_projects_user_parcel_idx
  on public.erf_site_projects (user_id, parcel_id, created_at desc);
```

### 3.4 `erf_site_project_assets`

This join table makes it possible to attach many photos, plans, topographical surveys, inspiration images, and generated designs to one Site Potential project.

```sql
create table public.erf_site_project_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_project_id uuid not null references public.erf_site_projects(id) on delete cascade,
  asset_id uuid not null references public.erf_assets(id) on delete cascade,
  role text not null check (
    role in (
      'site_photo',
      'existing_house_photo',
      'topography',
      'plan',
      'inspiration',
      'generated_option',
      'selected_generated_option',
      'supporting_document'
    )
  ),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (site_project_id, asset_id, role)
);

create index erf_site_project_assets_project_idx
  on public.erf_site_project_assets (site_project_id, display_order);
```

### 3.5 `erf_design_packs`

A design pack is the paid generation request that should produce six concept visualisations.

```sql
create table public.erf_design_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parcel_id text not null,
  site_project_id uuid not null references public.erf_site_projects(id) on delete cascade,

  payment_provider text,
  payment_reference text,
  entitlement_status text not null default 'pending_payment' check (
    entitlement_status in ('pending_payment', 'paid', 'refunded', 'cancelled')
  ),
  idempotency_key text not null,

  requested_count integer not null default 6 check (requested_count between 1 and 12),
  completed_count integer not null default 0,
  status text not null default 'pending_payment' check (
    status in ('pending_payment', 'queued', 'generating', 'complete', 'failed', 'cancelled')
  ),
  prompt_snapshot jsonb not null default '{}'::jsonb,
  failure_code text,
  failure_message text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, idempotency_key)
);

create index erf_design_packs_user_parcel_idx
  on public.erf_design_packs (user_id, parcel_id, created_at desc);
```

Generated images should be inserted into `erf_assets` as `asset_category = 'generated_design'`, then linked through `erf_site_project_assets`.

### 3.6 Optional `erf_asset_events`

For auditability, especially around paid generation and deletion:

```sql
create table public.erf_asset_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  asset_id uuid references public.erf_assets(id) on delete cascade,
  parcel_id text not null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

## 4. Exact Proposed Storage Structure

Create one private Supabase Storage bucket:

- Bucket: `erf-files`
- Public: `false`
- Suggested per-file size limits:
  - SG/topography/plans/PDFs: 25 MB initially
  - Site photos: 15 MB initially
  - Generated designs: server-generated, typically smaller; enforce max dimensions and MIME type

Recommended path:

```text
{user_id}/{parcel_id}/{asset_category}/{asset_id}/{safe_filename}
```

Examples:

```text
2d4.../E108C034001400001021000000/sg_diagram/9a1.../sg-diagram.pdf
2d4.../E108C034001400001021000000/paid_report/a73.../lightstone-report.pdf
2d4.../E108C034001400001021000000/site_photo/c2d.../north-boundary.jpg
2d4.../E108C034001400001021000000/generated_design/73b.../modern-courtyard-option-01.png
```

Rules:

- `user_id` must be the authenticated user's ID.
- `parcel_id` must be the normalized Easy Erf parcel ID used by `saved_properties`.
- `asset_id` must be the `erf_assets.id`.
- `safe_filename` must be sanitized. Never trust original path fragments.
- Signed URLs should be generated on demand. Do not make the bucket public.

## 5. RLS and Security Plan

### Table RLS

Enable RLS on all new tables.

Users can manage only their own rows:

```sql
alter table public.erf_assets enable row level security;

create policy "users read own erf assets"
on public.erf_assets for select to authenticated
using (auth.uid() = user_id);

create policy "users insert own erf assets"
on public.erf_assets for insert to authenticated
with check (auth.uid() = user_id);

create policy "users update own erf assets"
on public.erf_assets for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

Repeat equivalent policies for `erf_site_projects`, `erf_site_project_assets`, and `erf_design_packs`.

### Storage policies

Use private bucket policies that verify the first path segment equals `auth.uid()::text`.

Example shape:

```sql
create policy "users read own erf files"
on storage.objects for select to authenticated
using (
  bucket_id = 'erf-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users upload own erf files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'erf-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);
```

Server-side generation may use service-role access, but must still check:

- The authenticated user owns the `erf_site_project`.
- The design pack is paid/entitled.
- Input assets belong to the same user and parcel.
- Storage paths stay inside `{user_id}/{parcel_id}/...`.

### Upload validation

Validate at both UI and server/Storage boundary:

- MIME type
- extension
- max file size
- image dimensions where relevant
- PDF/image only for user uploads
- reject executable/archive/script files
- safe filename normalization
- duplicate fingerprint/idempotency

### Privacy and external-source boundaries

- Do not scrape or capture Google Street View imagery.
- It is acceptable to save an external Google Street View link as a research URL.
- Renovation visualisation must use user-uploaded photos, user-owned plans, user-permitted images, or explicitly licensed provider imagery.
- Generated concept images must be labelled as concept visualisations, not approvals, legal buildability, quotes, or architectural plans.

## 6. IndexedDB Migration Strategy

Current local attachments should be migrated into the vault without data loss.

### Migration source

Read from `src/lib/workbench/erfWorkspaceFiles.ts`:

- `readSgDiagramAttachments(parcelId)`
- `readPaidReportAttachments(parcelId)`
- `readAllWorkspaceAttachments(parcelId)`

### Migration steps

1. User signs in.
2. User opens a Workbench for a saved parcel.
3. App reads local IndexedDB attachments.
4. App queries `erf_assets` for existing `local_migration_fingerprint` values.
5. For each local attachment not yet migrated:
   - Create a deterministic fingerprint from `parcelId`, `kind`, `provider`, `fileName`, `fileSize`, `uploadedAt`, and possibly a hash of the Blob.
   - Insert `erf_assets` row with `status = 'pending_upload'`.
   - Upload Blob to `erf-files/{user_id}/{parcel_id}/{asset_category}/{asset_id}/{safe_filename}`.
   - Update `erf_assets.status` to `uploaded_reference_only`.
6. Keep local IndexedDB copy until upload and metadata confirmation both succeed.
7. After successful migration, mark the local record as migrated or remove it only after explicit confirmation.

### Duplicate prevention

- Use `local_migration_fingerprint`.
- Use `(storage_bucket, storage_path)` uniqueness.
- Use idempotent retry behavior.

### Failure behavior

- Never delete local files after a partial failure.
- Show "local copy still available in this browser" until migration is complete.
- Keep migration non-blocking so the Workbench remains usable.

## 7. Site Potential State Model

Add a `Site Potential` section between `Sources` and `Market`.

### Workbench tab model

Existing tab union:

```ts
type Tab =
  | "overview"
  | "research"
  | "listings"
  | "reports"
  | "notes"
  | "calculators"
  | "stoep-report";
```

Recommended addition:

```ts
type Tab =
  | "overview"
  | "research"
  | "site-potential"
  | "listings"
  | "reports"
  | "calculators"
  | "notes"
  | "stoep-report";
```

Also update `InvestorWorkflowView` in `investorWorkflow.ts`.

### Site project model

Client-side type should mirror `erf_site_projects`:

```ts
type SitePotentialMode = "vacant_land" | "renovation";

interface ErfSiteProject {
  id: string;
  parcelId: string;
  mode: SitePotentialMode;
  title?: string;
  brief?: string;
  targetStyle?: string;
  intendedUse?: string;
  assumptions: Record<string, unknown>;
  preferredDesignAssetId?: string | null;
  status:
    | "draft"
    | "ready_for_generation"
    | "generation_ordered"
    | "generated"
    | "failed"
    | "archived";
}
```

### Asset roles

Site Potential should attach files by role, not by one-off component state:

- `site_photo`
- `existing_house_photo`
- `topography`
- `plan`
- `inspiration`
- `generated_option`
- `selected_generated_option`
- `supporting_document`

### Report progress impact

`reportProgress.ts` can add Site Potential as either:

1. A new sixth row, if the final report should visibly include design readiness; or
2. A sub-status under Report/Strategy for a smaller first release.

For the paid visualisation feature, the clearer UX is a sixth row:

- Identity
- Sources
- Site Potential
- Market
- Strategy
- Report

Use "Optional" or "Not started" states so the base report still works without a paid visualisation.

## 8. AI-Generation Server Architecture

Generation must be server-side only.

### Recommended server path

Use one of the existing server patterns:

- TanStack Start API route, similar to `src/routes/api/listings.import.ts`; or
- Supabase Edge Function, similar to `supabase/functions/arcgis-public-proxy/index.ts`.

For paid generation, a Supabase Edge Function is preferable if it needs service-role Storage writes and long-running provider calls. A TanStack API route is also acceptable if the deployment runtime supports the timeouts and binary handling required.

### Request flow

1. User creates or updates a Site Potential project.
2. User uploads relevant files into `erf-files` and `erf_assets`.
3. User purchases a design pack.
4. Payment webhook or verified checkout return marks `erf_design_packs.entitlement_status = 'paid'`.
5. Client calls `POST /api/site-potential/generate` or Edge Function with `siteProjectId` and `designPackId`.
6. Server:
   - Authenticates the user.
   - Verifies project ownership.
   - Verifies paid entitlement and idempotency key.
   - Loads relevant assets via signed URLs or service-role Storage access.
   - Builds prompt from user brief, parcel context, selected uploaded photos/plans/topography, and explicit assumptions.
   - Calls AI image generation with a server-only key.
   - Stores generated images in `erf-files`.
   - Inserts `erf_assets` rows with `asset_category = 'generated_design'`.
   - Links assets to `erf_site_project_assets`.
   - Updates `erf_design_packs.status` and count fields.

### No frontend AI key

- Do not add OpenAI keys to `VITE_*`.
- Do not call OpenAI directly from browser code.
- Keep all model/provider secrets in server-only environment variables.

### Output language

Every generated design must carry this or equivalent wording:

> AI-generated concept visualisation. Not an architectural plan, municipal approval, quotation, or representation of what may legally be built.

## 9. Payment and Entitlement Boundary

### Current status

- `report_orders` exists.
- `ReportsTab.tsx` records placeholder report interest and says no payment is processed.
- `src/lib/config.server.ts` has an example comment for `stripeSecretKey`, but no active Stripe/payment integration was found.
- No real checkout flow is currently connected.

### Future design-pack payment boundary

Do not generate designs just because a client says payment happened. Use server-verified entitlement:

- `erf_design_packs.entitlement_status = 'paid'`
- `payment_provider`
- `payment_reference`
- `idempotency_key`
- optional separate `erf_design_orders` table if the payment system is larger than design packs

Generation starts only when:

1. User is authenticated.
2. The design pack belongs to the user and parcel.
3. Payment is verified server-side.
4. The request idempotency key is unused or safely retryable.

## 10. Final-Report Integration

`StoepAiReportView` should eventually read:

- `erf_assets` for all uploaded files and generated design outputs.
- `erf_site_projects` for the active Site Potential project.
- `erf_site_project_assets` for attached photos/plans/topography/generated designs.
- The selected `preferred_design_asset_id`.

Report content should include:

- Selected concept image thumbnail or signed URL.
- Site Potential mode: vacant land or renovation.
- Project title/brief.
- User assumptions.
- Input file status:
  - site photos uploaded
  - existing-house photos uploaded
  - topographical survey uploaded
  - plans uploaded
  - paid provider reports uploaded
- Generated design disclaimer.
- Missing evidence warnings.

The report should not claim:

- Legal buildability
- Municipal approval
- Architectural compliance
- Quantity surveyor pricing
- Ownership verification
- Valuation certainty

## 11. Exact Existing Files Likely To Change

### Workbench shell and nav

- `src/components/property/OfficialParcelPanel.tsx`
  - Add `site-potential` tab.
  - Insert Site Potential after Sources.
  - Add progress/state hooks for Site Potential.
  - Route next-step CTAs.
- `src/components/property/ErfResearchDossier.tsx`
  - Render `SitePotentialTab`.
  - Update Easy Erf Report to read cloud assets, not only IndexedDB files.
- `src/components/property/dossier/investorWorkflow.ts`
  - Add `site-potential` to `InvestorWorkflowView`.
  - Add due-diligence stage if Site Potential affects workflow.
- `src/components/property/dossier/ReportBuilderOverview.tsx`
  - Add Site Potential progress/action if approved.
  - Link Site Potential row/card to the new tab.

### State, progress, and files

- `src/lib/workbench/erfWorkspaceState.ts`
  - Add `sitePotentialStarted`, `sitePotentialProjectCount`, `selectedDesignAssetId` if local transitional state is needed.
  - Long term, prefer Supabase state for cross-device progress.
- `src/lib/workbench/erfWorkspaceFiles.ts`
  - Should become a compatibility/migration layer, not permanent storage.
  - Add migration helpers or move them to a new module.
- `src/lib/workbench/reportProgress.ts`
  - Include Site Potential in report progress if it becomes a first-class report section.
- `src/components/property/tabs/ReportsTab.tsx`
  - Replace IndexedDB-only paid report uploads with vault-backed uploads.
- `src/components/property/tabs/ListingsTab.tsx`
  - No direct Site Potential change expected, but Market may read shared assets later.

### Supabase and server

- `src/integrations/supabase/types.ts`
  - Regenerate after migrations.
- `src/integrations/supabase/client.server.ts`
  - Reuse for trusted server operations if TanStack server routes are used.
- `src/routes/api/listings.import.ts`
  - Existing API route pattern to copy for authenticated server routes.
- `supabase/functions/arcgis-public-proxy/index.ts`
  - Existing Edge Function pattern to copy if generation is implemented as Supabase Edge Function.
- Supabase migrations under `supabase/migrations/`
  - Add `erf_assets`, `erf_site_projects`, `erf_site_project_assets`, `erf_design_packs`, RLS, and Storage bucket/policies.

### Tests

- `src/components/property/__tests__/dossierUx.test.ts`
- `src/lib/workbench/__tests__/erfWorkspaceFiles.test.ts`
- `src/lib/workbench/__tests__/erfWorkspaceState.test.ts`
- `src/lib/workbench/__tests__/reportProgress.test.ts`
- New tests for Site Potential and vault services.

## 12. Exact New Files Likely To Be Created

### Client/domain

- `src/components/property/tabs/SitePotentialTab.tsx`
- `src/components/property/sitePotential/SitePotentialProjectForm.tsx`
- `src/components/property/sitePotential/SitePotentialAssetUploader.tsx`
- `src/components/property/sitePotential/GeneratedDesignPack.tsx`
- `src/components/property/sitePotential/SelectedDesignPanel.tsx`
- `src/lib/sitePotential/types.ts`
- `src/lib/sitePotential/siteProjectService.ts`
- `src/lib/sitePotential/designPackService.ts`
- `src/lib/sitePotential/__tests__/sitePotential.test.ts`

### File vault

- `src/lib/workbench/erfAssetVault.ts`
- `src/lib/workbench/erfAssetTypes.ts`
- `src/lib/workbench/migrateLocalWorkspaceAttachments.ts`
- `src/lib/workbench/__tests__/erfAssetVault.test.ts`
- `src/lib/workbench/__tests__/migrateLocalWorkspaceAttachments.test.ts`

### Server/Edge

- `src/routes/api/site-potential.generate.ts`
- `src/routes/api/site-potential.upload-url.ts` if signed upload URLs are used.
- `supabase/functions/generate-site-potential-pack/index.ts` if using Edge Functions.
- `supabase/functions/create-site-potential-checkout/index.ts` when real payment is added.
- `supabase/functions/site-potential-webhook/index.ts` for payment webhook handling.

### Database

- `supabase/migrations/YYYYMMDDHHMMSS_erf_file_vault.sql`
- `supabase/migrations/YYYYMMDDHHMMSS_site_potential_projects.sql`

## 13. Phased Implementation Plan

### Phase 0: Architecture guardrails

- Keep browser IndexedDB as compatibility only.
- Do not remove current SG/paid report upload UI until the vault is ready.
- Do not add AI generation before storage, RLS, payment entitlement, and disclaimers are in place.

### Phase 1: Cloud Erf File Vault foundation

- Add private `erf-files` bucket.
- Add `erf_assets`.
- Add RLS and Storage policies.
- Add `erfAssetVault` service for upload/list/open/remove.
- Update Easy Erf Report to list cloud vault files.
- Keep IndexedDB local files visible while migration is pending.

### Phase 2: IndexedDB migration

- Detect local SG and paid report attachments.
- Upload them to `erf-files`.
- Insert `erf_assets` metadata.
- Mark migration complete without duplicate uploads.
- Keep local fallback until confirmed.

### Phase 3: Site Potential shell

- Add `Site Potential` nav item after Sources.
- Add mode selection: vacant land or renovation.
- Add project brief and assumptions.
- Add vault-backed upload zones for:
  - site photos
  - existing-house photos
  - topographical surveys
  - plans
  - inspiration images
- Keep all copy clear that this is concept/planning support, not legal buildability.

### Phase 4: Payment entitlement

- Add design-pack order/entitlement flow.
- Use server-side payment verification.
- Make generation idempotent.
- Do not expose provider or AI secrets to the frontend.

### Phase 5: AI generation

- Server generates six concept images.
- Store images in `erf-files`.
- Insert `erf_assets`.
- Link to Site Potential project.
- User selects one preferred concept.

### Phase 6: Final report integration

- Easy Erf Report includes selected concept image and Site Potential summary.
- Report export stores generated export as `asset_category = 'report_export'`.
- Add full file list from `erf_assets`.

## 14. Test Plan

### Unit tests

- `erfAssetVault`
  - builds safe storage paths
  - rejects unsafe filenames
  - validates MIME and size limits
  - maps legacy IndexedDB kinds to new categories
  - lists assets by parcel and category
- IndexedDB migration
  - migrates SG diagram
  - migrates Lightstone PDF
  - migrates WinDeed PDF
  - retries idempotently
  - does not delete local file on upload failure
- Site Potential model
  - creates vacant-land project
  - creates renovation project
  - attaches multiple files
  - selects preferred generated design
- Report progress
  - Site Potential optional state does not block the free report
  - paid generated concept improves report completeness when present

### Component tests

- Workbench nav includes Site Potential between Sources and Market.
- Site Potential upload zones render.
- Existing SG upload still works.
- Paid Reports upload still works or routes to vault-backed uploader.
- Easy Erf Report lists all vault files.
- Easy Erf Report shows selected generated design if present.
- No copy claims generated designs are architectural plans or municipal approval.

### Integration tests

- Authenticated user uploads a file and can list/open it later.
- A second user cannot list/open another user's file metadata or signed URL.
- Storage policy rejects paths outside the user's folder.
- Signed URLs expire and are regenerated on demand.
- Design-pack generation cannot start without paid entitlement.
- Repeated generation requests with same idempotency key do not double-charge or duplicate output.

### Manual QA

- Save an erf on device A, upload SG and paid report PDFs, open on device B, confirm files appear.
- Clear browser storage and confirm cloud files still appear after sign-in.
- Upload multiple Site Potential photos/plans.
- Generate six concept placeholders only after entitlement is implemented.
- Select one concept and confirm it appears in Easy Erf Report.

## 15. Risks and Unresolved Decisions

### Risks

- Migration from IndexedDB can lose trust if users think files were already cloud-saved. The UI must clearly label local-only vs cloud-saved status during rollout.
- Supabase Storage RLS is easy to misconfigure. Path-based policies must be tested with multiple users.
- Generated design features can create legal/consumer risk if copy implies buildability, valuation, planning permission, or architectural compliance.
- Large photo/PDF uploads may exceed runtime limits if routed through server functions instead of direct Storage uploads.
- AI image generation may need async jobs rather than a single request/response function.

### Unresolved decisions

- Whether Site Potential progress should become a sixth report-builder row immediately or remain an optional report enhancement.
- Whether upload should use direct Supabase client upload or server-issued signed upload URLs.
- Which payment provider will be used for design packs.
- Whether generated concept packs are one-time purchases per parcel or reusable credits.
- Whether selected design should be one per Site Potential project or one per parcel.
- Whether report exports should be stored automatically as `report_export` assets in the same vault.

### Recommended default decisions

- Use Supabase Storage direct uploads with strict Storage RLS for normal user files.
- Use server/Edge service-role writes only for generated design outputs.
- Add Site Potential as a first-class Workbench nav item, but keep it optional in report progress.
- Use `erf_assets` as the single source of truth for every file, including SG diagrams and paid reports.
- Keep IndexedDB support only as a migration and offline fallback layer.
