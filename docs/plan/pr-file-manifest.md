# PR File Manifest

This manifest separates files used for private local development from files that
can be moved into maintainer-facing Twenty PR branches.

Use this as the source of truth before preparing any
`upstream/native-map-view-pr-*` branch. The PR branch should contain only the
files needed for that specific review scope.

## Local-Only Files

These files must stay out of upstream PR branches:

```text
AGENTS.md
deploy.sh
docs/plan/**
scripts/local/**
```

Why:

- `AGENTS.md` is Codex-specific workflow guidance. Upstream already has
  `CLAUDE.md`.
- `deploy.sh` and `scripts/local/**` are private convenience wrappers for this
  working tree.
- `docs/plan/**` contains private planning, branch choreography, and PR staging
  notes, not maintainer-facing product documentation.

The optional local host-isolation workflow belongs in these local-only files.
Twenty stores auth in cookies, and browser cookies are host-scoped rather than
port-scoped, so multiple apps on `localhost` can collide even when they use
different ports. By default, the private launcher still uses normal
`localhost`. Developers who need multiple local Twenty apps can opt in with
`TWENTY_GEO_ISOLATED_HOST=1`; that mode uses `twenty-geo.localhost` on
`127.0.0.2` to keep cookies separate without changing upstream source.

## Upstream-Candidate Files

These files may be moved into upstream PR branches when they are part of the
specific PR scope:

```text
packages/twenty-client-sdk/**
packages/twenty-front/**
packages/twenty-server/**
packages/twenty-shared/**
packages/twenty-ui/**
yarn.lock
```

Include generated files only when they are required by Twenty's normal workflow,
for example generated GraphQL/schema artifacts after backend schema changes.

## Needs Explicit Review

These files are not automatically local-only, but they need extra scrutiny
before inclusion because they affect developer setup, packaging, deployment, or
repository-wide behavior:

```text
.gitignore
package.json
nx.json
tsconfig.base.json
packages/twenty-docker/**
packages/twenty-utils/**
```

Only include these when the PR's stated scope requires them and the change is
generic enough for the main Twenty repository.

## Current Working-Tree Notes

As of this private Epic 05 branch, the uncommitted local-only edits are:

```text
AGENTS.md
deploy.sh
docs/plan/README.md
docs/plan/epic-05-reference-geospatial-layer-registry.md
docs/plan/epic-06-pr-positioning.md
docs/plan/pr-file-manifest.md
```

The uncommitted upstream-candidate edits are:

```text
(none)
```

Re-check this section before using it for any later PR preparation.

## Cleanliness Gate

Run this before pushing any maintainer-facing branch:

```bash
git diff --name-only upstream/main...HEAD |
  rg '^(AGENTS\.md|deploy\.sh|docs/plan/|scripts/local/)'
```

If the command prints any path, the branch still contains local-only files and
is not ready to open against the main Twenty repository.
