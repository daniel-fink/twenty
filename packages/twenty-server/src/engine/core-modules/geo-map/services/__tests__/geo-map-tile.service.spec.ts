import {
  FieldMetadataType,
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
  viewFilters = [],
  viewFilterGroups = [],
}: {
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
  queryResult,
  viewFilters,
  viewFilterGroups,
}: {
  queryResult: unknown[];
  viewFilters?: ({ id: string } & Record<string, unknown>)[];
  viewFilterGroups?: ({ id: string } & Record<string, unknown>)[];
}) => {
  const tileContextMaps = createTileContextMaps({
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

  it('should query vector tiles with raw PostGIS geometry and bypass only the final wrapper query', async () => {
    const tile = Buffer.from('tile');
    const { query, queryBuilder, service, viewId } = createService({
      queryResult: [{ tile }],
    });

    await service.getVectorTile({
      authContext,
      viewId,
      x: 0,
      y: 0,
      z: 0,
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
          operand: ViewFilterOperand.CONTAINS,
          positionInViewFilterGroup: null,
          subFieldName: null,
          value: 'North',
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
              ilike: '%North%',
            },
          },
        ],
      },
    );
  });
});
