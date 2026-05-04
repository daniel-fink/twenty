import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { ViewType } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { type DataSource } from 'typeorm';

import { GeoReferenceLayerConnectionService } from 'src/engine/core-modules/geo-map/reference-layer-catalog/services/geo-reference-layer-connection.service';
import {
  type LoadedGeoReferenceLayerCatalog,
  loadGeoReferenceLayerCatalogFromFile,
} from 'src/engine/core-modules/geo-map/reference-layer-catalog/utils/load-geo-reference-layer-catalog.util';
import {
  quoteGeoReferenceSqlIdentifier,
  quoteGeoReferenceSqlQualifiedName,
} from 'src/engine/core-modules/geo-map/reference-layer-catalog/utils/geo-reference-sql.util';
import { type GeoReferenceLayerCatalogLayer } from 'src/engine/core-modules/geo-map/reference-layer-catalog/geo-reference-layer-catalog.types';
import { GeoReferenceLayerStatus } from 'src/engine/core-modules/geo-map/entities/geo-reference-layer.entity';

type SyncGeoReferenceLayerCatalogArgs = {
  workspaceId: string;
  viewId: string;
  catalogPath: string;
};

export type SyncGeoReferenceLayerCatalogResult = {
  layerCount: number;
  attachmentCount: number;
  archivedLayerCount: number;
};

@Injectable()
export class GeoReferenceLayerCatalogSyncService {
  private readonly logger = new Logger(
    GeoReferenceLayerCatalogSyncService.name,
  );

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly connectionService: GeoReferenceLayerConnectionService,
  ) {}

  async syncCatalog({
    workspaceId,
    viewId,
    catalogPath,
  }: SyncGeoReferenceLayerCatalogArgs): Promise<SyncGeoReferenceLayerCatalogResult> {
    const catalog = loadGeoReferenceLayerCatalogFromFile(catalogPath);

    await this.assertMapView({ workspaceId, viewId });
    await this.validateCatalogSources({ catalog });

    return this.dataSource.transaction(async (manager) => {
      const now = new Date();
      const layerIdsByKey = new Map<string, string>();
      const incomingKeys = catalog.layers.map((layer) => layer.key);

      for (const layer of catalog.layers) {
        const connection = layer.source.connectionKey
          ? catalog.connections[layer.source.connectionKey]
          : undefined;
        const source = {
          ...layer.source,
          connectionUriEnv: connection?.uriEnv ?? null,
        };
        const exposedProperties =
          layer.exposedPropertiesManifest?.properties ??
          layer.exposedProperties ??
          [];
        const [row] = await manager.query(
          `
            INSERT INTO "core"."geoReferenceLayer" (
              "workspaceId",
              "key",
              "catalogKey",
              "name",
              "description",
              "status",
              "source",
              "tile",
              "style",
              "title",
              "exposedProperties",
              "propertyManifestPath",
              "catalogVersion",
              "lastSyncAt"
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12, $13, $14)
            ON CONFLICT ("workspaceId", "key")
            DO UPDATE SET
              "catalogKey" = EXCLUDED."catalogKey",
              "name" = EXCLUDED."name",
              "description" = EXCLUDED."description",
              "status" = EXCLUDED."status",
              "source" = EXCLUDED."source",
              "tile" = EXCLUDED."tile",
              "style" = EXCLUDED."style",
              "title" = EXCLUDED."title",
              "exposedProperties" = EXCLUDED."exposedProperties",
              "propertyManifestPath" = EXCLUDED."propertyManifestPath",
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
            GeoReferenceLayerStatus.ACTIVE,
            JSON.stringify(source),
            JSON.stringify(layer.tile),
            JSON.stringify(layer.style),
            JSON.stringify(layer.title),
            JSON.stringify(exposedProperties),
            layer.propertyManifestPath ?? null,
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

  private async validateCatalogSources({
    catalog,
  }: {
    catalog: LoadedGeoReferenceLayerCatalog;
  }) {
    for (const layer of catalog.layers) {
      await this.validateLayerSource({ catalog, layer });
    }
  }

  private async validateLayerSource({
    catalog,
    layer,
  }: {
    catalog: LoadedGeoReferenceLayerCatalog;
    layer: GeoReferenceLayerCatalogLayer;
  }) {
    const connection = layer.source.connectionKey
      ? catalog.connections[layer.source.connectionKey]
      : undefined;
    const source = {
      ...layer.source,
      connectionUriEnv: connection?.uriEnv ?? null,
    };
    const client = await this.connectionService.connect(source);

    try {
      const sourceTable = quoteGeoReferenceSqlQualifiedName(layer.source);
      const idColumn = quoteGeoReferenceSqlIdentifier(
        layer.source.idColumnName,
      );
      const geometryColumn = quoteGeoReferenceSqlIdentifier(
        layer.source.geometryColumnName,
      );
      const properties = layer.exposedProperties ?? [];
      const propertyColumns = properties.map((property) => property.column);
      const requiredColumns = [
        layer.source.idColumnName,
        layer.source.geometryColumnName,
        ...layer.title.fields,
        ...propertyColumns,
      ];
      const columnRows = await client.query<{ column_name: string }>(
        `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = $1
            AND table_name = $2
        `,
        [layer.source.schemaName, layer.source.tableName],
      );
      const existingColumns = new Set(
        columnRows.rows.map((row) => row.column_name),
      );
      const missingColumns = requiredColumns.filter(
        (column) => !existingColumns.has(column),
      );

      if (missingColumns.length > 0) {
        throw new Error(
          `Layer ${layer.key} source ${sourceTable} is missing columns: ${missingColumns.join(', ')}`,
        );
      }

      const sridRows = await client.query<{ srid: number | null }>(
        `
          SELECT ST_SRID(${geometryColumn}::geometry)::integer AS srid
          FROM ${sourceTable}
          WHERE ${geometryColumn} IS NOT NULL
          LIMIT 1
        `,
      );
      const actualSrid = sridRows.rows[0]?.srid;

      if (isDefined(actualSrid) && actualSrid !== layer.source.geometrySrid) {
        throw new Error(
          `Layer ${layer.key} declares SRID ${layer.source.geometrySrid}, source has ${actualSrid}`,
        );
      }

      const idRows = await client.query<{
        null_ids: string;
        duplicate_ids: string;
      }>(
        `
          SELECT
            COUNT(*) FILTER (WHERE ${idColumn} IS NULL)::text AS null_ids,
            (COUNT(*) - COUNT(DISTINCT ${idColumn}))::text AS duplicate_ids
          FROM ${sourceTable}
        `,
      );

      if (Number(idRows.rows[0]?.null_ids ?? 0) > 0) {
        throw new Error(`Layer ${layer.key} id column contains null values`);
      }

      if (Number(idRows.rows[0]?.duplicate_ids ?? 0) > 0) {
        throw new Error(
          `Layer ${layer.key} id column contains duplicate values`,
        );
      }
    } finally {
      await client.end();
    }
  }
}
