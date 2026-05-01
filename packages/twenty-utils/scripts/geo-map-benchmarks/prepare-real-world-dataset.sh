#!/usr/bin/env bash
set -euo pipefail

DATASET="${1:-}"
OUTPUT_PATH="${2:-}"
CACHE_DIR="${GEO_MAP_BENCHMARK_CACHE_DIR:-.local/geo-map-benchmarks/cache}"
LIMIT="${GEO_MAP_BENCHMARK_LIMIT:-0}"

if [[ -z "${DATASET}" || -z "${OUTPUT_PATH}" ]]; then
  echo "Usage: $0 <nybb|natural-earth-admin0|natural-earth-admin1|microsoft-us-buildings> <output.geojsonseq>"
  exit 1
fi

mkdir -p "${CACHE_DIR}" "$(dirname "${OUTPUT_PATH}")"

run_ogr2ogr() {
  docker run --rm \
    -v "${PWD}:/workspace" \
    -w /workspace \
    ghcr.io/osgeo/gdal:ubuntu-small-latest \
    ogr2ogr "$@"
}

download() {
  local url="$1"
  local output="$2"

  if [[ ! -f "${output}" ]]; then
    curl -L "${url}" -o "${output}"
  fi
}

case "${DATASET}" in
  nybb)
    download "https://www.nyc.gov/assets/planning/download/zip/data-maps/open-data/nybb_16a.zip" "${CACHE_DIR}/nybb_16a.zip"
    SOURCE="/vsizip//workspace/${CACHE_DIR}/nybb_16a.zip/nybb_16a/nybb.shp"
    ;;
  natural-earth-admin0)
    download "https://naciscdn.org/naturalearth/110m/cultural/ne_110m_admin_0_countries.zip" "${CACHE_DIR}/natural-earth-admin0.zip"
    SOURCE="/vsizip//workspace/${CACHE_DIR}/natural-earth-admin0.zip"
    ;;
  natural-earth-admin1)
    download "https://naciscdn.org/naturalearth/110m/cultural/ne_110m_admin_1_states_provinces.zip" "${CACHE_DIR}/natural-earth-admin1.zip"
    SOURCE="/vsizip//workspace/${CACHE_DIR}/natural-earth-admin1.zip"
    ;;
  microsoft-us-buildings)
    if [[ -z "${MICROSOFT_US_BUILDINGS_SOURCE_URL:-}" ]]; then
      echo "Set MICROSOFT_US_BUILDINGS_SOURCE_URL to a state or regional GeoJSON/GeoJSONSeq file from https://github.com/microsoft/USBuildingFootprints"
      exit 1
    fi
    download "${MICROSOFT_US_BUILDINGS_SOURCE_URL}" "${CACHE_DIR}/microsoft-us-buildings-source"
    SOURCE="/workspace/${CACHE_DIR}/microsoft-us-buildings-source"
    ;;
  *)
    echo "Unknown dataset: ${DATASET}"
    exit 1
    ;;
esac

ARGS=(
  -f GeoJSONSeq
  "/workspace/${OUTPUT_PATH}"
  "${SOURCE}"
  -t_srs EPSG:4326
  -makevalid
  -nlt MULTIPOLYGON
)

if [[ "${LIMIT}" != "0" ]]; then
  ARGS+=(-limit "${LIMIT}")
fi

run_ogr2ogr "${ARGS[@]}"
