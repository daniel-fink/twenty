export type GeoMapBenchmarkDataset = 'points' | 'polygons' | 'multipolygons';

type GeoMapBenchmarkSqlArgs = {
  schemaName: string;
  tableName: string;
  geometryColumnName: string;
};

type GeoMapBenchmarkInsertSqlArgs = GeoMapBenchmarkSqlArgs & {
  dataset: GeoMapBenchmarkDataset;
  count: number;
};

const BENCHMARK_IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export const assertGeoMapBenchmarkIdentifier = (identifier: string) => {
  if (!BENCHMARK_IDENTIFIER_REGEX.test(identifier)) {
    throw new Error(`Invalid benchmark identifier: ${identifier}`);
  }
};

const quoteIdentifier = (identifier: string) => {
  assertGeoMapBenchmarkIdentifier(identifier);

  return `"${identifier}"`;
};

const quoteLiteral = (value: string) => {
  assertGeoMapBenchmarkIdentifier(value);

  return `'${value}'`;
};

const buildBenchmarkGeometryExpression = ({
  dataset,
}: Pick<GeoMapBenchmarkInsertSqlArgs, 'dataset'>) => {
  const longitudeExpression =
    '-170 + (((series.value::bigint * 7919) % 340000)::double precision / 1000)';
  const latitudeExpression =
    '-70 + (((series.value::bigint * 104729) % 140000)::double precision / 1000)';
  const multipolygonOuterRing = `ST_MakeLine(ARRAY[
    ST_MakePoint(${longitudeExpression}, ${latitudeExpression}),
    ST_MakePoint(${longitudeExpression} + 0.04, ${latitudeExpression}),
    ST_MakePoint(${longitudeExpression} + 0.04, ${latitudeExpression} + 0.04),
    ST_MakePoint(${longitudeExpression}, ${latitudeExpression} + 0.04),
    ST_MakePoint(${longitudeExpression}, ${latitudeExpression})
  ])`;
  const multipolygonHoleRing = `ST_MakeLine(ARRAY[
    ST_MakePoint(${longitudeExpression} + 0.015, ${latitudeExpression} + 0.015),
    ST_MakePoint(${longitudeExpression} + 0.025, ${latitudeExpression} + 0.015),
    ST_MakePoint(${longitudeExpression} + 0.025, ${latitudeExpression} + 0.025),
    ST_MakePoint(${longitudeExpression} + 0.015, ${latitudeExpression} + 0.025),
    ST_MakePoint(${longitudeExpression} + 0.015, ${latitudeExpression} + 0.015)
  ])`;

  switch (dataset) {
    case 'points':
      return `ST_SetSRID(ST_MakePoint(${longitudeExpression}, ${latitudeExpression}), 4326)`;
    case 'polygons':
      return `ST_MakeEnvelope(${longitudeExpression}, ${latitudeExpression}, ${longitudeExpression} + 0.01, ${latitudeExpression} + 0.01, 4326)`;
    case 'multipolygons':
      return `ST_SetSRID(ST_Multi(ST_Collect(ARRAY[
        ST_MakePolygon(${multipolygonOuterRing}, ARRAY[${multipolygonHoleRing}]),
        ST_MakeEnvelope(${longitudeExpression} + 0.06, ${latitudeExpression} + 0.005, ${longitudeExpression} + 0.08, ${latitudeExpression} + 0.025, 0)
      ])), 4326)`;
  }
};

export const buildGeoMapBenchmarkTruncateSql = ({
  schemaName,
  tableName,
}: Pick<GeoMapBenchmarkSqlArgs, 'schemaName' | 'tableName'>) =>
  `DELETE FROM ${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)}`;

export const buildGeoMapBenchmarkGistIndexSql = ({
  schemaName,
  tableName,
  geometryColumnName,
}: GeoMapBenchmarkSqlArgs) =>
  `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_index index_metadata
        JOIN pg_class table_class
          ON table_class.oid = index_metadata.indrelid
        JOIN pg_namespace namespace
          ON namespace.oid = table_class.relnamespace
        JOIN pg_class index_class
          ON index_class.oid = index_metadata.indexrelid
        JOIN pg_am access_method
          ON access_method.oid = index_class.relam
        JOIN pg_attribute attribute
          ON attribute.attrelid = table_class.oid
          AND attribute.attnum = ANY(index_metadata.indkey)
        WHERE namespace.nspname = ${quoteLiteral(schemaName)}
          AND table_class.relname = ${quoteLiteral(tableName)}
          AND attribute.attname = ${quoteLiteral(geometryColumnName)}
          AND access_method.amname = 'gist'
      ) THEN
        CREATE INDEX ${quoteIdentifier(`${tableName}_${geometryColumnName}_benchmark_gist_idx`)}
          ON ${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)}
          USING GIST (${quoteIdentifier(geometryColumnName)});
      END IF;
    END $$;
  `;

export const buildGeoMapBenchmarkAnalyzeSql = ({
  schemaName,
  tableName,
}: Pick<GeoMapBenchmarkSqlArgs, 'schemaName' | 'tableName'>) =>
  `ANALYZE ${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)}`;

export const buildGeoMapBenchmarkInsertSql = ({
  schemaName,
  tableName,
  geometryColumnName,
  dataset,
  count,
}: GeoMapBenchmarkInsertSqlArgs) => {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error('Benchmark count must be a positive integer');
  }

  const geometryExpression = buildBenchmarkGeometryExpression({ dataset });

  return `
    INSERT INTO ${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)}
      ("id", ${quoteIdentifier(geometryColumnName)})
    SELECT
      ('00000000-0000-4000-8000-' || lpad(series.value::text, 12, '0'))::uuid,
      ${geometryExpression}
    FROM generate_series(1, ${count}) AS series(value)
    ON CONFLICT ("id") DO UPDATE
      SET ${quoteIdentifier(geometryColumnName)} = EXCLUDED.${quoteIdentifier(geometryColumnName)}
  `;
};
