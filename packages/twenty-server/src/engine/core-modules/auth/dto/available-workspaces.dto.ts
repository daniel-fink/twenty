/* @license Enterprise */

import { Field, ObjectType } from '@nestjs/graphql';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';
import { type SSOConfiguration } from 'src/engine/core-modules/sso/types/SSOConfigurations.type';
import {
  IdentityProviderType,
  SSOIdentityProviderStatus,
} from 'src/engine/core-modules/sso/workspace-sso-identity-provider.entity';
import { WorkspaceUrlsDTO } from 'src/engine/core-modules/workspace/dtos/workspace-urls.dto';
import { WorkspaceRelationshipType } from 'src/engine/core-modules/workspace/workspace-relationship.entity';

@ObjectType('SSOConnection')
class SSOConnectionDTO {
  @Field(() => IdentityProviderType)
  type: SSOConfiguration['type'];

  @Field(() => UUIDScalarType)
  id: string;

  @Field(() => String)
  issuer: string;

  @Field(() => String)
  name: string;

  @Field(() => SSOIdentityProviderStatus)
  status: SSOConfiguration['status'];
}

@ObjectType('AvailableWorkspaceRelationship')
export class AvailableWorkspaceRelationshipDTO {
  @Field(() => UUIDScalarType)
  parentWorkspaceId: string;

  @Field(() => UUIDScalarType)
  childWorkspaceId: string;

  @Field(() => WorkspaceRelationshipType)
  relationshipType: WorkspaceRelationshipType;

  @Field(() => String, { nullable: true })
  sourceId?: string | null;
}

@ObjectType('AvailableWorkspace')
export class AvailableWorkspace {
  @Field(() => UUIDScalarType)
  id: string;

  @Field(() => String, { nullable: true })
  displayName?: string;

  @Field(() => String, { nullable: true })
  loginToken?: string;

  @Field(() => String, { nullable: true })
  personalInviteToken?: string;

  @Field(() => String, { nullable: true })
  inviteHash?: string;

  @Field(() => WorkspaceUrlsDTO)
  workspaceUrls: WorkspaceUrlsDTO;

  @Field(() => String, { nullable: true })
  logo?: string;

  @Field(() => [SSOConnectionDTO])
  sso: SSOConnectionDTO[];

  @Field(() => AvailableWorkspaceRelationshipDTO, { nullable: true })
  workspaceRelationship?: AvailableWorkspaceRelationshipDTO | null;
}

@ObjectType('AvailableWorkspaces')
export class AvailableWorkspaces {
  @Field(() => [AvailableWorkspace])
  availableWorkspacesForSignIn: Array<AvailableWorkspace>;

  @Field(() => [AvailableWorkspace])
  availableWorkspacesForSignUp: Array<AvailableWorkspace>;
}
