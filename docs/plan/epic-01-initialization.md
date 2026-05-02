# Epic 01: Initialization and Development Workflow

## Status

Completed as the baseline workflow for native map view development.

This epic establishes:

- Local service bootstrap through Twenty's native setup script.
- Repo-local helper scripts for setup, start, reset, and checks.
- Dev seed data with address coordinates for map-view testing.
- A fork-oriented Git workflow for preparing maintainer-facing PRs.

Current note: this epic is historical. The local workflow files were restored
for private development on `feature/native-map-view-epic-05`. They should stay
tracked on private branches and stay out of `upstream/native-map-view-pr-*`
branches.

## Repository

Local checkout:

```bash
/Volumes/Data/Projects/twenty-geo
```

Upstream repository:

```bash
https://github.com/twentyhq/twenty.git
```

Expected fork remote:

```bash
git@github.com:daniel-fink/twenty.git
```

## Git Workflow

Use `upstream` for the Twenty source repository and `origin` for the personal
fork.

```bash
git remote rename origin upstream
git remote add origin git@github.com:daniel-fink/twenty.git
git fetch upstream
git fetch origin
git checkout -B feature/native-map-view upstream/main
git push -u origin feature/native-map-view
```

Keep the feature branch current with Twenty:

```bash
git fetch upstream
git rebase upstream/main
git push --force-with-lease
```

The eventual PR target is:

```text
twentyhq/twenty:main <- daniel-fink/twenty:feature/native-map-view
```

Current upstream-ready branches use narrower PR-specific names:

- `upstream/native-map-view-pr-02-map-mvp`
- `upstream/native-map-view-pr-03-geometry-foundation`
- `upstream/native-map-view-pr-04-hardening`
- `upstream/native-map-view-pr-05-reference-layers` (planned)

## Runtime Setup

Use Twenty's expected runtime:

```bash
nvm install 24.5.0
nvm use 24.5.0
corepack enable
yarn --version
```

Node `v24.5.0` is the baseline; newer Node `24.x` versions are compatible with
the root `package.json` engine range.

The canonical local service setup remains:

```bash
bash packages/twenty-utils/setup-dev-env.sh
```

That script starts PostgreSQL and Redis, creates `default` and `test`
databases, and copies missing frontend/server `.env` files.

## Helper Scripts

The root `deploy.sh` is the main entry point:

```bash
./deploy.sh local
./deploy.sh start
./deploy.sh reseed
./deploy.sh check
```

Equivalent local helper scripts are available under `scripts/local/`:

```bash
scripts/local/bootstrap-twenty-map-dev.sh
scripts/local/start-twenty-dev.sh
scripts/local/reseed.sh
scripts/local/reset-map-dev-data.sh
scripts/local/check-map-view.sh
```

Script responsibilities:

- Verify Node `^24.5.0`, Yarn 4, `npx`, and Nx project visibility.
- Run Twenty's native dev environment setup.
- Install dependencies with `yarn install --immutable`.
- Reset and seed the development database with `npx nx database:reset twenty-server`.
- Keep the app start command on the existing `yarn start` path.

Expected local URLs after starting the app:

- Frontend: `http://localhost:3001`
- Server: `http://localhost:3000`
- GraphQL: `http://localhost:3000/graphql`

## Map Dev Seed Data

Company dev seeds now include selected `ADDRESS` composite subfields:

- `addressAddressStreet1`
- `addressAddressStreet2`
- `addressAddressCity`
- `addressAddressState`
- `addressAddressPostcode`
- `addressAddressCountry`
- `addressAddressLat`
- `addressAddressLng`

The seed set includes:

- Valid coordinate records in close clusters around the San Francisco Bay Area.
- Valid coordinate records in multiple countries.
- Records with no coordinates.
- A partial-coordinate record for skip-state testing.

No PostGIS, native geometry field, or schema migration is introduced in this
epic.

## Validation

Run lightweight checks:

```bash
./deploy.sh check
```

Run full local bootstrap when services are available:

```bash
./deploy.sh local
```

Start the app:

```bash
./deploy.sh start
```

Verify Git remotes and branch:

```bash
git remote -v
git branch --show-current
git push -u origin feature/native-map-view
```

## Acceptance Criteria

- The repo has a repeatable local setup path.
- The developer can run server, worker, frontend, and tests through existing Nx/Yarn commands.
- The `feature/native-map-view` branch exists for native map view work.
- A repeatable seed-data path exists for map records.
- `upstream` tracks `twentyhq/twenty`; `origin` tracks the personal fork when the fork exists.
- The working tree is clean except intentional planning or feature changes.

## Notes

- Avoid touching website assets during geo PRs because macOS case-insensitive
  filesystems can report collisions.
- Full PostGIS setup waits until the geometry field epic.
- The recovered documentation disappeared because `docs/plan/` was listed in
  `.git/info/exclude`, hiding restored docs from normal Git visibility, and a
  later cleanup commit removed the tracked local workflow files from the current
  branch. Do not use local ignore rules for planning docs or private dev
  tooling.
- The Mark8 `deploy.sh` reference informed the shell dispatcher style and
  strict error handling only; Mark8 engine and container orchestration do not
  apply to this full Twenty monorepo.
