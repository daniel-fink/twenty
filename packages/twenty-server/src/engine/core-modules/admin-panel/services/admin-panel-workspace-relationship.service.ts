import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { IsNull, Repository } from 'typeorm';

import { EnsureWorkspaceRelationshipResultDTO } from 'src/engine/core-modules/admin-panel/dtos/ensure-workspace-relationship-result.dto';
import {
  WorkspaceRelationshipEntity,
  WorkspaceRelationshipType,
} from 'src/engine/core-modules/workspace/workspace-relationship.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

@Injectable()
export class AdminPanelWorkspaceRelationshipService {
  constructor(
    @InjectRepository(WorkspaceRelationshipEntity)
    private readonly workspaceRelationshipRepository: Repository<WorkspaceRelationshipEntity>,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
  ) {}

  async ensureWorkspaceRelationship(input: {
    childWorkspaceId: string;
    parentWorkspaceId: string;
    relationshipType: WorkspaceRelationshipType;
    sourceId?: string | null;
  }): Promise<EnsureWorkspaceRelationshipResultDTO> {
    const [parentWorkspace, childWorkspace] = await Promise.all([
      this.workspaceRepository.findOne({
        where: {
          deletedAt: IsNull(),
          id: input.parentWorkspaceId,
        },
      }),
      this.workspaceRepository.findOne({
        where: {
          deletedAt: IsNull(),
          id: input.childWorkspaceId,
        },
      }),
    ]);

    if (!parentWorkspace) {
      throw new Error(`Parent workspace not found: ${input.parentWorkspaceId}`);
    }

    if (!childWorkspace) {
      throw new Error(`Child workspace not found: ${input.childWorkspaceId}`);
    }

    const existingRelationship =
      await this.workspaceRelationshipRepository.findOne({
        where: {
          childWorkspaceId: input.childWorkspaceId,
          parentWorkspaceId: input.parentWorkspaceId,
          relationshipType: input.relationshipType,
        },
      });

    if (existingRelationship) {
      return {
        childWorkspaceId: input.childWorkspaceId,
        created: false,
        parentWorkspaceId: input.parentWorkspaceId,
        relationshipType: input.relationshipType,
        skippedExisting: true,
        sourceId: existingRelationship.sourceId,
      };
    }

    await this.workspaceRelationshipRepository.save(
      this.workspaceRelationshipRepository.create({
        childWorkspaceId: input.childWorkspaceId,
        parentWorkspaceId: input.parentWorkspaceId,
        relationshipType: input.relationshipType,
        sourceId: input.sourceId ?? null,
      }),
    );

    return {
      childWorkspaceId: input.childWorkspaceId,
      created: true,
      parentWorkspaceId: input.parentWorkspaceId,
      relationshipType: input.relationshipType,
      skippedExisting: false,
      sourceId: input.sourceId ?? null,
    };
  }
}
