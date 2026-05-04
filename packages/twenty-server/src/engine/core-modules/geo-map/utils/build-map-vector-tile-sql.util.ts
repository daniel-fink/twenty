import {
  DEFAULT_MAP_VECTOR_TILE_POLICY,
  MAP_VECTOR_TILE_LAYER_NAME,
  WEB_MERCATOR_WORLD_WIDTH_METERS,
} from 'src/engine/core-modules/geo-map/constants/map-vector-tile.constants';

type BuildMapVectorTileSqlArgs = {
  sourceQuery: string;
  geometryColumnName: string;
  titleColumnName?: string;
  z: number;
  x: number;
  y: number;
  maxFeatures?: number | null;
  extent?: number;
  buffer?: number;
  simplificationMaxZoom?: number;
  simplificationToleranceMultiplier?: number;
  simplificationEnabled?: boolean;
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

export const computeMapVectorTileSimplificationTolerance = ({
  z,
  extent = DEFAULT_MAP_VECTOR_TILE_POLICY.extent,
  simplificationMaxZoom = DEFAULT_MAP_VECTOR_TILE_POLICY.simplification.maxZoom,
  simplificationToleranceMultiplier = DEFAULT_MAP_VECTOR_TILE_POLICY
    .simplification.toleranceMultiplier,
  simplificationEnabled = DEFAULT_MAP_VECTOR_TILE_POLICY.simplification.enabled,
}: {
  z: number;
  extent?: number;
  simplificationMaxZoom?: number;
  simplificationToleranceMultiplier?: number;
  simplificationEnabled?: boolean;
}) => {
  if (
    !simplificationEnabled ||
    simplificationToleranceMultiplier === 0 ||
    z >= simplificationMaxZoom
  ) {
    return 0;
  }

  return Number(
    (
      (WEB_MERCATOR_WORLD_WIDTH_METERS / (2 ** z * extent * 2)) *
      simplificationToleranceMultiplier
    ).toFixed(6),
  );
};

export const computeMapVectorTileSimplificationToleranceForZoom = (
  z: number,
) => {
  return computeMapVectorTileSimplificationTolerance({ z });
};

export const buildMapVectorTileSql = ({
  sourceQuery,
  geometryColumnName,
  titleColumnName,
  z,
  x,
  y,
  maxFeatures = DEFAULT_MAP_VECTOR_TILE_POLICY.maxFeatureCount,
  extent = DEFAULT_MAP_VECTOR_TILE_POLICY.extent,
  buffer = DEFAULT_MAP_VECTOR_TILE_POLICY.buffer,
  simplificationMaxZoom = DEFAULT_MAP_VECTOR_TILE_POLICY.simplification.maxZoom,
  simplificationToleranceMultiplier = DEFAULT_MAP_VECTOR_TILE_POLICY
    .simplification.toleranceMultiplier,
  simplificationEnabled = DEFAULT_MAP_VECTOR_TILE_POLICY.simplification.enabled,
}: BuildMapVectorTileSqlArgs) => {
  const tileBounds3857 = `ST_TileEnvelope(${z}, ${x}, ${y})`;
  const tileBounds4326 = `ST_Transform(${tileBounds3857}, 4326)`;
  const sourceGeometryColumnReference = `tile_source.${quoteSqlIdentifier(geometryColumnName)}`;
  const sourceTitleColumnReference =
    titleColumnName === undefined
      ? null
      : `tile_source.${quoteSqlIdentifier(titleColumnName)}`;
  const tileRowColumns =
    sourceTitleColumnReference === null
      ? '"id", "geom"'
      : '"id", "title", "geom"';
  const tileGeometryColumnReference = `tile_source."geometry"`;
  const clippedGeometry4326 = `ST_Intersection(${tileGeometryColumnReference}, ${tileBounds4326})`;
  const clippedBoundary4326 = `ST_Intersection(ST_Boundary(${tileGeometryColumnReference}), ${tileBounds4326})`;
  const geometry3857 = `ST_Transform(${clippedGeometry4326}, 3857)`;
  const boundary3857 = `ST_Transform(${clippedBoundary4326}, 3857)`;
  const simplificationTolerance = computeMapVectorTileSimplificationTolerance({
    z,
    extent,
    simplificationMaxZoom,
    simplificationToleranceMultiplier,
    simplificationEnabled,
  });
  const tileGeometryExpression =
    simplificationTolerance > 0
      ? `ST_SimplifyPreserveTopology(${geometry3857}, ${simplificationTolerance})`
      : geometry3857;
  const tileBoundaryExpression =
    simplificationTolerance > 0
      ? `ST_SimplifyPreserveTopology(${boundary3857}, ${simplificationTolerance})`
      : boundary3857;
  const featureLimitClause =
    maxFeatures !== null && Number.isInteger(maxFeatures) && maxFeatures > 0
      ? `LIMIT ${maxFeatures}`
      : '';

  return `
    WITH source_rows AS (
      SELECT
        tile_source."id" AS "id",
        ${
          sourceTitleColumnReference === null
            ? ''
            : `${sourceTitleColumnReference} AS "title",`
        }
        ${sourceGeometryColumnReference} AS "geometry"
      FROM (${sourceQuery}) tile_source
      ${featureLimitClause}
    ),
    tile_fill_rows AS (
      SELECT
        tile_source."id" AS "id",
        ${sourceTitleColumnReference === null ? '' : 'tile_source."title",'}
        ST_AsMVTGeom(
          ${tileGeometryExpression},
          ${tileBounds3857},
          ${extent},
          ${buffer},
          true
        ) AS "geom"
      FROM source_rows tile_source
    ),
    tile_boundary_rows AS (
      SELECT
        tile_source."id" AS "id",
        ${sourceTitleColumnReference === null ? '' : 'tile_source."title",'}
        ST_AsMVTGeom(
          ${tileBoundaryExpression},
          ${tileBounds3857},
          ${extent},
          ${buffer},
          true
        ) AS "geom"
      FROM source_rows tile_source
      WHERE ST_Dimension(${tileGeometryColumnReference}) = 2
    ),
    tile_rows AS (
      SELECT ${tileRowColumns} FROM tile_fill_rows
      UNION ALL
      SELECT ${tileRowColumns} FROM tile_boundary_rows
    )
    SELECT ST_AsMVT(
      tile_rows,
      '${MAP_VECTOR_TILE_LAYER_NAME}',
      ${extent},
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
