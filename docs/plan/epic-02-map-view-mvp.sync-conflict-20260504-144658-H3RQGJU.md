# Epic 02: First-Pass Map View MVP

## Goal

Add a native `MAP` view that displays records using existing `ADDRESS.addressLat` and `ADDRESS.addressLng` subfields.

This epic intentionally avoids native geometry storage. It proves the product value and integration path with a smaller, reviewable change.

## Architecture Note: Address-Backed MVP, Geometry-Reserved Naming

Epic 2 should use future-proof map view naming without introducing native spatial storage.

`mapFieldMetadataId` is intentionally generic. In this epic, it must point to a readable, active `ADDRESS` field on the view's object, and records are plotted from that field's `addressLat` and `addressLng` subfields. In a later PostGIS epic, the same map view concept may allow `mapFieldMetadataId` to point to a native `GEOMETRY` field.

Reserve the name `geometry` for future Twenty object/table fields that physically store spatial data. Epic 2 must not add `FieldMetadataType.GEOMETRY`, `geometry(Point, 4326)` columns, PostGIS extensions, spatial indexes, GeoJSON API shapes, or geometry import/export behavior.

## User Outcome

A user can create a map view for an object with an address field, then see records plotted on a map using stored coordinates. Existing filters, sorts, permissions, and record-opening behavior continue to work.

## Scope

### Included

- Add `ViewType.MAP`.
- Add map view metadata: `mapFieldMetadataId`.
- Allow map view creation only when at least one readable `ADDRESS` field exists.
- Treat `mapFieldMetadataId` as a map field source, not as a geometry field.
- Render records with valid latitude and longitude.
- Skip records without coordinates.
- Open a record from a marker or marker popup.
- Reuse existing view filters and sorts.
- Add clear empty states.

### Excluded

- Native `GEOMETRY` field type.
- `geometry(Point, 4326)` or broader workspace geometry columns.
- PostGIS.
- PostGIS extension setup.
- Geocoding.
- Distance filtering.
- Polygon and line rendering.
- Draw tools.
- Spatial indexes.
- GeoJSON API shape decisions.
- Geometry import/export.

## Backend Tasks

- Extend shared `ViewType` with `MAP`.
- Add a core database migration:
  - Add enum value `MAP`.
  - Add nullable `mapFieldMetadataId`.
  - Add FK from `view.mapFieldMetadataId` to `fieldMetadata.id`.
  - Add index for `mapFieldMetadataId`.
  - Add integrity constraint: map views require `mapFieldMetadataId`.
- Add `mapFieldMetadataId` to:
  - View entity.
  - View DTO.
  - Create view input.
  - Update view input.
  - GraphQL generated types.
  - REST integration expectations if required.
- Validate that `mapFieldMetadataId` points to a readable, active `ADDRESS` field on the same object as the view.
- Do not introduce `FieldMetadataType.GEOMETRY`.
- Do not create PostGIS extensions, spatial indexes, or workspace geometry columns.

## Frontend Tasks

- Add map option to view picker.
- Add map icon mapping.
- Add `useGetAvailableFieldsForMap`.
- Add `mapFieldMetadataId` to frontend view model and GraphQL fragments.
- Represent the selected map field as a `MapFieldSource`; for Epic 2 the only supported source type is `ADDRESS`.
- Add `RecordIndexMapContainer`.
- Add `record-map` module:
  - `RecordMap`
  - `RecordMapMarker`
  - `RecordMapPopup`
  - `RecordMapDataLoaderEffect`
  - `RecordMapSSESubscribeEffect`
- Derive map records from the selected address field.
- Extract coordinates from selected address field:

```ts
record[addressFieldName]?.addressLat
record[addressFieldName]?.addressLng
```

- Use the existing record identifier/chip utilities for marker labels and popups.
- Fit initial viewport to visible markers.
- Provide empty states:
  - No mappable address field.
  - No records with coordinates.
  - Map style unavailable, if renderer requires external style configuration.

## Map Renderer Decision

Recommended first choice: MapLibre GL.

Reasons:

- Open source.
- Compatible with open vector tile styles.
- No hard Mapbox dependency.
- Supports markers, clustering, GeoJSON layers, and future spatial UX.

Implementation should isolate renderer-specific code so maintainers can request a different provider without rewriting view state and data loading logic.

## Tests

- Unit tests for available address field selection.
- Unit tests for coordinate extraction and invalid coordinate handling.
- Backend integration tests for creating and updating map views.
- Frontend component tests for empty states and marker rendering.
- Optional Storybook stories for map view states.

## Acceptance Criteria

- Users can create a map view from the view picker when an object has an address field.
- Map views persist and reload.
- Records with coordinates render as markers.
- Records without coordinates do not break rendering.
- Existing filters affect markers.
- Marker click opens the record using existing index behavior.
- No PostGIS dependency is introduced in this epic.
- No native geometry field, geometry column, or spatial index is introduced in this epic.

## Future PostGIS Positioning

Reserve Epic 3 for native spatial storage and querying:

- `FieldMetadataType.GEOMETRY`.
- `geometry(Point, 4326)` or broader geometry column support.
- GeoJSON or other API wire-shape decisions.
- PostGIS extension setup.
- GiST or SP-GiST indexes.
- Spatial filters and search.
- Backfill or sync from address latitude and longitude if needed.

Epic 2 proves the native map-view product surface first. Epic 3 can add native spatial storage once the view model and UI are established.

## Suggested PR Breakdown

1. Shared and backend metadata for `MAP` views.
2. Frontend view picker and map container.
3. Renderer polish, empty states, tests, and fixture data.
