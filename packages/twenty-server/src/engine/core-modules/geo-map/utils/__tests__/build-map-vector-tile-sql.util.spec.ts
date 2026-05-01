import {
  buildMapGeometryBoundsSql,
  buildMapVectorTileSql,
  computeMapVectorTileSimplificationTolerance,
} from 'src/engine/core-modules/geo-map/utils/build-map-vector-tile-sql.util';

describe('buildMapVectorTileSql', () => {
  it('should build a compact MVT query with a feature budget', () => {
    const sql = buildMapVectorTileSql({
      sourceQuery:
        'SELECT "record"."id" AS "id", "record"."geometry" AS "geometry" FROM "record" WHERE "record"."geometry" && $1',
      geometryColumnName: 'geometry',
      z: 6,
      x: 32,
      y: 21,
    });

    expect(sql).toContain('ST_AsMVTGeom');
    expect(sql).toContain(
      'ST_Intersection(tile_source."geometry", ST_Transform(ST_TileEnvelope(6, 32, 21), 4326))',
    );
    expect(sql).toContain(
      'ST_Intersection(ST_Boundary(tile_source."geometry"), ST_Transform(ST_TileEnvelope(6, 32, 21), 4326))',
    );
    expect(sql).toContain('UNION ALL');
    expect(sql).toContain('ST_AsMVT(');
    expect(sql).toContain("'records'");
    expect(sql).toContain('LIMIT 50000');
    expect(sql).toContain('ST_TileEnvelope(6, 32, 21)');
    expect(sql).toContain('tile_source."id" AS "id"');
    expect(sql).toContain('tile_source."geometry"');
    expect(sql).not.toContain('SELECT *');
  });

  it('should preserve source query placeholders for parameterized filters', () => {
    const sql = buildMapVectorTileSql({
      sourceQuery:
        'SELECT "record"."id" AS "id", "record"."geometry" AS "geometry" FROM "record" WHERE "record"."name" ILIKE $1',
      geometryColumnName: 'geometry',
      z: 0,
      x: 0,
      y: 0,
    });

    expect(sql).toContain('"record"."name" ILIKE $1');
  });

  it('should simplify individual features at low zoom without clustering them', () => {
    const sql = buildMapVectorTileSql({
      sourceQuery:
        'SELECT "record"."id" AS "id", "record"."geometry" AS "geometry" FROM "record"',
      geometryColumnName: 'geometry',
      z: 4,
      x: 8,
      y: 5,
    });

    expect(sql).toContain('ST_SimplifyPreserveTopology');
    expect(sql).toContain('ST_AsMVTGeom');
    expect(sql).toContain('tile_source."id" AS "id"');
    expect(sql).not.toContain('ST_Cluster');
  });

  it('should not simplify high zoom tiles', () => {
    const sql = buildMapVectorTileSql({
      sourceQuery:
        'SELECT "record"."id" AS "id", "record"."geometry" AS "geometry" FROM "record"',
      geometryColumnName: 'geometry',
      z: 12,
      x: 2048,
      y: 1365,
    });

    expect(sql).toContain(
      'ST_Transform(ST_Intersection(tile_source."geometry", ST_Transform(ST_TileEnvelope(12, 2048, 1365), 4326)), 3857)',
    );
    expect(sql).not.toContain('ST_SimplifyPreserveTopology');
    expect(computeMapVectorTileSimplificationTolerance(12)).toBe(0);
    expect(computeMapVectorTileSimplificationTolerance(4)).toBeGreaterThan(0);
  });

  it('should reject unsafe geometry column identifiers', () => {
    expect(() =>
      buildMapVectorTileSql({
        sourceQuery:
          'SELECT "record"."id" AS "id", "record"."geometry" AS "geometry" FROM "record"',
        geometryColumnName: 'geometry"; DROP TABLE record; --',
        z: 0,
        x: 0,
        y: 0,
      }),
    ).toThrow('Invalid SQL identifier');
  });

  it('should build a bounds query from the same parameterized source query', () => {
    const sql = buildMapGeometryBoundsSql({
      sourceQuery:
        'SELECT "record"."id" AS "id", "record"."geometry" AS "geometry" FROM "record" WHERE "record"."name" ILIKE $1',
      geometryColumnName: 'geometry',
    });

    expect(sql).toContain('"record"."name" ILIKE $1');
    expect(sql).toContain('COUNT(*)::integer AS "recordCount"');
    expect(sql).toContain('json_build_array');
    expect(sql).toContain('ST_Extent("geometry")');
    expect(sql).not.toContain('SELECT *');
  });

  it('should reject unsafe bounds geometry column identifiers', () => {
    expect(() =>
      buildMapGeometryBoundsSql({
        sourceQuery:
          'SELECT "record"."id" AS "id", "record"."geometry" AS "geometry" FROM "record"',
        geometryColumnName: 'geometry"; DROP TABLE record; --',
      }),
    ).toThrow('Invalid SQL identifier');
  });
});
