import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, type TestingModule } from '@nestjs/testing';

import { Repository } from 'typeorm';

import {
  EnsureWorkspaceMembersInput,
  WorkspaceMemberRolePolicy,
} from 'src/engine/core-modules/admin-panel/dtos/ensure-workspace-members.input';
import { AdminPanelWorkspaceMemberService } from 'src/engine/core-modules/admin-panel/services/admin-panel-workspace-member.service';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { UserWorkspaceService } from 'src/engine/core-modules/user-workspace/user-workspace.service';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { RoleTargetEntity } from 'src/engine/metadata-modules/role-target/role-target.entity';
import { RoleEntity } from 'src/engine/metadata-modules/role/role.entity';
import { UserRoleService } from 'src/engine/metadata-modules/user-role/user-role.service';

const sourceWorkspace = {
  id: 'source-workspace-id',
} as WorkspaceEntity;
const targetWorkspace = {
  defaultRoleId: 'target-default-role-id',
  id: 'target-workspace-id',
} as WorkspaceEntity;
const targetAdminRole = {
  id: 'target-admin-role-id',
} as RoleEntity;

const makeUser = (id: string, email = `${id}@example.com`) =>
  ({
    email,
    id,
  }) as UserEntity;

const makeUserWorkspace = ({
  deletedAt,
  id,
  user,
  userId,
  workspaceId = sourceWorkspace.id,
}: {
  deletedAt?: Date | null;
  id: string;
  user?: UserEntity;
  userId: string;
  workspaceId?: string;
}) =>
  ({
    deletedAt: deletedAt ?? null,
    id,
    user,
    userId,
    workspaceId,
  }) as UserWorkspaceEntity;

describe('AdminPanelWorkspaceMemberService', () => {
  let service: AdminPanelWorkspaceMemberService;
  let userWorkspaceRepository: jest.Mocked<Repository<UserWorkspaceEntity>>;
  let workspaceRepository: jest.Mocked<Repository<WorkspaceEntity>>;
  let roleRepository: jest.Mocked<Repository<RoleEntity>>;
  let roleTargetRepository: jest.Mocked<Repository<RoleTargetEntity>>;
  let userWorkspaceService: jest.Mocked<UserWorkspaceService>;
  let userRoleService: jest.Mocked<UserRoleService>;

  const input: EnsureWorkspaceMembersInput = {
    rolePolicy: WorkspaceMemberRolePolicy.MIRROR_SOURCE_ADMINS,
    sourceWorkspaceId: sourceWorkspace.id,
    targetWorkspaceId: targetWorkspace.id,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminPanelWorkspaceMemberService,
        {
          provide: getRepositoryToken(UserWorkspaceEntity),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(WorkspaceEntity),
          useValue: {
            findOneBy: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(RoleEntity),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(RoleTargetEntity),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: UserWorkspaceService,
          useValue: {
            addUserToWorkspaceIfUserNotInWorkspace: jest.fn(),
          },
        },
        {
          provide: UserRoleService,
          useValue: {
            assignRoleToManyUserWorkspace: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AdminPanelWorkspaceMemberService);
    userWorkspaceRepository = module.get(
      getRepositoryToken(UserWorkspaceEntity),
    );
    workspaceRepository = module.get(getRepositoryToken(WorkspaceEntity));
    roleRepository = module.get(getRepositoryToken(RoleEntity));
    roleTargetRepository = module.get(getRepositoryToken(RoleTargetEntity));
    userWorkspaceService = module.get(UserWorkspaceService);
    userRoleService = module.get(UserRoleService);

    workspaceRepository.findOneBy.mockImplementation(async (where) => {
      const { id } = where as { id: string };

      if (id === sourceWorkspace.id) {
        return sourceWorkspace;
      }

      if (id === targetWorkspace.id) {
        return targetWorkspace;
      }

      return null;
    });
    roleRepository.findOne.mockResolvedValue(targetAdminRole);
    roleTargetRepository.find.mockResolvedValue([]);
    userWorkspaceRepository.find.mockResolvedValue([]);
  });

  it('adds active source members to the target workspace', async () => {
    const user = makeUser('user-id');

    userWorkspaceRepository.find
      .mockResolvedValueOnce([
        makeUserWorkspace({
          id: 'source-user-workspace-id',
          user,
          userId: user.id,
        }),
      ])
      .mockResolvedValueOnce([]);

    const result = await service.ensureWorkspaceMembers(input);

    expect(result).toMatchObject({
      added: 1,
      failed: 0,
      skippedExisting: 0,
    });
    expect(
      userWorkspaceService.addUserToWorkspaceIfUserNotInWorkspace,
    ).toHaveBeenCalledWith(
      user,
      targetWorkspace,
      targetWorkspace.defaultRoleId,
    );
  });

  it('reports dry-run additions without writing', async () => {
    const user = makeUser('user-id');

    userWorkspaceRepository.find
      .mockResolvedValueOnce([
        makeUserWorkspace({
          id: 'source-user-workspace-id',
          user,
          userId: user.id,
        }),
      ])
      .mockResolvedValueOnce([]);

    const result = await service.ensureWorkspaceMembers({
      ...input,
      dryRun: true,
    });

    expect(result).toMatchObject({
      added: 1,
      dryRun: true,
    });
    expect(
      userWorkspaceService.addUserToWorkspaceIfUserNotInWorkspace,
    ).not.toHaveBeenCalled();
  });

  it('skips existing target members', async () => {
    const user = makeUser('user-id');

    userWorkspaceRepository.find
      .mockResolvedValueOnce([
        makeUserWorkspace({
          id: 'source-user-workspace-id',
          user,
          userId: user.id,
        }),
      ])
      .mockResolvedValueOnce([
        makeUserWorkspace({
          id: 'target-user-workspace-id',
          userId: user.id,
          workspaceId: targetWorkspace.id,
        }),
      ]);

    const result = await service.ensureWorkspaceMembers(input);

    expect(result).toMatchObject({
      added: 0,
      skippedExisting: 1,
    });
  });

  it('mirrors parent admins to the target admin role', async () => {
    const user = makeUser('admin-user-id');

    userWorkspaceRepository.find
      .mockResolvedValueOnce([
        makeUserWorkspace({
          id: 'source-admin-user-workspace-id',
          user,
          userId: user.id,
        }),
      ])
      .mockResolvedValueOnce([]);
    roleTargetRepository.find.mockResolvedValueOnce([
      {
        userWorkspaceId: 'source-admin-user-workspace-id',
      } as RoleTargetEntity,
    ]);

    const result = await service.ensureWorkspaceMembers(input);

    expect(result.added).toBe(1);
    expect(
      userWorkspaceService.addUserToWorkspaceIfUserNotInWorkspace,
    ).toHaveBeenCalledWith(user, targetWorkspace, targetAdminRole.id);
  });

  it('upgrades existing target members when the source member is admin', async () => {
    const user = makeUser('admin-user-id');

    userWorkspaceRepository.find
      .mockResolvedValueOnce([
        makeUserWorkspace({
          id: 'source-admin-user-workspace-id',
          user,
          userId: user.id,
        }),
      ])
      .mockResolvedValueOnce([
        makeUserWorkspace({
          id: 'target-user-workspace-id',
          userId: user.id,
          workspaceId: targetWorkspace.id,
        }),
      ]);
    roleTargetRepository.find.mockResolvedValueOnce([
      {
        userWorkspaceId: 'source-admin-user-workspace-id',
      } as RoleTargetEntity,
    ]);

    const result = await service.ensureWorkspaceMembers(input);

    expect(result.roleUpdated).toBe(1);
    expect(userRoleService.assignRoleToManyUserWorkspace).toHaveBeenCalledWith({
      roleId: targetAdminRole.id,
      userWorkspaceIds: ['target-user-workspace-id'],
      workspaceId: targetWorkspace.id,
    });
  });

  it('skips soft-deleted source memberships', async () => {
    const user = makeUser('deleted-user-id');

    userWorkspaceRepository.find.mockResolvedValueOnce([
      makeUserWorkspace({
        deletedAt: new Date(),
        id: 'deleted-source-user-workspace-id',
        user,
        userId: user.id,
      }),
    ]);

    const result = await service.ensureWorkspaceMembers(input);

    expect(result).toMatchObject({
      added: 0,
      skippedInactive: 1,
    });
  });
});
