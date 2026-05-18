import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, type TestingModule } from '@nestjs/testing';

import { Repository } from 'typeorm';

import { AdminPanelWorkspaceRelationshipService } from 'src/engine/core-modules/admin-panel/services/admin-panel-workspace-relationship.service';
import {
  WorkspaceRelationshipEntity,
  WorkspaceRelationshipType,
} from 'src/engine/core-modules/workspace/workspace-relationship.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

const parentWorkspace = { id: 'parent-workspace-id' } as WorkspaceEntity;
const childWorkspace = { id: 'child-workspace-id' } as WorkspaceEntity;

describe('AdminPanelWorkspaceRelationshipService', () => {
  let service: AdminPanelWorkspaceRelationshipService;
  let workspaceRepository: jest.Mocked<Repository<WorkspaceEntity>>;
  let workspaceRelationshipRepository: jest.Mocked<
    Repository<WorkspaceRelationshipEntity>
  >;

  const input = {
    childWorkspaceId: childWorkspace.id,
    parentWorkspaceId: parentWorkspace.id,
    relationshipType: WorkspaceRelationshipType.CHILD,
    sourceId: 'source-id',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminPanelWorkspaceRelationshipService,
        {
          provide: getRepositoryToken(WorkspaceRelationshipEntity),
          useValue: {
            create: jest.fn((value) => value),
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(WorkspaceEntity),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AdminPanelWorkspaceRelationshipService);
    workspaceRelationshipRepository = module.get(
      getRepositoryToken(WorkspaceRelationshipEntity),
    );
    workspaceRepository = module.get(getRepositoryToken(WorkspaceEntity));

    workspaceRepository.findOne.mockImplementation(async ({ where }) => {
      if ((where as { id: string }).id === parentWorkspace.id) {
        return parentWorkspace;
      }

      if ((where as { id: string }).id === childWorkspace.id) {
        return childWorkspace;
      }

      return null;
    });
    workspaceRelationshipRepository.findOne.mockResolvedValue(null);
  });

  it('creates a child workspace relationship', async () => {
    const result = await service.ensureWorkspaceRelationship(input);

    expect(result).toMatchObject({
      created: true,
      skippedExisting: false,
      ...input,
    });
    expect(workspaceRelationshipRepository.save).toHaveBeenCalledWith(input);
  });

  it('skips an existing child workspace relationship', async () => {
    workspaceRelationshipRepository.findOne.mockResolvedValue({
      ...input,
    } as WorkspaceRelationshipEntity);

    const result = await service.ensureWorkspaceRelationship(input);

    expect(result).toMatchObject({
      created: false,
      skippedExisting: true,
      ...input,
    });
    expect(workspaceRelationshipRepository.save).not.toHaveBeenCalled();
  });

  it('rejects missing parent or child workspaces', async () => {
    workspaceRepository.findOne.mockResolvedValueOnce(null);

    await expect(service.ensureWorkspaceRelationship(input)).rejects.toThrow(
      'Parent workspace not found',
    );
  });
});
