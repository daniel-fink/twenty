import {
  assertGeoReferenceTileCoordinates,
  buildGeoReferenceLayerTileSql,
} from 'src/engine/core-modules/geo-map/reference-layer-catalog/utils/build-geo-reference-layer-tile-sql.util';
import {
  GeoReferenceLayerStatus,
  type GeoReferenceLayerEntity,
} from 'src/engine/core-modules/geo-map/entities/geo-reference-layer.entity';

const layer = {
  id: 'layer-id',
  workspaceId: 'workspace-id',
  key: 'demo-parcels',
  catalogKey: 'demo',
  name: 'Demo parcels',
  description: null,
  status: GeoReferenceLayerStatus.ACTIVE,
  source: {
    provider: 'EXTERNAL_POSTGIS',
    connectionKey: 'demo',
    connectionUriEnv: 'GEO_REFERENCE_CONNECTION_DEMO',
    schemaName: 'model',
    tableName: 'parcels',
    idColumnName: 'property_PROPID',
    geometryColumnName: 'geometry',
    geometrySrid: 7856,
    geometryType: 'MULTIPOLYGON',
  },
  tile: {
    minZoom: 12,
    maxZoom: 18,
    maxFeatureCount: 25000,
  },
  style: {
    type: 'fill',
    fillColor: '#2563eb',
    fillOpacity: 0.2,
  },
  title: {
    fields: ['address_ADDRESS'],
    fallback: 'featureId',
  },
  exposedProperties: [],
  propertyManifestPath: null,
  catalogVersion: 1,
  lastSyncAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as GeoReferenceLayerEntity;

describe('buildGeoReferenceLayerTileSql', () => {
  it('transforms non-4326 sources through the declared source SRID', () => {
    const sql = buildGeoReferenceLayerTileSql({
      layer,
      z: 12,
      x: 2048,
      y: 1365,
    });

    expect(sql).toContain(
      'ST_Transform(ST_TileEnvelope(12, 2048, 1365), 7856)',
    );
    expect(sql).toContain('ST_Transform("source"."geometry"::geometry, 4326)');
    expect(sql).toContain(
      'ST_Transform(ST_Boundary(ST_Transform("source"."geometry"::geometry, 4326)), 3857)',
    );
    expect(sql).toContain('"source"."property_PROPID"::text AS "id"');
    expect(sql).toContain(
      'COALESCE("source"."address_ADDRESS"::text, "source"."property_PROPID"::text) AS "title"',
    );
    expect(sql).toContain('LIMIT 25000');
    expect(sql).toContain("'demo-parcels'");
    expect(sql).toContain("'demo-parcels-outline'");
  });

  it('emits only id and computed title properties for vector tiles', () => {
    const sql = buildGeoReferenceLayerTileSql({
      layer: {
        ...layer,
        exposedProperties: [
          {
            column: 'owner_NAME',
            label: 'Owner',
            type: 'TEXT',
          },
        ],
      },
      z: 12,
      x: 2048,
      y: 1365,
    });

    expect(sql).toContain('"source"."id",');
    expect(sql).toContain('"source"."title",');
    expect(sql).not.toContain('owner_NAME');
  });

  it('rejects invalid tile coordinates', () => {
    expect(() =>
      assertGeoReferenceTileCoordinates({ z: 4, x: 16, y: 0 }),
    ).toThrow('Invalid tile x');
  });

  it('rejects invalid source identifiers', () => {
    expect(() =>
      buildGeoReferenceLayerTileSql({
        layer: {
          ...layer,
          source: {
            ...layer.source,
            tableName: 'parcels;drop',
          },
        },
        z: 12,
        x: 2048,
        y: 1365,
      }),
    ).toThrow('Invalid SQL identifier: parcels;drop');
  });
});
