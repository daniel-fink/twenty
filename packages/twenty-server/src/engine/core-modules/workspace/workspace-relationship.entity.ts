import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

import { IDField } from '@ptc-org/nestjs-query-graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

export enum WorkspaceRelationshipType {
  CHILD = 'CHILD',
}

registerEnumType(WorkspaceRelationshipType, {
  name: 'WorkspaceRelationshipType',
});

@Entity({ name: 'workspaceRelationship', schema: 'core' })
@ObjectType('WorkspaceRelationship')
@Unique('IDX_WORKSPACE_RELATIONSHIP_UNIQUE', [
  'parentWorkspaceId',
  'childWorkspaceId',
  'relationshipType',
])
@Index('IDX_WORKSPACE_RELATIONSHIP_PARENT_WORKSPACE_ID', ['parentWorkspaceId'])
@Index('IDX_WORKSPACE_RELATIONSHIP_CHILD_WORKSPACE_ID', ['childWorkspaceId'])
export class WorkspaceRelationshipEntity {
  @IDField(() => UUIDScalarType)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => WorkspaceEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parentWorkspaceId' })
  parentWorkspace: Relation<WorkspaceEntity>;

  @Field(() => UUIDScalarType)
  @Column({ nullable: false, type: 'uuid' })
  parentWorkspaceId: string;

  @ManyToOne(() => WorkspaceEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'childWorkspaceId' })
  childWorkspace: Relation<WorkspaceEntity>;

  @Field(() => UUIDScalarType)
  @Column({ nullable: false, type: 'uuid' })
  childWorkspaceId: string;

  @Field(() => WorkspaceRelationshipType)
  @Column({
    enum: WorkspaceRelationshipType,
    enumName: 'workspaceRelationship_relationshipType_enum',
    nullable: false,
    type: 'enum',
  })
  relationshipType: WorkspaceRelationshipType;

  @Field(() => String, { nullable: true })
  @Column({ nullable: true, type: 'text' })
  sourceId: string | null;

  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Field()
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
