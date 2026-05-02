# Epic 03: Native PostGIS Geometry Fields

## Status

Implemented as the geometry foundation and represented for upstream review by
`upstream/native-map-view-pr-03-geometry-foundation`. The current code supports
`POINT`, `POLYGON`, `MULTIPOLYGON`, and generic `GEOMETRY`; it does not include
`LINESTRING` as an enabled object geometry type.

## Goal

Add native PostGIS-backed `GEOMETRY` fields to Twenty objects so users can store
point, polygon, multipolygon, or generic geometry shapes as first-class record
data.

This epic can proceed after the address-backed map view direction is validated locally. Maintainer feedback can shape upstream PR sequencing, but it is not a blocker for native geometry implementation work.

## Architecture Note: Scalar Geometry Field, GeoJSON API

Epic 3 introduces actual spatial storage. Unlike Epic 2, which plots existing `ADDRESS.addressLat` and `ADDRESS.addressLng` subfields, this epic adds a new scalar field type backed by PostGIS columns.

`FieldMetadataType.GEOMETRY` should represent one database column per field. It should not be implemented as a Twenty composite field because PostGIS geometry values need native spatial operators, GiST indexes, SRID constraints, and serialization through PostGIS functions.

Use GeoJSON-compatible values as the primary API and frontend representation. Do not make WKT the main wire format. WKT can be added later as an import convenience.

## User Outcome

A user can add a geometry field to an object, store geospatial shapes in records, read and update those shapes through Twenty APIs, and see useful field display in table, show, and map contexts.

Initial UX should make point geometry useful first. Polygon and multipolygon
storage are supported in the backend shape model, while advanced drawing/editing
can be staged after point editing is stable.

## Scope

### Included

- Add `FieldMetadataType.GEOMETRY`.
- Add geometry field settings:
  - `geometryType`: `POINT`, `POLYGON`, `MULTIPOLYGON`, or `GEOMETRY`.
  - `srid`: default `4326`.
  - `isGeography`: default `false`, reserved for future use.
- Enable PostGIS for workspace databases.
- Store values in PostGIS `geometry(<type>, <srid>)` columns.
- Add spatial indexes for geometry columns.
- Use GeoJSON-compatible API values.
- Validate GeoJSON shape type and coordinate ranges.
- Serialize reads from PostGIS to GeoJSON.
- Parse writes from GeoJSON into PostGIS geometry.
- Add geometry fields to metadata creation and update flows.
- Add basic frontend field creation and display.
- Allow Epic 2 map views to use `GEOMETRY` point fields as a map source.

### Excluded

- Geography columns.
- `LINESTRING` object geometry fields.
- 3D or measured coordinates.
- Geometry collections.
- Advanced line and polygon editors.
- Draw tools beyond a basic point editor.
- Spatial filtering and search operators.
- Viewport search.
- Distance sorting.
- Address geocoding.
- Automatic address-to-geometry sync.
- Spatial role permission predicates unless needed by existing permission plumbing.

## Field Model

Introduce:

```ts
FieldMetadataType.GEOMETRY
```

Introduce shared geometry settings types:

```ts
type GeometryType = 'POINT' | 'POLYGON' | 'MULTIPOLYGON' | 'GEOMETRY';

type FieldMetadataGeometrySettings = {
  geometryType: GeometryType;
  srid: number;
  isGeography?: boolean;
};
```

Initial defaults:

- `geometryType`: `POINT`.
- `srid`: `4326`.
- `isGeography`: `false`.
- `defaultValue`: `null`.

Validation rules:

- `geometryType` must be one of `POINT`, `POLYGON`, `MULTIPOLYGON`, or
  `GEOMETRY`.
- `srid` must initially be `4326`.
- `isGeography` must be `false` or absent.
- Geometry fields should be nullable by default.
- Unique geometry fields should be rejected unless a clear upstream pattern exists for indexing complex values.
- Searchable label identifiers should not allow geometry fields.

Future settings:

- `LINESTRING` support.
- Dimensionality: `XY`, `XYZ`, `XYM`, `XYZM`.
- Shape validation policy.
- Default map style and display options.
- Geography storage.

## API Representation

Use GeoJSON geometry objects for create, update, and read responses:

```json
{
  "type": "Point",
  "coordinates": [151.2093, -33.8688]
}
```

Polygon example:

```json
{
  "type": "Polygon",
  "coordinates": [
    [
      [151.2, -33.86],
      [151.22, -33.86],
      [151.22, -33.84],
      [151.2, -33.86]
    ]
  ]
}
```

API rules:

- Accept `null` for nullable geometry fields.
- Reject geometry objects whose `type` does not match field settings.
- Reject coordinates outside valid WGS84 ranges for SRID `4326`.
- Normalize writes with `ST_SetSRID(ST_GeomFromGeoJSON(...), 4326)`.
- Serialize reads with `ST_AsGeoJSON(column)::json`.
- Preserve GeoJSON coordinate order: longitude, latitude.

## Storage

Enable PostGIS:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

Store values as:

```sql
geometry(Point, 4326)
geometry(Polygon, 4326)
geometry(MultiPolygon, 4326)
geometry(Geometry, 4326)
```

Index geometry columns:

```sql
CREATE INDEX ... USING GIST ("geometryColumn");
```

Storage rules:

- PostGIS extension setup must run before workspace migrations create geometry columns.
- Geometry columns should be nullable unless field metadata says otherwise.
- Spatial indexes should be created and dropped with the field lifecycle.
- Down migrations must drop spatial indexes before dropping geometry columns.
- Avoid broad `geometry(Geometry, 4326)` in the first implementation; use the configured geometry type.

## Backend Tasks

- Add `GEOMETRY` to shared field metadata types:
  - `FieldMetadataType`.
  - `FieldMetadataSettingsMapping`.
  - `FieldMetadataDefaultValueMapping`.
  - field kind helpers where appropriate.
- Add geometry settings and GeoJSON value types in `twenty-shared`.
- Add metadata validation:
  - settings schema validation.
  - default value validation.
  - unique/searchable restrictions.
  - field creation and update tests.
- Update field metadata conversion paths:
  - create field input to flat field metadata.
  - field metadata entity to flat field metadata.
  - universal flat entity comparison and stringification.
  - application manifest conversion if custom fields can be declared there.
- Update workspace schema generation:
  - map `FieldMetadataType.GEOMETRY` to `geometry(<type>, 4326)`.
  - generate nullable geometry column definitions.
  - generate GiST index metadata or direct migration actions for geometry indexes.
  - ensure generated SQL is stable across diff runs.
- Add PostGIS extension management:
  - core or instance command to enable PostGIS.
  - local setup compatibility with the existing PostgreSQL service.
  - clear failure mode if the database cannot install extensions.
- Update query execution:
  - create/update input parsing from GeoJSON.
  - read serialization through `ST_AsGeoJSON`.
  - selected field handling.
  - REST selected fields and GraphQL selected fields.
  - cursor/filter plumbing so geometry fields do not break generic record queries.
- Update GraphQL schema generation:
  - add a `Geometry` scalar or object shape for GeoJSON.
  - add create/update input support.
  - add read output support.
  - omit geometry from order-by until Epic 4.
  - omit spatial filter operators until Epic 4.
- Update REST/OpenAPI expectations if generated object APIs expose field shapes there.
- Update import/export:
  - export GeoJSON objects.
  - import GeoJSON objects.
  - reject WKT initially unless a low-risk parser already exists.
- Add developer seed or fixture data only if needed for tests or demos.

## Frontend Tasks

- Add `GEOMETRY` to generated/shared frontend field metadata types.
- Add geometry to settings data model field creation:
  - field type config.
  - default icon, for example `IconMapPin` or `IconShape`.
  - settings form for `geometryType` with `Point`, `Polygon`,
    `MultiPolygon`, and `Geometry`.
  - fixed SRID display as `EPSG:4326` for the first version.
- Add geometry field display:
  - table cell compact display.
  - record show read display.
  - empty state for null geometry.
  - concise coordinate display for points.
  - compact shape summary for polygons and multipolygons.
- Add geometry field edit support:
  - point editor with longitude and latitude inputs.
  - validation feedback for invalid coordinate values.
  - polygon and multipolygon values can initially use a structured GeoJSON
    editor if full drawing UX is too large.
- Add geometry field preview support in settings.
- Add map view source support:
  - update `MapFieldSource` to support `GEOMETRY`.
  - allow `mapFieldMetadataId` to point to readable, active `GEOMETRY` point fields.
  - keep Epic 2 address-backed source support.
  - render point geometry records as markers.
  - provide a clear empty state for unsupported line/polygon map sources until layers are implemented.
- Add frontend tests for field settings, point validation, display, and map source selection.

## Map View Integration

Epic 2 introduced `mapFieldMetadataId` with geometry-reserved naming. Epic 3 should expand its validation:

- Allow `ADDRESS` fields.
- Allow `GEOMETRY` fields only when settings `geometryType` is `POINT`.
- Reject polygon, multipolygon, and generic geometry fields as marker sources
  until tile/layer rendering is implemented.
- Preserve existing address marker behavior.
- Add coordinate extraction from GeoJSON point values:

```ts
record[geometryFieldName]?.type === 'Point'
record[geometryFieldName]?.coordinates === [longitude, latitude]
```

Line and polygon map rendering can be added after point geometry is stable.

## Tests

- Shared unit tests:
  - geometry settings validation.
  - GeoJSON point, line, polygon validation.
  - invalid coordinate rejection.
  - helper type classification.
- Backend unit tests:
  - field metadata type-to-column mapping.
  - column definition generation.
  - geometry read serialization.
  - geometry write parsing.
  - flat field metadata validation.
- Backend integration tests:
  - create object with geometry field.
  - create, update, read, and clear point geometry values.
  - reject mismatched GeoJSON type.
  - reject invalid coordinate ranges.
  - verify PostGIS extension exists.
  - verify geometry column type and SRID.
  - verify GiST index exists.
  - verify regular record CRUD still works with permissions.
- Frontend tests:
  - field type appears in settings.
  - geometry settings form defaults to point and EPSG:4326.
  - point editor validates longitude and latitude.
  - geometry display handles null and valid point values.
  - map field picker includes point geometry fields and excludes line/polygon fields.
- Optional Storybook stories:
  - geometry field display states.
  - point editor states.
  - map view with address source and point geometry source.

## Acceptance Criteria

- A custom object can include a `GEOMETRY` field.
- Geometry field metadata persists with settings.
- Workspace schema generation creates PostGIS geometry columns.
- PostGIS extension setup is part of the migration path.
- Geometry columns have spatial indexes.
- Records can create, update, read, and clear geometry values.
- API responses use stable GeoJSON-compatible shapes.
- Invalid GeoJSON is rejected with useful validation errors.
- Existing permissions and record CRUD behavior remain intact.
- Epic 2 map views can use point geometry fields as marker sources.
- Line and polygon fields do not break table, show, API, or map view behavior.

## Risks

- This touches metadata, workspace schema generation, query runners, generated API schemas, import/export, and frontend field rendering.
- PostGIS extension availability can vary across hosted PostgreSQL environments.
- Geometry values are not ordinary TypeORM scalar values; reads and writes need explicit SQL handling.
- Generic filtering, ordering, cursor, and selected-field utilities may assume normal scalar columns.
- GeoJSON validation can become large. Keep first-pass validation strict and limited to supported geometry types.
- Frontend drawing tools can balloon scope. Start with point editing and compact display.

## Suggested PR Breakdown

1. Shared and backend metadata foundation:
   - `FieldMetadataType.GEOMETRY`.
   - geometry settings/default-value types.
   - metadata validators.
   - schema generation column type support.
   - tests that do not require full record CRUD.
2. PostGIS storage and record API:
   - extension setup.
   - geometry column creation.
   - GiST indexes.
   - GeoJSON read/write serialization.
   - backend integration tests.
3. Frontend field creation and display:
   - settings field type config.
   - geometry settings form.
   - point display and point editor.
   - frontend tests.
4. Map view geometry source:
   - `MapFieldSource` support for geometry.
   - map field validation update.
   - point geometry marker rendering.
   - empty state for unsupported geometry shapes.
5. Import/export and polish:
   - GeoJSON import/export.
   - fixture data.
   - Storybook states if useful.
   - documentation and PR cleanup.

## Future Epic 4 Positioning

Reserve spatial filtering and search for Epic 4:

- `withinDistance`.
- `withinBoundingBox`.
- `intersects`.
- `contains`.
- viewport search.
- distance sorting.
- spatial filter UI.
- map-driven saved views.
