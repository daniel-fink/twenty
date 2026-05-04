import {
  GeoReferenceLayerStatus,
  GeoReferenceLayerValidationStatus,
} from 'src/engine/core-modules/geo-map/entities/geo-reference-layer.entity';
import { GeoReferenceLayerService } from 'src/engine/core-modules/geo-map/services/geo-reference-layer.service';

const authContext = {
  type: 'user',
  user: { id: 'user-id' },
  workspace: { id: 'workspace-id' },
} as never;

const createRawLayerRow = () => ({
  attachment_isVisible: true,
  attachment_position: 0,
  attribution: 'Demo attribution',
  bounds: [1, 2, 3, 4],
  catalogKey: 'catalog',
  catalogVersion: 1,
  createdAt: new Date(),
  description: null,
  id: 'layer-id',
  key: 'parcels',
  lastSyncAt: new Date(),
  lastValidatedAt: new Date(),
  metadata: {},
  name: 'Parcels',
  rowCount: 1,
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
      sort: [],
      targetField: 'parcel_id',
      type: 'single',
    },
    sections: [],
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
  updatedAt: new Date(),
  validationError: null,
  validationStatus: GeoReferenceLayerValidationStatus.VALID,
  workspaceId: 'workspace-id',
});

const createService = ({
  dataSourceQuery,
  tile = Buffer.from('tile'),
}: {
  dataSourceQuery: jest.Mock;
  tile?: Buffer;
}) => {
  const client = {
    end: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue({ rows: [{ tile }] }),
  };
  const service = new GeoReferenceLayerService(
    { query: dataSourceQuery } as never,
    { connect: jest.fn().mockResolvedValue(client) } as never,
    { getPreferences: jest.fn().mockResolvedValue({}) } as never,
  );

  return { client, service };
};

describe('GeoReferenceLayerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queries only active and valid attached reference layers', async () => {
    const dataSourceQuery = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'view-id' }])
      .mockResolvedValueOnce([createRawLayerRow()]);
    const { service } = createService({ dataSourceQuery });

    await expect(
      service.getReferenceLayers({ authContext, viewId: 'view-id' }),
    ).resolves.toMatchObject([
      {
        attribution: 'Demo attribution',
        id: 'layer-id',
        key: 'parcels',
      },
    ]);

    expect(dataSourceQuery).toHaveBeenLastCalledWith(expect.any(String), [
      'workspace-id',
      'view-id',
      GeoReferenceLayerStatus.ACTIVE,
      GeoReferenceLayerValidationStatus.VALID,
    ]);
  });

  it('serves vector tiles for active and valid attached layers', async () => {
    const dataSourceQuery = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'view-id' }])
      .mockResolvedValueOnce([createRawLayerRow()]);
    const tile = Buffer.from('reference-tile');
    const { client, service } = createService({ dataSourceQuery, tile });

    await expect(
      service.getVectorTile({
        authContext,
        layerId: 'layer-id',
        viewId: 'view-id',
        x: 512,
        y: 512,
        z: 10,
      }),
    ).resolves.toEqual(tile);

    expect(dataSourceQuery).toHaveBeenLastCalledWith(expect.any(String), [
      'workspace-id',
      'view-id',
      'layer-id',
      GeoReferenceLayerStatus.ACTIVE,
      GeoReferenceLayerValidationStatus.VALID,
    ]);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('ST_AsMVT'),
    );
    expect(client.end).toHaveBeenCalled();
  });
});
