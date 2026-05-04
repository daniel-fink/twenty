import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { ViewType } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { type DataSource } from 'typeorm';

import { type LoadedGeoReferenceLayerCatalog } from 'src/engine/core-modules/geo-map/reference-layer-catalog/utils/load-geo-reference-layer-catalog.util';
import {
  GeoReferenceLayerStatus,
  GeoReferenceLayerValidationStatus,
} from 'src/engine/core-modules/geo-map/entities/geo-reference-layer.entity';
import { GeoReferenceLayerCatalogLoaderService } from 'src/engine/core-modules/geo-map/reference-layer-catalog/services/geo-reference-layer-catalog-loader.service';
import { GeoReferenceLayerCatalogValidationService } from 'src/engine/core-modules/geo-map/reference-layer-catalog/services/geo-reference-layer-catalog-validation.service';

type SyncGeoReferenceLayerCatalogArgs = {
  workspaceId: string;
  viewId: string;
  catalogPath?: string;
};

export type SyncGeoReferenceLayerCatalogResult = {
  layerCount: number;
  attachmentCount: number;
  archivedLayerCount: number;
  invalidLayerCount: number;
};

@Injectable()
export class GeoReferenceLayerCatalogSyncService {
  private readonly logger = new Logger(
    GeoReferenceLayerCatalogSyncService.name,
  );

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly catalogLoaderService: GeoReferenceLayerCatalogLoaderService,
    private readonly catalogValidationService: GeoReferenceLayerCatalogValidationService,
  ) {}

  async syncCatalog({
    workspaceId,
    viewId,
    catalogPath,
  }: SyncGeoReferenceLayerCatalogArgs): Promise<SyncGeoReferenceLayerCatalogResult> {
    const catalog = await this.catalogLoaderService.loadCatalog({
      catalogPath,
    });
    const validationResult =
      await this.catalogValidationService.validateCatalog({ catalog });
    const invalidLayers = validationResult.layers.filter(
      (layer) => layer.status === GeoReferenceLayerValidationStatus.INVALID,
    );

    await this.assertMapView({ workspaceId, viewId });

    return this.dataSource.transaction(async (manager) => {
      const now = new Date();
      const layerIdsByKey = new Map<string, string>();
      const incomingKeys = catalog.layers.map((layer) => layer.key);
      const validationResultsByKey = Object.fromEntries(
        validationResult.layers.map((layer) => [layer.layerKey, layer]),
      );

      for (const layer of catalog.layers) {
        const connection = layer.source.connectionKey
          ? catalog.connections[layer.source.connectionKey]
          : undefined;
        const source = {
          ...layer.source,
          connectionUriEnv: connection?.uriEnv ?? null,
        };
        const layerValidation = validationResultsByKey[layer.key];
        const status =
          layer.status === GeoReferenceLayerStatus.DISABLED
            ? GeoReferenceLayerStatus.DISABLED
            : GeoReferenceLayerStatus.ACTIVE;
        const [row] = await manager.query(
          `
            INSERT INTO "core"."geoReferenceLayer" (
              "workspaceId",
              "key",
              "catalogKey",
              "name",
              "description",
              "status",
              "tileProvider",
              "source",
              "tile",
              "style",
              "sidebarContract",
              "securityPolicy",
              "attribution",
              "validationStatus",
              "validationError",
              "lastValidatedAt",
              "rowCount",
              "bounds",
              "metadata",
              "sidebarContractPath",
              "catalogVersion",
              "lastSyncAt"
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13, $14, $15, $16, $17, $18::jsonb, $19::jsonb, $20, $21, $22)
            ON CONFLICT ("workspaceId", "key")
            DO UPDATE SET
              "catalogKey" = EXCLUDED."catalogKey",
              "name" = EXCLUDED."name",
              "description" = EXCLUDED."description",
              "status" = EXCLUDED."status",
              "tileProvider" = EXCLUDED."tileProvider",
              "source" = EXCLUDED."source",
              "tile" = EXCLUDED."tile",
              "style" = EXCLUDED."style",
              "sidebarContract" = EXCLUDED."sidebarContract",
              "securityPolicy" = EXCLUDED."securityPolicy",
              "attribution" = EXCLUDED."attribution",
              "validationStatus" = EXCLUDED."validationStatus",
              "validationError" = EXCLUDED."validationError",
              "lastValidatedAt" = EXCLUDED."lastValidatedAt",
              "rowCount" = EXCLUDED."rowCount",
              "bounds" = EXCLUDED."bounds",
              "metadata" = EXCLUDED."metadata",
              "sidebarContractPath" = EXCLUDED."sidebarContractPath",
              "catalogVersion" = EXCLUDED."catalogVersion",
              "lastSyncAt" = EXCLUDED."lastSyncAt",
              "updatedAt" = now()
            RETURNING "id"
          `,
          [
            workspaceId,
            layer.key,
            catalog.catalogKey,
            layer.name,
            layer.description ?? null,
            status,
            layer.tileProvider,
            JSON.stringify(source),
            JSON.stringify(layer.tile),
            JSON.stringify(layer.style),
            JSON.stringify(layer.sidebarContract),
            JSON.stringify(layer.securityPolicy),
            layer.attribution ?? null,
            layerValidation?.status ??
              GeoReferenceLayerValidationStatus.NOT_VALIDATED,
            layerValidation?.error ?? null,
            layerValidation?.status ===
              GeoReferenceLayerValidationStatus.VALID ||
            layerValidation?.status ===
              GeoReferenceLayerValidationStatus.INVALID
              ? now
              : null,
            layerValidation?.rowCount ?? null,
            JSON.stringify(layerValidation?.bounds ?? null),
            JSON.stringify(layer.metadata),
            layer.sidebarContractPath,
            catalog.version,
            now,
          ],
        );

        layerIdsByKey.set(layer.key, row.id);
      }

      const archivedRows = await manager.query(
        `
          UPDATE "core"."geoReferenceLayer"
          SET "status" = $4, "updatedAt" = now()
          WHERE "workspaceId" = $1
            AND "catalogKey" = $2
            AND NOT ("key" = ANY($3))
            AND "status" != $4
          RETURNING "id"
        `,
        [
          workspaceId,
          catalog.catalogKey,
          incomingKeys,
          GeoReferenceLayerStatus.ARCHIVED,
        ],
      );

      const defaultAttachments = this.getDefaultAttachments(catalog);

      for (const attachment of defaultAttachments) {
        const geoReferenceLayerId = layerIdsByKey.get(attachment.layerKey);

        if (!isDefined(geoReferenceLayerId)) {
          continue;
        }

        await manager.query(
          `
            INSERT INTO "core"."viewGeoReferenceLayer" (
              "workspaceId",
              "viewId",
              "geoReferenceLayerId",
              "position",
              "isVisible"
            )
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT ("viewId", "geoReferenceLayerId")
            DO UPDATE SET
              "position" = EXCLUDED."position",
              "isVisible" = EXCLUDED."isVisible",
              "updatedAt" = now()
          `,
          [
            workspaceId,
            viewId,
            geoReferenceLayerId,
            attachment.position,
            attachment.isVisible,
          ],
        );
      }

      return {
        layerCount: catalog.layers.length,
        attachmentCount: defaultAttachments.length,
        archivedLayerCount: archivedRows.length,
        invalidLayerCount: invalidLayers.length,
      };
    });
  }

  private getDefaultAttachments(catalog: LoadedGeoReferenceLayerCatalog) {
    if (isDefined(catalog.defaultViewAttachments)) {
      return catalog.defaultViewAttachments;
    }

    return catalog.layers.flatMap((layer) =>
      isDefined(layer.defaultAttachment)
        ? [
            {
              layerKey: layer.key,
              isVisible: layer.defaultAttachment.isVisible,
              position: layer.defaultAttachment.position,
            },
          ]
        : [],
    );
  }

  private async assertMapView({
    workspaceId,
    viewId,
  }: {
    workspaceId: string;
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
      [viewId, workspaceId, ViewType.MAP],
    );

    if (!isDefined(view)) {
      throw new Error(
        `Map view ${viewId} was not found in workspace ${workspaceId}`,
      );
    }
  }
}
