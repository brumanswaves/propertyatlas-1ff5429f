## Add Research Snapshot premium header card

Add a compact, dashboard-style summary card at the top of the Overview tab in `OfficialParcelPanel.tsx`. It surfaces the key research facts at a glance so the panel stops feeling like a raw GIS table.

### Where it goes

Inside the `tab === "overview"` block in `src/components/property/OfficialParcelPanel.tsx`, rendered **above** the existing "Address / Location" section.

### Card contents

Header strip:
- Title: "Research Snapshot"
- Right-aligned status pill: address confidence (reuses `CONFIDENCE_TONE`)

2-column tile grid (4 tiles total, stacks to 1 column on narrow widths):
1. **Erf** — `csg.erfNumber` (+ portion if present) or "—"
2. **Area** — `csg.geometryArea` formatted as `1,234 m²`, or "—"
3. **Zoning** — from `enrichment.zoning`:
   - loading → "Checking…"
   - ok → zoning code (with type as small subline)
   - not-found → "No record"
   - error/not-configured → "—"
4. **SG document** — from `buildSgDocumentUrl(...)`:
   - shown=true → "Available" + small "Open" link button (uses `openExternalUrl` with `sg.url`)
   - shown=false → "Not available" + tooltip-style helper

Bottom strip:
- Location line: minorRegion · majorRegion · province
- Coordinates: `lat.toFixed(5), lng.toFixed(5)`
- Small "Open in Maps" link (reuses Google Maps coordinate URL from `buildResearchLinks`-style: `https://maps.google.com/?q=lat,lng`) via `openExternalUrl`

### Style

- Rounded-2xl card, subtle border, `bg-card`
- Tile = small rounded-lg bordered block: 10px uppercase label, 13px bold value, optional 10px sub-label
- No new color tokens; reuse existing semantic tokens and `CONFIDENCE_TONE`
- No new icons beyond ones already imported (`Sparkles`, `MapPin`, `FileText`, `ExternalLink`)

### Implementation notes

- All data is already computed in scope: `csg`, `resolved`, `enrichment`, `lat`, `lng`, plus a fresh `buildSgDocumentUrl(...)` call (the existing one is inside an IIFE further down — we'll lift it to a `useMemo` near the top of the component and reuse it in both places to avoid double computation).
- Pure presentational change — no new files, no new dependencies, no business-logic changes.
- One new small subcomponent `SnapshotTile` defined at the bottom of the file alongside `Row` / `EnrichmentBlock`.

### Verification

- `npm run build` passes (currently green)
- Visual check: tile grid renders above Address/Location, confidence pill reflects current state, SG "Open" link only appears when shown=true

### Files touched

- `src/components/property/OfficialParcelPanel.tsx` (only)
