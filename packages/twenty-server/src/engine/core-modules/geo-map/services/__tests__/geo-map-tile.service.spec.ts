import {
  FieldMetadataType,
  type PartialGeoMapTilePolicy,
  ViewFilterOperand,
  ViewType,
} from 'twenty-shared/types';

import { GeoMapTileService } from 'src/engine/core-modules/geo-map/services/geo-map-tile.service';

const mockApplyDeletedAtToBuilder = jest.fn();
const mockApplyFilterToBuilder = jest.fn();

jest.mock(
  'src/engine/api/graphql/graphql-query-runner/graphql-query-parsers/graphql-query.parser',
  () => ({
    GraphqlQueryParser: jest.fn().mockImplementation(() => ({
      applyDeletedAtToBuilder: mockApplyDeletedAtToBuilder,
      applyFilterToBuilder: mockApplyFilterToBuilder,
    })),
  }),
);

jest.mock(
  'src/engine/twenty-orm/storage/orm-workspace-context.storage',
  () => ({
    getWorkspaceContext: jest.fn(() => ({
      apiKeyRoleMap: {},
      userWorkspaceRoleMap: {
        'user-workspace-id': 'role-id',
      },
    })),
  }),
);

const createFlatEntityMaps = <T extends { id: string }>(entities: T[]) => ({
  byUniversalIdentifier: Object.fromEntries(
    entities.map((entity) => [entity.id, entity]),
  ),
  universalIdentifierById: Object.fromEntries(
    entities.map((entity) => [entity.id, entity.id]),
  ),
  universalIdentifiersByApplicationId: {},
});

const createTileContextMaps = ({
  fieldMapTilePolicy,
  viewMapTilePolicy = null,
  viewFilters = [],
  viewFilterGroups = [],
}: {
  fieldMapTilePolicy?: PartialGeoMapTilePolicy;
  viewMapTilePolicy?: PartialGeoMapTilePolicy | null;
  viewFilters?: ({ id: string } & Record<string, unknown>)[];
  viewFilterGroups?: ({ id: string } & Record<string, unknown>)[];
} = {}) => {
  const objectMetadataId = 'object-id';
  const fieldMetadataId = 'field-id';
  const viewId = 'view-id';

  return {
    flatViewMaps: createFlatEntityMaps([
      {
        id: viewId,
        deletedAt: null,
        mapTilePolicy: viewMapTilePolicy,
        mapFieldMetadataId: fieldMetadataId,
        objectMetadataId,
        type: ViewType.MAP,
      },
    ]),
    flatObjectMetadataMaps: createFlatEntityMaps([
      {
        fieldIds: [fieldMetadataId],
        id: objectMetadataId,
        isActive: true,
        nameSingular: 'geoBenchmarkPoint',
      },
    ]),
    flatFieldMetadataMaps: createFlatEntityMaps([
      {
        id: fieldMetadataId,
        isActive: true,
        label: 'Geometry',
        name: 'geometry',
        objectMetadataId,
        options: null,
        settings: fieldMapTilePolicy
          ? {
              geometryType: 'GEOMETRY',
              isGeography: false,
              mapTilePolicy: fieldMapTilePolicy,
              srid: 4326,
            }
          : {
              geometryType: 'GEOMETRY',
              isGeography: false,
              srid: 4326,
            },
        type: FieldMetadataType.GEOMETRY,
      },
    ]),
    flatViewFilterMaps: createFlatEntityMaps(viewFilters),
    flatViewFilterGroupMaps: createFlatEntityMaps(viewFilterGroups),
    viewId,
  };
};

const createQueryBuilder = () => {
  const queryBuilder = {
    addSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    applyWorkspacePermissions: jest.fn().mockReturnThis(),
    getQueryAndParameters: jest.fn(() => [
      'SELECT "geoBenchmarkPoint"."id" AS "id", "geoBenchmarkPoint"."geometry"::geometry AS "geometry" FROM "record"',
      ['parameter'],
    ]),
    select: jest.fn().mockReturnThis(),
  };

  return queryBuilder;
};

const createService = ({
  fieldMapTilePolicy,
  queryResult,
  viewMapTilePolicy,
  viewFilters,
  viewFilterGroups,
}: {
  fieldMapTilePolicy?: PartialGeoMapTilePolicy;
  queryResult: unknown[];
  viewMapTilePolicy?: PartialGeoMapTilePolicy | null;
  viewFilters?: ({ id: string } & Record<string, unknown>)[];
  viewFilterGroups?: ({ id: string } & Record<string, unknown>)[];
}) => {
  const tileContextMaps = createTileContextMaps({
    fieldMapTilePolicy,
    viewMapTilePolicy,
    viewFilters,
    viewFilterGroups,
  });
  const queryBuilder = createQueryBuilder();
  const query = jest.fn().mockResolvedValue(queryResult);
  const service = new GeoMapTileService(
    {
      getOrRecomputeManyOrAllFlatEntityMaps: jest
        .fn()
        .mockResolvedValue(tileContextMaps),
    } as never,
    {
      executeInWorkspaceContext: jest.fn((callback) => callback()),
      getGlobalWorkspaceDataSourceReplica: jest.fn().mockResolvedValue({
        getRepository: jest.fn(() => ({
          createQueryBuilder: jest.fn(() => queryBuilder),
        })),
        query,
      }),
    } as never,
  );

  return { query, queryBuilder, service, viewId: tileContextMaps.viewId };
};

const authContext = {
  type: 'user',
  userWorkspaceId: 'user-workspace-id',
  workspace: { id: 'workspace-id' },
} as never;

describe('GeoMapTileService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should query geometry bounds with raw PostGIS geometry and bypass only the final wrapper query', async () => {
    const { query, queryBuilder, service, viewId } = createService({
      queryResult: [{ bounds: [1, 2, 3, 4], recordCount: 2 }],
    });

    await service.getGeometryBounds({ authContext, viewId });

    expect(queryBuilder.addSelect).toHaveBeenCalledWith(
      '"geoBenchmarkPoint"."geometry"::geometry',
      'geometry',
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ST_Extent("geometry")'),
      ['parameter'],
      undefined,
      { shouldBypassPermissionChecks: true },
    );
  });

  it('should expose the configured tile policy in TileJSON', async () => {
    const { service, viewId } = createService({
      queryResult: [],
      fieldMapTilePolicy: {
        minZoom: 13,
        maxZoom: 22,
      },
      viewMapTilePolicy: {
        minZoom: 11,
      },
    });

    const tileJson = await service.getTileJson({ authContext, viewId });

    expect(tileJson).toMatchObject({
      maxzoom: 22,
      minzoom: 11,
      vector_layers: [{ id: 'records' }],
    });
  });

  it('should query vector tiles with raw PostGIS geometry and bypass only the final wrapper query', async () => {
    const tile = Buffer.from('tile');
    const { query, queryBuilder, service, viewId } = createService({
      queryResult: [{ tile }],
    });

    await service.getVectorTile({
      authContext,
      viewId,
      x: 256,
      y: 170,
      z: 9,
    });

    expect(queryBuilder.addSelect).toHaveBeenCalledWith(
      '"geoBenchmarkPoint"."geometry"::geometry',
      'geometry',
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ST_AsMVTGeom'),
      ['parameter'],
      undefined,
      { shouldBypassPermissionChecks: true },
    );
  });

  it('should return an empty vector tile below the configured minimum zoom', async () => {
    const { query, service, viewId } = createService({
      fieldMapTilePolicy: {
        minZoom: 13,
      },
      queryResult: [{ tile: Buffer.from('tile') }],
    });

    const tile = await service.getVectorTile({
      authContext,
      viewId,
      x: 0,
      y: 384,
      z: 9,
    });

    expect(tile).toEqual(Buffer.alloc(0));
    expect(query).not.toHaveBeenCalled();
  });

  it('should pass configured tile policy values into SQL generation', async () => {
    const tile = Buffer.from('tile');
    const { query, service, viewId } = createService({
      fieldMapTilePolicy: {
        buffer: 128,
        extent: 8192,
        maxFeatureCount: 25_000,
        minZoom: 9,
        simplification: {
          enabled: false,
        },
      },
      queryResult: [{ tile }],
    });

    await service.getVectorTile({
      authContext,
      viewId,
      x: 256,
      y: 170,
      z: 9,
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT 25000'),
      ['parameter'],
      undefined,
      { shouldBypassPermissionChecks: true },
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        "ST_AsMVT(\n      tile_rows,\n      'records',\n      8192",
      ),
      ['parameter'],
      undefined,
      { shouldBypassPermissionChecks: true },
    );
    expect(query).toHaveBeenCalledWith(
      expect.not.stringContaining('ST_SimplifyPreserveTopology'),
      ['parameter'],
      undefined,
      { shouldBypassPermissionChecks: true },
    );
  });

  it('should AND saved view filters with request filters for bounds and tiles', async () => {
    const requestFilter = {
      amount: {
        gt: 1000,
      },
    };
    const { service, viewId } = createService({
      queryResult: [{ bounds: [1, 2, 3, 4], recordCount: 1 }],
      viewFilters: [
        {
          id: 'view-filter-id',
          deletedAt: null,
          fieldMetadataId: 'field-id',
          operand: ViewFilterOperand.WITHIN_BBOX,
          positionInViewFilterGroup: null,
          subFieldName: null,
          value: { west: 1, south: 2, east: 3, north: 4 },
          viewFilterGroupId: null,
          viewId: 'view-id',
        },
      ],
    });

    await service.getGeometryBounds({
      authContext,
      viewId,
      recordFilter: requestFilter,
    });

    expect(mockApplyFilterToBuilder).toHaveBeenCalledWith(
      expect.anything(),
      'geoBenchmarkPoint',
      {
        and: [
          requestFilter,
          {
            geometry: {
              withinBbox: {
                west: 1,
                south: 2,
                east: 3,
                north: 4,
              },
            },
          },
        ],
      },
    );
  });
});
