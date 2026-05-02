# Geo Map Tile Benchmarks

Geo map benchmarks exercise the authenticated Mapbox Vector Tile endpoint for
map views:

```bash
npx nx run twenty-server:command workspace:benchmark:geo-map-tiles \
  --base-url http://localhost:3000 \
  --token <access-token> \
  --view-id <map-view-id>
```

Prerequisites:

- A running Twenty server reachable from `--base-url`.
- A valid access token for the target workspace.
- A map view id whose selected map field contains supported GeoJSON geometry.

The command writes JSON metrics to
`.local/geo-map-benchmarks/results/latest.json` by default. Use a short smoke
set while iterating:

```bash
npx nx run twenty-server:command workspace:benchmark:geo-map-tiles \
  --base-url http://localhost:3000 \
  --token <access-token> \
  --view-id <map-view-id> \
  --tiles 0/0/0,4/8/5,12/2048/1365 \
  --iterations 1
```

Tile coordinates are validated before requests are sent. Each coordinate must
be `z/x/y`, use non-negative integers, and keep `x` and `y` inside the zoom
range (`0..2^z-1`).

Supported geometry inputs are GeoJSON `Point`, `Polygon`, and `MultiPolygon`
using WGS84 coordinates.

## Real-World Datasets

Prepare a GeoJSONSeq import file with GDAL installed:

```bash
bash packages/twenty-utils/scripts/geo-map-benchmarks/prepare-real-world-dataset.sh \
  natural-earth-admin0 \
  .local/geo-map-benchmarks/natural-earth-admin0.geojsonseq
```

Then import it into a workspace benchmark object:

```bash
npx nx run twenty-server:command workspace:import:geo-map-real-benchmark \
  --workspace-id <workspace-id> \
  --input-path .local/geo-map-benchmarks/natural-earth-admin0.geojsonseq \
  --create-map-view
```

For Microsoft building footprint imports, set
`MICROSOFT_US_BUILDINGS_SOURCE_URL` to a state or regional GeoJSON/GeoJSONSeq
file. Building benchmark objects get a default tile policy of `minZoom: 13` and
`maxZoom: 22` to avoid expensive low-zoom building tiles.

## Tile Policy Knobs

Synthetic and real-world benchmark import commands accept:

```bash
--map-min-zoom <0..22>
--map-max-zoom <0..22>
--map-max-feature-count <positive integer>
```

These values are stored on the geometry field settings and are merged with any
view-level map tile policy at request time. View policy values override field
policy values. The tile endpoint returns an empty tile outside the resolved zoom
policy.

## Security Invariants

The benchmark and tile tests cover these invariants:

- SQL identifier inputs are allow-listed before interpolation.
- Tile endpoint filters must be JSON objects, not arrays or scalar values.
- Request filters are combined with saved map view filters before query
  generation.
- Vector tile rows expose only the record `id` property and the internal `geom`
  column needed by `ST_AsMVT`.
- Benchmark smoke tile coordinates cannot exceed the legal x/y range for their
  zoom.
