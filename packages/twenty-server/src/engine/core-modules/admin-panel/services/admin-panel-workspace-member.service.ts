import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { isDefined } from 'twenty-shared/utils';
import { In, IsNull, Repository } from 'typeorm';

import {
  EnsureWorkspaceMembersInput,
  WorkspaceMemberRolePolicy,
} from 'src/engine/core-modules/admin-panel/dtos/ensure-workspace-members.input';
import { EnsureWorkspaceMembersResultDTO } from 'src/engine/core-modules/admin-panel/dtos/ensure-workspace-members-result.dto';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { UserWorkspaceService } from 'src/engine/core-modules/user-workspace/user-workspace.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { RoleTargetEntity } from 'src/engine/metadata-modules/role-target/role-target.entity';
import { RoleEntity } from 'src/engine/metadata-modules/role/role.entity';
import { UserRoleService } from 'src/engine/metadata-modules/user-role/user-role.service';
import { STANDARD_ROLE } from 'src/engine/workspace-manager/twenty-standard-application/constants/standard-role.constant';

@Injectable()
export class AdminPanelWorkspaceMemberService {
  constructor(
    @InjectRepository(UserWorkspaceEntity)
    private readonly userWorkspaceRepository: Repository<UserWorkspaceEntity>,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
    @InjectRepository(RoleTargetEntity)
    private readonly roleTargetRepository: Repository<RoleTargetEntity>,
    private readonly userWorkspaceService: UserWorkspaceService,
    private readonly userRoleService: UserRoleService,
  ) {}

  async ensureWorkspaceMembers(
    input: EnsureWorkspaceMembersInput,
  ): Promise<EnsureWorkspaceMembersResultDTO> {
    if (input.rolePolicy !== WorkspaceMemberRolePolicy.MIRROR_SOURCE_ADMINS) {
      throw new Error(`Unsupported role policy: ${input.rolePolicy}`);
    }

    const sourceWorkspace = await this.workspaceRepository.findOneBy({
      id: input.sourceWorkspaceId,
    });
    const targetWorkspace = await this.workspaceRepository.findOneBy({
      id: input.targetWorkspaceId,
    });

    if (!isDefined(sourceWorkspace)) {
      throw new Error(`Source workspace not found: ${input.sourceWorkspaceId}`);
    }

    if (!isDefined(targetWorkspace)) {
      throw new Error(`Target workspace not found: ${input.targetWorkspaceId}`);
    }

    const targetAdminRole = await this.roleRepository.findOne({
      where: {
        workspaceId: targetWorkspace.id,
        universalIdentifier: STANDARD_ROLE.admin.universalIdentifier,
      },
    });

    if (!isDefined(targetAdminRole)) {
      throw new Error(`Target admin role not found: ${targetWorkspace.id}`);
    }

    const sourceUserWorkspaces = await this.userWorkspaceRepository.find({
      relations: {
        user: true,
      },
      where: {
        workspaceId: sourceWorkspace.id,
      },
      withDeleted: true,
    });

    const result: EnsureWorkspaceMembersResultDTO = {
      added: 0,
      dryRun: input.dryRun ?? false,
      failed: 0,
      failures: [],
      roleUpdated: 0,
      skippedExisting: 0,
      skippedInactive: 0,
    };

    const activeSourceUserWorkspaces = sourceUserWorkspaces.filter(
      (userWorkspace) => {
        if (isDefined(userWorkspace.deletedAt)) {
          result.skippedInactive += 1;

          return false;
        }

        return true;
      },
    );

    if (activeSourceUserWorkspaces.length === 0) {
      return result;
    }

    const sourceUserWorkspaceIds = activeSourceUserWorkspaces.map(
      (userWorkspace) => userWorkspace.id,
    );
    const sourceUserIds = activeSourceUserWorkspaces.map(
      (userWorkspace) => userWorkspace.userId,
    );

    const sourceAdminUserWorkspaceIds = await this.getAdminUserWorkspaceIdSet({
      userWorkspaceIds: sourceUserWorkspaceIds,
      workspaceId: sourceWorkspace.id,
    });

    const targetUserWorkspaces = await this.userWorkspaceRepository.find({
      where: {
        deletedAt: IsNull(),
        userId: In(sourceUserIds),
        workspaceId: targetWorkspace.id,
      },
    });

    const targetUserWorkspaceByUserId = new Map(
      targetUserWorkspaces.map((userWorkspace) => [
        userWorkspace.userId,
        userWorkspace,
      ]),
    );

    const targetAdminUserWorkspaceIds = await this.getAdminUserWorkspaceIdSet({
      userWorkspaceIds: targetUserWorkspaces.map(
        (userWorkspace) => userWorkspace.id,
      ),
      workspaceId: targetWorkspace.id,
    });

    for (const sourceUserWorkspace of activeSourceUserWorkspaces) {
      const sourceUser = sourceUserWorkspace.user;

      if (!isDefined(sourceUser)) {
        result.failed += 1;
        result.failures.push({
          message: 'Source user not found for workspace membership.',
          userId: sourceUserWorkspace.userId,
        });
        continue;
      }

      const shouldMirrorAdmin = sourceAdminUserWorkspaceIds.has(
        sourceUserWorkspace.id,
      );
      const targetRoleId = shouldMirrorAdmin
        ? targetAdminRole.id
        : targetWorkspace.defaultRoleId;
      const existingTargetUserWorkspace = targetUserWorkspaceByUserId.get(
        sourceUserWorkspace.userId,
      );

      if (isDefined(existingTargetUserWorkspace)) {
        if (
          shouldMirrorAdmin &&
          !targetAdminUserWorkspaceIds.has(existingTargetUserWorkspace.id)
        ) {
          try {
            if (!result.dryRun) {
              await this.userRoleService.assignRoleToManyUserWorkspace({
                roleId: targetAdminRole.id,
                userWorkspaceIds: [existingTargetUserWorkspace.id],
                workspaceId: targetWorkspace.id,
              });
            }

            result.roleUpdated += 1;
          } catch (error) {
            this.addFailure(result, sourceUser, error);
          }

          continue;
        }

        result.skippedExisting += 1;
        continue;
      }

      try {
        if (!result.dryRun) {
          await this.userWorkspaceService.addUserToWorkspaceIfUserNotInWorkspace(
            sourceUser,
            targetWorkspace,
            targetRoleId,
          );
        }

        result.added += 1;
      } catch (error) {
        this.addFailure(result, sourceUser, error);
      }
    }

    return result;
  }

  private async getAdminUserWorkspaceIdSet({
    userWorkspaceIds,
    workspaceId,
  }: {
    userWorkspaceIds: string[];
    workspaceId: string;
  }): Promise<Set<string>> {
    if (userWorkspaceIds.length === 0) {
      return new Set();
    }

    const roleTargets = await this.roleTargetRepository.find({
      relations: {
        role: true,
      },
      where: {
        role: {
          universalIdentifier: STANDARD_ROLE.admin.universalIdentifier,
        },
        userWorkspaceId: In(userWorkspaceIds),
        workspaceId,
      },
    });

    return new Set(
      roleTargets
        .map((roleTarget) => roleTarget.userWorkspaceId)
        .filter(isDefined),
    );
  }

  private addFailure(
    result: EnsureWorkspaceMembersResultDTO,
    user: { id: string; email: string },
    error: unknown,
  ) {
    result.failed += 1;
    result.failures.push({
      email: user.email,
      message: error instanceof Error ? error.message : String(error),
      userId: user.id,
    });
  }
}
