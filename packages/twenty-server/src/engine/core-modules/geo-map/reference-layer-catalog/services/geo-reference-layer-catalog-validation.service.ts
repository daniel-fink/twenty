import { Injectable } from '@nestjs/common';

import { type Client } from 'pg';
import { isDefined } from 'twenty-shared/utils';

import {
  type GeoReferenceLayerBounds,
  type GeoReferenceLayerEntity,
  GeoReferenceLayerStatus,
  GeoReferenceLayerValidationStatus,
} from 'src/engine/core-modules/geo-map/entities/geo-reference-layer.entity';
import {
  type LoadedGeoReferenceLayerCatalog,
  type LoadedGeoReferenceLayerCatalogLayer,
} from 'src/engine/core-modules/geo-map/reference-layer-catalog/utils/load-geo-reference-layer-catalog.util';
import { GeoReferenceLayerConnectionService } from 'src/engine/core-modules/geo-map/reference-layer-catalog/services/geo-reference-layer-connection.service';
import {
  buildGeoReferenceLayerBoundsSql,
  buildGeoReferenceLayerTileSql,
} from 'src/engine/core-modules/geo-map/reference-layer-catalog/utils/build-geo-reference-layer-tile-sql.util';
import {
  quoteGeoReferenceSqlIdentifier,
  quoteGeoReferenceSqlQualifiedName,
} from 'src/engine/core-modules/geo-map/reference-layer-catalog/utils/geo-reference-sql.util';

export type GeoReferenceLayerCatalogLayerValidationResult = {
  layerKey: string;
  status: GeoReferenceLayerValidationStatus;
  error: string | null;
  rowCount: number | null;
  bounds: GeoReferenceLayerBounds | null;
};

export type GeoReferenceLayerCatalogValidationResult = {
  isValid: boolean;
  layers: GeoReferenceLayerCatalogLayerValidationResult[];
};

@Injectable()
export class GeoReferenceLayerCatalogValidationService {
  constructor(
    private readonly connectionService: GeoReferenceLayerConnectionService,
  ) {}

  async validateCatalog({
    catalog,
  }: {
    catalog: LoadedGeoReferenceLayerCatalog;
  }): Promise<GeoReferenceLayerCatalogValidationResult> {
    const layers = await Promise.all(
      catalog.layers.map((layer) => this.validateLayer({ catalog, layer })),
    );

    return {
      isValid: layers.every(
        (layer) => layer.status !== GeoReferenceLayerValidationStatus.INVALID,
      ),
      layers,
    };
  }

  private async validateLayer({
    catalog,
    layer,
  }: {
    catalog: LoadedGeoReferenceLayerCatalog;
    layer: LoadedGeoReferenceLayerCatalogLayer;
  }): Promise<GeoReferenceLayerCatalogLayerValidationResult> {
    if (layer.status === GeoReferenceLayerStatus.DISABLED) {
      return {
        bounds: null,
        error: null,
        layerKey: layer.key,
        rowCount: null,
        status: GeoReferenceLayerValidationStatus.NOT_VALIDATED,
      };
    }

    const connection = layer.source.connectionKey
      ? catalog.connections[layer.source.connectionKey]
      : undefined;
    const source = {
      ...layer.source,
      connectionUriEnv: connection?.uriEnv ?? null,
    };
    let client: Client | undefined;

    try {
      client = await this.connectionService.connect(source);
      const metadata = await this.validateActiveLayerSource({ client, layer });

      return {
        ...metadata,
        error: null,
        layerKey: layer.key,
        status: GeoReferenceLayerValidationStatus.VALID,
      };
    } catch (error) {
      return {
        bounds: null,
        error: error instanceof Error ? error.message : String(error),
        layerKey: layer.key,
        rowCount: null,
        status: GeoReferenceLayerValidationStatus.INVALID,
      };
    } finally {
      await client?.end();
    }
  }

  private async validateActiveLayerSource({
    client,
    layer,
  }: {
    client: Client;
    layer: LoadedGeoReferenceLayerCatalogLayer;
  }): Promise<{
    rowCount: number;
    bounds: GeoReferenceLayerBounds | null;
  }> {
    const sourceTable = quoteGeoReferenceSqlQualifiedName(layer.source);
    const geometryColumn = quoteGeoReferenceSqlIdentifier(
      layer.source.geometryColumnName,
    );

    await this.assertSourceTableExists({ client, layer, sourceTable });
    await this.assertRequiredColumnsExist({ client, layer, sourceTable });
    await this.assertGeometrySrid({
      client,
      layer,
      sourceTable,
      geometryColumn,
    });
    await this.assertGeometryTypes({
      client,
      layer,
      sourceTable,
      geometryColumn,
    });
    await this.assertGeometryGistIndex({ client, layer });
    await this.assertSelectedFeatureUniqueness({
      client,
      layer,
      sourceTable,
    });

    const operationalMetadata = await this.getLayerOperationalMetadata({
      client,
      layer,
    });

    await this.assertSampleTileGeneration({
      bounds: operationalMetadata.bounds,
      client,
      layer,
    });

    return operationalMetadata;
  }

  private async assertSourceTableExists({
    client,
    layer,
    sourceTable,
  }: {
    client: Client;
    layer: LoadedGeoReferenceLayerCatalogLayer;
    sourceTable: string;
  }) {
    const tableRows = await client.query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = $1
            AND table_name = $2
        ) AS "exists"
      `,
      [layer.source.schemaName, layer.source.tableName],
    );

    if (!tableRows.rows[0]?.exists) {
      throw new Error(`Layer ${layer.key} source ${sourceTable} was not found`);
    }
  }

  private async assertRequiredColumnsExist({
    client,
    layer,
    sourceTable,
  }: {
    client: Client;
    layer: LoadedGeoReferenceLayerCatalogLayer;
    sourceTable: string;
  }) {
    const contract = layer.sidebarContract;
    const fieldColumns = contract.sections.flatMap((section) =>
      section.fields.map((field) => field.column),
    );
    const sortColumns = contract.query.sort.map((sort) => sort.column);
    const requiredColumns = [
      layer.source.idColumnName,
      layer.source.geometryColumnName,
      contract.query.selectedFeatureField,
      contract.query.targetField,
      ...contract.query.selectionTitle.fields,
      ...sortColumns,
      ...fieldColumns,
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
    const missingColumns = [...new Set(requiredColumns)].filter(
      (column) => !existingColumns.has(column),
    );

    if (missingColumns.length > 0) {
      throw new Error(
        `Layer ${layer.key} source ${sourceTable} is missing columns: ${missingColumns.join(', ')}`,
      );
    }
  }

  private async assertGeometrySrid({
    client,
    geometryColumn,
    layer,
    sourceTable,
  }: {
    client: Client;
    geometryColumn: string;
    layer: LoadedGeoReferenceLayerCatalogLayer;
    sourceTable: string;
  }) {
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
  }

  private async assertGeometryTypes({
    client,
    geometryColumn,
    layer,
    sourceTable,
  }: {
    client: Client;
    geometryColumn: string;
    layer: LoadedGeoReferenceLayerCatalogLayer;
    sourceTable: string;
  }) {
    const geometryTypeRows = await client.query<{ geometry_type: string }>(
      `
        SELECT DISTINCT
          UPPER(REPLACE(ST_GeometryType(${geometryColumn}::geometry), 'ST_', '')) AS geometry_type
        FROM ${sourceTable}
        WHERE ${geometryColumn} IS NOT NULL
        LIMIT 25
      `,
    );
    const geometryTypes = geometryTypeRows.rows.map((row) => row.geometry_type);
    const incompatibleGeometryTypes = geometryTypes.filter(
      (geometryType) => geometryType !== layer.source.geometryType,
    );

    if (incompatibleGeometryTypes.length > 0) {
      throw new Error(
        `Layer ${layer.key} declares geometry type ${layer.source.geometryType}, source has ${incompatibleGeometryTypes.join(', ')}`,
      );
    }
  }

  private async assertGeometryGistIndex({
    client,
    layer,
  }: {
    client: Client;
    layer: LoadedGeoReferenceLayerCatalogLayer;
  }) {
    const gistRows = await client.query<{ has_gist_index: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM pg_index index_metadata
          INNER JOIN pg_class table_metadata
            ON table_metadata.oid = index_metadata.indrelid
          INNER JOIN pg_namespace namespace_metadata
            ON namespace_metadata.oid = table_metadata.relnamespace
          INNER JOIN pg_class index_relation
            ON index_relation.oid = index_metadata.indexrelid
          INNER JOIN pg_am access_method
            ON access_method.oid = index_relation.relam
          INNER JOIN pg_attribute attribute_metadata
            ON attribute_metadata.attrelid = table_metadata.oid
            AND attribute_metadata.attnum = ANY(index_metadata.indkey)
          WHERE namespace_metadata.nspname = $1
            AND table_metadata.relname = $2
            AND attribute_metadata.attname = $3
            AND access_method.amname = 'gist'
            AND index_metadata.indisvalid
        ) AS has_gist_index
      `,
      [
        layer.source.schemaName,
        layer.source.tableName,
        layer.source.geometryColumnName,
      ],
    );

    if (!gistRows.rows[0]?.has_gist_index) {
      throw new Error(
        `Layer ${layer.key} source ${quoteGeoReferenceSqlQualifiedName(layer.source)} requires a GiST index on ${layer.source.geometryColumnName}`,
      );
    }
  }

  private async assertSelectedFeatureUniqueness({
    client,
    layer,
    sourceTable,
  }: {
    client: Client;
    layer: LoadedGeoReferenceLayerCatalogLayer;
    sourceTable: string;
  }) {
    const idColumn = quoteGeoReferenceSqlIdentifier(
      layer.sidebarContract.query.selectedFeatureField,
    );
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
      throw new Error(
        `Layer ${layer.key} selected feature field contains null values`,
      );
    }

    if (Number(idRows.rows[0]?.duplicate_ids ?? 0) > 0) {
      throw new Error(
        `Layer ${layer.key} selected feature field contains duplicate values`,
      );
    }
  }

  private async getLayerOperationalMetadata({
    client,
    layer,
  }: {
    client: Client;
    layer: LoadedGeoReferenceLayerCatalogLayer;
  }): Promise<{
    rowCount: number;
    bounds: GeoReferenceLayerBounds | null;
  }> {
    const result = await client.query<{
      bounds: GeoReferenceLayerBounds | null;
      recordCount: number;
    }>(
      buildGeoReferenceLayerBoundsSql({
        layer: layer as unknown as GeoReferenceLayerEntity,
      }),
    );

    return {
      bounds: result.rows[0]?.bounds ?? null,
      rowCount: Number(result.rows[0]?.recordCount ?? 0),
    };
  }

  private async assertSampleTileGeneration({
    bounds,
    client,
    layer,
  }: {
    bounds: GeoReferenceLayerBounds | null;
    client: Client;
    layer: LoadedGeoReferenceLayerCatalogLayer;
  }) {
    if (!isDefined(bounds)) {
      return;
    }

    const [west, south, east, north] = bounds;
    const z = layer.tile.minZoom;
    const { x, y } = this.getTileCoordinatesForLonLat({
      latitude: (south + north) / 2,
      longitude: (west + east) / 2,
      z,
    });

    await client.query<{ tile: Buffer | null }>(
      buildGeoReferenceLayerTileSql({
        layer: layer as unknown as GeoReferenceLayerEntity,
        x,
        y,
        z,
      }),
    );
  }

  private getTileCoordinatesForLonLat({
    latitude,
    longitude,
    z,
  }: {
    latitude: number;
    longitude: number;
    z: number;
  }) {
    const maxTileIndex = 2 ** z - 1;
    const clampedLatitude = Math.max(
      -85.05112878,
      Math.min(85.05112878, latitude),
    );
    const clampedLongitude = Math.max(-180, Math.min(180, longitude));
    const latitudeRadians = (clampedLatitude * Math.PI) / 180;
    const x = Math.floor(((clampedLongitude + 180) / 360) * 2 ** z);
    const y = Math.floor(
      ((1 -
        Math.log(Math.tan(latitudeRadians) + 1 / Math.cos(latitudeRadians)) /
          Math.PI) /
        2) *
        2 ** z,
    );

    return {
      x: Math.max(0, Math.min(maxTileIndex, x)),
      y: Math.max(0, Math.min(maxTileIndex, y)),
    };
  }
}
