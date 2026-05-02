# Epic 05: Reference Geospatial Layer Registry

## Status

Active next-epic specification. Implementation should begin from
`upstream/native-map-view-pr-04-hardening` on the private
`feature/native-map-view-epic-05` branch. Epic 05 should assume the Epic 04
baseline exists: object-backed geometry map views, authenticated MVT tiles,
TileJSON, map tile policy handling, and spatial record filters.

The current code does not yet implement reference layers. This document is the
decision record and implementation target for that work.

## Goal

Add a first-class registry for large reference and analytical geospatial layers
that can appear in Twenty map views without requiring every dataset to become a
Twenty object.

This epic starts with the same PostgreSQL instance used by Twenty, but stores
pipeline-owned spatial datasets in separate geospatial schemas and registers
them through metadata that the map module can read.

The goal is to support large PostGIS datasets that enrich a map with context,
computed attributes, overlays, and insights while preserving Epic 4's object map
model for actual Twenty records.

## Architecture Note: Object Layers vs Reference Layers

Epic 4 is deliberately object-backed:

```txt
Twenty object -> selected GEOMETRY field -> authenticated record MVT tiles
```

Epic 5 introduces non-object reference layers:

```txt
pipeline-owned PostGIS table -> map layer registry -> map source/layers
```

These concepts should stay separate.

Object layers are Twenty records. They participate in object navigation,
record pages, object permissions, saved views, filters, workflows, and record
actions.

Reference layers are map context. They may contain millions of geometries,
pipeline-computed fields, derived scores, boundaries, parcels, buildings,
coverage areas, environmental zones, or other spatial data. They may support
tooltips and insight panels, but they do not automatically appear as objects in
the Twenty sidebar and do not automatically get record pages.

This separation avoids forcing heavy geospatial datasets through the full Twenty
metadata/object lifecycle when the product only needs them as map overlays.

## Product Direction

Twenty should become capable of composing maps from two families of layers:

- Native Twenty object layers, from Epic 4.
- Registered reference geospatial layers, from this epic.

The first version should be intentionally platform-oriented rather than a
full GIS layer manager. Administrators or local orchestration pipelines register
layers. End users consume curated layers in map views.

The product should support:

- Large read-only spatial overlays.
- Attributes computed outside Twenty by local data pipelines.
- Tooltips or insight panels for reference features.
- Multiple registered reference layers on the same map.
- A future path to third-party tile servers or PMTiles without redesigning the
  map UI.

The first implementation should not try to make every layer editable, every
attribute filterable, or every reference feature into a CRM record.

## Product Decisions To Resolve Before Coding

- First dataset: choose the initial reference layer used for local validation
  and demos, such as building footprints, parcels, boundaries, or another
  available PostGIS dataset.
- Ownership model: decide whether v1 registry records are workspace-scoped only
  or also support instance-level/shared reference layer definitions.
- Registration path: decide whether v1 layers are registered only by local
  commands/pipeline code or whether admins also need an in-app create/edit UI.
- Permission model: choose the v1 security policy for reference tables; the
  default should be authenticated workspace access with allowlisted properties.
- Tile endpoint shape: decide whether v1 exposes one endpoint per attached map
  view layer or one direct endpoint per registered layer.

## User Outcome

A user can open a map view and see operational records together with curated
reference layers that add spatial context.

Examples:

- Companies rendered as Twenty object records over parcel boundaries.
- Opportunities rendered over demographic, zoning, or coverage polygons.
- Building footprints shown as context while a user inspects a territory.
- Regional boundaries shown for visual grouping and hover insights.
- Pipeline-computed risk, density, or score layers shown on top of a CRM map.

Users can inspect relevant information from a reference feature without leaving
the map. If the feature is not a Twenty object, clicking it should not pretend
there is a normal Twenty record page.

## Scope

### Included

- Add a registry for non-object geospatial map layers.
- Store registry metadata in Twenty-controlled tables.
- Store large spatial datasets in separate PostGIS schemas in the same
  PostgreSQL instance.
- Define a stable ingestion contract for local orchestration/data pipelines.
- Support vector tile rendering for registered reference layers.
- Allow a map view to include one or more registered reference layers.
- Support basic layer visibility, ordering, min/max zoom, geometry type, style,
  and attribution metadata.
- Support a curated list of exposed properties for tooltips and insight panels.
- Keep reference layer tables outside the Twenty object metadata system.
- Keep Epic 4 object-layer rendering available on the same map.
- Add local benchmark/reference-layer seed commands or scripts.
- Preserve a future path to Martin, pg_tileserv, Tegola, PMTiles, or MBTiles.

### Excluded

- Making reference layers normal Twenty objects by default.
- User-editable geometry for reference layers.
- User-created arbitrary SQL layer definitions in the UI.
- General-purpose GIS desktop-style layer management.
- Full symbology editors.
- Raster tile serving.
- Public unauthenticated reference layer endpoints.
- Per-feature Twenty record pages for non-object layer rows.
- Per-user row-level permission predicates inside external pipeline tables in
  the first version.
- Cross-database or cloud object storage source adapters in the first version.
- Moving reference layers to a separate PostGIS database in the first version.
- Replacing the Epic 4 native object tile service.

## Architecture Decisions

- Keep Epic 4 object maps as the source of truth for Twenty records.
- Add reference layers as a separate map-layer provider family.
- Start in the same PostgreSQL database for operational simplicity.
- Use separate schemas for pipeline-owned geospatial datasets.
- Keep registry metadata in a Twenty-owned schema.
- Treat reference layers as read-only in the Twenty UI for v1.
- Use PostGIS MVT generation directly in Twenty for the first implementation.
- Keep the tile provider abstraction open so heavy layers can later move to
  Martin, pg_tileserv, Tegola, PMTiles, or MBTiles.
- Do not duplicate Twenty object permissions inside arbitrary reference tables
  unless a layer explicitly requires that security model.
- Require every registered PostGIS layer to declare an ownership/security policy.
- Require every tile-served geometry column to have a spatial index.
- Keep layer feature properties minimal and allowlist-based.
- Treat layer registry records as configuration, not as end-user CRM data.

## Schema Strategy

Use at least two schema families:

```txt
core / metadata schemas
  Twenty-owned registry tables and configuration.

geo_<workspace_or_domain> schemas
  Pipeline-owned spatial datasets and indexes.
```

For the first local implementation, a workspace-scoped schema is acceptable:

```txt
geo_workspace_20202020_1c25_4d02_bf25_6aeccf7ea419
```

If PostgreSQL identifier length or readability becomes a problem, use a stable
short hash:

```txt
geo_ws_1wgvd1injqtife6y4rvfbu3h5
```

Reference data tables should use conventional spatial names where possible:

```sql
CREATE TABLE geo_ws_1wgvd1injqtife6y4rvfbu3h5.microsoft_buildings_dc (
  id text PRIMARY KEY,
  geometry geometry(MultiPolygon, 4326) NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_updated_at timestamptz,
  pipeline_run_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

Recommended indexes:

```sql
CREATE INDEX microsoft_buildings_dc_geometry_gist
ON geo_ws_1wgvd1injqtife6y4rvfbu3h5.microsoft_buildings_dc
USING GIST (geometry);

CREATE INDEX microsoft_buildings_dc_properties_gin
ON geo_ws_1wgvd1injqtife6y4rvfbu3h5.microsoft_buildings_dc
USING GIN (properties);
```

For high-volume tile serving, later hardening may add:

```sql
ALTER TABLE geo_ws_1wgvd1injqtife6y4rvfbu3h5.microsoft_buildings_dc
ADD COLUMN geometry_3857 geometry(MultiPolygon, 3857);

CREATE INDEX microsoft_buildings_dc_geometry_3857_gist
ON geo_ws_1wgvd1injqtife6y4rvfbu3h5.microsoft_buildings_dc
USING GIST (geometry_3857);
```

The v1 registry should not require `geometry_3857`, but the ingestion contract
should leave room for it.

## Registry Model

Introduce a registry table for reference layers. Exact naming can follow Twenty
metadata conventions, but the conceptual model should include:

```ts
type GeoReferenceLayer = {
  id: string;
  workspaceId: string;
  key: string;
  name: string;
  description: string | null;
  sourceType: 'POSTGIS_TABLE';
  schemaName: string;
  tableName: string;
  idColumnName: string;
  geometryColumnName: string;
  geometrySrid: number;
  geometryType: 'POINT' | 'LINESTRING' | 'POLYGON' | 'MULTIPOLYGON' | 'GEOMETRY';
  minZoom: number;
  maxZoom: number;
  tileProvider: 'TWENTY_POSTGIS';
  isEnabled: boolean;
  isQueryable: boolean;
  isVisibleByDefault: boolean;
  attribution: string | null;
  style: GeoReferenceLayerStyle;
  exposedProperties: GeoReferenceLayerProperty[];
  securityPolicy: GeoReferenceLayerSecurityPolicy;
};
```

`LINESTRING` is listed here for future reference-layer compatibility, not
because Epic 03/04 object geometry fields currently expose line geometry as a
supported object field type.

Layer keys must be stable, URL-safe, and unique per workspace:

```txt
microsoft-us-buildings-dc
natural-earth-admin0
sales-territories
network-coverage-score
```

Expose properties through an allowlist, not by returning arbitrary table
columns:

```ts
type GeoReferenceLayerProperty = {
  key: string;
  source: {
    kind: 'COLUMN' | 'JSON_PROPERTY';
    name: string;
  };
  label: string;
  type: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'DATETIME' | 'JSON';
  isVisibleInTooltip: boolean;
  isVisibleInInsightPanel: boolean;
};
```

Style can start small:

```ts
type GeoReferenceLayerStyle = {
  color: string;
  fillOpacity?: number;
  lineOpacity?: number;
  lineWidth?: number;
  pointRadius?: number;
};
```

Future styling can add zoom expressions, categorical styling, ramps, and
data-driven MapLibre expressions.

## Map View Layer Attachments

Reference layer registration defines what exists. Map view layer attachment
defines what appears in a particular map view.

Introduce a map-view layer attachment concept:

```ts
type MapViewReferenceLayer = {
  id: string;
  workspaceId: string;
  viewId: string;
  geoReferenceLayerId: string;
  position: number;
  isVisibleByDefault: boolean;
  styleOverride: GeoReferenceLayerStyle | null;
};
```

This keeps layer availability separate from view composition.

Rules:

- A map view can include zero or more reference layers.
- Reference layers render under or over the primary object layer according to
  `position`.
- The primary object layer remains the only layer whose features open Twenty
  records in v1.
- Reference layer visibility can be toggled in the map UI without mutating the
  underlying layer registry.
- Persisted layer attachments should be workspace-scoped and view-scoped.

## Ingestion Contract

Local orchestration and data pipelines should be able to load data without
calling Twenty object metadata APIs.

Pipeline responsibilities:

1. Create or update the target geospatial schema.
2. Create or replace the layer table.
3. Normalize geometry to SRID 4326.
4. Validate geometries.
5. Store stable feature ids.
6. Store computed attributes in typed columns or `properties`.
7. Create required spatial indexes.
8. Run `ANALYZE`.
9. Upsert the layer registry entry.
10. Optionally attach the layer to one or more map views.

Recommended load path:

```bash
ogr2ogr \
  -f PostgreSQL "$DATABASE_URL" input.geojson \
  -nln geo_ws_1wgvd1injqtife6y4rvfbu3h5.layer_table \
  -lco GEOMETRY_NAME=geometry \
  -t_srs EPSG:4326 \
  -makevalid \
  -nlt PROMOTE_TO_MULTI
```

For dataframe pipelines, use `COPY`, `GeoPandas.to_postgis`, SQLAlchemy, dbt,
Dagster, Airflow, or direct PostgreSQL clients. The important constraint is the
table contract, not the ingestion tool.

Registry updates should have a supported command/API so pipelines do not edit
Twenty metadata tables by hand:

```bash
npx nx command twenty-server -- workspace:upsert:geo-reference-layer \
  --workspace-id <workspace-id> \
  --key microsoft-us-buildings-dc \
  --schema geo_ws_1wgvd1injqtife6y4rvfbu3h5 \
  --table microsoft_buildings_dc \
  --id-column id \
  --geometry-column geometry \
  --geometry-type MULTIPOLYGON \
  --min-zoom 9 \
  --max-zoom 22 \
  --style-json ./layer-style.json \
  --properties-json ./layer-properties.json
```

The command should validate table existence, geometry type, SRID, spatial index,
and exposed property names before enabling the layer.

## Tile Serving Architecture

Add a reference-layer tile endpoint or extend the map tile service with a layer
provider abstraction.

Recommended endpoint shape:

```txt
GET /rest/map/reference-layers/:layerId/tiles/:z/:x/:y.mvt
```

Alternative view-scoped endpoint:

```txt
GET /rest/map/views/:viewId/reference-layers/:layerId/tiles/:z/:x/:y.mvt
```

Use the view-scoped endpoint when a layer's visibility or style depends on view
attachment. Use the direct layer endpoint for globally registered layers whose
access policy is independent of a specific view.

Tile response:

- Content type: `application/vnd.mapbox-vector-tile`.
- Layer name: stable layer key or `features`.
- Feature properties:
  - stable feature id.
  - allowlisted exposed properties only.
- No arbitrary table columns.
- No hidden computed fields.

Tile SQL should use the same safe PostGIS pattern from Epic 4:

- `ST_TileEnvelope`
- bbox `&&` prefilter
- `ST_Intersects`
- `ST_Intersection` for clipping where needed
- `ST_AsMVTGeom`
- `ST_AsMVT`
- simplification appropriate to zoom

For polygon reference layers, keep the Epic 4 boundary lesson:

- Fill geometry can be clipped to tile bounds.
- Rendered outlines should avoid drawing artificial tile clipping boundaries.
- If outlines are needed, emit original-boundary line features separately.

## Tile Provider Abstraction

Start with:

```ts
type GeoReferenceTileProvider = 'TWENTY_POSTGIS';
```

Keep a future-compatible provider model:

```ts
type GeoReferenceTileProvider =
  | 'TWENTY_POSTGIS'
  | 'PG_TILESERV'
  | 'MARTIN_POSTGIS'
  | 'PMTILES'
  | 'MBTILES';
```

The frontend should not need to know whether a source is served by the Twenty
backend, a sidecar, or static tile archive. It should receive:

- Tile URL template.
- TileJSON metadata when useful.
- Source layer name.
- min/max zoom.
- style/layer definitions.
- attribution.

Provider-specific details should stay on the backend or in registry metadata.

## Permissions and Security

Reference layers are data. A visible feature can reveal sensitive information
even if it does not open a Twenty record.

The first version should support clear layer-level policies:

```ts
type GeoReferenceLayerSecurityPolicy =
  | { kind: 'WORKSPACE_MEMBERS' }
  | { kind: 'ADMIN_ONLY' }
  | { kind: 'ROLE_IDS'; roleIds: string[] }
  | { kind: 'INTERNAL_ONLY' };
```

Rules:

- Require authenticated workspace context for all reference layer endpoints.
- Check workspace membership before serving tiles.
- Check layer-level policy before serving tiles or metadata.
- Do not expose layers across workspaces.
- Do not return arbitrary SQL errors to clients.
- Do not let users submit raw SQL in layer registration.
- Validate schema, table, column, and property identifiers against strict
  identifier rules.
- Use parameterized SQL for runtime values.
- Use allowlisted property expressions only.

Per-user row-level filtering inside reference tables is deferred. If a layer
needs row-level security, model that as a later provider capability, not as an
implicit feature of every reference layer.

## Frontend Map Integration

The map should compose:

- Base map style.
- One primary Twenty object layer, if the view has one.
- Zero or more reference layer vector sources.
- Fill, line, and point layers for each reference source.
- Layer controls for visibility.
- Hover/click interactions for reference insights.

Frontend behavior:

- Read attached reference layers for a map view.
- Add one MapLibre vector source per reference layer.
- Add style layers from registry style metadata.
- Preserve the Epic 4 primary object click behavior.
- For reference feature clicks, open a lightweight insight panel or popup.
- Do not attempt to navigate to a Twenty record unless the layer is explicitly
  linked to an object in a future version.
- Refresh reference layer sources when view attachment or filter state changes.

The existing `RecordMap` component can evolve into a composition surface, but
the layer-specific code should be factored so object layers and reference
layers do not share record-specific assumptions.

## Tooltip and Insight Model

Reference features should support a small inspected-feature payload.

For v1, the tile may include only the properties required for tooltip display.
If the insight panel needs more data, fetch it by layer id and feature id:

```txt
GET /rest/map/reference-layers/:layerId/features/:featureId
```

Feature detail response should include:

- layer id
- feature id
- display title
- geometry summary or bounds
- allowlisted properties
- attribution/source metadata

Do not return full raw `properties` JSON unless the registry explicitly allows
it.

## Filtering and Analysis

Reference layers may eventually participate in spatial analysis, but v1 should
keep this narrow.

Included in v1:

- Display layer.
- Feature click/hover inspection.
- Layer bounds.
- Optional server-side fixed filter configured in registry metadata.

Deferred:

- End-user filtering of reference layers.
- Joining reference features to Twenty records.
- "Select records intersecting this layer" workflows.
- Spatial enrichment jobs that write back to Twenty object fields.
- Attribute-driven styling and legends beyond simple static style.

These are strong future candidates, but they should not block rendering
registered layers.

## Operational Model

Reference layers can be large and pipeline-driven. The registry should track
operational metadata:

- source name
- source URL or provenance
- pipeline run id
- last successful refresh
- row count
- geometry extent
- validation status
- index status
- tile provider
- layer enabled/disabled state

Add a validation command:

```bash
npx nx command twenty-server -- workspace:validate:geo-reference-layer \
  --workspace-id <workspace-id> \
  --key microsoft-us-buildings-dc
```

Validation should check:

- table exists
- id column exists
- geometry column exists
- SRID matches registry
- geometry type is compatible
- geometry column has a GiST index
- exposed properties resolve
- row count and bounds can be computed
- sample tile can be generated

## Performance Strategy

Start with live PostGIS MVT generation in the same database so the architecture
is simple and inspectable.

Use explicit budgets:

- Require GiST indexes.
- Use bbox predicates on every tile query.
- Clip geometries to tile bounds.
- Simplify lower zooms.
- Use min/max zoom to avoid pathological low-zoom requests.
- Keep tile properties allowlisted and small.
- Add cache headers where layer security permits.
- Log tile generation time, feature count, and tile byte size.

For heavy layers, graduate deliberately:

1. Add generated `geometry_3857` columns where transform cost is material.
2. Add precomputed generalized tables by zoom band.
3. Add materialized tile tables if the layer is stable.
4. Add Martin or pg_tileserv as a sidecar provider.
5. Add PMTiles or MBTiles for mostly static high-volume layers.

This epic should define the abstraction so these steps are possible, but it
does not need to implement every serving strategy.

## Backend Tasks

- Add registry persistence:
  - reference layer table
  - reference layer property table or JSON config
  - map-view reference layer attachment table
  - migrations and indexes
- Add registry validation:
  - identifier validation
  - schema/table existence checks
  - geometry column checks
  - SRID checks
  - geometry type compatibility checks
  - GiST index checks
  - exposed property checks
- Add command/API for layer upsert from local pipelines.
- Add command/API for layer validation.
- Add command/API for attaching layers to map views.
- Add service for resolving visible reference layers for a map view.
- Add authenticated tile endpoint for reference layers.
- Add MVT SQL builder for reference layer tables.
- Add feature detail endpoint for allowlisted properties.
- Add bounds endpoint for reference layers if needed by frontend fitting.
- Add cache headers and cache key strategy for reference tiles.
- Add tile metrics logging for reference layer requests.
- Add tests for registry validation and SQL safety.

## Frontend Tasks

- Add reference layer types to frontend model.
- Fetch map-view reference layer attachments.
- Extend map rendering to add reference layer vector sources.
- Add fill, line, and point layers using registry style metadata.
- Add layer visibility controls.
- Add hover/click handling for reference features.
- Add popup or side panel for allowlisted reference properties.
- Preserve object feature click behavior from Epic 4.
- Add loading/error states per reference layer.
- Add basic attribution display if the base map style does not handle it.
- Add tests for layer source construction and click behavior.

## Local Pipeline and Tooling Tasks

- Add sample pipeline script for loading a reference dataset into a `geo_*`
  schema.
- Add sample registry JSON files for style and exposed properties.
- Add command examples for Microsoft building footprints, Natural Earth, and
  other benchmark layers.
- Add a validation script that can be run after local pipeline loads.
- Keep generated datasets and reports under `.local/geo-reference-layers/`.
- Do not commit large generated spatial files.

## Benchmark Data Strategy

Reuse the Epic 4 real-world datasets, but load at least one of them as a
reference layer rather than a Twenty object.

Recommended v1 reference-layer benchmarks:

- Natural Earth Admin 0 as a global low-volume polygon reference layer.
- Microsoft US Building Footprints DC as a dense building-footprint reference
  layer.
- Microsoft US Building Footprints Rhode Island as a heavier local benchmark.

For each benchmark, validate:

- pipeline load
- registry upsert
- tile generation
- frontend rendering
- click/hover insight display
- layer visibility toggle

## Tests

### Unit Tests

- Registry identifier validation.
- Property allowlist validation.
- Style metadata validation.
- Security policy validation.
- MVT SQL generation for reference layers.
- Tile provider URL resolution.
- Map-view layer ordering.

### Backend Integration Tests

- Upsert a reference layer for an existing table.
- Reject a layer with a missing geometry column.
- Reject a layer without a spatial index when enabled.
- Reject an exposed property that is not present or not allowed.
- Serve MVT bytes for a registered layer.
- Ensure tile payload includes only allowlisted properties.
- Ensure unauthenticated users cannot read reference tiles.
- Ensure users from another workspace cannot read reference tiles.
- Ensure disabled layers do not serve tiles.
- Fetch feature detail by layer id and feature id.
- Attach a reference layer to a map view.
- Resolve attached layers in position order.

### Frontend Tests

- Map view requests attached reference layers.
- MapLibre sources are configured from registry metadata.
- Layer visibility toggles hide and show the correct layers.
- Reference feature click opens an insight popup/panel.
- Object feature click still opens the Twenty record.
- Missing or failed reference layers show a non-blocking state.
- Style metadata maps to expected MapLibre layer definitions.

### Performance Smoke Tests

- Load a reference layer with at least 100,000 polygons.
- Generate representative tiles at min, mid, and max zooms.
- Confirm tile queries use bbox predicates and spatial indexes.
- Confirm tile payloads stay within agreed byte budgets for target zooms.
- Compare live Twenty PostGIS serving with at least one sidecar or static-tile
  candidate when performance becomes a concern.

## Acceptance Criteria

- A pipeline-owned PostGIS table can be registered as a reference geospatial
  layer without creating a Twenty object.
- Registered reference layers live in separate `geo_*` schemas in the same
  PostgreSQL instance.
- Registry metadata declares source table, id column, geometry column,
  geometry type, zoom range, style, attribution, and exposed properties.
- Registry validation rejects unsafe identifiers, missing tables, missing
  geometry columns, incompatible SRIDs, and missing spatial indexes.
- A map view can attach one or more reference layers.
- The frontend renders attached reference layers together with an Epic 4 object
  layer.
- Reference layer tiles include only stable feature id and allowlisted
  properties.
- Reference feature click shows a tooltip or insight panel without requiring a
  Twenty record page.
- Object feature click behavior remains unchanged.
- Reference layer endpoints are authenticated and workspace-scoped.
- Disabled or unauthorized layers do not serve metadata, tiles, or feature
  details.
- Large reference datasets can be loaded outside normal seed data.
- The design keeps a future path to Martin, pg_tileserv, PMTiles, or MBTiles.

## Risks

- Reference layers can accidentally become a parallel object system if the
  boundary with Twenty objects is not kept clear.
- Large live PostGIS tile queries can overload the primary database.
- Weak property allowlisting can leak sensitive pipeline-computed attributes.
- Per-layer security policy can become confusing if it diverges from object
  permissions without clear UI indicators.
- Too much styling flexibility in v1 can slow the platform work.
- Arbitrary SQL layer definitions are powerful but risky; avoid them until
  there is a stronger security model.
- Multiple tile providers can fragment behavior if the provider abstraction is
  not kept narrow.

## Suggested PR Breakdown

1. Registry foundation:
   - reference layer metadata
   - map-view layer attachments
   - migrations
   - validation utilities
   - tests
2. Pipeline commands:
   - upsert reference layer
   - validate reference layer
   - attach reference layer to map view
   - sample local pipeline docs/scripts
3. Reference tile service:
   - authenticated tile endpoint
   - reference MVT SQL builder
   - feature detail endpoint
   - backend tests
4. Frontend layer composition:
   - fetch attached layers
   - MapLibre sources/layers
   - visibility controls
   - tooltip/insight panel
5. Benchmark and provider hardening:
   - load benchmark layers as non-object references
   - performance smoke tests
   - cache headers
   - provider comparison notes
