import { Field, ObjectType } from '@nestjs/graphql';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';
import { WorkspaceRelationshipType } from 'src/engine/core-modules/workspace/workspace-relationship.entity';

@ObjectType()
export class EnsureWorkspaceRelationshipResultDTO {
  @Field(() => UUIDScalarType)
  childWorkspaceId: string;

  @Field(() => Boolean)
  created: boolean;

  @Field(() => UUIDScalarType)
  parentWorkspaceId: string;

  @Field(() => WorkspaceRelationshipType)
  relationshipType: WorkspaceRelationshipType;

  @Field(() => Boolean)
  skippedExisting: boolean;

  @Field(() => String, { nullable: true })
  sourceId?: string | null;
}
