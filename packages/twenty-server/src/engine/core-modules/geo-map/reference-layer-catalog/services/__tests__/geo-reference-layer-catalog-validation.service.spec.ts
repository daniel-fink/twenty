import {
  GeoReferenceLayerStatus,
  GeoReferenceLayerValidationStatus,
} from 'src/engine/core-modules/geo-map/entities/geo-reference-layer.entity';
import { GeoReferenceLayerCatalogValidationService } from 'src/engine/core-modules/geo-map/reference-layer-catalog/services/geo-reference-layer-catalog-validation.service';
import { type GeoReferenceLayerConnectionService } from 'src/engine/core-modules/geo-map/reference-layer-catalog/services/geo-reference-layer-connection.service';
import { type LoadedGeoReferenceLayerCatalog } from 'src/engine/core-modules/geo-map/reference-layer-catalog/utils/load-geo-reference-layer-catalog.util';

const createCatalog = (
  overrides: Partial<LoadedGeoReferenceLayerCatalog['layers'][number]> = {},
): LoadedGeoReferenceLayerCatalog => ({
  catalogDirectory: '/tmp',
  catalogKey: 'demo',
  catalogPath: '/tmp/catalog.json',
  connections: {},
  layers: [
    {
      attribution: null,
      defaultAttachment: null,
      description: null,
      key: 'parcels',
      metadata: {},
      name: 'Parcels',
      securityPolicy: {
        kind: 'AUTHENTICATED_WORKSPACE',
        propertyPolicy: 'ALLOWLIST_ONLY',
      },
      sidebarContract: {
        dataset: 'parcels',
        query: {
          selectedFeatureField: 'parcel_id',
          selectionTitle: {
            fallback: 'selectedFeatureValue',
            fields: ['address'],
          },
          sort: [{ column: 'address', direction: 'asc' }],
          targetField: 'parcel_id',
          type: 'single',
        },
        sections: [
          {
            fields: [
              {
                column: 'zoning',
                label: 'Zoning',
                type: 'text',
              },
            ],
            id: 'details',
            title: 'Details',
          },
        ],
        tabId: 'attributes',
        title: 'Attributes',
        version: 1,
      },
      sidebarContractPath: './parcels.contract.json',
      source: {
        geometryColumnName: 'geom',
        geometrySrid: 4326,
        geometryType: 'MULTIPOLYGON',
        idColumnName: 'id',
        provider: 'TWENTY_WORKSPACE_POSTGIS',
        schemaName: 'public',
        tableName: 'parcels',
      },
      status: GeoReferenceLayerStatus.ACTIVE,
      style: {
        fillColor: '#2563eb',
        fillOpacity: 0.2,
        type: 'fill',
      },
      tile: {
        maxZoom: 16,
        minZoom: 10,
      },
      tileProvider: 'TWENTY_POSTGIS',
      ...overrides,
    },
  ],
  version: 1,
});

const createService = (
  queryResults: ({ rows: Record<string, unknown>[] } | Error)[],
) => {
  const query = jest.fn().mockImplementation(() => {
    const nextResult = queryResults.shift();

    return nextResult instanceof Error
      ? Promise.reject(nextResult)
      : Promise.resolve(nextResult);
  });
  const end = jest.fn().mockResolvedValue(undefined);
  const connect = jest.fn().mockResolvedValue({ end, query });
  const service = new GeoReferenceLayerCatalogValidationService({
    connect,
  } as unknown as GeoReferenceLayerConnectionService);

  return { connect, end, query, service };
};

const validQueryResults = () => [
  { rows: [{ exists: true }] },
  {
    rows: [
      { column_name: 'id' },
      { column_name: 'geom' },
      { column_name: 'parcel_id' },
      { column_name: 'address' },
      { column_name: 'zoning' },
    ],
  },
  { rows: [{ srid: 4326 }] },
  { rows: [{ geometry_type: 'MULTIPOLYGON' }] },
  { rows: [{ has_gist_index: true }] },
  { rows: [{ duplicate_ids: '0', null_ids: '0' }] },
  { rows: [{ bounds: [1, 2, 3, 4], recordCount: 12 }] },
  { rows: [{ tile: Buffer.from('tile') }] },
];

describe('GeoReferenceLayerCatalogValidationService', () => {
  it('validates an indexed active layer and returns operational metadata', async () => {
    const { service } = createService(validQueryResults());

    await expect(
      service.validateCatalog({ catalog: createCatalog() }),
    ).resolves.toMatchObject({
      isValid: true,
      layers: [
        {
          bounds: [1, 2, 3, 4],
          error: null,
          layerKey: 'parcels',
          rowCount: 12,
          status: GeoReferenceLayerValidationStatus.VALID,
        },
      ],
    });
  });

  it('skips source validation for disabled layers', async () => {
    const { connect, service } = createService([]);

    await expect(
      service.validateCatalog({
        catalog: createCatalog({ status: GeoReferenceLayerStatus.DISABLED }),
      }),
    ).resolves.toMatchObject({
      isValid: true,
      layers: [
        {
          bounds: null,
          error: null,
          rowCount: null,
          status: GeoReferenceLayerValidationStatus.NOT_VALIDATED,
        },
      ],
    });
    expect(connect).not.toHaveBeenCalled();
  });

  it('marks layers invalid when the geometry GiST index is missing', async () => {
    const { service } = createService([
      ...validQueryResults().slice(0, 4),
      { rows: [{ has_gist_index: false }] },
    ]);

    await expect(
      service.validateCatalog({ catalog: createCatalog() }),
    ).resolves.toMatchObject({
      isValid: false,
      layers: [
        {
          error: expect.stringContaining('requires a GiST index'),
          status: GeoReferenceLayerValidationStatus.INVALID,
        },
      ],
    });
  });

  it('marks layers invalid when the declared geometry type is incompatible', async () => {
    const { service } = createService([
      ...validQueryResults().slice(0, 3),
      { rows: [{ geometry_type: 'POINT' }] },
    ]);

    await expect(
      service.validateCatalog({ catalog: createCatalog() }),
    ).resolves.toMatchObject({
      isValid: false,
      layers: [
        {
          error: expect.stringContaining('declares geometry type MULTIPOLYGON'),
          status: GeoReferenceLayerValidationStatus.INVALID,
        },
      ],
    });
  });

  it('marks layers invalid when the sampled SRID does not match', async () => {
    const { service } = createService([
      ...validQueryResults().slice(0, 2),
      { rows: [{ srid: 3857 }] },
    ]);

    await expect(
      service.validateCatalog({ catalog: createCatalog() }),
    ).resolves.toMatchObject({
      isValid: false,
      layers: [
        {
          error: expect.stringContaining('declares SRID 4326'),
          status: GeoReferenceLayerValidationStatus.INVALID,
        },
      ],
    });
  });

  it('marks layers invalid when selected feature values are duplicated', async () => {
    const { service } = createService([
      ...validQueryResults().slice(0, 5),
      { rows: [{ duplicate_ids: '1', null_ids: '0' }] },
    ]);

    await expect(
      service.validateCatalog({ catalog: createCatalog() }),
    ).resolves.toMatchObject({
      isValid: false,
      layers: [
        {
          error: expect.stringContaining('duplicate values'),
          status: GeoReferenceLayerValidationStatus.INVALID,
        },
      ],
    });
  });

  it('marks layers invalid when sample tile generation fails', async () => {
    const { service } = createService([
      ...validQueryResults().slice(0, 7),
      new Error('sample tile failed'),
    ]);

    await expect(
      service.validateCatalog({ catalog: createCatalog() }),
    ).resolves.toMatchObject({
      isValid: false,
      layers: [
        {
          error: 'sample tile failed',
          status: GeoReferenceLayerValidationStatus.INVALID,
        },
      ],
    });
  });
});
