#!/usr/bin/env bash
set -euo pipefail

# Local-only template for loading a pipeline-owned reference layer.
# Required tools: ogr2ogr, psql.
#
# Example:
#   PG_DATABASE_URL=postgres://twenty:twenty@localhost:5432/default \
#   SOURCE_GEOJSON=.local/geo-reference-layers/parcels.geojson \
#   TARGET_SCHEMA=geo_reference_layers \
#   TARGET_TABLE=parcels \
#   GEOMETRY_COLUMN=geometry \
#   SRID=4326 \
#   bash packages/twenty-server/src/engine/core-modules/geo-map/reference-layer-catalog/examples/private/load-postgis-layer.example.sh

: "${PG_DATABASE_URL:?PG_DATABASE_URL is required}"
: "${SOURCE_GEOJSON:?SOURCE_GEOJSON is required}"
: "${TARGET_SCHEMA:?TARGET_SCHEMA is required}"
: "${TARGET_TABLE:?TARGET_TABLE is required}"
: "${GEOMETRY_COLUMN:=geometry}"
: "${SRID:=4326}"

assert_sql_identifier() {
  local value="$1"
  local name="$2"

  if [[ ! "$value" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
    echo "${name} must be a SQL identifier: ${value}" >&2
    exit 1
  fi
}

assert_sql_identifier "$TARGET_SCHEMA" TARGET_SCHEMA
assert_sql_identifier "$TARGET_TABLE" TARGET_TABLE
assert_sql_identifier "$GEOMETRY_COLUMN" GEOMETRY_COLUMN

psql "$PG_DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  "CREATE SCHEMA IF NOT EXISTS \"${TARGET_SCHEMA}\";"

ogr2ogr \
  -f PostgreSQL "PG:${PG_DATABASE_URL}" \
  "$SOURCE_GEOJSON" \
  -nln "${TARGET_SCHEMA}.${TARGET_TABLE}" \
  -lco GEOMETRY_NAME="$GEOMETRY_COLUMN" \
  -lco FID=id \
  -nlt PROMOTE_TO_MULTI \
  -t_srs "EPSG:${SRID}" \
  -overwrite

psql "$PG_DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  "CREATE INDEX IF NOT EXISTS \"IDX_${TARGET_SCHEMA}_${TARGET_TABLE}_${GEOMETRY_COLUMN}_GIST\"
   ON \"${TARGET_SCHEMA}\".\"${TARGET_TABLE}\"
   USING GIST (\"${GEOMETRY_COLUMN}\");"

psql "$PG_DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  "ANALYZE \"${TARGET_SCHEMA}\".\"${TARGET_TABLE}\";"
