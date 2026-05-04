import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddGeoReferenceLayerOperationalMetadata1776400000000
  implements MigrationInterface
{
  name = 'AddGeoReferenceLayerOperationalMetadata1776400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "core"."geoReferenceLayer_status_enum"
      ADD VALUE IF NOT EXISTS 'DISABLED'
    `);

    await queryRunner.query(`
      CREATE TYPE "core"."geoReferenceLayer_validationStatus_enum"
      AS ENUM ('NOT_VALIDATED', 'VALID', 'INVALID')
    `);

    await queryRunner.query(`
      ALTER TABLE "core"."geoReferenceLayer"
      ADD COLUMN IF NOT EXISTS "tileProvider" text NOT NULL DEFAULT 'TWENTY_POSTGIS',
      ADD COLUMN IF NOT EXISTS "securityPolicy" jsonb NOT NULL DEFAULT '{"kind":"AUTHENTICATED_WORKSPACE","propertyPolicy":"ALLOWLIST_ONLY"}'::jsonb,
      ADD COLUMN IF NOT EXISTS "attribution" text,
      ADD COLUMN IF NOT EXISTS "validationStatus" "core"."geoReferenceLayer_validationStatus_enum" NOT NULL DEFAULT 'NOT_VALIDATED',
      ADD COLUMN IF NOT EXISTS "validationError" text,
      ADD COLUMN IF NOT EXISTS "lastValidatedAt" timestamptz,
      ADD COLUMN IF NOT EXISTS "rowCount" integer,
      ADD COLUMN IF NOT EXISTS "bounds" jsonb,
      ADD COLUMN IF NOT EXISTS "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "core"."geoReferenceLayer"
      DROP COLUMN IF EXISTS "metadata",
      DROP COLUMN IF EXISTS "bounds",
      DROP COLUMN IF EXISTS "rowCount",
      DROP COLUMN IF EXISTS "lastValidatedAt",
      DROP COLUMN IF EXISTS "validationError",
      DROP COLUMN IF EXISTS "validationStatus",
      DROP COLUMN IF EXISTS "attribution",
      DROP COLUMN IF EXISTS "securityPolicy",
      DROP COLUMN IF EXISTS "tileProvider"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "core"."geoReferenceLayer_validationStatus_enum"
    `);

    await queryRunner.query(`
      UPDATE "core"."geoReferenceLayer"
      SET "status" = 'ARCHIVED'
      WHERE "status" = 'DISABLED'
    `);

    await queryRunner.query(`
      ALTER TYPE "core"."geoReferenceLayer_status_enum"
      RENAME TO "geoReferenceLayer_status_enum_old"
    `);

    await queryRunner.query(`
      CREATE TYPE "core"."geoReferenceLayer_status_enum"
      AS ENUM ('ACTIVE', 'ARCHIVED')
    `);

    await queryRunner.query(`
      ALTER TABLE "core"."geoReferenceLayer"
      ALTER COLUMN "status" DROP DEFAULT,
      ALTER COLUMN "status" TYPE "core"."geoReferenceLayer_status_enum"
        USING "status"::text::"core"."geoReferenceLayer_status_enum",
      ALTER COLUMN "status" SET DEFAULT 'ACTIVE'
    `);

    await queryRunner.query(`
      DROP TYPE "core"."geoReferenceLayer_status_enum_old"
    `);
  }
}
