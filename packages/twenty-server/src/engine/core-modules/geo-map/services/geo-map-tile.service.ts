import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { FieldMetadataType, ViewType } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { GraphqlQueryParser } from 'src/engine/api/graphql/graphql-query-runner/graphql-query-parsers/graphql-query.parser';
import { type ObjectRecordFilter } from 'src/engine/api/graphql/workspace-query-builder/interfaces/object-record.interface';
import { MAP_VECTOR_TILE_LAYER_NAME } from 'src/engine/core-modules/geo-map/constants/map-vector-tile.constants';
import {
  buildMapGeometryBoundsSql,
  buildMapVectorTileSql,
} from 'src/engine/core-modules/geo-map/utils/build-map-vector-tile-sql.util';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { WorkspaceManyOrAllFlatEntityMapsCacheService } from 'src/engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.service';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { findFlatEntityByIdInFlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps.util';
import { computeColumnName } from 'src/engine/metadata-modules/field-metadata/utils/compute-column-name.util';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
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
  flatObjectMetadata: FlatObjectMetadata;
  flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>;
  flatFieldMetadata: FlatFieldMetadata<FieldMetadataType.GEOMETRY>;
  flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
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
    const { flatObjectMetadata } = await this.getTileContext({
      authContext,
      viewId,
    });

    return {
      tilejson: '3.0.0',
      name: `${flatObjectMetadata.nameSingular}-records`,
      tiles: [`/rest/map/views/${viewId}/tiles/{z}/{x}/{y}.mvt`],
      minzoom: 0,
      maxzoom: 22,
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
      flatObjectMetadata,
      flatObjectMetadataMaps,
      flatFieldMetadata,
      flatFieldMetadataMaps,
    } = await this.getTileContext({
      authContext,
      viewId,
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

        graphqlQueryParser.applyDeletedAtToBuilder(queryBuilder, recordFilter);
        graphqlQueryParser.applyFilterToBuilder(
          queryBuilder,
          recordAlias,
          recordFilter,
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
    this.assertTileCoordinates({ z, x, y });

    const {
      flatObjectMetadata,
      flatObjectMetadataMaps,
      flatFieldMetadata,
      flatFieldMetadataMaps,
    } = await this.getTileContext({
      authContext,
      viewId,
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

        graphqlQueryParser.applyDeletedAtToBuilder(queryBuilder, recordFilter);
        graphqlQueryParser.applyFilterToBuilder(
          queryBuilder,
          recordAlias,
          recordFilter,
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
        });

        const [tileResult] = await globalWorkspaceDataSource.query(
          tileQuery,
          [...sourceParameters],
          undefined,
          { shouldBypassPermissionChecks: true },
        );

        return tileResult?.tile ?? Buffer.alloc(0);
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
    assertTileCoordinate({ value: z, name: 'z', max: 22 });

    const maxCoordinate = 2 ** z - 1;

    assertTileCoordinate({ value: x, name: 'x', max: maxCoordinate });
    assertTileCoordinate({ value: y, name: 'y', max: maxCoordinate });
  }

  private async getTileContext({
    authContext,
    viewId,
  }: {
    authContext: WorkspaceAuthContext;
    viewId: string;
  }): Promise<TileContext> {
    const { flatViewMaps, flatObjectMetadataMaps, flatFieldMetadataMaps } =
      await this.flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
        {
          workspaceId: authContext.workspace.id,
          flatMapsKeys: [
            'flatViewMaps',
            'flatObjectMetadataMaps',
            'flatFieldMetadataMaps',
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
      flatObjectMetadata,
      flatObjectMetadataMaps,
      flatFieldMetadata:
        flatFieldMetadata as FlatFieldMetadata<FieldMetadataType.GEOMETRY>,
      flatFieldMetadataMaps,
    };
  }
}
