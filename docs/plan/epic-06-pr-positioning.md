# Epic 06: PR Positioning

## Goal

Increase the chance of upstream acceptance by presenting native map and geometry
work as staged, reviewable contributions instead of one large geospatial
rewrite.

## Current Branch Strategy

Use two branch classes:

- Private development branches: keep `docs/plan/**`, `AGENTS.md`, `deploy.sh`,
  and `scripts/local/**` available for local work.
- Upstream PR branches: contain only implementation code, tests, migrations,
  generated files, and maintainer-facing docs.

Do not merge private development branches directly into upstream PR branches.
Replay only the intended implementation changes by explicit file restore,
clean cherry-pick, or a cleanup commit that removes local-only files before
pushing.

## Current PR Sequence

The current clean branch sequence is:

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
4. `upstream/native-map-view-pr-05-reference-layers` (planned)
   - Reference geospatial layer registry.
   - Pipeline-owned PostGIS layer registration.
   - Reference layer tile rendering.
   - Map view layer attachments.

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
- Add curated reference geospatial layers for large pipeline-owned datasets.
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

## PR Checklist

- Pull or rebase onto the correct upstream base.
- Run focused tests for touched packages.
- Run lint and typecheck targets for touched packages.
- Include screenshots or short screen recordings for UI PRs.
- Include migration notes for backend/schema PRs.
- Explain generated files and how they were produced.
- Confirm the GitHub `Files changed` tab has no private docs or local tooling.

## Acceptance Criteria

- Each PR has one coherent behavior change.
- Backend schema changes are tested.
- Frontend behavior is demonstrable without paid external services.
- Future geospatial work is documented but not bundled into earlier PRs.
- Private planning docs and helper scripts remain available on private branches
  without leaking into upstream PR branches.
