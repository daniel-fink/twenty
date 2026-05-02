import { assertGeoMapBenchmarkIdentifier } from 'src/database/commands/geo-map-benchmark/geo-map-benchmark-sql.util';

type GeoMapRealBenchmarkSqlArgs = {
  schemaName: string;
  tableName: string;
  geometryColumnName: string;
};

type GeoMapRealBenchmarkInsertSqlArgs = GeoMapRealBenchmarkSqlArgs & {
  batchParameterIndex: number;
};

type GeoMapRealBenchmarkExplainSqlArgs = GeoMapRealBenchmarkSqlArgs & {
  z: number;
  x: number;
  y: number;
};

const quoteIdentifier = (identifier: string) => {
  assertGeoMapBenchmarkIdentifier(identifier);

  return `"${identifier}"`;
};

export const buildGeoMapRealBenchmarkInsertSql = ({
  schemaName,
  tableName,
  geometryColumnName,
  batchParameterIndex,
}: GeoMapRealBenchmarkInsertSqlArgs) => {
  if (!Number.isInteger(batchParameterIndex) || batchParameterIndex <= 0) {
    throw new Error('Batch parameter index must be a positive integer');
  }

  return `
    INSERT INTO ${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)}
      ("id", ${quoteIdentifier(geometryColumnName)})
    SELECT
      feature.id,
      ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(feature.geometry::text), 4326)), 3))
    FROM jsonb_to_recordset($${batchParameterIndex}::jsonb) AS feature(id uuid, geometry jsonb)
    WHERE feature.geometry IS NOT NULL
      AND NOT ST_IsEmpty(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(feature.geometry::text), 4326)), 3))
    ON CONFLICT ("id") DO UPDATE
      SET ${quoteIdentifier(geometryColumnName)} = EXCLUDED.${quoteIdentifier(geometryColumnName)}
  `;
};

export const buildGeoMapBenchmarkTileExplainSql = ({
  schemaName,
  tableName,
  geometryColumnName,
  z,
  x,
  y,
}: GeoMapRealBenchmarkExplainSqlArgs) => {
  if (
    !Number.isInteger(z) ||
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    z < 0 ||
    x < 0 ||
    y < 0
  ) {
    throw new Error('Tile coordinates must be non-negative integers');
  }

  const geometryColumn = quoteIdentifier(geometryColumnName);
  const tileBounds3857 = `ST_TileEnvelope(${z}, ${x}, ${y})`;
  const tileBounds4326 = `ST_Transform(${tileBounds3857}, 4326)`;

  return `
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT "id"
    FROM ${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)}
    WHERE ${geometryColumn} IS NOT NULL
      AND ${geometryColumn} && ${tileBounds4326}
      AND ST_Intersects(${geometryColumn}, ${tileBounds4326})
  `;
};
