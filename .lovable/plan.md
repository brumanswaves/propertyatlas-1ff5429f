## PropertyAtlas v1.5 — Data Foundation & Provider-Ready Architecture

This is a large architectural upgrade. Below is the plan I'll execute. Nothing existing gets removed — demo data, map, panel, auth, dashboard, pricing, legal pages, watchlists, and mobile layouts all stay working.

### 1. Provider abstraction layer
Create `src/lib/providers/`:
- `types.ts` — `NormalizedProperty`, `Ownership`, `Transfer`, `Valuation`, `Report`, `ProviderMeta`, `FieldCompliance` (`displayAllowed`, `storageAllowed`, `cachingAllowed`), and a `NotAvailable` sentinel helper.
- `PropertyProvider.ts` — common interface: `searchProperties`, `getProperty`, `getGeometry`, `getOwnership`, `getValuation`, `getTransfers`, `getReports`, `health()`.
- `demo.ts` — wraps existing `src/data/properties.ts` into the interface (fully functional).
- `surveyorGeneral.ts`, `municipalGis.ts`, `winDeed.ts`, `lightstone.ts` — stub providers returning `status: 'not_connected'` + `Not Available` fields, but implementing the full contract.
- `registry.ts` — `getProvider(id)`, `listProviders()`, `getActiveProvider()` reading from localStorage (admin-only switch), defaulting to demo.

Frontend always calls through the registry — never imports a specific provider.

### 2. Normalized property model + graceful "Not Available"
- Add `normalizeProperty()` helper that maps the existing `Property` type to the new `NormalizedProperty` (Erf, Portion, Suburb, Municipality, Province, Coordinates, Land Size, Zoning, Municipal Valuation, Last Sale, Ownership Status, Boundary Geometry, Images, Amenities, Reports Available, etc.).
- Add `<FieldValue>` component that renders "Not Available" (muted) when value is null/undefined — used inside the panel.

### 3. Parcel & map system refactor
- Add `src/lib/geo/parcels.ts` with a `ParcelSource` interface supporting GeoJSON in, with hooks for Shapefile/SG/Municipal feeds later.
- `MapCanvas` keeps existing St Francis demo parcels; geometry now flows through `activeProvider.getGeometry()` so swapping the source doesn't touch the map component.
- Hover/selection/highlight effects preserved. Add scaffolding (commented hook points) for zoning layers and heatmaps.

### 4. Property detail panel upgrades
Keep current slide-out. Add per-tab footer strip showing **Source / Provider / Last Updated**. Add a new **Reports** tab alongside Overview, Ownership, Sales History, Intelligence, Photos. Existing AI/Estimate disclosures stay.

### 5. Report marketplace
- New table `report_orders` (id, user_id, parcel_id, report_type, status, price_cents, payload jsonb, created_at) with RLS + GRANTs.
- `src/lib/reports/catalog.ts` — Property, Ownership, Valuation, Comparable Sales, Transfer History. Each has `available: boolean` — currently all generate mock PDFs/JSON; UI shows "Coming Soon" where `available=false`.
- New route `/reports` listing catalog; "Order" stores a mock row.

### 6. Saved properties expansion
- Migration: add `tags text[]`, `note` already exists, add `priority text`, `status text` (default `'watching'`) to `saved_properties`.
- UI in dashboard: tag chips, priority selector, status dropdown (Watching / Researching / Potential Purchase / Offer Submitted).

### 7. Portfolio dashboard placeholders
Add cards: Estimated Portfolio Value, Total Land Area, Properties Tracked, Reports Purchased, Average Yield, Municipal Exposure — computed from demo data where possible, "Not Available" otherwise, with the standard estimate disclosure.

### 8. Admin tools
- Add `app_role` enum + `user_roles` table + `has_role()` security-definer function (standard pattern).
- New route `/_authenticated/admin` gated by `has_role(uid,'admin')` server-side. Shows: active provider switch, provider health table (Demo Active / SG Not Connected / WinDeed Not Connected / Lightstone Not Connected / Municipal GIS Not Connected), report orders count, property/parcel counts.

### 9. Compliance framework
Every field in `NormalizedProperty` carries an optional `FieldCompliance`. Provider stubs declare defaults (e.g. Lightstone valuation: display ✓, storage ✗, caching ✗). A `<ComplianceGuard>` wrapper hides/labels fields whose `displayAllowed=false`.

### 10. UI warmth pass
- Adjust `src/styles.css` tokens: warmer off-white surface, deeper navy primary, subtle amber accent, softer shadows (`shadow-elev-1/2/3`), tighter type scale. No dark mode flip, no clutter — keeps Apple Maps / Zillow feel.

### Migrations (one migration call)
- `app_role` enum + `user_roles` + `has_role()` + grants/policies
- `report_orders` table + grants/policies
- `saved_properties` add `tags`, `priority`, `status`

### Out of scope (explicit)
- No live provider API calls.
- No removal of demo data or existing features.
- No dark theme.

### Technical notes
- All new server reads use `createServerFn` + `requireSupabaseAuth` where user-scoped.
- Admin route lives under `_authenticated/`; admin check runs server-side via `has_role`.
- Provider switch persisted to `localStorage` (admin-visible UI only); default = demo.
- Type-safe: new `NormalizedProperty` is a superset; existing `Property` still works via adapter so nothing breaks.

Shall I proceed?
