import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddViewMapTilePolicy1776100000000 implements MigrationInterface {
  name = 'AddViewMapTilePolicy1776100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."view" ADD COLUMN IF NOT EXISTS "mapTilePolicy" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."view" DROP COLUMN IF EXISTS "mapTilePolicy"`,
    );
  }
}
