import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { IsNull, Repository } from 'typeorm';

import { EnsureApplicationInstalledResultDTO } from 'src/engine/core-modules/admin-panel/dtos/ensure-application-installed-result.dto';
import { ApplicationInstallService } from 'src/engine/core-modules/application/application-install/application-install.service';
import { ApplicationRegistrationEntity } from 'src/engine/core-modules/application/application-registration/application-registration.entity';
import { ApplicationEntity } from 'src/engine/core-modules/application/application.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

@Injectable()
export class AdminPanelApplicationInstallService {
  constructor(
    @InjectRepository(ApplicationEntity)
    private readonly applicationRepository: Repository<ApplicationEntity>,
    @InjectRepository(ApplicationRegistrationEntity)
    private readonly applicationRegistrationRepository: Repository<ApplicationRegistrationEntity>,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    private readonly applicationInstallService: ApplicationInstallService,
  ) {}

  async ensureApplicationInstalledInWorkspace(input: {
    applicationUniversalIdentifier: string;
    dryRun?: boolean;
    workspaceId: string;
  }): Promise<EnsureApplicationInstalledResultDTO> {
    const workspace = await this.workspaceRepository.findOneBy({
      id: input.workspaceId,
    });

    if (!workspace) {
      throw new Error(`Workspace not found: ${input.workspaceId}`);
    }

    const applicationRegistration =
      await this.applicationRegistrationRepository.findOne({
        where: {
          deletedAt: IsNull(),
          universalIdentifier: input.applicationUniversalIdentifier,
        },
      });

    if (!applicationRegistration) {
      throw new Error(
        `Application registration not found: ${input.applicationUniversalIdentifier}`,
      );
    }

    const existingApplication = await this.applicationRepository.findOne({
      where: {
        deletedAt: IsNull(),
        universalIdentifier: input.applicationUniversalIdentifier,
        workspaceId: input.workspaceId,
      },
    });

    if (existingApplication) {
      return {
        applicationUniversalIdentifier: input.applicationUniversalIdentifier,
        dryRun: input.dryRun ?? false,
        installed: false,
        skippedExisting: true,
      };
    }

    if (input.dryRun) {
      return {
        applicationUniversalIdentifier: input.applicationUniversalIdentifier,
        dryRun: true,
        installed: false,
        skippedExisting: false,
      };
    }

    await this.applicationInstallService.installApplication({
      appRegistrationId: applicationRegistration.id,
      workspaceId: input.workspaceId,
    });

    return {
      applicationUniversalIdentifier: input.applicationUniversalIdentifier,
      dryRun: false,
      installed: true,
      skippedExisting: false,
    };
  }
}
