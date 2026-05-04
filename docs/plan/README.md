# Native Map and Geometry Views Plan

This directory tracks the staged plan for adding native map and geospatial capabilities to Twenty.

The intended progression is deliberately incremental:

1. Establish a repeatable development workflow.
2. Ship a low-risk map view MVP using existing address latitude and longitude subfields.
3. Add native PostGIS-backed geometry field support.
4. Add spatial filtering and search parity with Twenty's existing non-geometry view capabilities.
5. Add a non-object reference geospatial layer registry for large pipeline-owned spatial datasets.

## Epics

- [Epic 01: Initialization and Development Workflow](./epic-01-initialization.md)
- [Epic 02: First-Pass Map View MVP](./epic-02-map-view-mvp.md)
- [Epic 03: Native PostGIS Geometry Fields](./epic-03-postgis-geometry.md)
- [Epic 04: PostGIS Filtering and Search](./epic-04-postgis-filtering-search.md)
- [Epic 05: Reference Geospatial Layer Registry](./epic-05-reference-geospatial-layer-registry.md)
- [Epic 06: PR Positioning](./epic-06-pr-positioning.md)
- [PR File Manifest](./pr-file-manifest.md)

## Current Branch Map

As of the Epic 05 branch setup, the local branch roles are:

- `feature/native-map-view`: private workflow foundation.
- `feature/native-map-view-epic-02`: private Map MVP implementation.
- `feature/native-map-view-epic-03`: private geometry foundation implementation.
- `feature/native-map-view-epic-04`: private tile rendering and spatial filter implementation.
- `feature/native-map-view-epic-05`: private reference layer registry planning and implementation branch.
- `feature/native-map-view-private-tooling`: historical source for local-only dev tooling.
- `upstream/native-map-view-pr-02-map-mvp`: clean upstream Map MVP branch.
- `upstream/native-map-view-pr-03-geometry-foundation`: clean upstream geometry foundation branch.
- `upstream/native-map-view-pr-04-hardening`: clean upstream hardening branch.

Private branches may track `docs/plan/**`, `AGENTS.md`, `deploy.sh`, and
`scripts/local/**`. Upstream PR branches must omit those files entirely.
Use [PR File Manifest](./pr-file-manifest.md) as the current source of truth for
which paths are local-only, upstream candidates, or require explicit review.

## Guiding Principles

- Keep early pull requests small enough to review.
- Reuse existing Twenty primitives for views, filters, permissions, record opening, metadata, import/export, and API behavior.
- Avoid introducing full geospatial storage until a native map view proves product value.
- Prefer open standards and portable formats: GeoJSON, EPSG:4326, PostGIS, and MapLibre-compatible rendering.
- Treat spatial querying as a parity milestone, not part of the first UI MVP.
- Keep large reference geospatial layers separate from Twenty objects unless users need object-level CRM behavior.

## Development, Deployment, And Testing Guide

These commands are for the private `twenty-geo` working tree. They are
intentionally documented here instead of inside Twenty package source or
upstream-facing docs because `deploy.sh`, `scripts/local/**`, and `docs/plan/**`
are local workflow aids, not files intended for a maintainer PR.

### Command Map

| Goal | Command |
| --- | --- |
| Check local tooling and scripts | `./deploy.sh check` |
| Bootstrap local services and seed data | `./deploy.sh local` or `./scripts/local/bootstrap-twenty-map-dev.sh` |
| Start the full local app, including worker | `./deploy.sh start` or `./scripts/local/start-twenty-dev.sh` |
| Start frontend/backend hot reload only | `./deploy.sh watch` or `./scripts/local/watch-twenty-dev.sh` |
| Reset and reseed map-ready dev data | `./deploy.sh reseed`, `./scripts/local/reseed.sh`, or `./scripts/local/reset-map-dev-data.sh` |
| Run focused Epic 2 map-view tests | `./deploy.sh test-map-view` or `./scripts/local/check-map-view.sh` |

### Local Development

Use this path when working on private epic branches such as
`feature/native-map-view-epic-05`.

First-time setup or after resetting local containers:

```bash
./deploy.sh local
```

This starts local services, installs dependencies, verifies the local database
schema, and exits. It does not start the app and it does not require any
`/etc/hosts` changes.

Start the full app:

```bash
./deploy.sh start
```

Use this when you need the frontend, backend, and worker together. It delegates
to the repository's existing Nx targets with local environment defaults.

For normal frontend/backend development, use the lighter hot-reload path:

```bash
./deploy.sh watch
```

By default, the local wrappers use the standard Twenty localhost URLs:

```text
Frontend: http://localhost:3001
Server:   http://localhost:3000
```

The frontend dev server is bound through `VITE_HOST=::` by default so local
browser clients that resolve `localhost` as either `::1` or `127.0.0.1` can
reach the same Vite process. Override this with `TWENTY_LOCAL_FRONTEND_BIND_HOST`
only when debugging host binding behavior.

If `http://localhost:3001` serves the Vite HTML but the browser stays blank,
try `http://127.0.0.1:3001` as a diagnostic only. If that works, the server is
healthy and the failure is host-scoped browser state under `localhost` from
another local Twenty app, such as old auth storage, cookies, cache, or a service
worker. Do not use `127.0.0.1` as the final isolation strategy with the default
wrapper, because the frontend still talks to `http://localhost:3000` for API
auth and can still send stale `localhost` tokens. Clear site data for
`localhost` once, or use isolated browser-cookie mode below for this repo.

If you are running more than one local Twenty app in the same browser, opt into
isolated browser-cookie mode:

```bash
TWENTY_GEO_ISOLATED_HOST=1 ./deploy.sh watch
```

This mode requires this `/etc/hosts` entry:

```text
127.0.0.2 twenty-geo.localhost
```

Isolated mode serves Twenty Geo at `http://twenty-geo.localhost:3001` and binds
the frontend to `127.0.0.2`, so `http://localhost:3001` cannot reach it. This is
local-only because Twenty auth uses cookies, and cookies are scoped by hostname,
not port.

To use isolated mode without leaving a permanent hosts entry, run it from a
temporary shell wrapper:

```bash
sudo -v
sudo sh -c "printf '\n# twenty-geo temporary host\n127.0.0.2 twenty-geo.localhost\n' >> /etc/hosts"
trap 'sudo sed -i.bak "/# twenty-geo temporary host/d;/127.0.0.2 twenty-geo.localhost/d" /etc/hosts' EXIT INT TERM
TWENTY_GEO_ISOLATED_HOST=1 ./deploy.sh watch
```

The trap removes the temporary entry when the shell exits normally or receives
`INT`/`TERM`. Cleanup is best-effort: if the terminal is force-killed or the
machine shuts down unexpectedly, remove the marked hosts entry manually.

This starts:

```bash
env -u NO_COLOR CHOKIDAR_USEPOLLING=1 CHOKIDAR_INTERVAL=1000 \
  FRONTEND_URL=http://localhost:3001 SERVER_URL=http://localhost:3000 \
  yarn nx run twenty-server:start --excludeTaskDependencies

env -u NO_COLOR VITE_HOST=:: \
  REACT_APP_SERVER_BASE_URL=http://localhost:3000 \
  yarn nx run twenty-front:start --excludeTaskDependencies
```

The backend target runs Nest in `--watch` mode and the frontend target runs the
Vite dev server with HMR enabled. The backend watcher uses Chokidar polling by
default because native macOS file watching can fail in this repository with
`EMFILE: too many open files, watch`, especially while watching
`packages/twenty-server/dist`.

The local wrapper also raises the file descriptor limit to `65536` by default
when the shell allows it. Override the watch settings when needed:

```bash
TWENTY_GEO_WATCH_ULIMIT=20000 \
TWENTY_GEO_WATCH_INTERVAL=500 \
./scripts/local/watch-twenty-dev.sh
```

To opt back into native backend file watching:

```bash
TWENTY_GEO_WATCH_POLLING=0 ./scripts/local/watch-twenty-dev.sh
```

Expected local URLs:

```text
Frontend: http://localhost:3001
Apple workspace: http://apple.localhost:3001
Backend: http://localhost:3000
GraphQL: http://localhost:3000/graphql
Health: http://localhost:3000/healthz
```

Use the seeded development login if prompted:

```text
tim@apple.dev
tim@apple.dev
```

For Epic 2 browser smoke testing:

1. Open `http://apple.localhost:3001/objects/companies`.
2. Sign in as `tim@apple.dev`.
3. Open the Companies view picker.
4. Create a `Map` view and leave `Address` selected as the address field.
5. Confirm markers render for seeded companies with address coordinates.

If the standard start path hangs on Nx dependency tasks in this local branch,
use the direct development fallback in separate terminals:

```bash
bash packages/twenty-utils/setup-dev-env.sh
NO_COLOR=1 yarn nx run twenty-server:start --excludeTaskDependencies
NO_COLOR=1 yarn nx run twenty-front:start --excludeTaskDependencies
```

If the frontend reports stale Vite optimized dependency files, stop the
frontend process, clear the local Vite cache, and restart the frontend:

```bash
rm -rf node_modules/.vite/packages/twenty-front
NO_COLOR=1 yarn nx run twenty-front:start --excludeTaskDependencies
```

### Local Test Matrix

Run the focused map-view check before every handoff:

```bash
./scripts/local/check-map-view.sh
```

That command builds the workspace packages needed by the tests and then runs:

```bash
NO_COLOR=1 yarn jest --config packages/twenty-front/jest.config.mjs \
  packages/twenty-front/src/modules/object-record/record-map/utils/__tests__/extractRecordMapCoordinates.test.ts \
  --runInBand

NO_COLOR=1 yarn jest --config packages/twenty-server/jest.config.mjs \
  packages/twenty-server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/validators/services/__tests__/flat-view-validator.service.spec.ts \
  --runInBand
```

Do not run raw root `jest` for these tests. In this monorepo it can scan built
`dist` and Nx cache artifacts, producing duplicate mock warnings and incorrect
TypeScript parsing.

Before moving work toward an upstream PR, also run the relevant broader checks
for touched packages:

```bash
npx nx lint:diff-with-main twenty-front
npx nx lint:diff-with-main twenty-server
npx nx typecheck twenty-front
npx nx typecheck twenty-server
git diff --check
```

For schema, migration, metadata, or GraphQL changes, also run the generation and
migration validation commands required by the root `AGENTS.md`.

### Remote Validation

Remote validation means validating the upstream-ready branch for the specific
PR being submitted and its CI surface, not deploying this private planning
branch.

Use a clean PR branch based on `upstream/main` for each PR:

```bash
git fetch upstream
git switch upstream/native-map-view-pr-02-map-mvp
git rebase upstream/main
```

Move only upstream-ready code, tests, migrations, generated files, and
maintainer-facing docs into that branch. Keep these local-only workflow files out
of the PR:

```text
docs/plan/**
AGENTS.md
deploy.sh
scripts/local/**
```

Verify the remote PR diff before pushing:

```bash
git diff --name-status upstream/main...HEAD
git diff --check upstream/main...HEAD
```

Push to the fork and open a draft PR:

```bash
git push -u origin upstream/native-map-view-pr-02-map-mvp
gh pr create \
  --repo twentyhq/twenty \
  --base main \
  --head daniel-fink:upstream/native-map-view-pr-02-map-mvp \
  --draft
```

After CI starts, use the GitHub PR checks as the remote test signal. If CI finds
issues, fix them on the private epic branch when local workflow context is
needed, then replay only the upstream-ready patch back to
the matching `upstream/native-map-view-pr-*` branch.

### Development Vs Production Deploy

Development deploy for this work is local only:

```bash
./deploy.sh local
./deploy.sh start
```

For day-to-day code iteration, prefer:

```bash
./deploy.sh watch
```

Production deploy is out of scope for the private Epic 2 workflow. The map-view
change should reach production only through Twenty's normal upstream review,
merge, release, and deployment process. Do not deploy private
`feature/native-map-view-*` branches to a production Twenty environment.

If a production-like smoke test is needed before upstreaming, use a temporary
remote development environment built from the clean upstream PR branch, then run
the same browser smoke test against that environment:

1. Open the seeded or prepared workspace.
2. Create a Companies `Map` view using an active `Address` field.
3. Confirm markers render.
4. Confirm filters and sorts update the mapped records.
5. Confirm clicking a marker opens the record through existing record-index
   behavior.

### Data Reset

Reset local map-ready data when the workspace state is stale:

```bash
./scripts/local/reset-map-dev-data.sh
```

This reseeds development records with company address latitude and longitude
fixtures used by Epic 2 map-view testing. It is a local development operation;
do not run it against remote or production data.

## Preparing Maintainer-Facing PRs

Keep planning/setup work separate from branches that will be proposed to Twenty
maintainers.

Use these branch roles:

- `feature/native-map-view`: private planning/setup branch. It can contain
  `docs/plan`, `AGENTS.md`, local scripts, and other Codex workflow material.
- `feature/native-map-view-epic-*`: private implementation branches for local
  development. These branches may start from `feature/native-map-view` so Epic 1
  tooling remains on disk while building later epics. Complete epic work can
  live here before it is split into reviewable upstream branches.
- `upstream/native-map-view-pr-*`: clean PR-ready branches based on
  `upstream/main`, one branch per upstream PR. Only code, tests, migrations,
  generated files, and docs that should be reviewed by Twenty maintainers
  should be committed here.

Never open a PR from the private planning branch unless the `Files changed` tab
has been checked and local-only files have been removed.

Day-to-day development can happen on a private epic branch so `scripts/local/**`,
`AGENTS.md`, `deploy.sh`, and `docs/plan/**` remain available. Treat that branch
as the working area, not the branch proposed upstream. When a change set is ready
for maintainer review, copy or replay only the upstream-ready files into
the matching `upstream/native-map-view-pr-*` branch.

The intended flow is to do the epic work locally first, then curate it into
separate upstream branches that can be submitted one-by-one. The current clean
upstream branch sequence is:

- `upstream/native-map-view-pr-02-map-mvp`
- `upstream/native-map-view-pr-03-geometry-foundation`
- `upstream/native-map-view-pr-04-hardening`
- `upstream/native-map-view-pr-05-reference-layers` (planned)

Each upstream PR branch should have a single coherent review scope. Later PR
branches may be based on an earlier upstream PR branch when they truly depend on
it, but rebase them onto `upstream/main` as earlier PRs merge.

### Start Or Refresh A Clean PR Branch

```bash
git fetch upstream
git switch upstream/native-map-view-pr-02-map-mvp
git rebase upstream/main
```

If the PR branch should be reset to a clean upstream base before adding a new
change set:

```bash
git fetch upstream
git switch upstream/native-map-view-pr-02-map-mvp
git reset --hard upstream/main
```

Only use `git reset --hard` on the PR-ready branch after confirming it has no
unpublished work you need to keep.

### Move Intended Changes Into The PR Branch

Prefer developing with local tooling available, then moving a small reviewed
change set into the matching `upstream/native-map-view-pr-*` branch.

If committed work was done on a private branch, move only the intended files or
commits:

```bash
git switch upstream/native-map-view-pr-02-map-mvp
git restore --source feature/native-map-view-epic-02 -- path/to/upstream-ready-file.ts
```

For uncommitted work on a private branch, first inspect the exact file list:

```bash
git status --short
git diff --name-status
```

Then copy only upstream-ready files into the PR branch:

```bash
git switch upstream/native-map-view-pr-02-map-mvp
git restore --source feature/native-map-view-epic-02 -- path/to/upstream-ready-file.ts
git status --short
```

Do not use a broad restore, checkout, or cherry-pick that brings local-only files
into the PR branch. If several files are needed, list them explicitly.

For a commit that contains only upstream-ready changes:

```bash
git switch upstream/native-map-view-pr-02-map-mvp
git cherry-pick <commit-sha>
```

For a mixed commit, stage it without committing, then remove local-only files:

```bash
git switch upstream/native-map-view-pr-02-map-mvp
git cherry-pick --no-commit <commit-sha>
git restore --staged --worktree -- AGENTS.md deploy.sh scripts/local docs/plan
git status --short
```

Local-only files that should normally stay out of upstream PRs:

- `docs/plan/**`
- `AGENTS.md`
- `deploy.sh`
- `scripts/local/**`

### Verify The PR Diff

Before every push or PR update:

```bash
git diff --name-status upstream/main...HEAD
git diff --check upstream/main...HEAD
if git diff --name-only upstream/main...HEAD |
  rg '^(AGENTS\.md|deploy\.sh|docs/plan/|scripts/local/)'; then
  echo 'Local-only files are present in the PR diff'
  exit 1
fi
```

The file list should contain only the intentional upstream changes for the
current PR. If planning or workflow files appear, remove them before pushing.

Do not rely on `.git/info/exclude` to hide private planning files. That local
ignore rule previously made restored documentation invisible to normal Git
status checks. Keep these files tracked on private branches, then remove or omit
them explicitly when preparing an upstream PR branch.

Run focused validation for the touched packages. Common examples:

```bash
npx nx lint:diff-with-main twenty-front
npx nx lint:diff-with-main twenty-server
npx nx typecheck twenty-front
npx nx typecheck twenty-server
```

For schema or GraphQL changes, also run the relevant generation and migration
commands described in the root `AGENTS.md`.

### Push To The Fork

```bash
git push -u origin upstream/native-map-view-pr-02-map-mvp
```

Use force-with-lease after rebasing an already-pushed PR branch:

```bash
git push --force-with-lease
```

### Open The PR Against Twenty

Open a draft PR first unless the change is already fully validated:

```bash
gh pr create \
  --repo twentyhq/twenty \
  --base main \
  --head daniel-fink:upstream/native-map-view-pr-02-map-mvp \
  --draft \
  --title "Add native map view foundation" \
  --body-file /tmp/twenty-map-view-pr.md
```

Before marking ready for review:

- Re-check the GitHub `Files changed` tab.
- Confirm no local-only planning/setup files are included.
- Confirm tests and generated artifacts match the change.
- Rebase on `upstream/main` and push with `--force-with-lease` if upstream has
  moved.
