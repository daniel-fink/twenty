import { type QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { type FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

@RegisteredInstanceCommand('2.2.0', 1777455269304)
export class AddNativePointGeometryFastInstanceCommand
  implements FastInstanceCommand
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "postgis"`);
    await queryRunner.query(
      `ALTER TYPE "core"."indexMetadata_indextype_enum" ADD VALUE IF NOT EXISTS 'GIST' AFTER 'BTREE'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "core"."indexMetadata_indextype_enum_old" AS ENUM('BTREE', 'GIN')`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."indexMetadata" ALTER COLUMN "indexType" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."indexMetadata" ALTER COLUMN "indexType" TYPE "core"."indexMetadata_indextype_enum_old" USING "indexType"::"text"::"core"."indexMetadata_indextype_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."indexMetadata" ALTER COLUMN "indexType" SET DEFAULT 'BTREE'`,
    );
    await queryRunner.query(`DROP TYPE "core"."indexMetadata_indextype_enum"`);
    await queryRunner.query(
      `ALTER TYPE "core"."indexMetadata_indextype_enum_old" RENAME TO "indexMetadata_indextype_enum"`,
    );
  }
}
