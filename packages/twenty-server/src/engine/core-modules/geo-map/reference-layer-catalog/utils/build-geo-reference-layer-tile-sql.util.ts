import { MAP_VECTOR_TILE_MAX_ZOOM } from 'src/engine/core-modules/geo-map/constants/map-vector-tile.constants';
import { type GeoReferenceLayerEntity } from 'src/engine/core-modules/geo-map/entities/geo-reference-layer.entity';
import {
  quoteGeoReferenceSqlIdentifier,
  quoteGeoReferenceSqlQualifiedName,
} from 'src/engine/core-modules/geo-map/reference-layer-catalog/utils/geo-reference-sql.util';

type BuildGeoReferenceLayerTileSqlArgs = {
  layer: GeoReferenceLayerEntity;
  z: number;
  x: number;
  y: number;
};

type BuildGeoReferenceLayerBoundsSqlArgs = {
  layer: GeoReferenceLayerEntity;
};

const escapeMvtLayerName = (layerName: string) => layerName.replace(/'/g, "''");

const buildCoalescedTextExpression = ({
  fallbackColumn,
  fields,
}: {
  fallbackColumn: string;
  fields: string[];
}) => {
  const fieldSelects = fields.map((field) => {
    const column = quoteGeoReferenceSqlIdentifier(field);

    return `NULLIF("source".${column}::text, '')`;
  });

  return fieldSelects.length > 0
    ? `COALESCE(${fieldSelects.join(', ')}, "source".${fallbackColumn}::text)`
    : `"source".${fallbackColumn}::text`;
};

const buildSortSelects = (layer: GeoReferenceLayerEntity) =>
  layer.sidebarContract.query.sort.map((sort, index) => {
    const column = quoteGeoReferenceSqlIdentifier(sort.column);

    return `"source".${column}::text AS "sort_${index}"`;
  });

const buildSortColumnSelects = (layer: GeoReferenceLayerEntity) =>
  layer.sidebarContract.query.sort.map((_, index) => `"source"."sort_${index}"`);

export const assertGeoReferenceTileCoordinates = ({
  z,
  x,
  y,
}: {
  z: number;
  x: number;
  y: number;
}) => {
  if (!Number.isInteger(z) || z < 0 || z > MAP_VECTOR_TILE_MAX_ZOOM) {
    throw new Error('Invalid tile z');
  }

  const maxCoordinate = 2 ** z - 1;

  if (!Number.isInteger(x) || x < 0 || x > maxCoordinate) {
    throw new Error('Invalid tile x');
  }

  if (!Number.isInteger(y) || y < 0 || y > maxCoordinate) {
    throw new Error('Invalid tile y');
  }
};

export const buildGeoReferenceLayerTileSql = ({
  layer,
  z,
  x,
  y,
}: BuildGeoReferenceLayerTileSqlArgs) => {
  assertGeoReferenceTileCoordinates({ z, x, y });

  const {
    schemaName,
    tableName,
    geometryColumnName,
    geometrySrid,
  } = layer.source;
  const { selectedFeatureField, selectionTitle } =
    layer.sidebarContract.query;
  const sourceTable = quoteGeoReferenceSqlQualifiedName({
    schemaName,
    tableName,
  });
  const idColumn = quoteGeoReferenceSqlIdentifier(selectedFeatureField);
  const geometryColumn = quoteGeoReferenceSqlIdentifier(geometryColumnName);
  const tileBounds3857 = `ST_TileEnvelope(${z}, ${x}, ${y})`;
  const tileBoundsSource = `ST_Transform(${tileBounds3857}, ${geometrySrid})`;
  const sourceGeometry = `"source"."${geometryColumnName}"`;
  const sourceGeometry4326 =
    geometrySrid === 4326
      ? `${sourceGeometry}::geometry`
      : `ST_Transform(${sourceGeometry}::geometry, 4326)`;
  const tileBounds4326 = `ST_Transform(${tileBounds3857}, 4326)`;
  const clippedGeometry4326 = `ST_Intersection(${sourceGeometry4326}, ${tileBounds4326})`;
  const featureLimit =
    Number.isInteger(layer.tile.maxFeatureCount) &&
    Number(layer.tile.maxFeatureCount) > 0
      ? `LIMIT ${layer.tile.maxFeatureCount}`
      : '';
  const mvtLayerName = escapeMvtLayerName(layer.key);
  const titleExpression = buildCoalescedTextExpression({
    fallbackColumn: idColumn,
    fields: selectionTitle.fields,
  });
  const sortSelects = buildSortSelects(layer);
  const sortColumnSelects = buildSortColumnSelects(layer);
  const sourceRowPropertySelects = [
    `"source".${idColumn}::text AS "id"`,
    `"source".${idColumn}::text AS "selectedFeatureValue"`,
    `${titleExpression} AS "title"`,
    ...sortSelects,
  ];
  const tileRowPropertySelects = [
    `"source"."id"`,
    `"source"."selectedFeatureValue"`,
    `"source"."title"`,
    ...sortColumnSelects,
  ];

  if (layer.style.type === 'fill') {
    return `
      WITH source_rows AS (
        SELECT
          ${sourceRowPropertySelects.join(',\n          ')},
          "source".${geometryColumn}::geometry AS "${geometryColumnName}"
        FROM ${sourceTable} "source"
        WHERE "source".${geometryColumn} IS NOT NULL
          AND "source".${geometryColumn} && ${tileBoundsSource}
          AND ST_Intersects("source".${geometryColumn}::geometry, ${tileBoundsSource})
        ${featureLimit}
      ),
      fill_tile_rows AS (
        SELECT
          ${tileRowPropertySelects.join(',\n          ')},
          ST_AsMVTGeom(
            ST_Transform(${clippedGeometry4326}, 3857),
            ${tileBounds3857},
            4096,
            64,
            true
          ) AS "geom"
        FROM source_rows "source"
      ),
      outline_tile_rows AS (
        SELECT
          ${tileRowPropertySelects.join(',\n          ')},
          ST_AsMVTGeom(
            ST_Transform(ST_Boundary(${sourceGeometry4326}), 3857),
            ${tileBounds3857},
            4096,
            64,
            true
          ) AS "geom"
        FROM source_rows "source"
      )
      SELECT
        COALESCE((
          SELECT ST_AsMVT(
            fill_tile_rows,
            '${mvtLayerName}',
            4096,
            'geom'
          )
          FROM fill_tile_rows
          WHERE "geom" IS NOT NULL
        ), '\\x'::bytea) ||
        COALESCE((
          SELECT ST_AsMVT(
            outline_tile_rows,
            '${mvtLayerName}-outline',
            4096,
            'geom'
          )
          FROM outline_tile_rows
          WHERE "geom" IS NOT NULL
        ), '\\x'::bytea) AS "tile";
    `;
  }

  return `
    WITH source_rows AS (
      SELECT
        ${sourceRowPropertySelects.join(',\n        ')},
        "source".${geometryColumn}::geometry AS "${geometryColumnName}"
      FROM ${sourceTable} "source"
      WHERE "source".${geometryColumn} IS NOT NULL
        AND "source".${geometryColumn} && ${tileBoundsSource}
        AND ST_Intersects("source".${geometryColumn}::geometry, ${tileBoundsSource})
      ${featureLimit}
    ),
    tile_rows AS (
      SELECT
        ${tileRowPropertySelects.join(',\n        ')},
        ST_AsMVTGeom(
          ST_Transform(${clippedGeometry4326}, 3857),
          ${tileBounds3857},
          4096,
          64,
          true
        ) AS "geom"
      FROM source_rows "source"
    )
    SELECT ST_AsMVT(
      tile_rows,
      '${mvtLayerName}',
      4096,
      'geom'
    ) AS "tile"
    FROM tile_rows
    WHERE "geom" IS NOT NULL;
  `;
};

export const buildGeoReferenceLayerBoundsSql = ({
  layer,
}: BuildGeoReferenceLayerBoundsSqlArgs) => {
  const { schemaName, tableName, geometryColumnName, geometrySrid } =
    layer.source;
  const sourceTable = quoteGeoReferenceSqlQualifiedName({
    schemaName,
    tableName,
  });
  const geometryColumn = quoteGeoReferenceSqlIdentifier(geometryColumnName);
  const geometry4326 =
    geometrySrid === 4326
      ? `"source".${geometryColumn}::geometry`
      : `ST_Transform("source".${geometryColumn}::geometry, 4326)`;

  return `
    SELECT
      COUNT(*)::integer AS "recordCount",
      CASE
        WHEN COUNT(*) = 0 THEN NULL
        ELSE json_build_array(
          ST_XMin(ST_Extent(${geometry4326}))::float8,
          ST_YMin(ST_Extent(${geometry4326}))::float8,
          ST_XMax(ST_Extent(${geometry4326}))::float8,
          ST_YMax(ST_Extent(${geometry4326}))::float8
        )
      END AS "bounds"
    FROM ${sourceTable} "source"
    WHERE "source".${geometryColumn} IS NOT NULL;
  `;
};
