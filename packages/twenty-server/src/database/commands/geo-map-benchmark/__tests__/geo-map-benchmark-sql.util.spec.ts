import {
  buildGeoMapBenchmarkAnalyzeSql,
  buildGeoMapBenchmarkGistIndexSql,
  buildGeoMapBenchmarkInsertSql,
  buildGeoMapBenchmarkTruncateSql,
} from 'src/database/commands/geo-map-benchmark/geo-map-benchmark-sql.util';

describe('geo map benchmark SQL utilities', () => {
  it('should build point bulk insert SQL from generate_series', () => {
    const sql = buildGeoMapBenchmarkInsertSql({
      schemaName: 'workspace_abcd',
      tableName: 'geoBenchmarkFeature',
      geometryColumnName: 'geometry',
      dataset: 'points',
      count: 1_000_000,
    });

    expect(sql).toContain('INSERT INTO "workspace_abcd"."geoBenchmarkFeature"');
    expect(sql).toContain('FROM generate_series(1, 1000000)');
    expect(sql).toContain('ST_SetSRID(ST_MakePoint');
    expect(sql).toContain('series.value::bigint * 7919');
    expect(sql).toContain('series.value::bigint * 104729');
    expect(sql).toContain('ON CONFLICT ("id") DO UPDATE');
  });

  it('should build polygon and multipolygon geometry expressions', () => {
    expect(
      buildGeoMapBenchmarkInsertSql({
        schemaName: 'workspace_abcd',
        tableName: 'geoBenchmarkFeature',
        geometryColumnName: 'geometry',
        dataset: 'polygons',
        count: 10,
      }),
    ).toContain('ST_MakeEnvelope');

    expect(
      buildGeoMapBenchmarkInsertSql({
        schemaName: 'workspace_abcd',
        tableName: 'geoBenchmarkFeature',
        geometryColumnName: 'geometry',
        dataset: 'multipolygons',
        count: 10,
      }),
    ).toContain('ST_MakePolygon');

    expect(
      buildGeoMapBenchmarkInsertSql({
        schemaName: 'workspace_abcd',
        tableName: 'geoBenchmarkFeature',
        geometryColumnName: 'geometry',
        dataset: 'multipolygons',
        count: 10,
      }),
    ).toContain('ARRAY[ST_MakeLine');

    expect(
      buildGeoMapBenchmarkInsertSql({
        schemaName: 'workspace_abcd',
        tableName: 'geoBenchmarkFeature',
        geometryColumnName: 'geometry',
        dataset: 'multipolygons',
        count: 10,
      }),
    ).toContain('ST_MakeEnvelope');
  });

  it('should build index, truncate, and analyze SQL with quoted identifiers', () => {
    expect(
      buildGeoMapBenchmarkGistIndexSql({
        schemaName: 'workspace_abcd',
        tableName: 'geoBenchmarkFeature',
        geometryColumnName: 'geometry',
      }),
    ).toBe(
      'CREATE INDEX IF NOT EXISTS "geoBenchmarkFeature_geometry_benchmark_gist_idx" ON "workspace_abcd"."geoBenchmarkFeature" USING GIST ("geometry")',
    );

    expect(
      buildGeoMapBenchmarkTruncateSql({
        schemaName: 'workspace_abcd',
        tableName: 'geoBenchmarkFeature',
      }),
    ).toBe('DELETE FROM "workspace_abcd"."geoBenchmarkFeature"');

    expect(
      buildGeoMapBenchmarkAnalyzeSql({
        schemaName: 'workspace_abcd',
        tableName: 'geoBenchmarkFeature',
      }),
    ).toBe('ANALYZE "workspace_abcd"."geoBenchmarkFeature"');
  });

  it('should reject unsafe identifiers and counts', () => {
    expect(() =>
      buildGeoMapBenchmarkInsertSql({
        schemaName: 'workspace_abcd; DROP SCHEMA core',
        tableName: 'geoBenchmarkFeature',
        geometryColumnName: 'geometry',
        dataset: 'points',
        count: 10,
      }),
    ).toThrow('Invalid benchmark identifier');

    expect(() =>
      buildGeoMapBenchmarkInsertSql({
        schemaName: 'workspace_abcd',
        tableName: 'geoBenchmarkFeature',
        geometryColumnName: 'geometry',
        dataset: 'points',
        count: 0,
      }),
    ).toThrow('Benchmark count must be a positive integer');
  });
});
