import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddMapViewSchema1776050000000 implements MigrationInterface {
  name = 'AddMapViewSchema1776050000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "core"."view_type_enum" ADD VALUE IF NOT EXISTS 'MAP'`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."view" ADD COLUMN IF NOT EXISTS "mapFieldMetadataId" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_VIEW_MAP_FIELD_METADATA" ON "core"."view" ("mapFieldMetadataId")`,
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_VIEW_MAP_FIELD_METADATA'
            AND connamespace = 'core'::regnamespace
        ) THEN
          ALTER TABLE "core"."view"
            ADD CONSTRAINT "FK_VIEW_MAP_FIELD_METADATA"
            FOREIGN KEY ("mapFieldMetadataId")
            REFERENCES "core"."fieldMetadata"("id")
            ON DELETE CASCADE
            ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'CHK_VIEW_MAP_INTEGRITY'
            AND connamespace = 'core'::regnamespace
        ) THEN
          ALTER TABLE "core"."view"
            ADD CONSTRAINT "CHK_VIEW_MAP_INTEGRITY"
            CHECK (("type"::text != 'MAP' OR "mapFieldMetadataId" IS NOT NULL));
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."view" DROP CONSTRAINT IF EXISTS "CHK_VIEW_MAP_INTEGRITY"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."view" DROP CONSTRAINT IF EXISTS "FK_VIEW_MAP_FIELD_METADATA"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "core"."IDX_VIEW_MAP_FIELD_METADATA"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."view" DROP COLUMN IF EXISTS "mapFieldMetadataId"`,
    );
  }
}
