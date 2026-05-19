import { ArgsType, Field, registerEnumType } from '@nestjs/graphql';

import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

export enum WorkspaceMemberRolePolicy {
  MIRROR_SOURCE_ADMINS = 'MIRROR_SOURCE_ADMINS',
}

registerEnumType(WorkspaceMemberRolePolicy, {
  name: 'WorkspaceMemberRolePolicy',
});

@ArgsType()
export class EnsureWorkspaceMembersInput {
  @Field(() => UUIDScalarType)
  @IsUUID()
  sourceWorkspaceId: string;

  @Field(() => UUIDScalarType)
  @IsUUID()
  targetWorkspaceId: string;

  @Field(() => WorkspaceMemberRolePolicy)
  @IsEnum(WorkspaceMemberRolePolicy)
  rolePolicy: WorkspaceMemberRolePolicy;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
