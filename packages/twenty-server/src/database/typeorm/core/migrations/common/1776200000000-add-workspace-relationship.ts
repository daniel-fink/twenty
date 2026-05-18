import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddWorkspaceRelationship1776200000000
  implements MigrationInterface
{
  name = 'AddWorkspaceRelationship1776200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "core"."workspaceRelationship_relationshipType_enum" AS ENUM ('CHILD');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "core"."workspaceRelationship" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "parentWorkspaceId" uuid NOT NULL,
        "childWorkspaceId" uuid NOT NULL,
        "relationshipType" "core"."workspaceRelationship_relationshipType_enum" NOT NULL,
        "sourceId" text,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_WORKSPACE_RELATIONSHIP_ID" PRIMARY KEY ("id"),
        CONSTRAINT "IDX_WORKSPACE_RELATIONSHIP_UNIQUE" UNIQUE ("parentWorkspaceId", "childWorkspaceId", "relationshipType"),
        CONSTRAINT "FK_WORKSPACE_RELATIONSHIP_PARENT_WORKSPACE_ID" FOREIGN KEY ("parentWorkspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_WORKSPACE_RELATIONSHIP_CHILD_WORKSPACE_ID" FOREIGN KEY ("childWorkspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_WORKSPACE_RELATIONSHIP_PARENT_WORKSPACE_ID" ON "core"."workspaceRelationship" ("parentWorkspaceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_WORKSPACE_RELATIONSHIP_CHILD_WORKSPACE_ID" ON "core"."workspaceRelationship" ("childWorkspaceId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "core"."workspaceRelationship"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "core"."workspaceRelationship_relationshipType_enum"`,
    );
  }
}
