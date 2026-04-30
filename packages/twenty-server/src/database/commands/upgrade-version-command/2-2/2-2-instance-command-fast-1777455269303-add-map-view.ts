import { type QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { type FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

@RegisteredInstanceCommand('2.2.0', 1777455269303)
export class AddMapViewFastInstanceCommand implements FastInstanceCommand {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "core"."view_type_enum" ADD VALUE IF NOT EXISTS 'MAP' AFTER 'CALENDAR'`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."view" ADD "mapFieldMetadataId" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_VIEW_MAP_FIELD_METADATA" ON "core"."view" ("mapFieldMetadataId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."view" ADD CONSTRAINT "FK_VIEW_MAP_FIELD_METADATA" FOREIGN KEY ("mapFieldMetadataId") REFERENCES "core"."fieldMetadata"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."view" ADD CONSTRAINT "CHK_VIEW_MAP_INTEGRITY" CHECK (("type"::text != 'MAP' OR "mapFieldMetadataId" IS NOT NULL))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."view" DROP CONSTRAINT "CHK_VIEW_MAP_INTEGRITY"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."view" DROP CONSTRAINT "FK_VIEW_MAP_FIELD_METADATA"`,
    );
    await queryRunner.query(`DROP INDEX "core"."IDX_VIEW_MAP_FIELD_METADATA"`);
    await queryRunner.query(
      `ALTER TABLE "core"."view" DROP COLUMN "mapFieldMetadataId"`,
    );
    await queryRunner.query(
      `CREATE TYPE "core"."view_type_enum_old" AS ENUM('TABLE', 'KANBAN', 'CALENDAR', 'FIELDS_WIDGET', 'TABLE_WIDGET')`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."view" ALTER COLUMN "type" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."view" ALTER COLUMN "type" TYPE "core"."view_type_enum_old" USING "type"::"text"::"core"."view_type_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."view" ALTER COLUMN "type" SET DEFAULT 'TABLE'`,
    );
    await queryRunner.query(`DROP TYPE "core"."view_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "core"."view_type_enum_old" RENAME TO "view_type_enum"`,
    );
  }
}
