#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

EXPECTED_NODE_MAJOR="24"
EXPECTED_NODE_MIN_MINOR="5"
EXPECTED_YARN_MAJOR="4"

log() {
  printf '[twenty-geo] %s\n' "$*"
}

die() {
  printf '[twenty-geo] ERROR: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<'USAGE'
Usage:
  ./deploy.sh bootstrap
  ./deploy.sh local
  ./deploy.sh dev
  ./deploy.sh start
  ./deploy.sh watch
  ./deploy.sh reseed
  ./deploy.sh test-map-view
  ./deploy.sh check
  ./deploy.sh help

Commands:
  bootstrap
    Bootstrap local services and install dependencies without modifying the
    existing development database.

  local
    Bootstrap local services, install dependencies, verify the local database
    schema, then exit.

  dev
    Bootstrap local services, install dependencies, verify the local database
    schema, then start frontend, backend, and worker. This is a long-running
    command.

  start
    Start frontend, backend, and worker through the existing monorepo start
    command.

  watch
    Start the frontend Vite dev server and backend Nest watcher for hot-reload
    development. This does not start the worker.

  reseed
    Destructively reset the database and reseed development records.

  test-map-view
    Build required workspace packages and run focused Epic 2 map-view tests.

  check
    Verify required tooling and run lightweight initialization checks.

Local URLs after start:
  Frontend: http://localhost:3001
  Server:   http://localhost:3000
  GraphQL:  http://localhost:3000/graphql
USAGE
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

check_node() {
  require_command node

  local current_node_version
  current_node_version="$(node --version)"
  local node_version_without_prefix="${current_node_version#v}"
  local current_node_major="${node_version_without_prefix%%.*}"
  local node_version_remainder="${node_version_without_prefix#*.}"
  local current_node_minor="${node_version_remainder%%.*}"

  if [[ "$current_node_major" != "$EXPECTED_NODE_MAJOR" ]] ||
    (( current_node_minor < EXPECTED_NODE_MIN_MINOR )); then
    die "Expected Node ^24.5.0, found $current_node_version. Run: nvm use 24.5.0"
  fi

  log "Node version OK: $current_node_version"
}

check_yarn() {
  require_command corepack
  require_command yarn

  local current_yarn_version
  current_yarn_version="$(yarn --version)"

  if [[ "${current_yarn_version%%.*}" != "$EXPECTED_YARN_MAJOR" ]]; then
    die "Expected Yarn $EXPECTED_YARN_MAJOR.x, found $current_yarn_version. Run: corepack enable"
  fi

  log "Yarn version OK: $current_yarn_version"
}

check_required_tools() {
  check_node
  check_yarn
  require_command npx
}

run_bootstrap() {
  check_required_tools

  log "Starting local PostgreSQL and Redis services"
  bash packages/twenty-utils/setup-dev-env.sh

  log "Installing dependencies"
  yarn install --immutable

  log "Local Twenty development environment is ready"
  log "Database was left unchanged. To reset/reseed intentionally, run: ./deploy.sh reseed"
}

run_local() {
  run_bootstrap

  check_database_schema

  log "Local Twenty development environment is ready"
  log "Start the full app with: ./deploy.sh dev"
}

run_dev() {
  run_bootstrap

  check_database_schema

  run_start
}

run_start() {
  check_required_tools
  log "Starting Twenty development processes"
  yarn start
}

check_database_schema() {
  log "Checking local database schema"

  node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((values, line) => {
      const trimmedLine = line.trim();

      if (trimmedLine === '' || trimmedLine.startsWith('#')) {
        return values;
      }

      const separatorIndex = trimmedLine.indexOf('=');

      if (separatorIndex === -1) {
        return values;
      }

      const key = trimmedLine.slice(0, separatorIndex).trim();
      const value = trimmedLine.slice(separatorIndex + 1).trim();

      values[key] = value.replace(/^['"]|['"]$/g, '');

      return values;
    }, {});
};

const envFileValues = parseEnvFile(
  path.join(process.cwd(), 'packages/twenty-server/.env'),
);
const databaseUrl =
  process.env.PG_DATABASE_URL ||
  envFileValues.PG_DATABASE_URL ||
  'postgres://postgres:postgres@localhost:5432/default';

let Client;

try {
  ({ Client } = require('pg'));
} catch (error) {
  console.error(
    'Unable to load the pg package. Run `yarn install --immutable` before starting local development.',
  );
  process.exit(2);
}

const client = new Client({ connectionString: databaseUrl });

const requiredTables = ['appToken', 'keyValuePair'];

(async () => {
  try {
    await client.connect();

    const result = await client.query(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'core'
          AND table_name = ANY($1)
      `,
      [requiredTables],
    );

    const existingTables = new Set(
      result.rows.map((row) => row.table_name),
    );
    const missingTables = requiredTables.filter(
      (tableName) => !existingTables.has(tableName),
    );

    if (missingTables.length > 0) {
      console.error(
        [
          'Local database schema is not initialized.',
          `Missing core table(s): ${missingTables.join(', ')}`,
          '',
          'Run: ./deploy.sh reseed',
          'This destructively resets and seeds the local development database.',
        ].join('\n'),
      );
      process.exit(1);
    }
  } catch (error) {
    console.error(
      [
        'Unable to verify the local database schema.',
        error instanceof Error ? error.message : String(error),
      ].join('\n'),
    );
    process.exit(1);
  } finally {
    await client.end().catch(() => undefined);
  }
})();
NODE

  log "Local database schema OK"
}

run_watch() {
  check_required_tools

  local watch_ulimit="${TWENTY_GEO_WATCH_ULIMIT:-65536}"
  local watch_polling="${TWENTY_GEO_WATCH_POLLING:-1}"
  local watch_interval="${TWENTY_GEO_WATCH_INTERVAL:-1000}"

  if ulimit -n "$watch_ulimit" 2>/dev/null; then
    log "File descriptor limit set to $(ulimit -n) for watch processes"
  else
    log "Could not raise file descriptor limit to $watch_ulimit; continuing with $(ulimit -n)"
  fi

  if [[ "$watch_polling" != "0" && "$watch_polling" != "false" ]]; then
    log "Backend watcher polling enabled with ${watch_interval}ms interval"
  else
    log "Backend watcher polling disabled; native file watching may hit EMFILE"
  fi

  log "Starting frontend and backend hot-reload processes"
  npx concurrently --kill-others --names twenty-server,twenty-front \
    "env -u NO_COLOR CHOKIDAR_USEPOLLING=$watch_polling CHOKIDAR_INTERVAL=$watch_interval yarn nx run twenty-server:start --excludeTaskDependencies" \
    "env -u NO_COLOR yarn nx run twenty-front:start --excludeTaskDependencies"
}

run_reseed() {
  check_required_tools
  log "Resetting and reseeding development data"
  npx nx database:reset twenty-server
}

run_test_map_view() {
  check_required_tools

  log "Building twenty-shared for workspace package imports"
  NO_COLOR=1 yarn nx run twenty-shared:build --excludeTaskDependencies

  log "Building twenty-ui for frontend workspace imports"
  NO_COLOR=1 yarn nx run twenty-ui:build --excludeTaskDependencies

  log "Running frontend map coordinate extraction tests"
  NO_COLOR=1 yarn jest --config packages/twenty-front/jest.config.mjs \
    packages/twenty-front/src/modules/object-record/record-map/utils/__tests__/extractRecordMapCoordinates.test.ts \
    --runInBand

  log "Running backend map view validation tests"
  NO_COLOR=1 yarn jest --config packages/twenty-server/jest.config.mjs \
    packages/twenty-server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/validators/services/__tests__/flat-view-validator.service.spec.ts \
    --runInBand

  log "Map view checks passed"
}

run_check() {
  check_required_tools

  log "Checking shell scripts"
  bash -n deploy.sh
  bash -n scripts/local/bootstrap-twenty-map-dev.sh
  bash -n scripts/local/start-twenty-dev.sh
  bash -n scripts/local/watch-twenty-dev.sh
  bash -n scripts/local/reseed.sh
  bash -n scripts/local/check-map-view.sh

  if [[ -f node_modules/.yarn-state.yml ]]; then
    log "Checking Nx project metadata"
    yarn nx show project twenty-front >/dev/null
    yarn nx show project twenty-server >/dev/null
  else
    log "Skipping Nx project metadata because dependencies are not installed"
    log "Run yarn install --immutable or ./deploy.sh local to enable Nx checks"
  fi

  log "Initialization checks passed"
}

main() {
  local command="${1:-help}"

  case "$command" in
    bootstrap)
      run_bootstrap
      ;;
    local)
      run_local
      ;;
    dev)
      run_dev
      ;;
    start)
      run_start
      ;;
    watch)
      run_watch
      ;;
    reseed)
      run_reseed
      ;;
    test-map-view)
      run_test_map_view
      ;;
    check)
      run_check
      ;;
    help | --help | -h)
      usage
      ;;
    *)
      usage >&2
      die "Unknown command: $command"
      ;;
  esac
}

main "$@"
