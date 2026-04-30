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
  ./deploy.sh local
  ./deploy.sh start
  ./deploy.sh reset-map-dev-data
  ./deploy.sh check
  ./deploy.sh help

Commands:
  local
    Bootstrap local services, install dependencies, and reset/seed the Twenty
    development database with map-ready address fixture data.

  start
    Start frontend, backend, and worker through the existing monorepo start
    command.

  reset-map-dev-data
    Reset the database and reseed development records, including company
    address latitude and longitude fixtures used by map-view work.

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

run_local() {
  check_required_tools

  log "Starting local PostgreSQL and Redis services"
  bash packages/twenty-utils/setup-dev-env.sh

  log "Installing dependencies"
  yarn install --immutable

  log "Resetting and seeding development database"
  npx nx database:reset twenty-server

  log "Local Twenty development environment is ready"
}

run_start() {
  check_required_tools
  log "Starting Twenty development processes"
  yarn start
}

run_reset_map_dev_data() {
  check_required_tools
  log "Resetting and seeding map development data"
  npx nx database:reset twenty-server
}

run_check() {
  check_required_tools

  log "Checking shell scripts"
  bash -n deploy.sh
  bash -n scripts/local/bootstrap-twenty-map-dev.sh
  bash -n scripts/local/start-twenty-dev.sh
  bash -n scripts/local/reset-map-dev-data.sh
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
    local)
      run_local
      ;;
    start)
      run_start
      ;;
    reset-map-dev-data)
      run_reset_map_dev_data
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
