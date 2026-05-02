import {
  Logger,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  FieldMetadataType,
  type GeoMapTilePolicy,
  ViewType,
} from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { GraphqlQueryParser } from 'src/engine/api/graphql/graphql-query-runner/graphql-query-parsers/graphql-query.parser';
import { type ObjectRecordFilter } from 'src/engine/api/graphql/workspace-query-builder/interfaces/object-record.interface';
import {
  MAP_VECTOR_TILE_LAYER_NAME,
  MAP_VECTOR_TILE_MAX_ZOOM,
} from 'src/engine/core-modules/geo-map/constants/map-vector-tile.constants';
import { buildMapViewRecordFilter } from 'src/engine/core-modules/geo-map/utils/build-map-view-record-filter.util';
import {
  buildMapGeometryBoundsSql,
  buildMapVectorTileSql,
} from 'src/engine/core-modules/geo-map/utils/build-map-vector-tile-sql.util';
import { resolveMapTilePolicy } from 'src/engine/core-modules/geo-map/utils/resolve-map-tile-policy.util';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { WorkspaceManyOrAllFlatEntityMapsCacheService } from 'src/engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.service';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { findFlatEntityByIdInFlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps.util';
import { computeColumnName } from 'src/engine/metadata-modules/field-metadata/utils/compute-column-name.util';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { type FlatViewFilterGroup } from 'src/engine/metadata-modules/flat-view-filter-group/types/flat-view-filter-group.type';
import { type FlatViewFilter } from 'src/engine/metadata-modules/flat-view-filter/types/flat-view-filter.type';
import { type FlatView } from 'src/engine/metadata-modules/flat-view/types/flat-view.type';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { getWorkspaceContext } from 'src/engine/twenty-orm/storage/orm-workspace-context.storage';
import { resolveRolePermissionConfig } from 'src/engine/twenty-orm/utils/resolve-role-permission-config.util';

type GeometryBounds = [number, number, number, number];

type GeometryBoundsQueryResult = {
  bounds: GeometryBounds | null;
  recordCount: number;
};

type MapViewBounds = {
  bounds: GeometryBounds | null;
  recordCount: number;
};

type TileContext = {
  flatView: FlatView;
  flatObjectMetadata: FlatObjectMetadata;
  flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>;
  flatFieldMetadata: FlatFieldMetadata<FieldMetadataType.GEOMETRY>;
  flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
  flatViewFilterMaps: FlatEntityMaps<FlatViewFilter>;
  flatViewFilterGroupMaps: FlatEntityMaps<FlatViewFilterGroup>;
};

type TileJson = {
  tilejson: '3.0.0';
  name: string;
  tiles: string[];
  minzoom: number;
  maxzoom: number;
  vector_layers: {
    id: string;
    fields: Record<string, string>;
  }[];
};

const assertTileCoordinate = ({
  value,
  name,
  max,
}: {
  value: number;
  name: string;
  max?: number;
}) => {
  if (
    !Number.isInteger(value) ||
    value < 0 ||
    (isDefined(max) && value > max)
  ) {
    throw new BadRequestException(`Invalid tile ${name}`);
  }
};

@Injectable()
export class GeoMapTileService {
  private readonly logger = new Logger(GeoMapTileService.name);

  constructor(
    private readonly flatEntityMapsCacheService: WorkspaceManyOrAllFlatEntityMapsCacheService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async getTileJson({
    authContext,
    viewId,
  }: {
    authContext: WorkspaceAuthContext;
    viewId: string;
  }): Promise<TileJson> {
    const tileContext = await this.getTileContext({
      authContext,
      viewId,
    });
    const { flatObjectMetadata } = tileContext;
    const tilePolicy = this.resolveTilePolicy(tileContext);

    return {
      tilejson: '3.0.0',
      name: `${flatObjectMetadata.nameSingular}-records`,
      tiles: [`/rest/map/views/${viewId}/tiles/{z}/{x}/{y}.mvt`],
      minzoom: tilePolicy.minZoom,
      maxzoom: tilePolicy.maxZoom,
      vector_layers: [
        {
          id: MAP_VECTOR_TILE_LAYER_NAME,
          fields: {
            id: 'String',
          },
        },
      ],
    };
  }

  async getGeometryBounds({
    authContext,
    viewId,
    recordFilter = {},
  }: {
    authContext: WorkspaceAuthContext;
    viewId: string;
    recordFilter?: Partial<ObjectRecordFilter>;
  }): Promise<MapViewBounds> {
    const {
      flatView,
      flatObjectMetadata,
      flatObjectMetadataMaps,
      flatFieldMetadata,
      flatFieldMetadataMaps,
      flatViewFilterMaps,
      flatViewFilterGroupMaps,
    } = await this.getTileContext({
      authContext,
      viewId,
    });
    const effectiveRecordFilter = this.buildEffectiveRecordFilter({
      flatView,
      flatObjectMetadata,
      flatFieldMetadataMaps,
      flatViewFilterMaps,
      flatViewFilterGroupMaps,
      recordFilter,
    });

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const rolePermissionConfig = resolveRolePermissionConfig({
          authContext,
          userWorkspaceRoleMap: getWorkspaceContext().userWorkspaceRoleMap,
          apiKeyRoleMap: getWorkspaceContext().apiKeyRoleMap,
        });

        if (!isDefined(rolePermissionConfig)) {
          throw new BadRequestException('Invalid tile auth context');
        }

        const globalWorkspaceDataSource =
          await this.globalWorkspaceOrmManager.getGlobalWorkspaceDataSourceReplica();

        const repository = globalWorkspaceDataSource.getRepository(
          flatObjectMetadata.nameSingular,
          rolePermissionConfig,
        );
        const recordAlias = flatObjectMetadata.nameSingular;
        const geometryColumnName = computeColumnName(flatFieldMetadata.name);
        const geometryFieldReference = `"${recordAlias}"."${geometryColumnName}"`;

        const queryBuilder = repository
          .createQueryBuilder(recordAlias)
          .select(`${recordAlias}.id`, 'id')
          .addSelect(`${geometryFieldReference}::geometry`, geometryColumnName);

        const graphqlQueryParser = new GraphqlQueryParser(
          flatObjectMetadata,
          flatObjectMetadataMaps,
          flatFieldMetadataMaps,
        );

        graphqlQueryParser.applyDeletedAtToBuilder(
          queryBuilder,
          effectiveRecordFilter,
        );
        graphqlQueryParser.applyFilterToBuilder(
          queryBuilder,
          recordAlias,
          effectiveRecordFilter,
        );

        queryBuilder.andWhere(`${geometryFieldReference} IS NOT NULL`);

        queryBuilder.applyWorkspacePermissions();

        const [sourceQuery, sourceParameters] =
          queryBuilder.getQueryAndParameters();
        const boundsQuery = buildMapGeometryBoundsSql({
          sourceQuery,
          geometryColumnName,
        });

        const [boundsResult] = await globalWorkspaceDataSource.query<
          GeometryBoundsQueryResult[]
        >(boundsQuery, [...sourceParameters], undefined, {
          shouldBypassPermissionChecks: true,
        });

        return {
          bounds: boundsResult?.bounds ?? null,
          recordCount: Number(boundsResult?.recordCount ?? 0),
        };
      },
      authContext,
    );
  }

  async getVectorTile({
    authContext,
    viewId,
    z,
    x,
    y,
    recordFilter = {},
  }: {
    authContext: WorkspaceAuthContext;
    viewId: string;
    z: number;
    x: number;
    y: number;
    recordFilter?: Partial<ObjectRecordFilter>;
  }): Promise<Buffer> {
    const startTime = performance.now();

    this.assertTileCoordinates({ z, x, y });

    const {
      flatView,
      flatObjectMetadata,
      flatObjectMetadataMaps,
      flatFieldMetadata,
      flatFieldMetadataMaps,
      flatViewFilterMaps,
      flatViewFilterGroupMaps,
    } = await this.getTileContext({
      authContext,
      viewId,
    });
    const tilePolicy = this.resolveTilePolicy({
      flatView,
      flatObjectMetadata,
      flatObjectMetadataMaps,
      flatFieldMetadata,
      flatFieldMetadataMaps,
      flatViewFilterMaps,
      flatViewFilterGroupMaps,
    });

    if (z < tilePolicy.minZoom || z > tilePolicy.maxZoom) {
      this.logger.debug(
        `Returned empty vector tile outside zoom policy for view ${viewId} at ${z}/${x}/${y} with policy ${JSON.stringify(tilePolicy)}`,
      );

      return Buffer.alloc(0);
    }
    const effectiveRecordFilter = this.buildEffectiveRecordFilter({
      flatView,
      flatObjectMetadata,
      flatFieldMetadataMaps,
      flatViewFilterMaps,
      flatViewFilterGroupMaps,
      recordFilter,
    });

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const rolePermissionConfig = resolveRolePermissionConfig({
          authContext,
          userWorkspaceRoleMap: getWorkspaceContext().userWorkspaceRoleMap,
          apiKeyRoleMap: getWorkspaceContext().apiKeyRoleMap,
        });

        if (!isDefined(rolePermissionConfig)) {
          throw new BadRequestException('Invalid tile auth context');
        }

        const globalWorkspaceDataSource =
          await this.globalWorkspaceOrmManager.getGlobalWorkspaceDataSourceReplica();

        const repository = globalWorkspaceDataSource.getRepository(
          flatObjectMetadata.nameSingular,
          rolePermissionConfig,
        );
        const recordAlias = flatObjectMetadata.nameSingular;
        const geometryColumnName = computeColumnName(flatFieldMetadata.name);
        const geometryFieldReference = `"${recordAlias}"."${geometryColumnName}"`;
        const tileBounds3857 = `ST_TileEnvelope(${z}, ${x}, ${y})`;
        const tileBounds4326 = `ST_Transform(${tileBounds3857}, 4326)`;

        const queryBuilder = repository
          .createQueryBuilder(recordAlias)
          .select(`${recordAlias}.id`, 'id')
          .addSelect(`${geometryFieldReference}::geometry`, geometryColumnName);

        const graphqlQueryParser = new GraphqlQueryParser(
          flatObjectMetadata,
          flatObjectMetadataMaps,
          flatFieldMetadataMaps,
        );

        graphqlQueryParser.applyDeletedAtToBuilder(
          queryBuilder,
          effectiveRecordFilter,
        );
        graphqlQueryParser.applyFilterToBuilder(
          queryBuilder,
          recordAlias,
          effectiveRecordFilter,
        );

        queryBuilder
          .andWhere(`${geometryFieldReference} IS NOT NULL`)
          .andWhere(`${geometryFieldReference} && ${tileBounds4326}`)
          .andWhere(
            `ST_Intersects(${geometryFieldReference}, ${tileBounds4326})`,
          );

        queryBuilder.applyWorkspacePermissions();

        const [sourceQuery, sourceParameters] =
          queryBuilder.getQueryAndParameters();
        const tileQuery = buildMapVectorTileSql({
          sourceQuery,
          geometryColumnName,
          z,
          x,
          y,
          maxFeatures: tilePolicy.maxFeatureCount,
          extent: tilePolicy.extent,
          buffer: tilePolicy.buffer,
          simplificationMaxZoom: tilePolicy.simplification.maxZoom,
          simplificationToleranceMultiplier:
            tilePolicy.simplification.toleranceMultiplier,
          simplificationEnabled: tilePolicy.simplification.enabled,
        });

        const [tileResult] = await globalWorkspaceDataSource.query(
          tileQuery,
          [...sourceParameters],
          undefined,
          { shouldBypassPermissionChecks: true },
        );

        const tile = tileResult?.tile ?? Buffer.alloc(0);
        const durationMs = Math.round(performance.now() - startTime);

        this.logger.debug(
          `Generated vector tile for view ${viewId} at ${z}/${x}/${y} in ${durationMs}ms (${tile.length} bytes) with policy ${JSON.stringify(tilePolicy)}`,
        );

        return tile;
      },
      authContext,
    );
  }

  private assertTileCoordinates({
    z,
    x,
    y,
  }: {
    z: number;
    x: number;
    y: number;
  }) {
    assertTileCoordinate({
      value: z,
      name: 'z',
      max: MAP_VECTOR_TILE_MAX_ZOOM,
    });

    const maxCoordinate = 2 ** z - 1;

    assertTileCoordinate({ value: x, name: 'x', max: maxCoordinate });
    assertTileCoordinate({ value: y, name: 'y', max: maxCoordinate });
  }

  private resolveTilePolicy({
    flatView,
    flatFieldMetadata,
  }: TileContext): GeoMapTilePolicy {
    try {
      return resolveMapTilePolicy({
        fieldPolicy: flatFieldMetadata.settings?.mapTilePolicy,
        viewPolicy: flatView.mapTilePolicy,
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? `Invalid map tile policy: ${error.message}`
          : 'Invalid map tile policy',
      );
    }
  }

  private buildEffectiveRecordFilter({
    flatView,
    flatObjectMetadata,
    flatFieldMetadataMaps,
    flatViewFilterMaps,
    flatViewFilterGroupMaps,
    recordFilter,
  }: {
    flatView: FlatView;
    flatObjectMetadata: FlatObjectMetadata;
    flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
    flatViewFilterMaps: FlatEntityMaps<FlatViewFilter>;
    flatViewFilterGroupMaps: FlatEntityMaps<FlatViewFilterGroup>;
    recordFilter: Partial<ObjectRecordFilter>;
  }) {
    try {
      return buildMapViewRecordFilter({
        flatView,
        flatObjectMetadata,
        flatFieldMetadataMaps,
        flatViewFilterMaps,
        flatViewFilterGroupMaps,
        requestRecordFilter: recordFilter,
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? `Invalid map view filter: ${error.message}`
          : 'Invalid map view filter',
      );
    }
  }

  private async getTileContext({
    authContext,
    viewId,
  }: {
    authContext: WorkspaceAuthContext;
    viewId: string;
  }): Promise<TileContext> {
    const {
      flatViewMaps,
      flatObjectMetadataMaps,
      flatFieldMetadataMaps,
      flatViewFilterMaps,
      flatViewFilterGroupMaps,
    } =
      await this.flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
        {
          workspaceId: authContext.workspace.id,
          flatMapsKeys: [
            'flatViewMaps',
            'flatObjectMetadataMaps',
            'flatFieldMetadataMaps',
            'flatViewFilterMaps',
            'flatViewFilterGroupMaps',
          ],
        },
      );

    const flatView = findFlatEntityByIdInFlatEntityMaps({
      flatEntityId: viewId,
      flatEntityMaps: flatViewMaps,
    });

    if (
      !isDefined(flatView) ||
      flatView.deletedAt !== null ||
      flatView.type !== ViewType.MAP
    ) {
      throw new NotFoundException('Map view not found');
    }

    if (!isDefined(flatView.mapFieldMetadataId)) {
      throw new BadRequestException('Map view has no geometry field');
    }

    const flatObjectMetadata = findFlatEntityByIdInFlatEntityMaps({
      flatEntityId: flatView.objectMetadataId,
      flatEntityMaps: flatObjectMetadataMaps,
    });

    const flatFieldMetadata = findFlatEntityByIdInFlatEntityMaps({
      flatEntityId: flatView.mapFieldMetadataId,
      flatEntityMaps: flatFieldMetadataMaps,
    });

    if (
      !isDefined(flatObjectMetadata) ||
      flatObjectMetadata.isActive !== true
    ) {
      throw new NotFoundException('Map object not found');
    }

    if (
      !isDefined(flatFieldMetadata) ||
      flatFieldMetadata.isActive !== true ||
      flatFieldMetadata.type !== FieldMetadataType.GEOMETRY ||
      flatFieldMetadata.objectMetadataId !== flatObjectMetadata.id
    ) {
      throw new BadRequestException('Map view field must be a geometry field');
    }

    return {
      flatView,
      flatObjectMetadata,
      flatObjectMetadataMaps,
      flatFieldMetadata:
        flatFieldMetadata as FlatFieldMetadata<FieldMetadataType.GEOMETRY>,
      flatFieldMetadataMaps,
      flatViewFilterMaps,
      flatViewFilterGroupMaps,
    };
  }
}
