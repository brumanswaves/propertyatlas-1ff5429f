# Imported Public GeoJSON drop-zone

Static official-source GeoJSON files served from `/data/*` at runtime.

## CSG cadastral fallback

The map will look for `st-francis-csg-parcels.geojson` here when the live CSG
endpoint is unreachable from the deployment runtime. If the file is present and
valid GeoJSON, the map loads it and labels the layer **Imported CSG GeoJSON**.

To populate it, download an official CSG cadastral extract for the Kouga / St
Francis Bay pilot area from the CSG Property Viewer (https://csggis.drdlr.gov.za/psv/)
or request it from your CSG contact, then save it here exactly as:

```
public/data/st-francis-csg-parcels.geojson
```

Do not fabricate parcel data. Empty or missing file = no imported fallback.
