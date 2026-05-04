import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { ViewType } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { type DataSource } from 'typeorm';

import {
  GeoReferenceLayerEntity,
  GeoReferenceLayerStatus,
  type GeoReferenceLayerSource,
} from 'src/engine/core-modules/geo-map/entities/geo-reference-layer.entity';
import { type ViewGeoReferenceLayerEntity } from 'src/engine/core-modules/geo-map/entities/view-geo-reference-layer.entity';
import { GeoReferenceLayerConnectionService } from 'src/engine/core-modules/geo-map/reference-layer-catalog/services/geo-reference-layer-connection.service';
import {
  assertGeoReferenceTileCoordinates,
  buildGeoReferenceLayerBoundsSql,
  buildGeoReferenceLayerTileSql,
} from 'src/engine/core-modules/geo-map/reference-layer-catalog/utils/build-geo-reference-layer-tile-sql.util';
import {
  quoteGeoReferenceSqlIdentifier,
  quoteGeoReferenceSqlQualifiedName,
} from 'src/engine/core-modules/geo-map/reference-layer-catalog/utils/geo-reference-sql.util';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { GeoReferenceLayerVisibilityPreferenceService } from 'src/engine/core-modules/geo-map/services/geo-reference-layer-visibility-preference.service';

type ReferenceLayerBounds = [number, number, number, number];

@Injectable()
export class GeoReferenceLayerService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly connectionService: GeoReferenceLayerConnectionService,
    private readonly visibilityPreferenceService: GeoReferenceLayerVisibilityPreferenceService,
  ) {}

  async getReferenceLayers({
    authContext,
    viewId,
  }: {
    authContext: WorkspaceAuthContext;
    viewId: string;
  }) {
    await this.assertMapView({ authContext, viewId });

    const rows = await this.dataSource.query(
      `
        SELECT
          "viewGeoReferenceLayer"."id" AS "attachment_id",
          "viewGeoReferenceLayer"."workspaceId" AS "attachment_workspaceId",
          "viewGeoReferenceLayer"."viewId" AS "attachment_viewId",
          "viewGeoReferenceLayer"."geoReferenceLayerId" AS "attachment_geoReferenceLayerId",
          "viewGeoReferenceLayer"."position" AS "attachment_position",
          "viewGeoReferenceLayer"."isVisible" AS "attachment_isVisible",
          "viewGeoReferenceLayer"."styleOverride" AS "attachment_styleOverride",
          "geoReferenceLayer".*
        FROM "core"."viewGeoReferenceLayer" "viewGeoReferenceLayer"
        INNER JOIN "core"."geoReferenceLayer" "geoReferenceLayer"
          ON "geoReferenceLayer"."id" = "viewGeoReferenceLayer"."geoReferenceLayerId"
        WHERE "viewGeoReferenceLayer"."workspaceId" = $1
          AND "viewGeoReferenceLayer"."viewId" = $2
          AND "geoReferenceLayer"."status" = $3
        ORDER BY "viewGeoReferenceLayer"."position" ASC
      `,
      [authContext.workspace.id, viewId, GeoReferenceLayerStatus.ACTIVE],
    );

    const preferences =
      authContext.type === 'user'
        ? await this.visibilityPreferenceService.getPreferences({
            userId: authContext.user.id,
            workspaceId: authContext.workspace.id,
            viewId,
          })
        : {};

    return rows.map((row: Record<string, unknown>) => {
      const layer = this.mapRawLayer(row);
      const attachment = this.mapRawAttachment(row);

      return this.toReferenceLayerResponse({
        attachment,
        layer,
        isVisible: preferences[layer.id] ?? attachment.isVisible,
      });
    });
  }

  async getTileJson({
    authContext,
    viewId,
    layerId,
  }: {
    authContext: WorkspaceAuthContext;
    viewId: string;
    layerId: string;
  }) {
    const { layer } = await this.getAttachedLayerOrThrow({
      authContext,
      viewId,
      layerId,
    });

    return {
      tilejson: '3.0.0',
      name: layer.key,
      tiles: [
        `/rest/map/views/${viewId}/reference-layers/${layer.id}/tiles/{z}/{x}/{y}.mvt`,
      ],
      minzoom: layer.tile.minZoom,
      maxzoom: layer.tile.maxZoom,
      vector_layers: [
        {
          id: layer.key,
          fields: {
            id: 'String',
          },
        },
      ],
    };
  }

  async getVectorTile({
    authContext,
    viewId,
    layerId,
    z,
    x,
    y,
  }: {
    authContext: WorkspaceAuthContext;
    viewId: string;
    layerId: string;
    z: number;
    x: number;
    y: number;
  }): Promise<Buffer> {
    try {
      assertGeoReferenceTileCoordinates({ z, x, y });
    } catch {
      throw new BadRequestException('Invalid tile coordinate');
    }

    const { layer } = await this.getAttachedLayerOrThrow({
      authContext,
      viewId,
      layerId,
    });

    if (z < layer.tile.minZoom || z > layer.tile.maxZoom) {
      return Buffer.alloc(0);
    }

    const client = await this.connectionService.connect(layer.source);

    try {
      const tileSql = buildGeoReferenceLayerTileSql({ layer, z, x, y });
      const result = await client.query<{ tile: Buffer | null }>(tileSql);

      return result.rows[0]?.tile ?? Buffer.alloc(0);
    } finally {
      await client.end();
    }
  }

  async getBounds({
    authContext,
    viewId,
    layerId,
  }: {
    authContext: WorkspaceAuthContext;
    viewId: string;
    layerId: string;
  }) {
    const { layer } = await this.getAttachedLayerOrThrow({
      authContext,
      viewId,
      layerId,
    });
    const client = await this.connectionService.connect(layer.source);

    try {
      const boundsSql = buildGeoReferenceLayerBoundsSql({ layer });
      const result = await client.query<{
        bounds: ReferenceLayerBounds | null;
        recordCount: number;
      }>(boundsSql);

      return {
        bounds: result.rows[0]?.bounds ?? null,
        recordCount: Number(result.rows[0]?.recordCount ?? 0),
      };
    } finally {
      await client.end();
    }
  }

  async getFeature({
    authContext,
    viewId,
    layerId,
    featureId,
  }: {
    authContext: WorkspaceAuthContext;
    viewId: string;
    layerId: string;
    featureId: string;
  }) {
    const { layer } = await this.getAttachedLayerOrThrow({
      authContext,
      viewId,
      layerId,
    });
    const client = await this.connectionService.connect(layer.source);
    const properties = layer.exposedProperties;
    const sourceTable = quoteGeoReferenceSqlQualifiedName(layer.source);
    const idColumn = quoteGeoReferenceSqlIdentifier(layer.source.idColumnName);
    const geometryColumn = quoteGeoReferenceSqlIdentifier(
      layer.source.geometryColumnName,
    );
    const propertySelects = properties.map((property) => {
      const column = quoteGeoReferenceSqlIdentifier(property.column);

      return `"source".${column} AS "${property.column}"`;
    });
    const titleSelects = layer.title.fields.map((field) => {
      const column = quoteGeoReferenceSqlIdentifier(field);

      return `"source".${column}::text`;
    });
    const titleExpression =
      titleSelects.length > 0
        ? `COALESCE(${titleSelects.join(', ')}, "source".${idColumn}::text)`
        : `"source".${idColumn}::text`;
    const groupByColumns = new Set([
      `"source".${idColumn}`,
      ...properties.map(
        (property) =>
          `"source".${quoteGeoReferenceSqlIdentifier(property.column)}`,
      ),
      ...layer.title.fields.map(
        (field) => `"source".${quoteGeoReferenceSqlIdentifier(field)}`,
      ),
    ]);
    const geometry4326 = this.getGeometry4326Expression({
      source: layer.source,
      geometryColumn,
    });

    try {
      const result = await client.query<Record<string, unknown>>(
        `
          SELECT
            "source".${idColumn}::text AS "featureId",
            ${titleExpression} AS "title",
            json_build_array(
              ST_XMin(ST_Extent(${geometry4326}))::float8,
              ST_YMin(ST_Extent(${geometry4326}))::float8,
              ST_XMax(ST_Extent(${geometry4326}))::float8,
              ST_YMax(ST_Extent(${geometry4326}))::float8
            ) AS "bounds"
            ${propertySelects.length > 0 ? `, ${propertySelects.join(', ')}` : ''}
          FROM ${sourceTable} "source"
          WHERE "source".${idColumn}::text = $1
          GROUP BY ${[...groupByColumns].join(', ')}
          LIMIT 1
        `,
        [featureId],
      );
      const row = result.rows[0];

      if (!isDefined(row)) {
        throw new NotFoundException('Reference feature not found');
      }

      return {
        layerId: layer.id,
        layerKey: layer.key,
        layerName: layer.name,
        featureId: row.featureId,
        title: row.title ?? row.featureId,
        bounds: row.bounds,
        properties: properties.map((property) => ({
          column: property.column,
          label: property.label,
          type: property.type,
          tab: property.tab ?? null,
          group: property.group ?? null,
          role: property.role ?? null,
          description: property.description ?? null,
          value: row[property.column] ?? null,
        })),
      };
    } finally {
      await client.end();
    }
  }

  async setVisibilityPreference({
    authContext,
    viewId,
    layerId,
    isVisible,
  }: {
    authContext: WorkspaceAuthContext;
    viewId: string;
    layerId: string;
    isVisible: boolean;
  }) {
    if (authContext.type !== 'user') {
      throw new BadRequestException(
        'Layer visibility preferences require a user',
      );
    }

    await this.getAttachedLayerOrThrow({ authContext, viewId, layerId });

    await this.visibilityPreferenceService.setPreference({
      userId: authContext.user.id,
      workspaceId: authContext.workspace.id,
      viewId,
      layerId,
      isVisible,
    });
  }

  async getVisibilityPreferences({
    authContext,
    viewId,
  }: {
    authContext: WorkspaceAuthContext;
    viewId: string;
  }) {
    await this.assertMapView({ authContext, viewId });

    if (authContext.type !== 'user') {
      return {};
    }

    return this.visibilityPreferenceService.getPreferences({
      userId: authContext.user.id,
      workspaceId: authContext.workspace.id,
      viewId,
    });
  }

  private async getAttachedLayerOrThrow({
    authContext,
    viewId,
    layerId,
  }: {
    authContext: WorkspaceAuthContext;
    viewId: string;
    layerId: string;
  }) {
    await this.assertMapView({ authContext, viewId });

    const [row] = await this.dataSource.query(
      `
        SELECT
          "viewGeoReferenceLayer"."id" AS "attachment_id",
          "viewGeoReferenceLayer"."workspaceId" AS "attachment_workspaceId",
          "viewGeoReferenceLayer"."viewId" AS "attachment_viewId",
          "viewGeoReferenceLayer"."geoReferenceLayerId" AS "attachment_geoReferenceLayerId",
          "viewGeoReferenceLayer"."position" AS "attachment_position",
          "viewGeoReferenceLayer"."isVisible" AS "attachment_isVisible",
          "viewGeoReferenceLayer"."styleOverride" AS "attachment_styleOverride",
          "geoReferenceLayer".*
        FROM "core"."viewGeoReferenceLayer" "viewGeoReferenceLayer"
        INNER JOIN "core"."geoReferenceLayer" "geoReferenceLayer"
          ON "geoReferenceLayer"."id" = "viewGeoReferenceLayer"."geoReferenceLayerId"
        WHERE "viewGeoReferenceLayer"."workspaceId" = $1
          AND "viewGeoReferenceLayer"."viewId" = $2
          AND "geoReferenceLayer"."id" = $3
          AND "geoReferenceLayer"."status" = $4
      `,
      [
        authContext.workspace.id,
        viewId,
        layerId,
        GeoReferenceLayerStatus.ACTIVE,
      ],
    );

    if (!isDefined(row)) {
      throw new NotFoundException('Reference layer not found');
    }

    return {
      attachment: this.mapRawAttachment(row),
      layer: this.mapRawLayer(row),
    };
  }

  private async assertMapView({
    authContext,
    viewId,
  }: {
    authContext: WorkspaceAuthContext;
    viewId: string;
  }) {
    const [view] = await this.dataSource.query(
      `
        SELECT "id"
        FROM "core"."view"
        WHERE "id" = $1
          AND "workspaceId" = $2
          AND "deletedAt" IS NULL
          AND "type" = $3
      `,
      [viewId, authContext.workspace.id, ViewType.MAP],
    );

    if (!isDefined(view)) {
      throw new NotFoundException('Map view not found');
    }
  }

  private toReferenceLayerResponse({
    attachment,
    layer,
    isVisible,
  }: {
    attachment: Pick<ViewGeoReferenceLayerEntity, 'position' | 'isVisible'>;
    layer: GeoReferenceLayerEntity;
    isVisible: boolean;
  }) {
    return {
      id: layer.id,
      key: layer.key,
      name: layer.name,
      description: layer.description,
      source: {
        geometryType: layer.source.geometryType,
      },
      tile: layer.tile,
      style: layer.style,
      title: layer.title,
      exposedProperties: layer.exposedProperties.map((property) => ({
        column: property.column,
        label: property.label,
        type: property.type,
        tab: property.tab ?? null,
        group: property.group ?? null,
      })),
      attachment: {
        position: attachment.position,
        defaultIsVisible: attachment.isVisible,
        isVisible,
      },
    };
  }

  private mapRawLayer(row: Record<string, unknown>): GeoReferenceLayerEntity {
    return {
      id: row.id as string,
      workspaceId: row.workspaceId as string,
      key: row.key as string,
      catalogKey: row.catalogKey as string,
      name: row.name as string,
      description: (row.description as string | null) ?? null,
      status: row.status as GeoReferenceLayerStatus,
      source: row.source as GeoReferenceLayerSource,
      tile: row.tile as GeoReferenceLayerEntity['tile'],
      style: row.style as GeoReferenceLayerEntity['style'],
      title: row.title as GeoReferenceLayerEntity['title'],
      exposedProperties:
        (row.exposedProperties as GeoReferenceLayerEntity['exposedProperties']) ??
        [],
      propertyManifestPath: (row.propertyManifestPath as string | null) ?? null,
      catalogVersion: row.catalogVersion as number,
      lastSyncAt: row.lastSyncAt as Date,
      createdAt: row.createdAt as Date,
      updatedAt: row.updatedAt as Date,
    } as GeoReferenceLayerEntity;
  }

  private mapRawAttachment(
    row: Record<string, unknown>,
  ): Pick<ViewGeoReferenceLayerEntity, 'position' | 'isVisible'> {
    return {
      position: Number(row.attachment_position ?? row.position ?? 0),
      isVisible: Boolean(row.attachment_isVisible ?? row.isVisible),
    };
  }

  private getGeometry4326Expression({
    source,
    geometryColumn,
  }: {
    source: GeoReferenceLayerSource;
    geometryColumn: string;
  }) {
    return source.geometrySrid === 4326
      ? `"source".${geometryColumn}::geometry`
      : `ST_Transform("source".${geometryColumn}::geometry, 4326)`;
  }
}
