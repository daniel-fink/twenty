import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';

import { Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { Command, CommandRunner, Option } from 'nest-commander';
import {
  FieldMetadataType,
  type FieldMetadataGeometrySettings,
  ViewKey,
  ViewType,
  ViewVisibility,
} from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { type DataSource } from 'typeorm';

import {
  assertGeoMapBenchmarkIdentifier,
  buildGeoMapBenchmarkAnalyzeSql,
  buildGeoMapBenchmarkGistIndexSql,
  buildGeoMapBenchmarkTruncateSql,
} from 'src/database/commands/geo-map-benchmark/geo-map-benchmark-sql.util';
import { buildGeoMapRealBenchmarkInsertSql } from 'src/database/commands/geo-map-benchmark/geo-map-real-benchmark-sql.util';
import { FieldMetadataService } from 'src/engine/metadata-modules/field-metadata/services/field-metadata.service';
import { ObjectMetadataService } from 'src/engine/metadata-modules/object-metadata/object-metadata.service';
import { ViewService } from 'src/engine/metadata-modules/view/services/view.service';
import { WorkspaceMetadataVersionService } from 'src/engine/metadata-modules/workspace-metadata-version/services/workspace-metadata-version.service';
import { computeTableName } from 'src/engine/utils/compute-table-name.util';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';

const DEFAULT_OBJECT_NAME_SINGULAR = 'geoBenchmarkRealPolygon';
const DEFAULT_OBJECT_NAME_PLURAL = 'geoBenchmarkRealPolygons';
const DEFAULT_GEOMETRY_FIELD_NAME = 'geometry';
const DEFAULT_BATCH_SIZE = 1_000;

const DEFAULT_GEOMETRY_SETTINGS = {
  geometryType: 'MULTIPOLYGON',
  srid: 4326,
  isGeography: false,
} as const satisfies FieldMetadataGeometrySettings;

type GeoMapRealBenchmarkImportOptions = {
  workspaceId?: string;
  inputPath?: string;
  objectNameSingular?: string;
  objectNamePlural?: string;
  geometryFieldName?: string;
  batchSize?: number;
  limit?: number;
  reset?: boolean;
  createMapView?: boolean;
};

type GeoJsonFeature = {
  id?: string;
  geometry?: unknown;
  type?: string;
};

const formatBenchmarkObjectLabel = (objectName: string) =>
  objectName
    .replace(/^geoBenchmark/, 'Geo Benchmark ')
    .replace(/([a-z])([A-Z])/g, '$1 $2');

const parseGeoJsonFeature = (value: unknown): GeoJsonFeature | null => {
  if (!isDefined(value) || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (record.type === 'Feature') {
    return {
      id: typeof record.id === 'string' ? record.id : undefined,
      geometry: record.geometry,
      type: 'Feature',
    };
  }

  if (typeof record.type === 'string' && isDefined(record.coordinates)) {
    return {
      geometry: record,
      type: 'Feature',
    };
  }

  return null;
};

async function* readGeoJsonFeatures(inputPath: string) {
  if (inputPath.endsWith('.geojson') || inputPath.endsWith('.json')) {
    const parsedDocument = JSON.parse(readFileSync(inputPath, 'utf8')) as
      | Record<string, unknown>
      | unknown[];

    if (
      !Array.isArray(parsedDocument) &&
      parsedDocument.type === 'FeatureCollection' &&
      Array.isArray(parsedDocument.features)
    ) {
      for (const feature of parsedDocument.features) {
        const parsedFeature = parseGeoJsonFeature(feature);

        if (isDefined(parsedFeature)) {
          yield parsedFeature;
        }
      }

      return;
    }
  }

  const lineReader = createInterface({
    input: createReadStream(inputPath),
    crlfDelay: Infinity,
  });

  for await (const line of lineReader) {
    const trimmedLine = line.trim();

    if (trimmedLine === '') {
      continue;
    }

    const parsedFeature = parseGeoJsonFeature(JSON.parse(trimmedLine));

    if (isDefined(parsedFeature)) {
      yield parsedFeature;
    }
  }
}

@Command({
  name: 'workspace:import:geo-map-real-benchmark',
  description:
    'Create a real Twenty benchmark object and bulk import polygon/multipolygon GeoJSONSeq or GeoJSON features for map tile benchmarks.',
})
export class GeoMapRealBenchmarkImportCommand extends CommandRunner {
  private readonly logger = new Logger(GeoMapRealBenchmarkImportCommand.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly objectMetadataService: ObjectMetadataService,
    private readonly fieldMetadataService: FieldMetadataService,
    private readonly viewService: ViewService,
    private readonly workspaceMetadataVersionService: WorkspaceMetadataVersionService,
  ) {
    super();
  }

  @Option({ flags: '--workspace-id <workspaceId>' })
  parseWorkspaceId(workspaceId: string): string {
    return workspaceId;
  }

  @Option({ flags: '--input-path <inputPath>' })
  parseInputPath(inputPath: string): string {
    return inputPath;
  }

  @Option({ flags: '--object-name-singular <objectNameSingular>' })
  parseObjectNameSingular(objectNameSingular: string): string {
    return objectNameSingular;
  }

  @Option({ flags: '--object-name-plural <objectNamePlural>' })
  parseObjectNamePlural(objectNamePlural: string): string {
    return objectNamePlural;
  }

  @Option({ flags: '--geometry-field-name <geometryFieldName>' })
  parseGeometryFieldName(geometryFieldName: string): string {
    return geometryFieldName;
  }

  @Option({ flags: '--batch-size <batchSize>' })
  parseBatchSize(batchSize: string): number {
    const parsedBatchSize = Number(batchSize);

    if (!Number.isInteger(parsedBatchSize) || parsedBatchSize <= 0) {
      throw new Error('Batch size must be a positive integer');
    }

    return parsedBatchSize;
  }

  @Option({ flags: '--limit <limit>' })
  parseLimit(limit: string): number {
    const parsedLimit = Number(limit);

    if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
      throw new Error('Limit must be a positive integer');
    }

    return parsedLimit;
  }

  @Option({ flags: '--reset' })
  parseReset(): boolean {
    return true;
  }

  @Option({ flags: '--create-map-view' })
  parseCreateMapView(): boolean {
    return true;
  }

  async run(
    _passedParams: string[],
    options: GeoMapRealBenchmarkImportOptions,
  ): Promise<void> {
    const workspaceId = options.workspaceId;
    const inputPath = options.inputPath;

    if (!isDefined(workspaceId) || workspaceId === '') {
      throw new Error('--workspace-id is required');
    }

    if (!isDefined(inputPath) || inputPath === '' || !existsSync(inputPath)) {
      throw new Error(
        '--input-path must point to a GeoJSONSeq or GeoJSON file',
      );
    }

    const objectNameSingular =
      options.objectNameSingular ?? DEFAULT_OBJECT_NAME_SINGULAR;
    const objectNamePlural =
      options.objectNamePlural ?? DEFAULT_OBJECT_NAME_PLURAL;
    const geometryFieldName =
      options.geometryFieldName ?? DEFAULT_GEOMETRY_FIELD_NAME;
    const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;

    assertGeoMapBenchmarkIdentifier(objectNameSingular);
    assertGeoMapBenchmarkIdentifier(objectNamePlural);
    assertGeoMapBenchmarkIdentifier(geometryFieldName);

    const objectMetadata = await this.ensureBenchmarkObject({
      workspaceId,
      objectNameSingular,
      objectNamePlural,
    });

    const fieldMetadata = await this.ensureBenchmarkGeometryField({
      workspaceId,
      objectMetadataId: objectMetadata.id,
      geometryFieldName,
    });

    const schemaName = getWorkspaceSchemaName(workspaceId);
    const tableName = computeTableName(
      objectMetadata.nameSingular,
      objectMetadata.isCustom,
    );

    if (options.reset === true) {
      await this.dataSource.query(
        buildGeoMapBenchmarkTruncateSql({ schemaName, tableName }),
      );
    }

    await this.dataSource.query(
      buildGeoMapBenchmarkGistIndexSql({
        schemaName,
        tableName,
        geometryColumnName: geometryFieldName,
      }),
    );

    let importedCount = 0;
    let batch: { id: string; geometry: unknown }[] = [];

    const flushBatch = async () => {
      if (batch.length === 0) {
        return;
      }

      await this.dataSource.query(
        buildGeoMapRealBenchmarkInsertSql({
          schemaName,
          tableName,
          geometryColumnName: geometryFieldName,
          batchParameterIndex: 1,
        }),
        [JSON.stringify(batch)],
      );

      importedCount += batch.length;
      batch = [];
      this.logger.log(`Imported ${importedCount} real benchmark features`);
    };

    for await (const feature of readGeoJsonFeatures(inputPath)) {
      if (options.limit && importedCount + batch.length >= options.limit) {
        break;
      }

      if (!isDefined(feature.geometry)) {
        continue;
      }

      batch.push({
        id: feature.id ?? randomUUID(),
        geometry: feature.geometry,
      });

      if (batch.length >= batchSize) {
        await flushBatch();
      }
    }

    await flushBatch();
    await this.dataSource.query(
      buildGeoMapBenchmarkAnalyzeSql({ schemaName, tableName }),
    );

    if (options.createMapView === true) {
      await this.ensureMapView({
        workspaceId,
        objectMetadataId: objectMetadata.id,
        fieldMetadataId: fieldMetadata.id,
        objectNameSingular,
      });
    }

    this.logger.log(
      `Geo map real benchmark import complete for workspace ${workspaceId}`,
    );
  }

  private async ensureBenchmarkObject({
    workspaceId,
    objectNameSingular,
    objectNamePlural,
  }: {
    workspaceId: string;
    objectNameSingular: string;
    objectNamePlural: string;
  }) {
    const existingObjectMetadata =
      await this.objectMetadataService.findOneWithinWorkspace(workspaceId, {
        where: { nameSingular: objectNameSingular },
      });

    if (isDefined(existingObjectMetadata)) {
      return existingObjectMetadata;
    }

    return this.objectMetadataService.createOneObject({
      workspaceId,
      createObjectInput: {
        nameSingular: objectNameSingular,
        namePlural: objectNamePlural,
        labelSingular: formatBenchmarkObjectLabel(objectNameSingular),
        labelPlural: formatBenchmarkObjectLabel(objectNamePlural),
        icon: 'IconMap',
        skipNameField: true,
      },
    });
  }

  private async ensureBenchmarkGeometryField({
    workspaceId,
    objectMetadataId,
    geometryFieldName,
  }: {
    workspaceId: string;
    objectMetadataId: string;
    geometryFieldName: string;
  }) {
    const existingFieldMetadata =
      await this.fieldMetadataService.findOneWithinWorkspace(workspaceId, {
        where: {
          objectMetadataId,
          name: geometryFieldName,
        },
      });

    if (isDefined(existingFieldMetadata)) {
      if (existingFieldMetadata.type !== FieldMetadataType.GEOMETRY) {
        throw new Error(
          `${geometryFieldName} already exists and is not GEOMETRY`,
        );
      }

      return existingFieldMetadata;
    }

    return this.fieldMetadataService.createOneField({
      workspaceId,
      createFieldInput: {
        objectMetadataId,
        name: geometryFieldName,
        label: 'Geometry',
        type: FieldMetadataType.GEOMETRY,
        icon: 'IconMap2',
        isNullable: true,
        settings: DEFAULT_GEOMETRY_SETTINGS,
      },
    });
  }

  private async ensureMapView({
    workspaceId,
    objectMetadataId,
    fieldMetadataId,
    objectNameSingular,
  }: {
    workspaceId: string;
    objectMetadataId: string;
    fieldMetadataId: string;
    objectNameSingular: string;
  }) {
    const existingViews = await this.dataSource.query<{ id: string }[]>(
      `
        SELECT "id"
        FROM "core"."view"
        WHERE "workspaceId" = $1
          AND "objectMetadataId" = $2
          AND "mapFieldMetadataId" = $3
          AND "type" = 'MAP'
          AND "deletedAt" IS NULL
        LIMIT 1
      `,
      [workspaceId, objectMetadataId, fieldMetadataId],
    );

    if (existingViews.length > 0) {
      await this.promoteMapViewAsDefault({
        workspaceId,
        objectMetadataId,
        mapViewId: existingViews[0].id,
      });

      return;
    }

    const mapView = await this.viewService.createOne({
      workspaceId,
      createViewInput: {
        name: `${formatBenchmarkObjectLabel(objectNameSingular)} Map`,
        objectMetadataId,
        type: ViewType.MAP,
        icon: 'IconMap',
        mapFieldMetadataId: fieldMetadataId,
        visibility: ViewVisibility.WORKSPACE,
      },
    });

    await this.promoteMapViewAsDefault({
      workspaceId,
      objectMetadataId,
      mapViewId: mapView.id,
    });
  }

  private async promoteMapViewAsDefault({
    workspaceId,
    objectMetadataId,
    mapViewId,
  }: {
    workspaceId: string;
    objectMetadataId: string;
    mapViewId: string;
  }) {
    await this.dataSource.query(
      `
        UPDATE "core"."view"
        SET "key" = NULL
        WHERE "workspaceId" = $1
          AND "objectMetadataId" = $2
          AND "id" <> $3
          AND "key" = $4
      `,
      [workspaceId, objectMetadataId, mapViewId, ViewKey.INDEX],
    );

    await this.dataSource.query(
      `
        UPDATE "core"."view"
        SET "key" = $4
        WHERE "workspaceId" = $1
          AND "objectMetadataId" = $2
          AND "id" = $3
      `,
      [workspaceId, objectMetadataId, mapViewId, ViewKey.INDEX],
    );

    await this.workspaceMetadataVersionService.incrementMetadataVersion(
      workspaceId,
    );
  }
}
