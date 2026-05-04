# Epic 04: Tile-Backed PostGIS Map Views and Spatial Search

## Goal

Move native map views from address-backed MVP rendering to PostGIS-backed spatial
rendering and filtering.

Epic 4 should make a map view render one selected `GEOMETRY` field from the
view's object through dynamic vector tiles, while preserving normal record query
paths for filtering, saved views, record selection, and record detail lookup.

This epic is not only a filter epic. Spatial filters are still required, but the
main architecture goal is to support large datasets with millions of points or
polygons without loading records into React as markers.

## Architecture Note: Geometry-First Map Views, Tile-First Rendering

Epics 2 and 3 used `ADDRESS` fields and the standard Company `location`
geometry as stepping stones. Epic 4 should treat addresses as legacy MVP context,
not the core map architecture.

A tile-backed map view should target a single PostGIS geometry field on the
view's object:

```ts
view.mapFieldMetadataId -> FieldMetadataType.GEOMETRY
```

Keep `mapFieldMetadataId` as the selected map field. Do not add multiple map
fields, layer stacks, joins, or address fallback behavior in this epic.

Use `geometry` as the canonical recommended field and physical column name for
tile-backed map objects because it follows common PostGIS convention. However,
the implementation should still resolve the selected field through
`mapFieldMetadataId` so existing and future metadata paths remain explicit.

The map should have one user-facing mode: a native map view. Internally, geometry
map views should render through vector tiles by default. The existing
record-marker path can remain as an MVP fallback for address-backed views until
those views are migrated or replaced, but it should not drive the Epic 4 design.

## Product Direction

Epic 4 changes the map view model from "records with addresses can be plotted"
to "records with a selected spatial field can be rendered and queried."

The product should treat geometry as ordinary record data with a specialized
map presentation. Any Twenty object may become map-capable if it has one
readable `GEOMETRY` field selected by the view. The field should normally be
named `geometry`, but the view must still resolve the selected field through
metadata instead of assuming a hard-coded column.

This keeps map views aligned with Twenty's object model:

- The object remains the unit of navigation, permissions, filters, and record
  actions.
- The selected geometry field is the unit of map rendering.
- The tile service is an optimized rendering path, not a separate GIS product.
- Existing record APIs remain the source of truth for record detail, selection,
  editing, and command actions.

Address-backed map behavior should be documented as MVP context and possible
legacy fallback. It should not define the Epic 4 implementation strategy.

## User Outcome

A user can open a map view for any object with a selected geometry field and
interact with large spatial datasets without waiting for all records to load.

Users can:

- Render points, polygons, and multipolygons on a map.
- Pan and zoom through large geometry datasets.
- Filter records by spatial relationships and viewport.
- Save spatial filters in views.
- Click a rendered geometry and open the corresponding record.
- Use GraphQL and REST APIs for spatial record queries.

The map should remain usable when the underlying object has millions of
geometries, provided the geometry column is indexed and the tile query budget is
respected.

## Scope

### Included

- Treat `GEOMETRY` as the primary map source for Epic 4 map views.
- Allow exactly one selected geometry field per map view.
- Support point, polygon, and multipolygon geometries for tile rendering.
- Add spatial filters for normal record query APIs.
- Add dynamic MVT tile serving from the Twenty backend.
- Render geometry map views with a MapLibre vector tile source.
- Keep vector tile payloads compact:
  - tile geometry
  - record UUID
  - no full record payload
- Fetch full record details through existing record APIs after feature click.
- Apply the same visibility constraints to tile queries as record queries:
  - workspace isolation
  - object permissions
  - field read permissions
  - row-level permission predicates
  - soft-delete filters
  - active saved view filters
- Add large dataset benchmark seeding utilities for development and performance
  testing.
- Add performance and correctness tests for tile generation and spatial
  filtering.

### Excluded

- Multiple geometry layers per view.
- User-configurable styling by field value.
- Editing geometries directly on the map.
- Drawing tools for new polygons.
- Raster tile generation.
- Offline tile packaging.
- Public unauthenticated tile endpoints.
- Using `pg_tileserv` as the primary production tile server.
- Address geocoding or automatic address-to-geometry synchronization beyond
  previous stepping-stone work.
- General purpose GIS layer management.

## Architecture Decisions

Epic 4 should capture these decisions as implementation constraints:

- Use a native Twenty NestJS tile endpoint as the production runtime.
- Generate tiles with PostGIS MVT functions inside the workspace database.
- Use `pg_tileserv` and `pg_featureserv` only as references, local benchmark
  aids, and optional developer comparison tools.
- Use MapLibre vector sources on the frontend for geometry map rendering.
- Keep one selected geometry field per map view.
- Keep v1 tile feature properties limited to the record UUID.
- Fetch full records through existing GraphQL or REST APIs after user
  interaction.
- Allow user-created geometry fields to use `geometry(Geometry, 4326)` in Epic
  4, alongside stricter typed geometry columns where the shape is known.
- Render individual features at low zoom in v1; do not introduce clustering or
  density tiles as part of the first implementation.
- Apply record-query-equivalent permissions and filters before emitting tile
  features.
- Treat vector tile rendering and record querying as separate backend paths
  with shared authorization and filter composition.
- Make tile requests view-scoped by default so saved filters, selected object,
  and selected geometry field resolve from the view.
- Use normal query parameters for temporary unsaved filters in v1; defer signed
  filter payloads or server-side filter tokens until URL size or security review
  requires them.
- Make large dataset performance an explicit deliverable, not a later
  optimization.

## Geometry Field Model

Epic 3 currently introduced a point-focused geometry path. Epic 4 needs to
broaden the spatial model enough to support tile-backed rendering of points,
polygons, and multipolygons.

Supported v1 geometry types:

```ts
type GeometryType = 'POINT' | 'POLYGON' | 'MULTIPOLYGON' | 'GEOMETRY';
```

Recommended future-compatible type:

```ts
type GeometryType =
  | 'POINT'
  | 'LINESTRING'
  | 'POLYGON'
  | 'MULTIPOLYGON'
  | 'GEOMETRY';
```

Epic 4 should not require line rendering in the product UI unless it falls out
cleanly from the tile implementation. The important expansion for this epic is
polygon and multipolygon support.

Allowed storage for user-created flexible tile-backed objects:

```sql
geometry(Geometry, 4326)
```

Recommended storage for stricter fields when the shape is known:

```sql
geometry(Point, 4326)
geometry(Polygon, 4326)
geometry(MultiPolygon, 4326)
```

All tile-backed geometry columns must have a GiST index:

```sql
CREATE INDEX ... USING GIST ("geometry");
```

Rules:

- Preserve SRID `4326` for Epic 4.
- Preserve GeoJSON coordinate order: longitude, latitude.
- Reject invalid coordinate ranges for input filters.
- Keep one selected geometry field per map view.
- Prefer field name `geometry` for new map-focused objects.
- Allow user-created fields to use generic `geometry(Geometry, 4326)` when the
  object may contain mixed point, polygon, and multipolygon data.
- Do not require every object in Twenty to have a geometry field.

## Tile Serving Architecture

Add a native Twenty tile endpoint in the NestJS backend. The endpoint should be
authenticated and workspace-aware.

Primary endpoint:

```txt
GET /rest/map/views/:viewId/tiles/:z/:x/:y.mvt
```

Primary TileJSON endpoint:

```txt
GET /rest/map/views/:viewId/tile-json
```

The server should resolve object metadata, `mapFieldMetadataId`, saved filters,
and permission context from `viewId`. Object-and-field tile endpoints can exist
as internal test helpers if useful, but they should not be the primary frontend
contract.

Tile response:

- Content type: `application/vnd.mapbox-vector-tile`.
- Body: MVT bytes.
- Layer name: stable, short, and object scoped, for example `records`.
- Feature properties:
  - `id`: record UUID.
- No record names, labels, emails, addresses, or other CRM fields in v1 tile
  payloads.

Tile SQL should use PostGIS MVT functions:

- `ST_TileEnvelope`
- `ST_AsMVTGeom`
- `ST_AsMVT`
- `ST_Intersects` or bbox `&&` prefilters
- `ST_Simplify` or `ST_SimplifyPreserveTopology` where appropriate

Example shape:

```sql
WITH bounds AS (
  SELECT ST_TileEnvelope($1, $2, $3) AS geom
),
tile_rows AS (
  SELECT
    "id",
    ST_AsMVTGeom(
      "geometry",
      bounds.geom,
      4096,
      64,
      true
    ) AS geom
  FROM "workspace_x"."mapFeature", bounds
  WHERE "geometry" && bounds.geom
    AND ST_Intersects("geometry", bounds.geom)
  LIMIT $4
)
SELECT ST_AsMVT(tile_rows, 'records', 4096, 'geom')
FROM tile_rows;
```

The real implementation must inject object permissions, row-level predicates,
soft-delete filters, and saved-view filters before tile generation.

## Permissions and Security

A vector tile is data. If a user can see a geometry or record UUID in a tile,
the user has learned that a record exists at that location.

Therefore, tile queries must not bypass record visibility rules.

Required constraints:

- User must have read access to the object.
- User must have read access to the selected geometry field.
- Row-level permission predicates must be applied exactly as they are for normal
  record queries.
- Soft-deleted records must be excluded unless the current view and permissions
  explicitly allow them.
- Saved view filters must be applied before tile output.
- Tile payloads must not contain fields the user cannot read.

Recommended implementation direction:

- Reuse the same metadata and permission context used by normal record queries.
- Build tile SQL through a server-side service that can compose:
  - tile bbox predicate
  - active record filters
  - row-level permission predicates
  - object and field permission checks
- Add tests proving hidden records do not appear in tile features.

Avoid a separate map-specific permission model in Epic 4. It would create
surprising behavior where a user can see geometry on a map but cannot access the
record in the table.

## Record Query Path vs Tile Path

Epic 4 should deliberately maintain two data paths.

### Record Query Path

Used for:

- GraphQL and REST spatial filters.
- Saved view filter computation.
- Table/list views.
- Record detail lookup after clicking a tile feature.
- Selection and command-menu actions.

This path returns records and should continue to use existing GraphQL and REST
record APIs.

### Tile Path

Used for:

- Map rendering.
- Large dataset panning and zooming.
- Point and polygon visualization.

This path returns MVT tile bytes and should not hydrate record data into Apollo
or React state. The frontend should use the tile feature UUID to fetch a record
only after user interaction.

## Spatial Filters

Spatial filters should work through GraphQL and REST record APIs, and saved
views should be able to persist them.

Initial operators:

- `IS_EMPTY`
- `IS_NOT_EMPTY`
- `WITHIN_DISTANCE`
- `WITHIN_BBOX`
- `INTERSECTS`
- `CONTAINS`
- `WITHIN`
- `NEAR`

Later operators:

- `TOUCHES`
- `CROSSES`
- `OVERLAPS`
- `DISJOINT`
- `AREA_GREATER_THAN`
- `LENGTH_GREATER_THAN`

API value examples:

```json
{
  "withinDistance": {
    "point": {
      "type": "Point",
      "coordinates": [151.2093, -33.8688]
    },
    "distanceInMeters": 500
  }
}
```

```json
{
  "withinBbox": {
    "west": 151.19,
    "south": -33.88,
    "east": 151.22,
    "north": -33.84
  }
}
```

```json
{
  "intersects": {
    "type": "Polygon",
    "coordinates": [
      [
        [151.19, -33.88],
        [151.22, -33.88],
        [151.22, -33.84],
        [151.19, -33.84],
        [151.19, -33.88]
      ]
    ]
  }
}
```

Distance rules:

- Distances must be meters.
- Do not interpret WGS84 degrees as meters.
- Use geography casts or projected calculations deliberately.
- Use an index-aware geometry prefilter where possible, then the accurate meter
  calculation.

All generated SQL must remain parameterized.

## Map View Integration

Geometry map views should render through MapLibre vector tiles.

Frontend behavior:

- Configure a vector source using the authenticated tile endpoint.
- Render point layers and polygon fill/outline layers.
- Use `recordId` from the tile feature for click interactions.
- Fetch record details through existing APIs when a feature is clicked.
- Keep active view filters in sync with tile requests.
- Refetch tiles when saved filters, viewport, or selected geometry field changes.

Viewport search:

- The current viewport can become a temporary `WITHIN_BBOX` filter.
- User must explicitly save the filter if it should persist in the view.
- Do not silently rewrite saved view filters on every pan or zoom.

Feature selection:

- Tile feature click should not rely on full tile properties.
- Fetch the full record by UUID after click.
- If the record is no longer visible or permission is revoked, show a safe empty
  or not-found state.

## Scaling Rules

Tile-backed maps need explicit budgets.

Recommended controls:

- Always use GiST-index-compatible bbox predicates.
- Clip geometries to the tile envelope.
- Simplify polygons at lower zoom levels.
- Use tile buffer to avoid visible seam artifacts.
- Render individual features at low zoom in v1.
- Limit features per tile even when low zoom renders individual features.
- Keep tile property payloads minimal.
- Add cache headers keyed by:
  - workspace
  - object
  - geometry field
  - z/x/y
  - saved view or filter signature
  - role or permission signature
- Avoid caching tiles across users unless their effective permissions and filters
  are identical.

Suggested first budgets:

- Target p95 tile generation under 250 ms for benchmark datasets.
- Target individual tile payloads under 500 KB compressed.
- Cap feature count per tile initially if the individual-feature result exceeds
  budget, and log enough context to tune the limit.
- Defer aggregation, clustering, and density tiles until benchmark evidence
  shows they are required.

These numbers are starting points for local benchmarking, not hard product
limits.

## pg_tileserv and pg_featureserv Positioning

Use `pg_tileserv` and `pg_featureserv` as reference tools and benchmarking aids,
not as the primary Epic 4 production runtime.

`pg_tileserv` is valuable because it demonstrates a clean PostGIS MVT serving
model. It can help validate SQL shape, TileJSON behavior, tile caching
expectations, and operational performance.

`pg_featureserv` is useful for feature-style APIs and GeoJSON inspection, but it
is not the core renderer for massive datasets.

Reasons not to use them as the primary runtime in Epic 4:

- Twenty permissions are dynamic and app-level.
- Tile queries need workspace metadata, field metadata, saved view filters, and
  row-level permission predicates.
- Duplicating that logic in database functions or a sidecar would increase
  security risk.

Acceptable uses:

- Local benchmark comparison.
- Reference SQL and TileJSON behavior.
- Optional developer-only sidecar experiments.

## Backend Tasks

- Broaden geometry settings and validation for point, polygon, and multipolygon
  use cases.
- Add geometry filter operand types for spatial operators.
- Extend GraphQL filter schema generation.
- Extend REST filter parsing for spatial JSON payloads.
- Extend filter argument processors.
- Add parameterized SQL generation for spatial predicates.
- Add saved view persistence for spatial filters.
- Add query-param serialization and deserialization for spatial filters where
  relevant.
- Add a native authenticated MVT tile endpoint.
- Add optional TileJSON endpoint for MapLibre source setup.
- Add tile query service that resolves:
  - workspace schema
  - object metadata
  - selected geometry field
  - field read permission
  - row-level predicates
  - saved view filters
  - soft-delete scope
- Add MVT SQL generation using PostGIS tile functions.
- Add cache headers and cache key strategy.
- Add tile response size and feature count safeguards.
- Add benchmark seed command or script for large synthetic map datasets.

## Frontend Tasks

- Treat geometry map views as tile-backed by default.
- Replace geometry map marker loading with a MapLibre vector tile source.
- Add point, polygon fill, and polygon outline layers.
- Use tile feature `id` to fetch and open records through existing APIs.
- Keep existing record query path for selected record details.
- Add spatial filter inputs for geometry fields:
  - emptiness
  - distance from point
  - bounding box
  - intersects/contains/within through a structured GeoJSON editor or staged UI
- Add viewport action: search this area.
- Add readable filter chips for spatial filters.
- Add validation for invalid GeoJSON, missing radius, invalid coordinate order,
  and invalid bbox bounds.
- Keep address-backed MVP rendering as legacy/fallback behavior only if still
  needed during migration.

## Benchmark Data Strategy

Do not seed large spatial datasets as normal application seed data. Use an
explicit server-side benchmark command or script, preferably exposed through an
Nx target once the workflow stabilizes.

Recommended approach:

1. Create a Twenty-real benchmark object through metadata services.
2. Add one `GEOMETRY` field named `geometry`.
3. Run workspace migration to create the physical column.
4. Bulk insert synthetic data directly with SQL.
5. Create a GiST index.
6. Optionally create a map view pointed at the benchmark geometry field.

Implemented benchmark paths:

- Synthetic benchmark seed:
  `workspace:seed:geo-map-benchmark --workspace-id <id> --dataset points|polygons|multipolygons --count <n> --reset`
- Real-world dataset preparation:
  `packages/twenty-utils/scripts/geo-map-benchmarks/prepare-real-world-dataset.sh nybb|natural-earth-admin0|natural-earth-admin1|microsoft-us-buildings <output.geojsonseq>`
- Real-world benchmark import:
  `workspace:import:geo-map-real-benchmark --workspace-id <id> --input-path <output.geojsonseq> --limit <n> --reset --create-map-view`
- Tile benchmark runner:
  `workspace:benchmark:geo-map-tiles --base-url <url> --token <token> --view-id <view-id> --workspace-id <id> --object-name-singular <name> --geometry-field-name geometry`

The real-world import command expects GeoJSONSeq/NDJSON for large datasets and
accepts GeoJSON FeatureCollection for small fixtures. Generated downloads,
normalized datasets, and benchmark reports should live under
`.local/geo-map-benchmarks/` and must not be committed.

### Real-World Polygon Dataset Tiers

Use synthetic data to control record counts, then supplement it with real-world
polygon data so the tile path sees real geometry complexity.

Recommended tiers:

- Fixture tier: GeoPandas/geodatasets `nybb`.
  - Use for tiny multipolygon correctness tests.
  - Good for CRS transform checks, borough islands, and multipolygon rendering.
  - Not useful for performance because it only contains a handful of features.
- Rendering correctness tier: Natural Earth administrative boundaries.
  - Use for low-zoom world and regional polygon rendering.
  - Good for simplification, clipping, and tile-boundary behavior.
  - Keep this as a deterministic lightweight fixture.
- Product-realism tier: NYC MapPLUTO or NYC tax lot polygons.
  - Use for municipal parcel-style polygons that look closer to operational CRM
    use cases.
  - Good for medium-sized urban datasets with real attributes and irregular
    polygon shapes.
- Primary scale tier: Microsoft US Building Footprints.
  - Use as the first serious real-world scale benchmark.
  - Good for hundreds of thousands or millions of building polygons by state or
    regional subset.
  - This should be the main supplement for proving the tile pipeline handles
    large polygon counts beyond synthetic `generate_series` data.
- Later hardening tier: Overture Maps Buildings and OpenStreetMap/Geofabrik.
  - Use Overture when we want cloud-native GeoParquet ingestion and very large
    Polygon/MultiPolygon coverage.
  - Use Geofabrik extracts when we want messy OSM-derived polygons, regional
    variation, and topology edge cases.

Epic 4's recommended minimum real-world dataset set is:

1. `nybb` for multipolygon fixture tests.
2. Natural Earth for low-zoom rendering correctness.
3. Microsoft US Building Footprints for scale benchmarking.

### Point Seed Example

```sql
INSERT INTO "workspace_x"."mapFeature" (
  "id",
  "name",
  "geometry",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  'Point ' || i,
  ST_SetSRID(
    ST_MakePoint(
      -180 + random() * 360,
      -85 + random() * 170
    ),
    4326
  ),
  now(),
  now()
FROM generate_series(1, 1000000) AS i;
```

### Polygon Seed Example

```sql
INSERT INTO "workspace_x"."mapFeature" (
  "id",
  "name",
  "geometry",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  'Polygon ' || i,
  ST_SetSRID(
    ST_MakeEnvelope(
      lon,
      lat,
      lon + size,
      lat + size,
      4326
    ),
    4326
  ),
  now(),
  now()
FROM (
  SELECT
    i,
    -180 + random() * 360 AS lon,
    -80 + random() * 160 AS lat,
    0.01 + random() * 0.2 AS size
  FROM generate_series(1, 500000) AS i
) seed;
```

### Multipolygon Seed Example

```sql
INSERT INTO "workspace_x"."mapFeature" (
  "id",
  "name",
  "geometry",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  'MultiPolygon ' || i,
  ST_SetSRID(
    ST_Multi(
      ST_Collect(
        ST_MakeEnvelope(lon, lat, lon + size, lat + size, 4326),
        ST_MakeEnvelope(lon + size * 2, lat, lon + size * 3, lat + size, 4326)
      )
    ),
    4326
  ),
  now(),
  now()
FROM (
  SELECT
    i,
    -180 + random() * 360 AS lon,
    -80 + random() * 160 AS lat,
    0.01 + random() * 0.1 AS size
  FROM generate_series(1, 250000) AS i
) seed;
```

### Index and Benchmark Queries

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS map_feature_geometry_gist
ON "workspace_x"."mapFeature"
USING GIST ("geometry");
```

```sql
EXPLAIN ANALYZE
SELECT count(*)
FROM "workspace_x"."mapFeature"
WHERE "geometry" && ST_TileEnvelope(8, 130, 87);
```

```sql
EXPLAIN ANALYZE
WITH bounds AS (
  SELECT ST_TileEnvelope(8, 130, 87) AS geom
),
tile_rows AS (
  SELECT
    "id",
    ST_AsMVTGeom("geometry", bounds.geom, 4096, 64, true) AS geom
  FROM "workspace_x"."mapFeature", bounds
  WHERE "geometry" && bounds.geom
  LIMIT 50000
)
SELECT ST_AsMVT(tile_rows, 'records', 4096, 'geom')
FROM tile_rows;
```

## Tests

### Unit Tests

- Geometry filter value validation.
- Spatial operator to GraphQL filter conversion.
- Spatial operator to REST filter conversion.
- SQL generation for each spatial predicate.
- Tile URL and TileJSON generation.
- Tile cache key generation.
- Geometry field selection validation for map views.

### Backend Integration Tests

- GraphQL spatial filters return expected point records.
- REST spatial filters return expected point records.
- Spatial filters persist in saved views.
- Tile endpoint returns valid MVT bytes.
- Tile endpoint includes record UUID properties only.
- Tile endpoint excludes records hidden by row-level permissions.
- Tile endpoint excludes hidden geometry fields.
- Tile endpoint respects saved view filters.
- Tile SQL uses GiST-index-compatible bbox predicates.
- Polygon and multipolygon geometries render into tiles.
- `nybb` multipolygons render into valid tile features.
- Natural Earth polygons render correctly across low zoom levels.
- Microsoft building footprint subsets can be bulk loaded and tiled.

### Frontend Tests

- Map view config uses one selected geometry field.
- MapLibre vector source is configured with the tile endpoint.
- Point and polygon layers are registered.
- Feature click fetches record details by UUID.
- Search-this-area creates a temporary bbox filter.
- Saving persists the bbox filter only after explicit user action.
- Spatial filter chips render readable labels.
- Invalid filter inputs show validation feedback.

### Performance Smoke Tests

- Seed at least 1,000,000 points.
- Seed at least 500,000 polygons.
- Seed at least 250,000 multipolygons.
- Load a Microsoft US Building Footprints regional or state subset with at
  least 1,000,000 polygons.
- Confirm representative tile requests stay within agreed time and byte budgets.
- Confirm low-zoom polygon tiles simplify or cap output to avoid oversized
  responses.

## Acceptance Criteria

- A geometry map view renders from one selected `GEOMETRY` field.
- Tile-backed rendering is the default for geometry map views.
- MVT tile endpoint works for points, polygons, and multipolygons.
- Tile features contain geometry and record UUID only.
- Clicking a tile feature opens the full record through existing APIs.
- Spatial filters work through GraphQL and REST.
- Spatial filters can be saved in views.
- Search-this-area applies a viewport bbox filter.
- Generated SQL remains parameterized.
- Tile queries use GiST-index-aware spatial predicates.
- Hidden records and hidden geometry fields do not leak through tiles.
- Large benchmark datasets can be generated outside normal seed data.
- Address-backed map behavior is no longer the core Epic 4 architecture.

## Risks

- Permission parity in tile SQL is security-critical.
- Large polygons can produce oversized tiles without simplification or caps.
- Row-level predicates may reduce cacheability because effective tile output can
  differ by user or role.
- Saved spatial filters can become large if full polygons are persisted inline.
- Supporting generic `geometry(Geometry, 4326)` may require revisiting Epic 3's
  point-focused validators and TypeORM column metadata.
- Tile generation can become database-heavy without clear budgets, indexes, and
  caching.
- Multipolygon fixtures can hide topology issues if synthetic shapes are too
  simple; real-world dataset imports should be used for later validation.

## Suggested PR Breakdown

1. Spatial filter foundation:
   - geometry filter types
   - GraphQL and REST filter parsing
   - SQL predicates
   - saved view persistence
   - filter tests
2. Geometry shape broadening:
   - point, polygon, multipolygon settings
   - GeoJSON validation
   - schema generation for configured geometry types
   - integration tests
3. Native tile service:
   - authenticated MVT endpoint
   - tile SQL builder
   - permission and saved-filter composition
   - backend MVT tests
4. Frontend tile map view:
   - MapLibre vector source
   - point and polygon layers
   - feature click record lookup
   - search-this-area action
5. Benchmark and hardening:
   - large dataset seed command
   - performance smoke tests
   - cache headers
   - tile budgets
   - pg_tileserv comparison notes
