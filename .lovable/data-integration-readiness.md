# PropertyAtlas — Data Integration Readiness Report

**Status:** Feature freeze in effect. Focus is stability, performance, mobile, DB schema, and provider integration readiness. No new user-facing features until SG / Municipal GIS / WinDeed / Lightstone integrations are finalized.

---

## 1. Demo Data Audit

All synthetic data flows through a single source and a single provider entry point. There are **no direct imports of mock data into components** — they all go through `getActiveProvider()` or read the in-memory dataset via the demo provider.

| Location | Role | Production action |
|---|---|---|
| `src/data/properties.ts` | In-memory St Francis Bay pilot dataset (~real polygons, fake attributes). | Keep as fallback/seed. Gate behind `provider === "demo"` only. |
| `src/lib/providers/demo.ts` | `demoProvider` — normalizes the pilot dataset to `NormalizedProperty`. | Keep. Used for offline dev + sales demos. |
| `src/lib/providers/stubs.ts` | `surveyor-general`, `municipal-gis`, `windeed`, `lightstone` stubs — return empty + `not_connected`. | Replace `notConnectedProvider(...)` body per provider as integrations land. |
| `src/lib/providers/registry.ts` | Single switch via `localStorage` (`pa.activeProvider`). | Move active provider to a server-side per-tenant setting before launch. |
| `src/components/map/MapCanvas.tsx` | Renders polygons from active provider. | No change needed once providers return geometry. |
| `src/components/map/SearchBar.tsx` | Calls `searchProperties`. | No change. |
| `src/components/map/FilterPanel.tsx` | Filters provider results client-side. | Push filters into provider query when real APIs support them. |
| `src/components/property/PropertyPanel.tsx` | Pulls overview / ownership / valuation / transfers / geometry. | No change once providers populate `Field<T>`. |
| `src/routes/index.tsx`, `dashboard.tsx`, `admin.tsx` | Consumers of `getActiveProvider()`. | No change. |

**Verdict:** The provider abstraction is the only seam. Demo data cannot leak into a non-demo provider session.

---

## 2. Provider Readiness Checklist

Legend: ✅ ready · 🟡 partial · 🔴 missing

### 2.1 Parcel boundary requirements
| Item | Status | Notes |
|---|---|---|
| `NormalizedGeometry` (GeoJSON Polygon + centroid + source) | ✅ | `src/lib/providers/types.ts` |
| Map rendering pipeline | ✅ | `MapCanvas` consumes any provider geometry |
| Multi-polygon / portion handling | 🟡 | Type allows single Polygon only — add `MultiPolygon` before SG ingest |
| Cadastral CRS handling | 🔴 | SG uses Hartebeesthoek94 LO; need reprojection helper to WGS84 |
| Per-parcel caching policy | 🔴 | Decide TTL + storage table once SG license is signed |

### 2.2 Property search requirements
| Item | Status | Notes |
|---|---|---|
| `searchProperties({ query, limit })` contract | ✅ | |
| Server-side debouncing/throttling | 🔴 | Move search to a `createServerFn` to apply rate limits + cache |
| Structured search (erf, portion, scheme/SS) | 🟡 | Currently free-text; extend `SearchInput` |
| Address geocoding fallback | 🔴 | Needed for WinDeed/Lightstone which expect normalized addresses |

### 2.3 Ownership requirements
| Item | Status | Notes |
|---|---|---|
| `NormalizedOwnership` + `Field<T>` compliance envelope | ✅ | Caching/display flags already exist |
| ID number masking | 🟡 | `idNumber?` exists; UI must respect `displayAllowed=false` (WinDeed) |
| Owner-type taxonomy (Individual / Trust / Company) | ✅ | |
| Audit log of ownership lookups | 🔴 | POPIA: log every WinDeed query with user_id, purpose |

### 2.4 Transfer history requirements
| Item | Status | Notes |
|---|---|---|
| `NormalizedTransfer[]` (date, price, buyer, seller, deedRef) | ✅ | |
| Pagination for long histories | 🔴 | Add cursor to `getTransfers` |
| Deed document storage | 🔴 | Need a `deed_documents` storage bucket + signed URLs |

### 2.5 Valuation requirements
| Item | Status | Notes |
|---|---|---|
| `NormalizedValuation` (market estimate, municipal value, confidence, asOf) | ✅ | |
| Comparable sales | 🔴 | Add `getComparables(id)` to `PropertyProvider` for Lightstone |
| AVM versioning | 🔴 | Persist `model_version` alongside cached valuations |

### 2.6 Report ordering requirements
| Item | Status | Notes |
|---|---|---|
| `report_orders` table + RLS | ✅ | Migration `20260617151510_*` |
| Catalog (`src/lib/reports/catalog.ts`) | ✅ | 5 report types defined |
| Provider report list (`getReports(id)`) | ✅ | |
| Payment integration | 🔴 | Stripe/Paddle not wired |
| Webhook → mark order complete + attach PDF | 🔴 | Need `/api/public/webhooks/{provider}` + storage bucket |
| Order status enum (`pending → paid → fulfilling → complete → failed`) | 🟡 | Currently free-text `status` |

### 2.7 Database schema readiness
| Table | Status | Required before go-live |
|---|---|---|
| `profiles`, `user_roles`, `watchlists` | ✅ | |
| `saved_properties` (with `user_data`, `external_links`, `manual_*`, `research_status`) | ✅ | |
| `property_listings`, `property_notes` | ✅ | RLS scoped to `auth.uid()` |
| `report_orders` | 🟡 | Add `provider_id`, `provider_order_ref`, `pdf_storage_path`, status enum |
| `provider_cache` | 🔴 | New table: `(provider_id, resource_type, resource_id, payload jsonb, fetched_at, expires_at)` |
| `provider_audit_log` | 🔴 | New table: `(user_id, provider_id, action, resource_id, purpose, at)` — POPIA requirement for WinDeed/Lightstone |
| `provider_settings` | 🔴 | Per-tenant active provider + credentials (encrypted, server-only) |

### 2.8 API adapter readiness
| Adapter | Status | Blockers |
|---|---|---|
| `demoProvider` | ✅ | — |
| `surveyor-general` | 🔴 stub | License/MoU; CRS reprojection helper; cadastral ID mapping |
| `municipal-gis` | 🔴 stub | Per-municipality endpoints differ; need adapter-per-municipality sub-registry |
| `windeed` | 🔴 stub | Commercial account; per-query billing; audit logging; POPIA purpose-of-use field |
| `lightstone` | 🔴 stub | Commercial contract; cache/storage restrictions; AVM display rules |
| Server-side adapter execution | 🔴 | All four must run in `createServerFn` (never browser) — credentials are server secrets |
| Standardized error envelope | 🟡 | Add `ProviderError { code, retryable, message }` to the contract |
| Health checks surfaced in `/admin` | 🟡 | `health()` exists; admin page should poll and display latency |

---

## 3. Production Hardening Backlog (pre-integration)

Ordered by impact:

1. **Move provider calls server-side.** Wrap each `PropertyProvider` method behind a `createServerFn`; the browser never sees provider credentials or raw responses.
2. **Add `provider_cache` + `provider_audit_log` tables.** Required for WinDeed/Lightstone licensing and to cap per-query cost.
3. **Strengthen `report_orders`** with enum status, provider linkage, and a `report_files` storage bucket.
4. **Extend `NormalizedGeometry`** to support `MultiPolygon` and add a Hartebeesthoek94 → WGS84 reprojection helper.
5. **Mobile performance pass** on `MapCanvas` (cluster markers, lazy-load polygons by viewport bbox).
6. **Replace `localStorage` provider switch** with a server-side, role-gated setting.
7. **POPIA review:** purpose-of-use prompt before any WinDeed/Lightstone lookup; mask ID numbers by default.
8. **Standardize `ProviderError`** and surface retryable vs terminal failures in the UI.
9. **Add provider health polling** on `/admin` with latency + last-checked.
10. **Lock down secrets:** none of the four provider integrations may read keys outside a server function handler.

---

## 4. Definition of "Integration-Ready"

A provider is ready to enable in production when **all** of the following are true:

- [ ] Adapter implemented as a server-only module, all credentials read inside handlers
- [ ] Returns `NormalizedProperty` / `NormalizedGeometry` / `NormalizedOwnership` / `NormalizedValuation` / `NormalizedTransfer[]` with correct `FieldCompliance` flags
- [ ] Writes to `provider_cache` with provider-mandated TTL
- [ ] Writes to `provider_audit_log` for every billable lookup
- [ ] `health()` returns `active` with p95 latency < 1500ms in staging
- [ ] Error paths return `ProviderError`, never throw raw
- [ ] Admin page shows green health + last-checked timestamp
- [ ] Report ordering (if applicable) wired through `report_orders` + webhook + storage bucket
- [ ] Legal: signed contract / license / DPA on file
