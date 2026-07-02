# Dean Erf Coordinate Enrichment

Use `scripts/enrich-dean-erfs.ts` to enrich Brandon's corrected Dean erf spreadsheet with official Kouga SG parcel coordinates and Google Maps pins.

The script uses the existing ErfStoep public parcel infrastructure:

- `PUBLIC_LAYER_CONFIG["csg-parcels"]`
- Kouga SG Properties FeatureServer layer 32
- `centroidForGeometry`
- `indexOfficialFeature`
- existing official parcel id/property extraction helpers

It does **not** use Google Maps text search as a location source. Google Maps is only used for the final clickable `https://www.google.com/maps?q=LAT,LNG` pin after coordinates are matched from the SG/GIS parcel feature.

## Run

```powershell
node --experimental-strip-types scripts/enrich-dean-erfs.ts --input "Dean corrected erfs.xlsx" --output "Dean corrected erfs enriched.xlsx"
```

CSV works too:

```powershell
node --experimental-strip-types scripts/enrich-dean-erfs.ts --input "Dean corrected erfs.csv" --output "Dean corrected erfs enriched.csv"
```

Expected input columns can include `Erf`, `Group`, `Erf / Group`, `Handwritten Note`, `Confidence`, and `Status`. Grouped erf values like `995 / 996`, `1573 - 1568`, and `1104 / 1106 / 1107 / 3127` are expanded into one output row per erf.

The script prints:

- rows read
- individual erfs parsed
- `Matched`, `Ambiguous`, and `Not Found` counts
- five sample output rows with Google Maps pins where matched

Ambiguous and unmatched rows are preserved so Brandon can ask Dean to confirm them.
