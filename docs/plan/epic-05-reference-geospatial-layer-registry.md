# Epic 05: Reference Geospatial Layer Registry

## Status

Partially implemented; hardening and documentation alignment remaining.

Epic 05 should assume the Epic 04 baseline exists: object-backed geometry map
views, authenticated MVT tiles, TileJSON, map tile policy handling, and spatial
record filters. The current code now includes reference-layer registry tables,
catalog loading from local files, a sync command, authenticated REST endpoints,
MVT serving, frontend MapLibre rendering, layer toggles, and side-panel feature
inspection.

Status legend used below:

- **Implemented differently**: code satisfies the product intent but not the
  original written schema.
- **Remaining implementation**: real gaps needed to complete Epic 05.
- **Deferred/future**: explicitly not v1 completion work.

This document remains the decision record and implementation target. Some older
schema sketches are now historical context rather than current v1 instructions.

## Goal

Add a first-class registry for large reference and analytical geospatial layers
that can appear in Twenty map views without requiring every dataset to become a
Twenty object.

This epic starts with PostGIS tables that are owned by data pipelines, not by
Twenty object metadata. Those tables can live in the same PostgreSQL instance as
Twenty or in an allowlisted external PostGIS connection configured by
environment variable. Twenty stores only catalog-derived registry metadata and
map-view attachments in `core` tables.

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
full GIS layer manager. Local orchestration pipelines and backend commands
register layers from text-based catalog files. End users consume curated layers
in map views.

The product should support:

- Large read-only spatial overlays.
- Attributes computed outside Twenty by local data pipelines.
- Tooltips or insight panels for reference features.
- Multiple registered reference layers on the same map.
- A future path to third-party tile servers or PMTiles without redesigning the
  map UI.

The first implementation should not try to make every layer editable, every
attribute filterable, or every reference feature into a CRM record.

## Resolved V1 Decisions

- Admin UI is out of scope for v1.
- Registry records are workspace-scoped only. Shared or instance-level layer
  catalogs are deferred until the core model proves useful.
- Text-based JSON catalogs are the authoring source of truth. Runtime database
  rows are materialized state for validation, FK integrity, and fast tile
  request lookup.
- Catalog files live under the owning server package, not a new root-level
  `config/` directory.
- Secrets and connection strings are never committed. Catalogs reference
  connection keys whose URIs are resolved from env/config variables.
- The v1 security policy is authenticated workspace access with allowlisted
  properties only.
- The initial demo catalog should use the inspected `geofs` PostGIS database:
  `model.parcels` as the primary polygon reference layer and
  `model.transactions` as a dense point overlay. `model.forecast_houses` and
  `model.forecast_apartments` are good follow-up analytic polygon layers.
- The tile service must support source SRIDs other than `4326`; the `geofs`
  tables use EPSG `7856`.

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
- Define a package-owned JSON catalog format for reference layer definitions.
- Load catalog files through a server config variable, following the existing
  AI catalog pattern rather than adding a root-level config directory.
- Resolve catalog connection keys from env/config variables.
- Materialize validated catalog layers into Twenty-controlled runtime metadata
  tables.
- Support PostGIS source tables in either the primary database or an allowlisted
  external PostGIS connection.
- Define a stable ingestion/registration contract for local orchestration/data
  pipelines.
- Support vector tile rendering for registered reference layers.
- Allow a map view to include one or more registered reference layers.
- Support basic layer visibility, ordering, min/max zoom, geometry type, style,
  and attribution metadata.
- Support a curated sidebar contract for feature picking and insight panels.
- Keep reference layer tables outside the Twenty object metadata system.
- Keep Epic 4 object-layer rendering available on the same map.
- Add catalog sync and validation commands.
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
- Arbitrary user-entered connection strings, SQL definitions, or source
  adapters in the UI.
- Cloud object storage, PMTiles, MBTiles, Martin, or pg_tileserv providers in
  the first implementation.
- Replacing the Epic 4 native object tile service.
- Root-level repo `config/` conventions.
- App manifest integration through `twenty-sdk` in this epic. That belongs in a
  later epic once the reference-layer model is proven.

## Architecture Decisions

- Keep Epic 4 object maps as the source of truth for Twenty records.
- Add reference layers as a separate map-layer provider family.
- Keep authored layer definitions in JSON catalog files.
- Store sanitized runtime registry metadata in Twenty-owned `core` tables.
- Load catalogs from a package-owned built-in path or from a storage path
  configured through `TwentyConfigService`.
- Resolve external PostGIS credentials from env/config variables, never from
  committed catalog files.
- Support same-database PostGIS sources and explicitly configured external
  PostGIS sources in v1.
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
- Do not introduce a new root-level config directory for upstream PRs; keep
  server-owned catalogs under `packages/twenty-server`.

## Catalog Strategy

Follow the existing Twenty pattern used by the AI model catalog:

- Define the catalog type and Zod schema in the owning server module.
- Keep a built-in default catalog checked into `packages/twenty-server`.
- Allow deployments to override or extend the catalog with a storage path
  config variable.
- Resolve secrets through config/env templates, not through committed JSON.
- Validate the entire catalog before materializing it into runtime metadata
  tables.

Recommended upstreamable location:

```txt
packages/twenty-server/src/engine/core-modules/geo-map/reference-layer-catalog/
  geo-reference-layer-catalog.schema.ts
  geo-reference-layer-catalog.types.ts
  default-geo-reference-layer-catalog.json
  examples/
    geofs-demo.example.json
```

Do not add a root-level `config/` directory for this feature. The root already
contains workspace/tooling files, while runtime server catalogs live inside
their owning package/module.

Add config variables through Twenty's config system:

```bash
GEO_REFERENCE_LAYER_CATALOG_STORAGE_PATH=
GEO_REFERENCE_CONNECTION_GEOFS_DEMO=
```

`GEO_REFERENCE_LAYER_CATALOG_STORAGE_PATH` points to a JSON catalog loaded
through the existing storage driver. Catalog `uriEnv` values should resolve
registered config variables first and then fall back to `process.env`, matching
the AI provider template-resolution pattern. If a connection variable is added
to `ConfigVariables`, it must be marked sensitive; otherwise it should remain an
environment-only deployment secret and never be returned through admin config
APIs.

Example catalog:

```json
{
  "version": 1,
  "kind": "geo-reference-layer-catalog",
  "name": "Private geofs demo reference layer catalog",
  "connections": {
    "geofs-demo": {
      "type": "POSTGIS",
      "uriEnv": "GEO_REFERENCE_CONNECTION_GEOFS_DEMO"
    }
  },
  "layers": [
    {
      "key": "geofs-parcels",
      "name": "Parcels",
      "description": "Parcel boundaries from the geofs demo PostGIS database.",
      "source": {
        "provider": "EXTERNAL_POSTGIS",
        "connectionKey": "geofs-demo",
        "schemaName": "model",
        "tableName": "parcels",
        "idColumnName": "property_SHAPEUUID",
        "geometryColumnName": "geometry",
        "geometrySrid": 7856,
        "geometryType": "MULTIPOLYGON"
      },
      "sidebarContractPath": "./geofs-demo.contracts/parcels.contract.json",
      "tile": {
        "minZoom": 12,
        "maxZoom": 18
      },
      "style": {
        "type": "fill",
        "fillColor": "#3B82F6",
        "fillOpacity": 0.14,
        "lineColor": "#1D4ED8",
        "lineOpacity": 0.82,
        "lineWidth": 1
      },
      "defaultAttachment": {
        "isVisible": true,
        "position": 10
      }
    }
  ],
  "defaultViewAttachments": [
    {
      "layerKey": "geofs-parcels",
      "isVisible": true,
      "position": 10
    }
  ]
}
```

The built-in default catalog should be empty or contain only non-sensitive
example entries that cannot leak private infrastructure.

Current v1 catalogs use `sidebarContractPath` to point at a nearby JSON
contract file. That contract is the allowlist for feature titles, sort keys, and
side-panel insight fields. The older inline `exposedProperties` sketch is
superseded for v1 and should not be used as the canonical catalog shape.

## App Manifest Boundary

Do not fold reference layers into Twenty's application manifest system in this
epic.

The app manifest path is promising because Twenty already supports
text-defined objects, fields, roles, views, page layouts, and application
variables through `twenty-sdk` definitions. However, adding reference layers to
that system would touch `twenty-sdk`, manifest types, app install/sync,
universal identifiers, marketplace review semantics, and application migration
behavior.

Recommended sequencing:

- Epic 05: server-owned JSON catalog, validation, sync command, runtime
  registry tables, tiles, and frontend rendering.
- Later epic: `defineGeoReferenceLayer`, manifest schema/types, application
  install/sync support, and marketplace-compatible packaging.

## Data Source Strategy

Reference datasets are external source tables, not Twenty object tables.

Supported v1 source types:

- `TWENTY_WORKSPACE_POSTGIS`: source table is in the current Twenty Postgres
  connection.
- `EXTERNAL_POSTGIS`: source table is in an allowlisted PostGIS connection
  resolved from a catalog connection key and env/config variable.

For first-party local datasets created by pipelines in the Twenty database,
separate `geo_*` schemas remain a good convention:

```txt
geo_ws_1wgvd1injqtife6y4rvfbu3h5
```

For the `geofs` demo database, the existing schemas are accepted as-is:

```txt
model.parcels
model.transactions
model.forecast_houses
model.forecast_apartments
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

**Implemented differently.** Epic 05 uses two Twenty-controlled runtime
metadata tables in the `core` schema:

- `core.geoReferenceLayer`: one materialized, validated layer from a catalog.
- `core.viewGeoReferenceLayer`: map-view attachment rows for registered
  layers.

The catalog remains the authoring source of truth. These tables exist so tile
requests can use validated, indexed, workspace-scoped metadata without reading
catalog files on the hot path.

Current v1 layer model:

```ts
type GeoReferenceLayer = {
  id: string;
  workspaceId: string;
  key: string;
  catalogKey: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  source: {
    provider: 'TWENTY_WORKSPACE_POSTGIS' | 'EXTERNAL_POSTGIS';
    connectionKey?: string | null;
    connectionUriEnv?: string | null;
    schemaName: string;
    tableName: string;
    idColumnName: string;
    geometryColumnName: string;
    geometrySrid: number;
    geometryType: string;
  };
  tile: {
    minZoom: number;
    maxZoom: number;
    maxFeatureCount?: number | null;
  };
  style: GeoReferenceLayerStyle;
  sidebarContract: GeoReferenceLayerSidebarContract;
  sidebarContractPath: string | null;
  catalogVersion: number;
  lastSyncAt: Date;
};
```

`source`, `tile`, `style`, and `sidebarContract` are stored as validated JSON
materialized from catalog files. This is the current v1 shape and should be
preferred over the older flat-column sketch.

The sidebar contract is the v1 allowlist and insight model. It defines the
selected feature id, title fields, sort keys carried in MVT properties, and
fields shown in the side-panel detail view. It supersedes the earlier
`exposedProperties` model for v1.

Layer keys must be stable, URL-safe, and unique per workspace:

```txt
microsoft-us-buildings-dc
natural-earth-admin0
sales-territories
network-coverage-score
```

Current v1 table shape:

```sql
CREATE TABLE "core"."geoReferenceLayer" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "workspaceId" uuid NOT NULL,
  "key" text NOT NULL,
  "catalogKey" text NOT NULL DEFAULT 'default',
  "name" text NOT NULL,
  "description" text,
  "status" "core"."geoReferenceLayer_status_enum" NOT NULL DEFAULT 'ACTIVE',
  "source" jsonb NOT NULL,
  "tile" jsonb NOT NULL,
  "style" jsonb NOT NULL,
  "sidebarContract" jsonb NOT NULL,
  "sidebarContractPath" text,
  "catalogVersion" integer NOT NULL DEFAULT 1,
  "lastSyncAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "PK_GEO_REFERENCE_LAYER" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IDX_GEO_REFERENCE_LAYER_WORKSPACE_KEY"
ON "core"."geoReferenceLayer" ("workspaceId", "key");

CREATE INDEX "IDX_GEO_REFERENCE_LAYER_WORKSPACE_STATUS"
ON "core"."geoReferenceLayer" ("workspaceId", "status");
```

Superseded design note: the earlier flat model with `sourceType`,
`schemaName`, `geometrySrid`, `tileProvider`, `securityPolicy`, `metadata`, and
inline `exposedProperties` is no longer the current v1 implementation target.
Some of those concepts remain **remaining implementation** hardening candidates:
`tileProvider`, explicit security policy metadata, attribution, validation
status, operational metadata, and provider metadata.

Style should be intentionally narrow and map to static MapLibre paint/layout
properties:

```ts
type GeoReferenceLayerStyle =
  | {
      type: 'fill';
      fillColor: string;
      fillOpacity?: number;
      lineColor?: string;
      lineWidth?: number;
    }
  | {
      type: 'line';
      lineColor: string;
      lineWidth?: number;
      lineOpacity?: number;
    }
  | {
      type: 'circle';
      circleColor: string;
      circleRadius?: number;
      circleOpacity?: number;
    };
```

Future styling can add zoom expressions, categorical styling, ramps, and
data-driven MapLibre expressions.

## Map View Layer Attachments

Reference layer registration defines what exists. Map view layer attachment
defines what appears in a particular map view.

Current v1 map-view layer attachment model:

```ts
type MapViewReferenceLayer = {
  id: string;
  workspaceId: string;
  viewId: string;
  geoReferenceLayerId: string;
  position: number;
  isVisible: boolean;
  styleOverride: GeoReferenceLayerStyle | null;
};
```

Current v1 table shape:

```sql
CREATE TABLE "core"."viewGeoReferenceLayer" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "workspaceId" uuid NOT NULL,
  "viewId" uuid NOT NULL,
  "geoReferenceLayerId" uuid NOT NULL,
  "position" double precision NOT NULL DEFAULT 0,
  "isVisible" boolean NOT NULL DEFAULT true,
  "styleOverride" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "PK_VIEW_GEO_REFERENCE_LAYER" PRIMARY KEY ("id"),
  CONSTRAINT "FK_VIEW_GEO_REFERENCE_LAYER_VIEW"
    FOREIGN KEY ("viewId") REFERENCES "core"."view"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_VIEW_GEO_REFERENCE_LAYER_LAYER"
    FOREIGN KEY ("geoReferenceLayerId")
    REFERENCES "core"."geoReferenceLayer"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "IDX_VIEW_GEO_REFERENCE_LAYER_VIEW_LAYER"
ON "core"."viewGeoReferenceLayer" ("viewId", "geoReferenceLayerId");

CREATE INDEX "IDX_VIEW_GEO_REFERENCE_LAYER_WORKSPACE_VIEW"
ON "core"."viewGeoReferenceLayer" ("workspaceId", "viewId");
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
- Zoom overrides and soft deletes were part of the earlier sketch but are not in
  the current v1 implementation.

## Ingestion Contract

Local orchestration and data pipelines should be able to load data without
calling Twenty object metadata APIs.

Pipeline responsibilities:

1. Create or update the target geospatial schema.
2. Create or replace the layer table.
3. Declare the source geometry SRID in the catalog. Normalizing to `4326` is
   allowed but not required.
4. Validate geometries.
5. Store stable feature ids.
6. Store computed attributes in typed columns or `properties`.
7. Create required spatial indexes.
8. Run `ANALYZE`.
9. Update the JSON catalog entry.
10. Run the catalog sync/validation command.

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

Catalog sync should have a supported command so pipelines do not edit Twenty
metadata tables by hand:

```bash
npx nx command twenty-server -- workspace:sync:geo-reference-layer-catalog \
  --workspace-id <workspace-id> \
  --catalog-path packages/twenty-server/src/engine/core-modules/geo-map/reference-layer-catalog/examples/geofs-demo.example.json
```

The command should validate catalog shape, connection key resolution, table
existence, geometry type, SRID, spatial index, and sidebar contract columns
before enabling each layer. It should upsert `core.geoReferenceLayer` and
`core.viewGeoReferenceLayer` rows in one transaction per workspace.

## Tile Serving Architecture

Add view-scoped reference-layer tile endpoints and extend the map tile service
with a layer provider abstraction.

Recommended endpoint shape:

```txt
GET /rest/map/views/:viewId/reference-layers/:layerId/tiles/:z/:x/:y.mvt
```

Use the view-scoped endpoint because v1 layer availability is defined by a
`viewGeoReferenceLayer` attachment. This also prevents clients from probing
workspace layers that are registered but not attached to the current map view.

Tile response:

- Content type: `application/vnd.mapbox-vector-tile`.
- Layer name: stable layer key or `features`.
- Feature properties:
  - stable feature id.
  - selected feature value.
  - display title.
  - contract-declared sort keys only.
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
- `ST_Transform` to Web Mercator when the catalog `geometrySrid` is not `3857`

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

The first version should support one clear layer-level policy:

```ts
type GeoReferenceLayerSecurityPolicy = {
  kind: 'AUTHENTICATED_WORKSPACE';
  propertyPolicy: 'ALLOWLIST_ONLY';
};
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

Admin-only layers, role-specific layers, internal-only layers, and per-user
row-level filtering inside reference tables are deferred. If a layer needs that
security model, add it later as an explicit provider capability, not as an
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
- For reference feature clicks, open the side-panel insight page backed by the
  layer sidebar contract.
- Do not attempt to navigate to a Twenty record unless the layer is explicitly
  linked to an object in a future version.
- Refresh reference layer sources when view attachment or filter state changes.

The existing `RecordMap` component can evolve into a composition surface, but
the layer-specific code should be factored so object layers and reference
layers do not share record-specific assumptions.

## Tooltip and Insight Model

**Implemented differently.** Reference features support a small inspected-feature
payload through side-panel feature detail, not through the older inline
`exposedProperties` catalog model.

For v1, the tile may include only the properties required for feature picking:
stable feature id, selected feature value, title, and sort keys. The side panel
fetches allowlisted detail fields by layer id and feature id:

```txt
GET /rest/map/views/:viewId/reference-layers/:layerId/features/:featureId
```

Feature detail response should include:

- layer id
- selected feature value
- display title
- geometry summary or bounds
- sidebar-contract sections and fields
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
npx nx command twenty-server -- workspace:validate:geo-reference-layer-catalog \
  --workspace-id <workspace-id> \
  --catalog-path <catalog-path>
```

Validation should check:

- table exists
- id column exists
- geometry column exists
- SRID matches registry
- geometry type is compatible
- geometry column has a GiST index
- sidebar contract fields, title fields, and sort fields resolve
- row count and bounds can be computed
- sample tiles can be generated for each enabled layer

## Performance Strategy

Start with live PostGIS MVT generation against the configured source PostGIS
connection so the architecture is simple and inspectable.

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

Implemented:

- Catalog types and Zod schema exist for the current v1 catalog and sidebar
  contract shape.
- Built-in empty/default catalog JSON exists.
- Private `geofs` demo catalog and contracts exist for parcels and transactions.
- `GEO_REFERENCE_LAYER_CATALOG_STORAGE_PATH` config variable exists.
- External connection `uriEnv` resolution checks registered config first and
  then falls back to `process.env`.
- Registry persistence exists through `core.geoReferenceLayer` and
  `core.viewGeoReferenceLayer`.
- Catalog sync command materializes catalog layers and default attachments.
- Catalog sync can load a catalog from `--catalog-path`, configured storage, or
  the built-in default catalog.
- Validation-only command exists for catalog checks without materializing
  registry rows.
- Registry validation checks table existence, required columns, sampled SRID,
  geometry type compatibility, selected-feature uniqueness, and GiST indexes.
- Sync persists validation status, validation error, last validation time, row
  count, bounds, attribution, explicit security policy, tile provider, and
  operational metadata.
- Services and authenticated REST endpoints exist for attached layer metadata,
  TileJSON, MVT tiles, bounds, and feature details.
- Disabled and invalid layers are materialized but are not served by reference
  layer metadata, TileJSON, tile, bounds, or feature endpoints.
- Reference MVT SQL builder exists and supports non-`4326` source SRIDs.
- Initial schema and SQL-safety unit tests exist.

Remaining implementation:

- Add sample tile generation checks to validation if v1 wants to catch
  tile-time SQL issues before sync completes.
- Add cache header strategy and tile metrics logging for reference tile requests.
- Add integration tests for validation, sync, auth boundaries, invalid/disabled/
  archived layers, feature detail, MVT bytes, and SRID `7856`.

## Frontend Tasks

Implemented:

- Reference layer types exist in the frontend model.
- Map views fetch attached reference layers.
- Map rendering adds MapLibre vector sources for visible reference layers.
- Fill, line, and circle layers render from registry style metadata.
- Layer visibility controls exist in the map layers dropdown.
- Reference-only map views render when attached reference layers exist and no
  primary object tile source is available.
- Map-surface loading/error states exist for reference layer loading failures.
- Reference-layer attribution is passed through to MapLibre vector sources.
- Reference feature clicks open the side-panel insight page.
- Object feature click behavior from Epic 4 is preserved.
- Basic reference map rendering, attribution, and feature picker tests exist.

Remaining implementation:

- Add broader behavior tests for visibility toggles, reference feature
  side-panel navigation, and object-click preservation.

## Local Pipeline and Tooling Tasks

Implemented:

- Private `geofs` example catalog exists for parcels and transactions.

Remaining implementation:

- Add command examples for syncing and validating that catalog.
- Add optional sample pipeline script for loading a new reference dataset into a
  `geo_*` schema in the primary database.
- Add a validation script that can be run after local pipeline loads or external
  catalog changes.
- Keep generated datasets and reports under `.local/geo-reference-layers/`.
- Do not commit large generated spatial files.
- Do not commit live database credentials or host-specific private catalogs to
  upstream PR branches.

## Benchmark Data Strategy

Reuse the Epic 4 real-world datasets, but load at least one of them as a
reference layer rather than a Twenty object.

Recommended v1 reference-layer benchmarks:

- `geofs` `model.parcels`: 26,335 indexed `MULTIPOLYGON` rows in SRID `7856`.
- `geofs` `model.transactions`: 91,808 indexed `POINT` rows in SRID `7856`.
- `geofs` `model.forecast_houses`: 375 styled analytic `MULTIPOLYGON` rows.
- `geofs` `model.forecast_apartments`: 375 styled analytic `MULTIPOLYGON`
  rows.
- Natural Earth or Microsoft building footprints can remain optional public
  benchmarks after the catalog path is working.

For each benchmark, validate:

- pipeline load
- registry upsert
- tile generation
- frontend rendering
- click/hover insight display
- layer visibility toggle

## Tests

### Unit Tests

- Catalog schema validation.
- Catalog connection-key validation.
- Registry identifier validation.
- Sidebar contract allowlist validation.
- Style metadata validation.
- Security policy validation.
- MVT SQL generation for reference layers.
- Tile provider URL resolution.
- Map-view layer ordering.

### Backend Integration Tests

- Validate and sync a catalog for an existing PostGIS table.
- Materialize synced catalog entries into `core.geoReferenceLayer` and
  `core.viewGeoReferenceLayer`.
- Resolve an external PostGIS connection from an env-backed connection key.
- Reject a layer with a missing geometry column.
- Reject a layer without a spatial index when enabled.
- Reject a sidebar contract field that is not present or not allowed.
- Serve MVT bytes for a registered layer.
- Ensure tile payload includes only feature identity, title, and contract sort
  keys.
- Ensure unauthenticated users cannot read reference tiles.
- Ensure users from another workspace cannot read reference tiles.
- Ensure disabled layers do not serve tiles.
- Fetch feature detail by view id, layer id, and feature id.
- Attach a reference layer to a map view.
- Resolve attached layers in position order.
- Generate tiles from a source layer whose SRID is not `4326`.

### Frontend Tests

- Map view requests attached reference layers.
- MapLibre sources are configured from registry metadata.
- Layer visibility toggles hide and show the correct layers.
- Reference feature click opens the side-panel insight page.
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

- [x] **Done**: A JSON catalog can define a pipeline-owned PostGIS table as a
      reference geospatial layer without creating a Twenty object.
- [ ] **Partial**: The catalog lives under the owning server package or an
      explicit `--catalog-path`; configured storage-path loading is implemented,
      but local pipeline docs still need command examples.
- [x] **Done**: Connection strings are resolved from env/config variables and
      are not stored in committed catalogs.
- [x] **Done**: Catalog sync materializes rows into `core.geoReferenceLayer` and
      `core.viewGeoReferenceLayer`.
- [x] **Done**: Registered reference layers may point to same-database PostGIS
      sources or explicitly configured external PostGIS connections.
- [x] **Done**: Registry metadata declares source table, id column, geometry
      column, geometry type, zoom range, style, sidebar contract, attribution,
      explicit security policy, validation state, bounds, row count, and operational
      metadata.
- [ ] **Partial**: Registry validation rejects unsafe identifiers, missing
      tables, missing columns, SRID mismatches, geometry type mismatches, duplicate
      selected feature values, and missing GiST indexes; sample tile checks remain.
- [x] **Done**: A map view can attach one or more reference layers.
- [x] **Done**: The frontend renders attached reference layers together with an
      Epic 4 object layer or as a reference-only map view.
- [x] **Done**: Reference layer tiles include only stable feature identity,
      title, and contract sort keys.
- [x] **Done**: Reference feature click shows a side-panel insight view without
      requiring a Twenty record page.
- [x] **Done**: Object feature click behavior remains unchanged.
- [x] **Done**: Reference layer endpoints are authenticated and
      workspace-scoped.
- [x] **Done**: Unauthorized, unattached, disabled, and invalid layers do not
      serve metadata, tiles, or feature details; explicit policy metadata is
      persisted.
- [x] **Done**: Large reference datasets can be loaded outside normal seed data.
- [x] **Done**: Source SRIDs other than `4326`, including the `geofs` SRID
      `7856`, render through MVT tile SQL.
- [ ] **Partial**: The design keeps a future path to Martin, pg_tileserv,
      PMTiles, or MBTiles; only live Twenty PostGIS serving is implemented.

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

1. Validation hardening:
   - reusable validation service
   - GiST, geometry type, bounds, row count, and sample tile checks
   - validation-only command
   - backend unit and integration tests
2. Catalog loading and metadata hardening:
   - storage-path catalog loading
   - explicit security policy, attribution, validation, and operational metadata
   - disabled-layer handling
3. Frontend completion:
   - reference-only map views
   - map-surface loading/error states
   - attribution display
   - reference-layer behavior tests
4. Pipeline and benchmark readiness:
   - command examples
   - optional local `geo_*` load script
   - `geofs` benchmark notes and performance smoke checks
5. Provider future-proofing:
   - keep `TWENTY_POSTGIS` as the only implemented provider
   - document Martin, pg_tileserv, PMTiles, and MBTiles as deferred provider
     targets
