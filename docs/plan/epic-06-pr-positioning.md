# Epic 06: PR Positioning And App Split

## Goal

Increase the chance of upstream acceptance by presenting native map and geometry
work as staged, reviewable contributions instead of one large geospatial
rewrite.

Epic 06 now also owns the split between:

- the upstream Twenty PR track, which should finish native object map views with
  a narrow, tractable change surface; and
- the private `twenty-geo-layers` Twenty v2 app, which should carry the
  reference-layer product surface that does not need to live in core Twenty.

The intended end state is:

```txt
Upstream Twenty PR:
  Native Twenty objects can be displayed, selected, and opened from a map view.

Private Twenty v2 app:
  Curated geospatial reference layers, catalogs, sync/validation, and custom
  feature-detail UX live outside the upstream PR.
```

## Current Branch Strategy

Use two branch classes:

- Private development branches: keep `docs/plan/**`, `AGENTS.md`, `deploy.sh`,
  and `scripts/local/**` available for local work.
- Upstream PR branches: contain only implementation code, tests, migrations,
  generated files, and maintainer-facing docs.

Use [PR File Manifest](./pr-file-manifest.md) as the current source of truth for
local-only paths, upstream-candidate paths, and files that need explicit review
before inclusion.

Do not merge private development branches directly into upstream PR branches.
Replay only the intended implementation changes by explicit file restore,
clean cherry-pick, or a cleanup commit that removes local-only files before
pushing.

Preserve the current Epic 05 branch before extracting from it:

```bash
git switch feature/native-map-view-epic-05
git switch -c feature/native-map-view-epic-05-presplit
```

Commit or stash any dirty Epic 05 changes on that preservation branch before
starting the split. This branch is the source archive for reference-layer code,
tests, docs, and examples. Do not force-push or rewrite it after extraction
starts.

As of commit `0f2c0c02e9` (`Harden geo reference vector tile handling`), Epic 05
should be treated as a completed in-core implementation under the previous
plan. That does not change the upstream split decision: it makes the
preservation branch more valuable as source material for the app extraction.
Preserve the completed behavior, tests, private examples, and hardening notes
before removing reference-layer code from the upstream-minimal branch.

## Current PR Sequence

The upstream branch sequence should stop at a feature-complete native map view:

1. `upstream/native-map-view-pr-02-map-mvp`
   - Native `MAP` view type.
   - Address-backed map rendering.
   - Map view creation and validation.
   - MapLibre MVP frontend behavior.
2. `upstream/native-map-view-pr-03-geometry-foundation`
   - `FieldMetadataType.GEOMETRY`.
   - PostGIS geometry storage.
   - GeoJSON scalar/read-write handling.
   - Standard seeded point geometry.
3. `upstream/native-map-view-pr-04-hardening`
   - Geometry-backed map views.
   - Vector tile rendering and TileJSON.
   - Map tile policy.
   - Spatial filter operands and benchmark support.
4. `feature/native-map-view-upstream-minimal` (new cleanup branch)
   - Based on `upstream/native-map-view-pr-04-hardening`.
   - Adds only the native-record completion work listed below.
   - This is the candidate branch for closing the upstream PR set.

There should not be an upstream `pr-05-reference-layers` branch for the current
product split. Reference layers move to `twenty-geo-layers` unless a later
product decision asks for a small generic app-extension hook in core.

Create the upstream cleanup branch from the current PR04 hardening baseline:

```bash
git switch -c feature/native-map-view-upstream-minimal \
  upstream/native-map-view-pr-04-hardening
```

## Epic 04 Completion Scope

Epic 04 should close upstream native map work. It should include everything a
Twenty user expects from an object view:

- A map view displays native Twenty records from address coordinates or native
  geometry fields.
- Clicking a mapped address marker opens the underlying record.
- Clicking a mapped geometry point, line, or polygon opens the underlying
  record.
- Clicking overlapping rendered record features opens a small record picker,
  equivalent to choosing the desired row from a dense list/table.
- Picker labels use the object's label identifier when available, and fall back
  to a generic object record label when not.
- Existing view filters, spatial filters, permissions, saved view state, and
  map tile policy behavior remain the source of truth.

Subsume only these Epic 05 artifacts into Epic 04:

```txt
packages/twenty-front/src/modules/object-record/record-map/components/
  RecordMapRecordFeaturePicker.tsx

packages/twenty-front/src/modules/object-record/record-map/constants/
  record-map-vector-tile-layer.constants.ts

packages/twenty-front/src/modules/object-record/record-map/types/
  RecordMapRecordFeaturePicker.ts

packages/twenty-front/src/modules/object-record/record-map/utils/
  getRecordMapRecordFeaturePickerItems.ts
  __tests__/getRecordMapRecordFeaturePickerItems.test.ts
```

Also subsume the native-record portions of these existing files:

```txt
packages/twenty-front/src/modules/object-record/record-index/components/
  RecordIndexMapContainer.tsx

packages/twenty-front/src/modules/object-record/record-map/components/
  RecordMap.tsx

packages/twenty-front/src/modules/object-record/record-map/hooks/
  useRecordMapVectorTileLayers.ts

packages/twenty-server/src/engine/core-modules/geo-map/services/
  geo-map-tile.service.ts

packages/twenty-server/src/engine/core-modules/geo-map/utils/
  build-map-vector-tile-sql.util.ts
```

The server-side native tile change should be limited to:

- include an optional `title` MVT property derived from the active object label
  identifier field;
- expose that property in TileJSON metadata when present;
- preserve existing tile output when the label field is missing, inactive, or
  not on the mapped object.

The frontend native record picking change should be limited to:

- hit-test existing native record tile layers;
- dedupe fill/line duplicate hits for polygon boundaries;
- prefer point hits over line hits over fill hits when the same record appears
  more than once;
- show a picker only when multiple distinct record ids are hit;
- open records through the existing record-index opening path.

Small polish that belongs in Epic 04:

- Map views should use the map icon in view picker dropdowns even if an older
  saved icon value differs.
- MapLibre branding/attribution controls should not be hidden wholesale. Hide
  only what Twenty intentionally owns, and preserve required attribution.
- If the native picker needs bounded menu scrolling, either keep the tiny
  `DropdownMenuItemsContainer` max-height prop or keep the scroll handling local
  to the picker. Prefer the smaller final diff.

Do not include any reference-layer loading, reference-layer auto-fit, reference
picker, reference sidebar page, or layer visibility UI in Epic 04.

## Epic 05 Extraction Scope

The following Epic 05 work is not upstream PR04 completion work. Extract it to
`twenty-geo-layers` or keep it only on private branches:

```txt
packages/twenty-front/src/modules/object-record/record-map/components/
  RecordMapReferenceFeaturePicker.tsx

packages/twenty-front/src/modules/object-record/record-map/constants/
  record-map-reference-layer.constants.ts

packages/twenty-front/src/modules/object-record/record-map/hooks/
  useMapReferenceLayerBounds.ts
  useMapReferenceLayers.ts
  useRecordMapReferenceLayers.ts

packages/twenty-front/src/modules/object-record/record-map/types/
  RecordMapReferenceLayer.ts

packages/twenty-front/src/modules/object-record/record-map/utils/
  getRecordMapReferenceFeaturePickerItems.ts
  getRecordMapReferenceLayerMapIds.ts
  getRecordMapReferenceLayerSwatchColor.ts
  __tests__/getRecordMapReferenceFeaturePickerItems.test.ts

packages/twenty-front/src/modules/side-panel/pages/map-reference-feature/
packages/twenty-front/src/modules/side-panel/constants/SidePanelPagesConfig.tsx
packages/twenty-shared/src/types/SidePanelPages.ts

packages/twenty-server/src/database/typeorm/core/migrations/common/
  1776200000000-add-geo-reference-layers.ts
  1776300000000-add-geo-reference-layer-sidebar-contract.ts
  1776400000000-add-geo-reference-layer-operational-metadata.ts

packages/twenty-server/src/engine/core-modules/geo-map/entities/
  geo-reference-layer.entity.ts
  view-geo-reference-layer.entity.ts

packages/twenty-server/src/engine/core-modules/geo-map/reference-layer-catalog/
packages/twenty-server/src/engine/core-modules/geo-map/services/
  geo-reference-layer.service.ts
  geo-reference-layer-visibility-preference.service.ts

packages/twenty-server/src/engine/core-modules/geo-map/commands/
  geo-reference-layer-catalog-sync.command.ts
  geo-reference-layer-catalog-validate.command.ts

Reference-layer additions to:
  geo-map-module.ts
  geo-map-tile.controller.ts
  geo-map.resolver.ts
  database-command.module.ts
  config-variables.ts
  RecordMap.tsx
  RecordMapLayersDropdownButton.tsx
  RecordIndexMapContainer.tsx
```

These files are valuable implementation source material, but they should not be
copied blindly into the app. App code must use Twenty v2 app APIs and public
Twenty APIs, not `@/` frontend internals or `src/engine/...` server internals.

The completed Epic 05 source state includes hardening that should be preserved
in the extraction ledger:

- private cache headers and timing/byte logging for reference tile responses;
- validation checks for table existence, columns, SRID, geometry type,
  selected-feature uniqueness, GiST indexes, and sample tile generation;
- unit/service/component coverage for serving gates, validation behavior, tile
  response headers, attribution, and reference feature picking;
- private catalog README examples for validate/sync commands;
- `load-postgis-layer.example.sh` as a local-only PostGIS import template.

## `twenty-geo-layers` App Workspace

Create `twenty-geo-layers` as a Whirlwind-owned app workspace, not as a
root-level folder inside `twenty-geo` and not as a separate GitHub repository.

Recommended local checkout layout:

```txt
/Volumes/Data/Projects/Whirlwind/
  apps/                   # Whirlwind-owned Twenty v2 app workspaces
    mark8/
    twenty-geo-layers/
  vendors/                # independent upstream/vendor repos pinned by Whirlwind
    twenty-geo/           # Twenty fork and upstream PR workspace
```

The `Whirlwind` root is a monorepo for Whirlwind-owned apps, services, and
orchestration. `vendors/` is for independently-owned repositories that Whirlwind
pins or checks out for local development. `twenty-geo` should stay independently
owned there so it can push clean upstream PR branches without Whirlwind
monorepo history.

Each folder under `apps/` is Whirlwind-owned source in the monorepo. App code
should not import source directly from `vendors/twenty-geo`; it should talk to
the running Twenty server through public app, GraphQL, REST, and SDK boundaries.

Use these app identifiers consistently:

- App path: `apps/twenty-geo-layers/`
- Package name: `twenty-geo-layers`
- Display name: `Twenty Geo Layers`
- Extraction ledger:
  `apps/twenty-geo-layers/docs/epic-05-extraction-ledger.md`

Do not place the app at `twenty-geo/twenty-geo-layers` or
`twenty-geo/apps/twenty-geo-layers`. Private app folders inside `twenty-geo`
make upstream diffs easier to pollute. If a temporary in-repo staging app is
needed for fast experiments, put it under
`packages/twenty-apps/internal/twenty-geo-layers` on a private branch only, and
do not include it in upstream PR branches.

Scaffold the app:

```bash
mkdir -p /Volumes/Data/Projects/Whirlwind/apps
cd /Volumes/Data/Projects/Whirlwind/apps
npx create-twenty-app@latest twenty-geo-layers
cd /Volumes/Data/Projects/Whirlwind
rm -rf apps/twenty-geo-layers/.git
git add apps/twenty-geo-layers
git commit -m "Initialize Twenty Geo Layers app"
```

Use the app workspace for:

- layer catalog files and schemas that describe external or pipeline-owned
  geospatial datasets;
- logic functions that validate catalogs, sync app-owned metadata, or call
  external geospatial services;
- app-owned objects for layer definitions, saved layer sets, sync runs, or
  validation results if the v2 app model needs persisted state;
- front components for catalog administration, validation status, layer
  previews, or feature-detail panels;
- navigation items and page layouts for the app's own objects.

Avoid app code that depends on:

- `packages/twenty-front/src/**` imports;
- `packages/twenty-server/src/**` imports;
- direct access to the native `maplibregl.Map` instance;
- core-only database entities or migrations;
- private scripts from `vendors/twenty-geo`;
- sibling app source imports such as `../mark8/**`.

Shared local orchestration scripts may live at the `Whirlwind/` root if they
coordinate multiple repos, but upstream PR branches in `vendors/twenty-geo` and
deployable app code under `apps/*` should not depend on those scripts.

Current Twenty v2 front components render in a sandboxed Remote DOM worker and
cannot directly mutate the native map instance. Therefore, the first app version
should not promise native overlay rendering inside the core map unless a future
small upstream extension point is added. The app can still own catalog,
validation, metadata, feature-detail, and administration workflows immediately.

## Extraction Procedure

1. Preserve source state.

   ```bash
   cd /Volumes/Data/Projects/Whirlwind/vendors/twenty-geo
   git switch feature/native-map-view-epic-05-presplit
   git status --short
   ```

   Commit or stash dirty work before copying. Keep this branch as the immutable
   source reference.

2. Build the upstream-minimal branch from PR04.

   ```bash
   git switch -c feature/native-map-view-upstream-minimal \
     upstream/native-map-view-pr-04-hardening
   ```

3. Replay native-record completion only.

   Prefer file-level restore from the preservation branch for new native picker
   files:

   ```bash
   git restore --source feature/native-map-view-epic-05-presplit -- \
     packages/twenty-front/src/modules/object-record/record-map/components/RecordMapRecordFeaturePicker.tsx \
     packages/twenty-front/src/modules/object-record/record-map/constants/record-map-vector-tile-layer.constants.ts \
     packages/twenty-front/src/modules/object-record/record-map/types/RecordMapRecordFeaturePicker.ts \
     packages/twenty-front/src/modules/object-record/record-map/utils/getRecordMapRecordFeaturePickerItems.ts \
     packages/twenty-front/src/modules/object-record/record-map/utils/__tests__/getRecordMapRecordFeaturePickerItems.test.ts
   ```

   For modified files, apply the native-record hunks manually. Do not restore
   whole files when that would pull reference-layer imports or behavior into the
   upstream branch.

4. Verify no reference-layer paths leaked into the upstream branch.

   ```bash
   git diff --name-only upstream/native-map-view-pr-04-hardening...HEAD |
     rg 'reference-layer|ReferenceLayer|map-reference-feature|geo-reference|viewGeoReferenceLayer|geoReferenceLayer' &&
     { echo "Reference-layer code leaked into upstream branch"; exit 1; } || true
   ```

5. Run focused validation on the upstream branch.

   ```bash
   npx jest packages/twenty-front/src/modules/object-record/record-map/utils/__tests__/getRecordMapRecordFeaturePickerItems.test.ts --config=packages/twenty-front/jest.config.mjs
   npx jest packages/twenty-server/src/engine/core-modules/geo-map/utils/__tests__/build-map-vector-tile-sql.util.spec.ts --config=packages/twenty-server/jest.config.mjs
   npx nx lint:diff-with-main twenty-front
   npx nx lint:diff-with-main twenty-server
   npx nx typecheck twenty-front
   npx nx typecheck twenty-server
   ```

6. Extract app source material into the app workspace.

   Copy concepts, not internal imports. Use Epic 05 files as references while
   creating app-native entities:

   ```bash
   cd /Volumes/Data/Projects/Whirlwind/apps/twenty-geo-layers
   yarn twenty add object
   yarn twenty add logicFunction
   yarn twenty add frontComponent
   yarn twenty add navigationMenuItem
   ```

   Suggested first app modules:

   ```txt
   src/objects/
     reference-layer.object.ts
     reference-layer-sync-run.object.ts

   src/fields/
     reference-layer-*.field.ts
     reference-layer-sync-run-*.field.ts

   src/logic-functions/
     validate-catalog.logic-function.ts
     sync-catalog.logic-function.ts

   src/front-components/
     reference-layer-admin.front-component.tsx
     reference-feature-details.front-component.tsx

   src/navigation-menu-items/
     reference-layers.navigation-menu-item.ts
   ```

   If app-owned objects are too heavy for v1, start with front components and
   logic functions only, then add persisted objects when the app needs history
   or workspace-visible configuration.

7. Keep an app migration ledger.

   In the app workspace, create a private note such as
   `apps/twenty-geo-layers/docs/epic-05-extraction-ledger.md` listing each
   Epic 05 source file and its destination or disposition:

   ```txt
   geo-reference-layer-catalog.schema.ts -> src/catalog/catalog-schema.ts
   geo-reference-layer-catalog-sync.service.ts -> sync-catalog.logic-function.ts
   SidePanelMapReferenceFeaturePage.tsx -> reference-feature-details.front-component.tsx
   useRecordMapReferenceLayers.ts -> deferred pending native map extension hook
   ```

## Using `twenty-geo-layers` With `twenty-geo`

Run `twenty-geo` as the local Twenty server:

```bash
cd /Volumes/Data/Projects/Whirlwind/vendors/twenty-geo
./deploy.sh local
./deploy.sh watch
```

Expected local URLs:

```text
Frontend: http://localhost:3001
Server:   http://localhost:3000
Apple workspace: http://apple.localhost:3001
```

Authenticate the app workspace against the local `twenty-geo` server:

```bash
cd /Volumes/Data/Projects/Whirlwind/apps/twenty-geo-layers
yarn twenty remote add --api-url http://localhost:3000 --as twenty-geo
yarn twenty remote switch
```

When the browser opens for authorization, sign in to the local Twenty workspace:

```text
Email:    tim@apple.dev
Password: tim@apple.dev
```

Sync the app once:

```bash
yarn twenty dev --once
```

For active app development, use watch mode:

```bash
yarn twenty dev
```

Then open:

```text
http://apple.localhost:3001/settings/applications#developer
```

Confirm `twenty-geo-layers` appears under developer apps, install it into the
workspace if prompted, and verify its app-owned navigation items, objects, or
front components appear in the UI.

Use this local contract while the native map extension point is not available:

- `twenty-geo` owns native map rendering and record opening.
- `twenty-geo-layers` owns reference-layer catalogs, validation, sync status,
  and app UI.
- Native overlay rendering from app-owned layers is deferred until Twenty core
  exposes a small, generic map-layer contribution API.

If an extension hook is approved later, keep it generic in the upstream branch:

```txt
core map asks installed apps or app-owned metadata for:
  tile URL template
  source layer names
  style metadata
  bounds
  feature selection handler
```

Do not upstream GEOS-specific names, private catalog examples, or assumptions
about one external PostGIS database.

## Recommended Maintainer Framing

For the first upstream discussion or PR description, keep the framing staged:

```md
I would like to add native map views to Twenty in reviewable steps.

Initial scope:
- Add `MAP` as a view type.
- Render records using existing address coordinates.
- Reuse existing view filters, permissions, and record-opening behavior.

Follow-up scope:
- Add native PostGIS-backed geometry fields.
- Add tile-backed geometry rendering and spatial filters.
- Keep curated reference geospatial layers in a Twenty v2 app unless and until
  core needs a generic app-contributed map-layer hook.
```

## Cleanliness Gate

Before pushing any `upstream/native-map-view-pr-*` branch, run:

```bash
git diff --name-status upstream/main...HEAD
git diff --check upstream/main...HEAD
if git diff --name-only upstream/main...HEAD |
  rg '^(AGENTS\.md|deploy\.sh|docs/plan/|scripts/local/)'; then
  echo 'Local-only files are present in the PR diff'
  exit 1
fi
```

If the branch depends on an earlier unmerged PR, replace `upstream/main` with
that PR branch as the comparison base.

For the upstream-minimal branch, also run:

```bash
if git diff --name-only upstream/native-map-view-pr-04-hardening...HEAD |
  rg 'reference-layer|ReferenceLayer|map-reference-feature|geo-reference|viewGeoReferenceLayer|geoReferenceLayer'; then
  echo 'Reference-layer work is present in the upstream completion branch'
  exit 1
fi
```

## PR Checklist

- Pull or rebase onto the correct upstream base.
- Run focused tests for touched packages.
- Run lint and typecheck targets for touched packages.
- Include screenshots or short screen recordings for UI PRs.
- Include migration notes for backend/schema PRs.
- Explain generated files and how they were produced.
- Confirm the GitHub `Files changed` tab has no private docs or local tooling.
- Confirm reference-layer app work is not bundled into the upstream native map
  PR.

## Acceptance Criteria

- Each PR has one coherent behavior change.
- Backend schema changes are tested.
- Frontend behavior is demonstrable without paid external services.
- Native object map views can open records with the same product expectation as
  list/table views.
- Future reference-layer work is documented and extracted to
  `twenty-geo-layers`, not bundled into the upstream native map PR.
- Private planning docs and helper scripts remain available on private branches
  without leaking into upstream PR branches.
