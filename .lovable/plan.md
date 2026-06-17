# PropertyAtlas MVP — Public Property Research Hub

Reposition PropertyAtlas as a **research operating system** for South African property: outbound public links, user notes, calculators, saved-property workflow, and third-party report ordering. No scraping, no claims of owning official records. All existing functionality (map, parcels, auth, dashboard, watchlists, saved properties, pricing, legal, mobile) is preserved.

## 1. Positioning & copy

- Update tagline + hero on `routes/index.tsx`:
  - H1: *"One place to research a South African property before you buy, sell, or invest."*
  - Sub: *"Save every property, link, report, and note in one place."*
- Add a small disclaimer line on the homepage, property panel footer, and `/reports`:
  > "PropertyAtlas helps organize property research from public sources, user notes, and third-party reports. Official records and valuations should be verified through the relevant provider."
- Sprinkle CTAs: *Research properties faster.* / *Compare opportunities before you buy, sell, or invest.* / *Order official third-party reports when you need verified data.*

## 2. Property research panel — 6 tabs

Refactor `src/components/property/PropertyPanel.tsx` to use 6 tabs (replaces current set, keeps slide-out + scroll behaviour):

1. **Overview** — existing field grid via `<FieldValue>`. Add "Edit details" mode so users can override/add Address, Erf, Suburb, Town, Municipality, Province, Coords, Property type, Land size, Status. Stored under `saved_properties.user_data jsonb`.
2. **Research Links** — new `ResearchLinksTab.tsx`. Helper `src/lib/research/links.ts` builds outbound URLs from address/erf/suburb/municipality:
   - Google Maps, Google Street View, Google Search
   - Property24, Private Property search
   - Municipal valuation roll search (Google fallback `site:gov.za "valuation roll" {muni}`)
   - Municipal GIS / zoning portal search
   - Surveyor General search
   - WinDeed search, Lightstone info page
   - Deeds Office info page
   All `target="_blank" rel="noopener"`, labeled *External source*.
3. **Listings** — `ListingsTab.tsx`. Quick-search buttons (Property24, Private Property, Pam Golding, Seeff, RE/MAX, Rawson, Google). Form to save listings: URL, asking price, agent, agency, notes, date found, status (`For Sale | Under Offer | Sold | Off Market | Watching`). Stored in new `property_listings` table.
4. **Reports** — keep `lib/reports/catalog.ts`; expand to: Lightstone Property Report, Lightstone Property Value Seller, WinDeed Property Report, WinDeed AVM, SG Diagram. All marked `Coming Soon` except Lightstone Property Report which runs the placeholder order flow (creates `report_orders` row with `status='pending'`, `provider='lightstone'`, no real payment). Disclaimer text included.
5. **Notes** — `NotesTab.tsx`. Multi-section textarea: Personal notes, Pros, Cons, Questions to verify, Agent contact, Municipality notes, Renovation notes. Plus a Due Diligence Checklist (10 fixed items) with checkbox state. Stored in `property_notes` table.
6. **Calculators** — `CalculatorsTab.tsx`. Four pure-client calculators (Buy-to-let yield, Flip profit, Development feasibility, Holding cost). All show *"Estimates only. Not financial, legal, tax, or valuation advice."*

Each tab keeps the existing `<SourceBadge>` footer.

## 3. Saved properties workflow

- Migration: add `saved_properties.research_status text default 'new'`, `external_links jsonb default '[]'`, `manual_price_cents int`, `manual_value_cents int`, `user_data jsonb default '{}'` (tags/priority/status already exist).
- Status options: `New | Researching | Watching | Report Ordered | Interested | Offer Submitted | Passed | Purchased`.
- `routes/dashboard.tsx` shows new status chip + filter, plus counts per status.

## 4. Map — manual property creation

- `MapCanvas.tsx`: on right-click / long-press an empty point (or via a floating "Add Property / Research This Location" button on the map), open a small dialog capturing Address, Erf, Suburb, Municipality, Notes. Saves a `saved_properties` row with `parcel_id = 'user:{uuid}'` and opens it in the panel.

## 5. Reports marketplace

- `routes/reports.tsx` updated to surface the 5 report types above with provider attribution + Coming Soon badges.
- Lightstone placeholder checkout: 3-step modal (Select report → Confirm details → Order pending). Inserts into `report_orders`. No Stripe call unless already wired (it isn't — skip).

## 6. Admin / provider roadmap

- `routes/admin.tsx`: add a "Data Provider Roadmap" panel listing:
  - Demo data — Active
  - Public link research — Active
  - Lightstone reports — Pending integration
  - WinDeed reports — Pending
  - Surveyor General — Pending
  - Municipal GIS — Pending

## 7. Compliance

- Add `<ComplianceNotice>` component shown on Research Links, Listings, Reports tabs and on `/reports`.
- No scraping anywhere — all third-party data access is via outbound link or user-entered text.

## Technical details

**New files**
- `src/components/property/tabs/OverviewTab.tsx`
- `src/components/property/tabs/ResearchLinksTab.tsx`
- `src/components/property/tabs/ListingsTab.tsx`
- `src/components/property/tabs/ReportsTab.tsx`
- `src/components/property/tabs/NotesTab.tsx`
- `src/components/property/tabs/CalculatorsTab.tsx`
- `src/components/property/AddPropertyDialog.tsx`
- `src/components/common/ComplianceNotice.tsx`
- `src/lib/research/links.ts` (URL builders)
- `src/lib/research/checklist.ts` (10 due-diligence items)
- `src/lib/research/calculators.ts` (pure math)
- `src/lib/research/listings.functions.ts`, `notes.functions.ts`, `saved.functions.ts` (server fns with `requireSupabaseAuth`)

**Edited**
- `src/components/property/PropertyPanel.tsx` — swap tab set
- `src/components/map/MapCanvas.tsx` — add "Add Property" entry point
- `src/routes/index.tsx` — new hero copy
- `src/routes/reports.tsx` — expanded catalog + Lightstone placeholder
- `src/routes/admin.tsx` — provider roadmap panel
- `src/routes/dashboard.tsx` — research status chip/filter
- `src/lib/reports/catalog.ts` — 5 report types

**Migrations**
```sql
-- property_listings
CREATE TABLE public.property_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  parcel_id text not null,
  url text, asking_price_cents int, agent text, agency text,
  notes text, found_at date default current_date,
  status text not null default 'Watching',
  created_at timestamptz not null default now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.property_listings TO authenticated;
GRANT ALL ON public.property_listings TO service_role;
ALTER TABLE public.property_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own listings" ON public.property_listings FOR ALL TO authenticated
  USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- property_notes (one row per user/parcel)
CREATE TABLE public.property_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, parcel_id text not null,
  personal text, pros text, cons text, questions text,
  agent_contact text, municipality text, renovation text,
  checklist jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique(user_id, parcel_id)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.property_notes TO authenticated;
GRANT ALL ON public.property_notes TO service_role;
ALTER TABLE public.property_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notes" ON public.property_notes FOR ALL TO authenticated
  USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- saved_properties additions
ALTER TABLE public.saved_properties
  ADD COLUMN IF NOT EXISTS research_status text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS external_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS manual_price_cents int,
  ADD COLUMN IF NOT EXISTS manual_value_cents int,
  ADD COLUMN IF NOT EXISTS user_data jsonb NOT NULL DEFAULT '{}'::jsonb;
```

## Out of scope
- Real payments (Stripe/PayFast not configured; placeholder order only).
- Live Lightstone/WinDeed/SG/Municipal API calls.
- Any scraping or copying of third-party data.
- Removing existing features, pages, or visual identity.
