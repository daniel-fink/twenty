import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { ViewType } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { type DataSource } from 'typeorm';

import {
  GeoReferenceLayerEntity,
  GeoReferenceLayerStatus,
  GeoReferenceLayerValidationStatus,
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
  private readonly logger = new Logger(GeoReferenceLayerService.name);

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
          AND "geoReferenceLayer"."validationStatus" = $4
        ORDER BY "viewGeoReferenceLayer"."position" ASC
      `,
      [
        authContext.workspace.id,
        viewId,
        GeoReferenceLayerStatus.ACTIVE,
        GeoReferenceLayerValidationStatus.VALID,
      ],
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
      attribution: layer.attribution,
      vector_layers: [
        {
          id: layer.key,
          fields: {
            id: 'String',
            selectedFeatureValue: 'String',
            title: 'String',
            ...Object.fromEntries(
              layer.sidebarContract.query.sort.map((_, index) => [
                `sort_${index}`,
                'String',
              ]),
            ),
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
    const startTime = performance.now();

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
      this.logger.debug(
        `Returned empty reference vector tile outside zoom policy for layer ${layer.id} in view ${viewId} at ${z}/${x}/${y} with minZoom ${layer.tile.minZoom} and maxZoom ${layer.tile.maxZoom}`,
      );

      return Buffer.alloc(0);
    }

    const client = await this.connectionService.connect(layer.source);

    try {
      const tileSql = buildGeoReferenceLayerTileSql({ layer, z, x, y });
      const result = await client.query<{ tile: Buffer | null }>(tileSql);
      const tile = result.rows[0]?.tile ?? Buffer.alloc(0);
      const durationMs = Math.round(performance.now() - startTime);

      this.logger.debug(
        `Generated reference vector tile for layer ${layer.id} in view ${viewId} at ${z}/${x}/${y} in ${durationMs}ms (${tile.length} bytes)`,
      );

      return tile;
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
    const contract = layer.sidebarContract;
    const contractFields = contract.sections.flatMap(
      (section) => section.fields,
    );
    const sourceTable = quoteGeoReferenceSqlQualifiedName(layer.source);
    const selectedFeatureColumn = quoteGeoReferenceSqlIdentifier(
      contract.query.selectedFeatureField,
    );
    const targetColumn = quoteGeoReferenceSqlIdentifier(
      contract.query.targetField,
    );
    const geometryColumn = quoteGeoReferenceSqlIdentifier(
      layer.source.geometryColumnName,
    );
    const fieldSelects = contractFields.map((field) => {
      const column = quoteGeoReferenceSqlIdentifier(field.column);

      return `"source".${column} AS "${field.column}"`;
    });
    const titleSelects = contract.query.selectionTitle.fields.map((field) => {
      const column = quoteGeoReferenceSqlIdentifier(field);

      return `NULLIF("source".${column}::text, '')`;
    });
    const titleExpression =
      titleSelects.length > 0
        ? `COALESCE(${titleSelects.join(', ')}, "source".${selectedFeatureColumn}::text)`
        : `"source".${selectedFeatureColumn}::text`;
    const groupByColumns = new Set([
      `"source".${selectedFeatureColumn}`,
      ...contractFields.map(
        (field) => `"source".${quoteGeoReferenceSqlIdentifier(field.column)}`,
      ),
      ...contract.query.selectionTitle.fields.map(
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
            "source".${selectedFeatureColumn}::text AS "selectedFeatureValue",
            ${titleExpression} AS "title",
            json_build_array(
              ST_XMin(ST_Extent(${geometry4326}))::float8,
              ST_YMin(ST_Extent(${geometry4326}))::float8,
              ST_XMax(ST_Extent(${geometry4326}))::float8,
              ST_YMax(ST_Extent(${geometry4326}))::float8
            ) AS "bounds"
            ${fieldSelects.length > 0 ? `, ${fieldSelects.join(', ')}` : ''}
          FROM ${sourceTable} "source"
          WHERE "source".${targetColumn}::text = $1
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
        selectedFeatureValue: row.selectedFeatureValue,
        title: row.title ?? row.selectedFeatureValue,
        bounds: row.bounds,
        tab: {
          id: contract.tabId,
          title: contract.title,
        },
        sections: contract.sections.map((section) => ({
          id: section.id,
          title: section.title,
          fields: section.fields.map((field) => ({
            column: field.column,
            label: field.label,
            type: field.type,
            description: field.description ?? null,
            format: field.format ?? null,
            formatOptions: field.formatOptions ?? null,
            value: row[field.column] ?? null,
          })),
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
          AND "geoReferenceLayer"."validationStatus" = $5
      `,
      [
        authContext.workspace.id,
        viewId,
        layerId,
        GeoReferenceLayerStatus.ACTIVE,
        GeoReferenceLayerValidationStatus.VALID,
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
      attribution: layer.attribution,
      style: layer.style,
      query: {
        selectedFeatureField: layer.sidebarContract.query.selectedFeatureField,
        sort: layer.sidebarContract.query.sort,
      },
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
      tileProvider: row.tileProvider as GeoReferenceLayerEntity['tileProvider'],
      source: row.source as GeoReferenceLayerSource,
      tile: row.tile as GeoReferenceLayerEntity['tile'],
      style: row.style as GeoReferenceLayerEntity['style'],
      sidebarContract:
        row.sidebarContract as GeoReferenceLayerEntity['sidebarContract'],
      securityPolicy:
        row.securityPolicy as GeoReferenceLayerEntity['securityPolicy'],
      attribution: (row.attribution as string | null) ?? null,
      validationStatus:
        (row.validationStatus as GeoReferenceLayerValidationStatus) ??
        GeoReferenceLayerValidationStatus.NOT_VALIDATED,
      validationError: (row.validationError as string | null) ?? null,
      lastValidatedAt: (row.lastValidatedAt as Date | null) ?? null,
      rowCount: (row.rowCount as number | null) ?? null,
      bounds: row.bounds as GeoReferenceLayerEntity['bounds'],
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      sidebarContractPath: (row.sidebarContractPath as string | null) ?? null,
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
