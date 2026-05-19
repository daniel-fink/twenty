import { Field, ObjectType } from '@nestjs/graphql';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

@ObjectType()
export class EnsureApplicationInstalledResultDTO {
  @Field(() => UUIDScalarType)
  applicationUniversalIdentifier: string;

  @Field()
  dryRun: boolean;

  @Field()
  installed: boolean;

  @Field()
  skippedExisting: boolean;
}
