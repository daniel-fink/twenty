import { Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { Command, CommandRunner, Option } from 'nest-commander';
import {
  FieldMetadataType,
  type FieldMetadataGeometrySettings,
} from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { type DataSource } from 'typeorm';

import {
  assertGeoMapBenchmarkIdentifier,
  buildGeoMapBenchmarkAnalyzeSql,
  buildGeoMapBenchmarkGistIndexSql,
  buildGeoMapBenchmarkInsertSql,
  buildGeoMapBenchmarkTruncateSql,
  type GeoMapBenchmarkDataset,
} from 'src/database/commands/geo-map-benchmark/geo-map-benchmark-sql.util';
import { FieldMetadataService } from 'src/engine/metadata-modules/field-metadata/services/field-metadata.service';
import { ObjectMetadataService } from 'src/engine/metadata-modules/object-metadata/object-metadata.service';
import { computeTableName } from 'src/engine/utils/compute-table-name.util';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';

const DEFAULT_OBJECT_NAME_SINGULAR = 'geoBenchmarkFeature';
const DEFAULT_OBJECT_NAME_PLURAL = 'geoBenchmarkFeatures';
const DEFAULT_GEOMETRY_FIELD_NAME = 'geometry';
const DEFAULT_RECORD_COUNT = 100_000;

const DEFAULT_GEOMETRY_SETTINGS = {
  geometryType: 'GEOMETRY',
  srid: 4326,
  isGeography: false,
} as const satisfies FieldMetadataGeometrySettings;

const formatBenchmarkObjectLabel = (objectName: string) =>
  objectName
    .replace(/^geoBenchmark/, 'Geo Benchmark ')
    .replace(/([a-z])([A-Z])/g, '$1 $2');

type GeoMapBenchmarkSeedOptions = {
  workspaceId?: string;
  objectNameSingular?: string;
  objectNamePlural?: string;
  geometryFieldName?: string;
  dataset?: GeoMapBenchmarkDataset;
  count?: number;
  reset?: boolean;
};

@Command({
  name: 'workspace:seed:geo-map-benchmark',
  description:
    'Create a real Twenty benchmark object with one geometry field, then bulk insert synthetic PostGIS records for map tile testing.',
})
export class GeoMapBenchmarkSeedCommand extends CommandRunner {
  private readonly logger = new Logger(GeoMapBenchmarkSeedCommand.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly objectMetadataService: ObjectMetadataService,
    private readonly fieldMetadataService: FieldMetadataService,
  ) {
    super();
  }

  @Option({
    flags: '--workspace-id <workspaceId>',
    description: 'Workspace id to seed.',
  })
  parseWorkspaceId(workspaceId: string): string {
    return workspaceId;
  }

  @Option({
    flags: '--object-name-singular <objectNameSingular>',
    description: `Benchmark object name singular. Defaults to ${DEFAULT_OBJECT_NAME_SINGULAR}.`,
  })
  parseObjectNameSingular(objectNameSingular: string): string {
    return objectNameSingular;
  }

  @Option({
    flags: '--object-name-plural <objectNamePlural>',
    description: `Benchmark object name plural. Defaults to ${DEFAULT_OBJECT_NAME_PLURAL}.`,
  })
  parseObjectNamePlural(objectNamePlural: string): string {
    return objectNamePlural;
  }

  @Option({
    flags: '--geometry-field-name <geometryFieldName>',
    description: `Geometry field name. Defaults to ${DEFAULT_GEOMETRY_FIELD_NAME}.`,
  })
  parseGeometryFieldName(geometryFieldName: string): string {
    return geometryFieldName;
  }

  @Option({
    flags: '--dataset <dataset>',
    description: 'Dataset shape: points, polygons, or multipolygons.',
  })
  parseDataset(dataset: string): GeoMapBenchmarkDataset {
    if (
      dataset !== 'points' &&
      dataset !== 'polygons' &&
      dataset !== 'multipolygons'
    ) {
      throw new Error('Dataset must be points, polygons, or multipolygons');
    }

    return dataset;
  }

  @Option({
    flags: '--count <count>',
    description: `Record count to bulk insert. Defaults to ${DEFAULT_RECORD_COUNT}.`,
  })
  parseCount(count: string): number {
    const parsedCount = Number(count);

    if (!Number.isInteger(parsedCount) || parsedCount <= 0) {
      throw new Error('Count must be a positive integer');
    }

    return parsedCount;
  }

  @Option({
    flags: '--reset',
    description: 'Truncate the benchmark table before inserting records.',
  })
  parseReset(): boolean {
    return true;
  }

  async run(
    _passedParams: string[],
    options: GeoMapBenchmarkSeedOptions,
  ): Promise<void> {
    const workspaceId = options.workspaceId;

    if (!isDefined(workspaceId) || workspaceId === '') {
      throw new Error('--workspace-id is required');
    }

    const objectNameSingular =
      options.objectNameSingular ?? DEFAULT_OBJECT_NAME_SINGULAR;
    const objectNamePlural =
      options.objectNamePlural ?? DEFAULT_OBJECT_NAME_PLURAL;
    const geometryFieldName =
      options.geometryFieldName ?? DEFAULT_GEOMETRY_FIELD_NAME;
    const dataset = options.dataset ?? 'points';
    const count = options.count ?? DEFAULT_RECORD_COUNT;
    const reset = options.reset ?? false;

    assertGeoMapBenchmarkIdentifier(objectNameSingular);
    assertGeoMapBenchmarkIdentifier(objectNamePlural);
    assertGeoMapBenchmarkIdentifier(geometryFieldName);

    const objectMetadata = await this.ensureBenchmarkObject({
      workspaceId,
      objectNameSingular,
      objectNamePlural,
    });

    await this.ensureBenchmarkGeometryField({
      workspaceId,
      objectMetadataId: objectMetadata.id,
      geometryFieldName,
    });

    const schemaName = getWorkspaceSchemaName(workspaceId);
    const tableName = computeTableName(
      objectMetadata.nameSingular,
      objectMetadata.isCustom,
    );

    if (reset) {
      await this.dataSource.query(
        buildGeoMapBenchmarkTruncateSql({
          schemaName,
          tableName,
        }),
      );
    }

    await this.dataSource.query(
      buildGeoMapBenchmarkGistIndexSql({
        schemaName,
        tableName,
        geometryColumnName: geometryFieldName,
      }),
    );

    this.logger.log(
      `Inserting ${count} ${dataset} records into ${schemaName}.${tableName}.${geometryFieldName}`,
    );

    await this.dataSource.query(
      buildGeoMapBenchmarkInsertSql({
        schemaName,
        tableName,
        geometryColumnName: geometryFieldName,
        dataset,
        count,
      }),
    );

    await this.dataSource.query(
      buildGeoMapBenchmarkAnalyzeSql({
        schemaName,
        tableName,
      }),
    );

    this.logger.log(
      `Geo map benchmark seed complete for workspace ${workspaceId}`,
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

    this.logger.log(`Creating benchmark object ${objectNameSingular}`);

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
      return existingFieldMetadata;
    }

    this.logger.log(`Creating benchmark geometry field ${geometryFieldName}`);

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
}
