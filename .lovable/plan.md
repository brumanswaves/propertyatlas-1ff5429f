## Goal

Activate the two newly-discovered Kouga ArcGIS endpoints, render them as dedicated branded panels in the property overview, and surface full diagnostics in `admin/public-data-debug`. No fake results, clean not-found/error states, build must pass.

## 1. Config — `.env`

Uncomment and set:

```
VITE_KOUGA_PROPERTIES_SG_URL=https://services6.arcgis.com/HrQQGPZkIr5BuMyY/arcgis/rest/services/Kouga_SG_Properties/FeatureServer/32/query
VITE_KOUGA_WARDS_URL=https://services6.arcgis.com/HrQQGPZkIr5BuMyY/arcgis/rest/services/kougaWardBoundary2026/FeatureServer/0/query
```

## 2. Provider — `src/lib/providers/kougaEnrichment.ts`

- Keep `f=json`, `returnGeometry=false`, `outFields=*`, `spatialRel=esriSpatialRelIntersects`, `inSR=4326`, `outSR=4326`. Never include `objectIds` or `f=pbf`.
- Extend `KougaEnrichmentRecord` with `matchMethod: "point" | "envelope"` and `featureCount: number`.
- Extend `KougaEnrichmentState` `error` branch with optional `httpStatus`.
- Add an envelope fallback helper: when a point query returns `not-found`, retry with `geometryType=esriGeometryEnvelope` using a small box (~25 m → ~0.00025°) around the same lng/lat. Used by `fetchKougaPropertyAtPoint` and `fetchKougaWardAtPoint`. Zoning keeps point-only behavior (unchanged).
- `pointQuery` records `featureCount` from `json.features?.length ?? 0` and tags `matchMethod`.
- All three functions still return `not-configured` cleanly when the env var is missing (property/ward only — zoning stays hardcoded).

## 3. Property panel — `src/components/property/OfficialParcelPanel.tsx`

Replace the single generic "Kouga Public GIS" block with **three** dedicated branded sections, each fed by the existing `enrichment` state:

- **Kouga Public Mapping Record** (from `enrichment.property`). Labeled rows (only show if value present, otherwise omit):
  - Parcel number — `PARCEL_NO` / `PARCEL_NUMBER`
  - 21 Digit Code / LPI — `LPI` / `LPI_CODE` / `ID`
  - Province — `PROVINCE`
  - Major region — `MAJ_REGION` / `MAJOR_REGION`
  - Major code — `MAJ_CODE` / `MAJOR_CODE`
  - Minor region — `MIN_REGION` / `MINOR_REGION`
  - Minor code — `MIN_CODE` / `MINOR_CODE`
  - Geometry area — `GEOM_AREA` / `Shape__Area`
  - Area m² — derived (round)
  - Area ha — derived (`/10000`, 4 dp)
  - Modified date — `MODIFIED` / `LAST_EDITED_DATE` / `EditDate` (epoch ms → ISO date)
  - Match method pill (point vs envelope)
  - Footer: `Source: Kouga Public Mapping Viewer`

- **Municipal Context** (from `enrichment.ward`). Labeled rows:
  - Province — `PROVINCE`
  - Municipality — `MUNICIPALITY` / `LM_NAME` / `MUNIC_NAME`
  - Ward number — `WARD_NO` / `WARDNO` / `WARD`
  - Ward ID — `WARD_ID` / `WARDID`
  - Voting station — `VOTING_STN` / `VDNAME`
  - Updated date — `UPDATED` / `EditDate` / `LAST_EDITED_DATE`
  - Shape area — `Shape__Area`
  - Shape length — `Shape__Length`
  - Match method pill
  - Footer: `Source: Kouga Public Mapping Viewer`

- **Zoning** stays in its existing block (already discovered, unchanged).

Field accessors are resilient: read the first key present from a small candidate list, format with the existing `fmt` helper. Unknown values just hide. Not-found and error states reuse `EnrichmentBlock`'s visual language but with the new panel titles.

## 4. Admin debug — `src/routes/admin.public-data-debug.tsx`

Augment `KougaEndpointStatus` (and add a new `KougaLiveProbe` below it) to:

- Show endpoint configuration status (existing).
- Add a "Probe at point" form (lng/lat, defaulting to Jeffreys Bay test coords). On submit, fire `fetchKougaEnrichment(lng, lat)` and for each of zoning / property / ward show:
  - Request URL actually used (first attempt, plus envelope retry URL if used)
  - HTTP status / error message
  - Feature count
  - Match method (`point` or `envelope`)
  - First feature attribute sample (JSON, collapsed `<pre>`)
- Clean "not configured" rows remain for missing env vars.

## 5. Verification

- `npm run build` passes (TypeScript strict).
- In preview: select a Jeffreys Bay erf → CSG block renders → Kouga Public Mapping Record renders if matched → Municipal Context renders if matched → no fake values, missing fields hidden.
- Admin debug shows live URL + feature count + first feature sample for both new endpoints.

## Out of scope

Phase 2 enrichments (richer zoning description/restrictions, SG diagram document fetching, deeper Kouga UX). Not started until the user approves.
