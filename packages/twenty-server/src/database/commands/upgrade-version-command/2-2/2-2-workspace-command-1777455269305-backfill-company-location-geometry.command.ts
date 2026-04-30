import { Command } from 'nest-commander';
import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import {
  DEFAULT_GEOMETRY_FIELD_SETTINGS,
  FieldMetadataType,
} from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { v4 } from 'uuid';

import { ActiveOrSuspendedWorkspaceCommandRunner } from 'src/database/commands/command-runners/active-or-suspended-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { findFlatEntityByUniversalIdentifier } from 'src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-universal-identifier.util';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import {
  type FlatIndexFieldMetadata,
  type FlatIndexMetadata,
} from 'src/engine/metadata-modules/flat-index-metadata/types/flat-index-metadata.type';
import { IndexType } from 'src/engine/metadata-modules/index-metadata/types/indexType.types';
import { generateFlatIndexMetadataWithNameOrThrow } from 'src/engine/metadata-modules/index-metadata/utils/generate-flat-index.util';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { getDefaultFlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/utils/get-default-flat-field-metadata-from-create-field-input.util';
import { WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';
import { type UniversalFlatFieldMetadata } from 'src/engine/workspace-manager/workspace-migration/universal-flat-entity/types/universal-flat-field-metadata.type';
import { type UniversalFlatIndexFieldMetadata } from 'src/engine/workspace-manager/workspace-migration/universal-flat-entity/types/universal-flat-index-metadata.type';

const COMPANY_LOCATION_FIELD_NAME = 'location';
const CONFLICTING_LOCATION_FIELD_NAME = 'locationOld';

@RegisteredWorkspaceCommand('2.2.0', 1777455269305)
@Command({
  name: 'upgrade:2-2:backfill-company-location-geometry',
  description:
    'Create the standard Company location geometry field, add its GiST index, and seed it once from address longitude/latitude',
})
export class BackfillCompanyLocationGeometryCommand extends ActiveOrSuspendedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly applicationService: ApplicationService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly workspaceMigrationValidateBuildAndRunService: WorkspaceMigrationValidateBuildAndRunService,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    dataSource,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    if (!dataSource) {
      this.logger.log(`No data source for workspace ${workspaceId}, skipping`);

      return;
    }

    const isDryRun = options.dryRun ?? false;

    if (!isDryRun) {
      await this.ensureGeometryPrerequisites({ dataSource });
    }

    await this.ensureLocationFieldExists({ workspaceId, isDryRun });
    await this.ensureLocationGistIndexExists({ workspaceId, isDryRun });

    if (isDryRun) {
      this.logger.log(
        `[DRY RUN] Would seed Company.location from address coordinates for workspace ${workspaceId}`,
      );

      return;
    }

    const schemaName = getWorkspaceSchemaName(workspaceId);
    const result = await dataSource.query(
      `UPDATE "${schemaName}"."company"
       SET "location" = ST_SetSRID(
         ST_MakePoint("addressAddressLng", "addressAddressLat"),
         4326
       )
       WHERE "location" IS NULL
         AND "addressAddressLng" IS NOT NULL
         AND "addressAddressLat" IS NOT NULL
         AND "addressAddressLng" BETWEEN -180 AND 180
         AND "addressAddressLat" BETWEEN -90 AND 90`,
      undefined,
      undefined,
      { shouldBypassPermissionChecks: true },
    );

    this.logger.log(
      `Seeded Company.location for ${result?.[1] ?? 0} companies in workspace ${workspaceId}`,
    );
  }

  private async ensureGeometryPrerequisites({
    dataSource,
  }: Pick<RunOnWorkspaceArgs, 'dataSource'>): Promise<void> {
    if (!dataSource) {
      return;
    }

    await dataSource.query(
      `CREATE EXTENSION IF NOT EXISTS "postgis"`,
      undefined,
      undefined,
      { shouldBypassPermissionChecks: true },
    );
    await dataSource.query(
      `ALTER TYPE "core"."indexMetadata_indextype_enum" ADD VALUE IF NOT EXISTS 'GIST' AFTER 'BTREE'`,
      undefined,
      undefined,
      { shouldBypassPermissionChecks: true },
    );
  }

  private async ensureLocationFieldExists({
    workspaceId,
    isDryRun,
  }: {
    workspaceId: string;
    isDryRun: boolean;
  }): Promise<void> {
    const { flatObjectMetadataMaps, flatFieldMetadataMaps } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        'flatObjectMetadataMaps',
        'flatFieldMetadataMaps',
      ]);

    const companyObjectMetadata =
      findFlatEntityByUniversalIdentifier<FlatObjectMetadata>({
        flatEntityMaps: flatObjectMetadataMaps,
        universalIdentifier: STANDARD_OBJECTS.company.universalIdentifier,
      });

    if (!companyObjectMetadata) {
      this.logger.log(
        `Company object metadata not found for workspace ${workspaceId}, skipping`,
      );

      return;
    }

    const existingLocationField = findFlatEntityByUniversalIdentifier({
      flatEntityMaps: flatFieldMetadataMaps,
      universalIdentifier:
        STANDARD_OBJECTS.company.fields.location.universalIdentifier,
    });

    if (existingLocationField) {
      return;
    }

    const conflictingField = Object.values(
      flatFieldMetadataMaps.byUniversalIdentifier,
    )
      .filter(isDefined)
      .find(
        (field) =>
          field.name === COMPANY_LOCATION_FIELD_NAME &&
          field.objectMetadataUniversalIdentifier ===
            companyObjectMetadata.universalIdentifier,
      );

    if (conflictingField) {
      this.logger.log(
        `Found conflicting Company.location field (${conflictingField.universalIdentifier}) for workspace ${workspaceId}, renaming it to ${CONFLICTING_LOCATION_FIELD_NAME}`,
      );

      if (!isDryRun) {
        await this.renameConflictingLocationField({
          conflictingField,
          workspaceId,
        });
      }
    }

    if (isDryRun) {
      this.logger.log(
        `[DRY RUN] Would create standard Company.location geometry field for workspace ${workspaceId}`,
      );

      return;
    }

    const { twentyStandardFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );

    const flatFieldMetadataToCreate = {
      ...getDefaultFlatFieldMetadata({
        createFieldInput: {
          name: COMPANY_LOCATION_FIELD_NAME,
          type: FieldMetadataType.GEOMETRY,
          label: 'Location',
          description: 'Point location derived from address',
          icon: 'IconMapPin',
          isNullable: true,
          isUIReadOnly: true,
          settings: DEFAULT_GEOMETRY_FIELD_SETTINGS,
          universalIdentifier:
            STANDARD_OBJECTS.company.fields.location.universalIdentifier,
        },
        flatApplication: twentyStandardFlatApplication,
        objectMetadataUniversalIdentifier:
          companyObjectMetadata.universalIdentifier,
      }),
      isCustom: false,
    };

    const validateAndBuildResult =
      await this.workspaceMigrationValidateBuildAndRunService.validateBuildAndRunWorkspaceMigration(
        {
          allFlatEntityOperationByMetadataName: {
            fieldMetadata: {
              flatEntityToCreate: [flatFieldMetadataToCreate],
              flatEntityToDelete: [],
              flatEntityToUpdate: [],
            },
          },
          workspaceId,
          applicationUniversalIdentifier:
            twentyStandardFlatApplication.universalIdentifier,
        },
      );

    if (validateAndBuildResult.status === 'fail') {
      throw new Error(
        `Failed to create Company.location field for workspace ${workspaceId}: ${JSON.stringify(validateAndBuildResult, null, 2)}`,
      );
    }

    await this.workspaceCacheService.invalidateAndRecompute(workspaceId, [
      'flatFieldMetadataMaps',
    ]);

    this.logger.log(
      `Created Company.location field for workspace ${workspaceId}`,
    );
  }

  private async renameConflictingLocationField({
    conflictingField,
    workspaceId,
  }: {
    conflictingField: FlatFieldMetadata;
    workspaceId: string;
  }): Promise<void> {
    const fieldToUpdate: UniversalFlatFieldMetadata = {
      ...conflictingField,
      name: CONFLICTING_LOCATION_FIELD_NAME,
      label: 'Location (old)',
    };

    const validateAndBuildResult =
      await this.workspaceMigrationValidateBuildAndRunService.validateBuildAndRunWorkspaceMigration(
        {
          allFlatEntityOperationByMetadataName: {
            fieldMetadata: {
              flatEntityToCreate: [],
              flatEntityToDelete: [],
              flatEntityToUpdate: [fieldToUpdate],
            },
          },
          workspaceId,
          applicationUniversalIdentifier:
            conflictingField.applicationUniversalIdentifier,
        },
      );

    if (validateAndBuildResult.status === 'fail') {
      throw new Error(
        `Failed to rename conflicting Company.location field for workspace ${workspaceId}: ${JSON.stringify(validateAndBuildResult, null, 2)}`,
      );
    }
  }

  private async ensureLocationGistIndexExists({
    workspaceId,
    isDryRun,
  }: {
    workspaceId: string;
    isDryRun: boolean;
  }): Promise<void> {
    const { flatObjectMetadataMaps, flatFieldMetadataMaps, flatIndexMaps } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        'flatObjectMetadataMaps',
        'flatFieldMetadataMaps',
        'flatIndexMaps',
      ]);

    const companyObjectMetadata =
      findFlatEntityByUniversalIdentifier<FlatObjectMetadata>({
        flatEntityMaps: flatObjectMetadataMaps,
        universalIdentifier: STANDARD_OBJECTS.company.universalIdentifier,
      });
    const locationField =
      findFlatEntityByUniversalIdentifier<FlatFieldMetadata>({
        flatEntityMaps: flatFieldMetadataMaps,
        universalIdentifier:
          STANDARD_OBJECTS.company.fields.location.universalIdentifier,
      });
    const existingLocationIndex = findFlatEntityByUniversalIdentifier({
      flatEntityMaps: flatIndexMaps,
      universalIdentifier:
        STANDARD_OBJECTS.company.indexes.locationGistIndex.universalIdentifier,
    });

    if (!companyObjectMetadata || !locationField || existingLocationIndex) {
      return;
    }

    if (isDryRun) {
      this.logger.log(
        `[DRY RUN] Would create Company.location GiST index for workspace ${workspaceId}`,
      );

      return;
    }

    const { twentyStandardFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );

    const now = new Date().toISOString();
    const indexId = v4();
    const indexUniversalIdentifier =
      STANDARD_OBJECTS.company.indexes.locationGistIndex.universalIdentifier;
    const universalFlatIndexFieldMetadatas: UniversalFlatIndexFieldMetadata[] =
      [
        {
          createdAt: now,
          order: 0,
          updatedAt: now,
          fieldMetadataUniversalIdentifier: locationField.universalIdentifier,
          indexMetadataUniversalIdentifier: indexUniversalIdentifier,
        },
      ];

    const universalFlatIndex = generateFlatIndexMetadataWithNameOrThrow({
      flatIndex: {
        createdAt: now,
        applicationUniversalIdentifier:
          twentyStandardFlatApplication.universalIdentifier,
        indexType: IndexType.GIST,
        indexWhereClause: null,
        isCustom: false,
        isUnique: false,
        objectMetadataUniversalIdentifier:
          companyObjectMetadata.universalIdentifier,
        universalIdentifier: indexUniversalIdentifier,
        updatedAt: now,
        universalFlatIndexFieldMetadatas,
      },
      flatObjectMetadata: companyObjectMetadata,
      objectFlatFieldMetadatas: [locationField],
    });

    const flatIndexMetadataToCreate: FlatIndexMetadata = {
      ...universalFlatIndex,
      applicationId: twentyStandardFlatApplication.id,
      flatIndexFieldMetadatas: [
        {
          createdAt: now,
          fieldMetadataId: locationField.id,
          id: v4(),
          indexMetadataId: indexId,
          order: 0,
          updatedAt: now,
          workspaceId,
        },
      ] satisfies FlatIndexFieldMetadata[],
      id: indexId,
      objectMetadataId: companyObjectMetadata.id,
      workspaceId,
    };

    const validateAndBuildResult =
      await this.workspaceMigrationValidateBuildAndRunService.validateBuildAndRunWorkspaceMigration(
        {
          allFlatEntityOperationByMetadataName: {
            index: {
              flatEntityToCreate: [flatIndexMetadataToCreate],
              flatEntityToDelete: [],
              flatEntityToUpdate: [],
            },
          },
          workspaceId,
          applicationUniversalIdentifier:
            twentyStandardFlatApplication.universalIdentifier,
        },
      );

    if (validateAndBuildResult.status === 'fail') {
      throw new Error(
        `Failed to create Company.location GiST index for workspace ${workspaceId}: ${JSON.stringify(validateAndBuildResult, null, 2)}`,
      );
    }

    await this.workspaceCacheService.invalidateAndRecompute(workspaceId, [
      'flatIndexMaps',
    ]);

    this.logger.log(
      `Created Company.location GiST index for workspace ${workspaceId}`,
    );
  }
}
