import {
  MAP_VECTOR_TILE_BUFFER,
  MAP_VECTOR_TILE_EXTENT,
  MAP_VECTOR_TILE_LAYER_NAME,
  MAP_VECTOR_TILE_MAX_FEATURES,
  MAP_VECTOR_TILE_SIMPLIFICATION_MAX_ZOOM,
  WEB_MERCATOR_WORLD_WIDTH_METERS,
} from 'src/engine/core-modules/geo-map/constants/map-vector-tile.constants';

type BuildMapVectorTileSqlArgs = {
  sourceQuery: string;
  geometryColumnName: string;
  z: number;
  x: number;
  y: number;
};

type BuildMapGeometryBoundsSqlArgs = {
  sourceQuery: string;
  geometryColumnName: string;
};

const SQL_IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const quoteSqlIdentifier = (identifier: string) => {
  if (!SQL_IDENTIFIER_REGEX.test(identifier)) {
    throw new Error(`Invalid SQL identifier: ${identifier}`);
  }

  return `"${identifier}"`;
};

export const computeMapVectorTileSimplificationTolerance = (z: number) => {
  if (z >= MAP_VECTOR_TILE_SIMPLIFICATION_MAX_ZOOM) {
    return 0;
  }

  return Number(
    (
      WEB_MERCATOR_WORLD_WIDTH_METERS /
      (2 ** z * MAP_VECTOR_TILE_EXTENT * 2)
    ).toFixed(6),
  );
};

export const buildMapVectorTileSql = ({
  sourceQuery,
  geometryColumnName,
  z,
  x,
  y,
}: BuildMapVectorTileSqlArgs) => {
  const tileBounds3857 = `ST_TileEnvelope(${z}, ${x}, ${y})`;
  const tileBounds4326 = `ST_Transform(${tileBounds3857}, 4326)`;
  const geometryColumnReference = `tile_source.${quoteSqlIdentifier(geometryColumnName)}`;
  const clippedGeometry4326 = `ST_Intersection(${geometryColumnReference}, ${tileBounds4326})`;
  const clippedBoundary4326 = `ST_Intersection(ST_Boundary(${geometryColumnReference}), ${tileBounds4326})`;
  const geometry3857 = `ST_Transform(${clippedGeometry4326}, 3857)`;
  const boundary3857 = `ST_Transform(${clippedBoundary4326}, 3857)`;
  const simplificationTolerance =
    computeMapVectorTileSimplificationTolerance(z);
  const tileGeometryExpression =
    simplificationTolerance > 0
      ? `ST_SimplifyPreserveTopology(${geometry3857}, ${simplificationTolerance})`
      : geometry3857;
  const tileBoundaryExpression =
    simplificationTolerance > 0
      ? `ST_SimplifyPreserveTopology(${boundary3857}, ${simplificationTolerance})`
      : boundary3857;

  return `
    WITH source_rows AS (
      SELECT
        tile_source."id" AS "id",
        ${geometryColumnReference} AS "geometry"
      FROM (${sourceQuery}) tile_source
      LIMIT ${MAP_VECTOR_TILE_MAX_FEATURES}
    ),
    tile_fill_rows AS (
      SELECT
        tile_source."id" AS "id",
        ST_AsMVTGeom(
          ${tileGeometryExpression},
          ${tileBounds3857},
          ${MAP_VECTOR_TILE_EXTENT},
          ${MAP_VECTOR_TILE_BUFFER},
          true
        ) AS "geom"
      FROM source_rows tile_source
    ),
    tile_boundary_rows AS (
      SELECT
        tile_source."id" AS "id",
        ST_AsMVTGeom(
          ${tileBoundaryExpression},
          ${tileBounds3857},
          ${MAP_VECTOR_TILE_EXTENT},
          ${MAP_VECTOR_TILE_BUFFER},
          true
        ) AS "geom"
      FROM source_rows tile_source
      WHERE ST_Dimension(${geometryColumnReference}) = 2
    ),
    tile_rows AS (
      SELECT "id", "geom" FROM tile_fill_rows
      UNION ALL
      SELECT "id", "geom" FROM tile_boundary_rows
    )
    SELECT ST_AsMVT(
      tile_rows,
      '${MAP_VECTOR_TILE_LAYER_NAME}',
      ${MAP_VECTOR_TILE_EXTENT},
      'geom'
    ) AS "tile"
    FROM tile_rows;
  `;
};

export const buildMapGeometryBoundsSql = ({
  sourceQuery,
  geometryColumnName,
}: BuildMapGeometryBoundsSqlArgs) => {
  const geometryColumnReference = `bounds_source.${quoteSqlIdentifier(geometryColumnName)}`;

  return `
    WITH bounds_rows AS (
      SELECT
        ${geometryColumnReference} AS "geometry"
      FROM (${sourceQuery}) bounds_source
    )
    SELECT
      COUNT(*)::integer AS "recordCount",
      CASE
        WHEN COUNT(*) = 0 THEN NULL
        ELSE json_build_array(
          ST_XMin(ST_Extent("geometry"))::float8,
          ST_YMin(ST_Extent("geometry"))::float8,
          ST_XMax(ST_Extent("geometry"))::float8,
          ST_YMax(ST_Extent("geometry"))::float8
        )
      END AS "bounds"
    FROM bounds_rows;
  `;
};
