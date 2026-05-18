import { Field, Int, ObjectType } from '@nestjs/graphql';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

@ObjectType('EnsureWorkspaceMembersFailure')
export class EnsureWorkspaceMembersFailureDTO {
  @Field(() => UUIDScalarType, { nullable: true })
  userId?: string;

  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => String)
  message: string;
}

@ObjectType('EnsureWorkspaceMembersResult')
export class EnsureWorkspaceMembersResultDTO {
  @Field(() => Int)
  added: number;

  @Field(() => Int)
  skippedExisting: number;

  @Field(() => Int)
  skippedInactive: number;

  @Field(() => Int)
  roleUpdated: number;

  @Field(() => Int)
  failed: number;

  @Field(() => [EnsureWorkspaceMembersFailureDTO])
  failures: EnsureWorkspaceMembersFailureDTO[];

  @Field(() => Boolean)
  dryRun: boolean;
}
