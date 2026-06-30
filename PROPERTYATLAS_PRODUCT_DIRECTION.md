# ErfStoep Product Direction

Last updated: 2026-06-19

## North Star

ErfStoep is an AI erf research command center for real South African parcels.

The first real product is not a fake Zillow clone and not a demo-data property card. The first real product is:

User clicks an official CSG, Kouga, or other public erf -> ErfStoep opens an Erf Research Dossier -> the dossier helps the user gather public data, official links, generated searches, calculators, saved notes, saved evidence, listing research, risk checks, and optional paid reports.

Official parcels are the main product. Demo parcels are examples only.

## Product Guardrails

1. Official parcels are the main product.
   The app should orient around real public parcel geometries and public source research. The official CSG/Kouga click path should evolve into the primary user experience.

2. Demo parcels are examples only.
   Demo records can demonstrate what enriched data could look like, but they must not be treated as production property intelligence.

3. Do not fabricate ownership, valuation, transfer, sale history, rates, zoning, or paid provider data.
   If a fact is not returned by an official source, entered by the user, or attached by a paid provider, the UI must say it is unavailable, manual, paid, or not yet attached.

4. Every data point must be source-labelled.
   Data should identify its source type: official, municipal, public web, generated search, paid provider, user supplied, demo, sponsored, or unavailable.

5. Public research first, paid reports second.
   The MVP should help users do useful public-source research before monetizing. Paid report slots should explain what they add and should never pretend the paid data already exists.

6. Calculators and saved evidence are core product.
   The dossier should let users do practical scenario work and save evidence against a normalized parcel id.

7. Compliance language must stay honest.
   External links, portal searches, paid-provider placeholders, POPIA-sensitive research, and generated summaries must be clearly labelled.

8. One-month MVP goal.
   Within one month, ErfStoep should feel useful and impressive for real official erfs: identify the parcel, show known public fields, generate source-specific research actions, support notes/evidence/listings, provide calculators, and expose paid report/partner slots.

## Current Codebase Position

Current state after Phase 1:

- The main route `/` supports official CSG/Kouga clicks through `OfficialParcelPanel`.
- Demo parcels still use `PropertyPanel` with richer mock valuation/ownership/intelligence examples.
- Admin routes are guarded.
- Dashboard saved demo links reopen `/?parcel=<parcel_id>`.
- SG document context is passed where buildable.
- Missing static official GeoJSON references are handled without fabricating data.

Main product gap:

- `OfficialParcelPanel` is still a panel, not yet the full Erf Research Dossier.
- Public source research exists in pieces: `ResearchLinksTab`, `ListingsTab`, `ReportsTab`, `NotesTab`, `CalculatorsTab`, `SavedLinksManager`.
- These pieces need to be composed around official parcels first, with a normalized parcel id and a source registry.

## Proposed Component Architecture

### `ErfResearchDossier`

Primary official-parcel experience. Replaces or wraps the current `OfficialParcelPanel` content over time.

Responsibilities:

- Accept a normalized official parcel object.
- Render identity header, AI research summary, source checklist, calculators, notes/evidence, paid reports, and sponsor cards.
- Keep all official facts source-labelled.
- Never show demo valuation/ownership as if it belongs to an official parcel.

Suggested props:

```ts
interface ErfResearchDossierProps {
  parcel: NormalizedOfficialParcel;
  onClose: () => void;
}
```

### `PublicSourceRegistry`

Structured catalog of research sources and generated searches.

Responsibilities:

- Define source categories.
- Define source cards for CSG, SG documents, Deeds/WinDeed/Lightstone, municipal valuation/rates, zoning/planning, environmental/heritage/flood/geology, listings/market evidence, neighbourhood intelligence, roads/infrastructure, legal/entity/distress, tenders/catalysts.
- Generate URLs from known parcel context.
- Return unavailable/manual/paid states when required fields are missing.

This should live as data and helper functions, likely under:

- `src/lib/research/publicSourceRegistry.ts`
- `src/lib/research/sourceTypes.ts`

### `ResearchSourceCard`

Reusable source/action card.

Each card should show:

- Source name.
- Source type: official, municipal, public web, generated search, paid provider, user supplied, sponsored.
- Status: available, open search, manual check, paid report, unavailable.
- What it may reveal.
- Action button.
- Compliance/source note.

### `ResearchChecklist`

Category-grouped source checklist.

Responsibilities:

- Render source cards grouped by research category.
- Let users mark checks as not started, checking, found, not found, needs follow-up.
- Save user status against normalized parcel id.

### `CalculatorHub`

Working calculator surface for investors, home buyers, developers, and agents.

Phase 2 should include simple working calculators where inputs are available or user-entered:

- Transfer duty and buyer closing costs.
- Bond payment estimate.
- Land plus build cost.
- Flip profit.
- Holding costs.
- Rental yield.
- Cash-on-cash return.
- Developer margin.
- Target offer price.
- Price per square meter.
- Municipal value vs asking price.
- Renovation budget.
- Professional fees allowance.
- Contingency.
- Selling costs.
- Low/base/high scenario table.

Existing `CalculatorsTab` can be reused, then expanded into `CalculatorHub`.

### `PaidReportsPanel`

Paid-provider and manual-provider slots.

Report slots:

- Lightstone report.
- WinDeed report.
- Deeds/ownership report.
- Valuation report.
- Comparable sales report.
- Zoning/planning consultant report later.

Required copy:

- "Paid provider data not yet attached."
- "Order report" or "Save interest."

This should extend the current `ReportsTab` and `REPORT_CATALOG`.

### `NotesEvidencePanel`

User evidence and private research workspace.

Responsibilities:

- Save notes.
- Save tags.
- Save research status.
- Save research links.
- Save listing URLs.
- Save report interests.
- Save manual findings.
- Later support uploaded screenshots/files.

Existing pieces to reuse:

- `NotesTab`
- `ListingsTab`
- `SavedLinksManager`
- `property_notes`
- `property_listings`
- `property_research_links`
- `saved_properties.user_data`

### `SponsorCard`

Clearly labelled useful partner/sponsor slot.

Sponsor categories:

- Conveyancer.
- Bond originator.
- Architect.
- Engineer.
- Town planner.
- Builder.
- Surveyor.
- Insurance broker.
- Property manager.

Rules:

- Must be clearly labelled as sponsored or partner.
- Must feel like a useful next step for the erf research context.
- Must not be visually confused with official data.

### Normalized Official Parcel Id Helper

Create one helper that all official parcel persistence uses.

Proposed location:

- `src/lib/parcels/officialParcelId.ts`

Proposed strategy:

```ts
type NormalizedParcelSource = "csg" | "kouga" | "demo" | "manual";

interface NormalizedParcelIdParts {
  source: NormalizedParcelSource;
  lpi?: string | null;
  parcelKey?: string | null;
  erfNumber?: string | number | null;
  portion?: string | number | null;
  municipality?: string | null;
  province?: string | null;
  lng?: number | null;
  lat?: number | null;
}
```

Priority:

1. CSG LPI if available: `csg:lpi:<LPI>`.
2. CSG parcel key if available: `csg:parcel-key:<key>`.
3. Erf/portion/municipality/province if available: `csg:erf:<province>:<municipality>:<erf>:<portion>`.
4. Kouga feature object id plus layer if only a zoning feature is available: `kouga:<layer>:<objectid>`.
5. Coordinate fallback only as last resort: `official:point:<rounded-lng>:<rounded-lat>`.
6. Existing demo ids remain unchanged: `parcel-N`.

Requirements:

- Deterministic.
- URL-safe.
- Backward-compatible with existing `saved_properties.parcel_id`.
- Never merge distinct official parcels just because their display text is similar.

### How `OfficialParcelPanel` Evolves

Current `OfficialParcelPanel` should become a thin adapter:

1. Normalize selected Mapbox feature properties.
2. Build a `NormalizedOfficialParcel`.
3. Pass it into `ErfResearchDossier`.

Near-term:

- Keep current panel shell.
- Add dossier sections incrementally.
- Move normalization functions out of component.

Medium-term:

- Rename or replace with `ErfResearchDossier`.
- Use `OfficialParcelPanel` only for backward compatibility, or remove it after the dossier owns the official click path.

### How `PropertyPanel` and Demo Records Fit

`PropertyPanel` should remain as an example/demo experience, not the primary product.

Rules:

- Keep demo labels prominent.
- Do not use demo valuation/ownership to shape official parcel behavior.
- Optionally route demo parcels through `ErfResearchDossier` in "demo/enriched example" mode later, with source labels set to `demo`.
- Demo records can help sell the future enriched experience, but official public dossiers should be useful without fake enrichment.

## Proposed Supabase and Data Changes

Phase 2 should avoid breaking existing saved demo properties. The least risky path is to reuse current user-owned tables with normalized parcel ids first, then add focused columns/tables later.

### Existing Tables to Reuse Immediately

- `saved_properties`
  - Store normalized official parcel id in `parcel_id`.
  - Store official identity snapshot in `user_data`.
  - Use `research_status`, `tags`, `external_links`, `manual_price_cents`, `manual_value_cents`.

- `property_notes`
  - Store notes by normalized parcel id.
  - Add explicit user filters in queries.

- `property_research_links`
  - Store saved official links, generated search links, municipal links, user-supplied evidence URLs.

- `property_listings`
  - Store user-saved listing URLs by normalized parcel id.

- `report_orders`
  - Store paid report interest/order placeholders by normalized parcel id.

### Recommended Additions

Do not add these before approval. Proposed only.

1. `parcel_dossier_status`

Purpose: durable per-user dossier state without overloading `saved_properties`.

Fields:

- `id`
- `user_id`
- `parcel_id`
- `status`
- `tags`
- `checklist`
- `manual_findings`
- `last_opened_at`
- `created_at`
- `updated_at`

2. `parcel_evidence`

Purpose: saved evidence records, later file uploads/screenshots.

Fields:

- `id`
- `user_id`
- `parcel_id`
- `kind`
- `title`
- `url`
- `storage_path`
- `source_type`
- `note`
- `created_at`
- `updated_at`

3. `parcel_report_interests`

Purpose: replace localStorage report interests.

Fields:

- `id`
- `user_id`
- `parcel_id`
- `report_type`
- `provider`
- `interest_kind`
- `status`
- `created_at`

### Normalized Parcel Snapshot

When an official parcel is saved, put a source-labelled snapshot in `saved_properties.user_data`, for example:

```json
{
  "kind": "official",
  "source": "Chief Surveyor-General",
  "sourceLayer": "csg-parcels",
  "displayTitle": "Erf 1234",
  "erfNumber": "1234",
  "portion": "0",
  "lpi": "C019...",
  "parcelKey": "...",
  "municipality": "Kouga Local Municipality",
  "province": "Eastern Cape",
  "lng": 24.83,
  "lat": -34.16,
  "knownFields": ["erfNumber", "portion", "lpi", "parcelKey"],
  "missingFields": ["ownership", "valuation", "transfers", "rates"],
  "fetchedAt": "2026-06-19T00:00:00.000Z"
}
```

### Backward Compatibility

- Existing demo saves use ids like `parcel-123`; keep them working.
- Official saves use namespaced ids like `csg:lpi:...`.
- UI should distinguish `demo`, `official`, and `manual` saved records.
- Existing RLS policies can remain user-owned.

## Public Research Categories

The source registry should support these categories:

1. CSG and SG documents.
2. Deeds and ownership research.
3. Municipal valuation roll, rates, and taxes.
4. Zoning and land use.
5. Planning applications and public notices.
6. Environmental, heritage, flood, coastal, and geology risk.
7. Listings and market evidence.
8. Neighbourhood intelligence.
9. Roads, access, and infrastructure.
10. Legal, entity, estate, and distress research.
11. Public tenders and future area catalysts.

Each category should start as a public-source checklist with generated links and manual save fields. Attach verified data only when a real source or user entry exists.

## One-Month Implementation Roadmap

### Week 1: Stabilize Phase 1 and Create Guardrails

Goals:

- Keep build passing.
- Add this product direction document.
- Create `PublicSourceRegistry` types and first static registry.
- Create normalized official parcel id helper.
- Move official parcel normalization out of `OfficialParcelPanel`.
- Add tests for id helper and source registry URL generation.

Deliverables:

- Product guardrails in repo.
- Source registry skeleton.
- Official parcel normalization helper.
- No major UX rewrite yet.

### Week 2: Build Erf Research Dossier Shell

Goals:

- Create `ErfResearchDossier`.
- Make official parcel clicks open the dossier shell.
- Add premium official identity header.
- Add data completeness score.
- Add AI research summary placeholder that summarizes known vs missing fields without fabricating.
- Add category-grouped `ResearchChecklist`.

Deliverables:

- Official parcels feel like the main product.
- Demo panel remains available as examples.
- Dossier has useful public-source actions even without paid data.

### Week 3: Calculators, Saved Links, Notes, Statuses, Listing Research

Goals:

- Add `CalculatorHub` or extend `CalculatorsTab`.
- Add user dossier status/tags/manual findings.
- Save notes, links, listings, and report interests against normalized official parcel ids.
- Improve dashboard saved official parcel display.
- Add listing research source cards and manual evidence save flow.

Deliverables:

- A user can click a real erf and build a useful saved research file.
- Core calculators work with user-entered assumptions.
- Saved official dossiers are visible and reopenable.

### Week 4: Paid Report Slots, Sponsor Slots, Polish, Legal Copy, Build/Test/Deploy

Goals:

- Add `PaidReportsPanel` with Lightstone, WinDeed, Deeds/ownership, valuation, comparables, planning consultant slots.
- Add clearly labelled `SponsorCard` slots.
- Improve legal/compliance copy for POPIA, paid-provider data, generated searches, and external sites.
- Add smoke tests for official click -> dossier -> save -> reopen.
- Run build and targeted lint.
- Prepare deployment checklist.

Deliverables:

- Real-erf research command center MVP.
- Honest paid-report monetization surface.
- Clearly labelled partner slots.
- Build/test/deploy-ready release candidate.

## Approval Gate

Do not implement the full Phase 2 until this plan is approved.

Next approved coding step should be narrow:

1. Add normalized official parcel id helper.
2. Add source registry types and initial registry.
3. Refactor `OfficialParcelPanel` into an adapter around `ErfResearchDossier` shell.

No fabricated data. Official parcels first.
