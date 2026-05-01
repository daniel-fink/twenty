import {
  buildGeoMapBenchmarkAnalyzeSql,
  buildGeoMapBenchmarkGistIndexSql,
  buildGeoMapBenchmarkInsertSql,
  buildGeoMapBenchmarkTruncateSql,
} from 'src/database/commands/geo-map-benchmark/geo-map-benchmark-sql.util';
import {
  buildGeoMapBenchmarkTileExplainSql,
  buildGeoMapRealBenchmarkInsertSql,
} from 'src/database/commands/geo-map-benchmark/geo-map-real-benchmark-sql.util';

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
    const gistIndexSql = buildGeoMapBenchmarkGistIndexSql({
      schemaName: 'workspace_abcd',
      tableName: 'geoBenchmarkFeature',
      geometryColumnName: 'geometry',
    });

    expect(gistIndexSql).toContain('IF NOT EXISTS');
    expect(gistIndexSql).toContain("namespace.nspname = 'workspace_abcd'");
    expect(gistIndexSql).toContain(
      'CREATE INDEX "geoBenchmarkFeature_geometry_benchmark_gist_idx"',
    );
    expect(gistIndexSql).toContain('ON "workspace_abcd"."geoBenchmarkFeature"');
    expect(gistIndexSql).toContain('USING GIST ("geometry")');

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

  it('should build real-world benchmark import SQL from GeoJSON batch records', () => {
    const sql = buildGeoMapRealBenchmarkInsertSql({
      schemaName: 'workspace_abcd',
      tableName: 'geoBenchmarkRealPolygon',
      geometryColumnName: 'geometry',
      batchParameterIndex: 1,
    });

    expect(sql).toContain(
      'INSERT INTO "workspace_abcd"."geoBenchmarkRealPolygon"',
    );
    expect(sql).toContain('jsonb_to_recordset($1::jsonb)');
    expect(sql).toContain('ST_GeomFromGeoJSON(feature.geometry::text)');
    expect(sql).toContain('ST_MakeValid');
    expect(sql).toContain('ST_Multi');
    expect(sql).toContain('ON CONFLICT ("id") DO UPDATE');
  });

  it('should build tile explain SQL that exercises bbox and exact predicates', () => {
    const sql = buildGeoMapBenchmarkTileExplainSql({
      schemaName: 'workspace_abcd',
      tableName: 'geoBenchmarkRealPolygon',
      geometryColumnName: 'geometry',
      z: 4,
      x: 8,
      y: 5,
    });

    expect(sql).toContain('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)');
    expect(sql).toContain(
      '"geometry" && ST_Transform(ST_TileEnvelope(4, 8, 5), 4326)',
    );
    expect(sql).toContain(
      'ST_Intersects("geometry", ST_Transform(ST_TileEnvelope(4, 8, 5), 4326))',
    );
  });
});
