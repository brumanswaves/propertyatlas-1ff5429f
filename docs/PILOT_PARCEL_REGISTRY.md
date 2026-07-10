# Kouga / St Francis Pilot Parcel Registry

ErfStoep uses a small pilot parcel registry so erf search can return likely
Kouga / St Francis parcels before the map is zoomed into the parcel boundary.

This is not national erf search.

## Source

The registry is generated from the official Kouga SG Properties ArcGIS
FeatureServer layer 32:

https://services6.arcgis.com/HrQQGPZkIr5BuMyY/arcgis/rest/services/Kouga_SG_Properties/FeatureServer/32/query

The generated app file is:

```txt
public/data/kouga-st-francis-pilot-parcels.json
```

Each record keeps source-backed parcel identity fields such as erf number,
portion, LPI, parcel key, township/minor region, municipality/major region,
province, coordinates, bounds, area where available, and the original source
properties needed by the Workbench.

## Refresh

The registry is refreshed manually. It is not fetched automatically in
production.

```bash
node --experimental-strip-types scripts/build-kouga-pilot-parcel-registry.ts
```

The script pages through the official layer, filters to the St Francis pilot
minor regions, dedupes by LPI, parcel key, or erf/portion/township fallback, and
writes the compact JSON registry.

## Limitations

- The registry only covers the Kouga / St Francis pilot area.
- It can become stale and should be refreshed when public layer data changes.
- It does not fabricate ownership, valuation, zoning, sales history, or survey
  precision.
- Search results may include multiple parcels with the same erf number. Users
  must choose using township, municipality, province, LPI, and parcel key context.
- National erf search requires a broader registry/import pipeline.

