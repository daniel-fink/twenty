# Private Reference Layer Catalog Examples

These examples are templates for local or private deployments. Do not commit
live credentials or host-specific catalogs upstream.

## Validate

```bash
npx nx command twenty-server -- workspace:validate:geo-reference-layer-catalog \
  --catalog-path packages/twenty-server/src/engine/core-modules/geo-map/reference-layer-catalog/examples/private/geofs-demo.catalog.json
```

## Sync

```bash
npx nx command twenty-server -- workspace:sync:geo-reference-layer-catalog \
  --workspace-id <workspace-id> \
  --view-id <map-view-id> \
  --catalog-path packages/twenty-server/src/engine/core-modules/geo-map/reference-layer-catalog/examples/private/geofs-demo.catalog.json
```

## Storage-Backed Catalog

When `GEO_REFERENCE_LAYER_CATALOG_STORAGE_PATH` points to a catalog in the
configured file storage backend, omit `--catalog-path`:

```bash
npx nx command twenty-server -- workspace:validate:geo-reference-layer-catalog

npx nx command twenty-server -- workspace:sync:geo-reference-layer-catalog \
  --workspace-id <workspace-id> \
  --view-id <map-view-id>
```

## Loading A Dataset

Use `load-postgis-layer.example.sh` as a local-only template for importing a
GeoJSON file into a pipeline-owned PostGIS schema. Keep source data and reports
under `.local/geo-reference-layers/`.
