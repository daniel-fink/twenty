import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddGeoReferenceLayers1776200000000 implements MigrationInterface {
  name = 'AddGeoReferenceLayers1776200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "core"."geoReferenceLayer_status_enum"
      AS ENUM ('ACTIVE', 'ARCHIVED')
    `);

    await queryRunner.query(`
      CREATE TABLE "core"."geoReferenceLayer" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "key" text NOT NULL,
        "catalogKey" text NOT NULL DEFAULT 'default',
        "name" text NOT NULL,
        "description" text,
        "status" "core"."geoReferenceLayer_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "source" jsonb NOT NULL,
        "tile" jsonb NOT NULL,
        "style" jsonb NOT NULL,
        "title" jsonb NOT NULL,
        "exposedProperties" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "propertyManifestPath" text,
        "catalogVersion" integer NOT NULL DEFAULT 1,
        "lastSyncAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_GEO_REFERENCE_LAYER" PRIMARY KEY ("id"),
        CONSTRAINT "FK_GEO_REFERENCE_LAYER_WORKSPACE"
          FOREIGN KEY ("workspaceId")
          REFERENCES "core"."workspace"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_GEO_REFERENCE_LAYER_WORKSPACE_KEY"
      ON "core"."geoReferenceLayer" ("workspaceId", "key")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_GEO_REFERENCE_LAYER_WORKSPACE_STATUS"
      ON "core"."geoReferenceLayer" ("workspaceId", "status")
    `);

    await queryRunner.query(`
      CREATE TABLE "core"."viewGeoReferenceLayer" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "viewId" uuid NOT NULL,
        "geoReferenceLayerId" uuid NOT NULL,
        "position" double precision NOT NULL DEFAULT 0,
        "isVisible" boolean NOT NULL DEFAULT true,
        "styleOverride" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_VIEW_GEO_REFERENCE_LAYER" PRIMARY KEY ("id"),
        CONSTRAINT "FK_VIEW_GEO_REFERENCE_LAYER_WORKSPACE"
          FOREIGN KEY ("workspaceId")
          REFERENCES "core"."workspace"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_VIEW_GEO_REFERENCE_LAYER_VIEW"
          FOREIGN KEY ("viewId")
          REFERENCES "core"."view"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_VIEW_GEO_REFERENCE_LAYER_LAYER"
          FOREIGN KEY ("geoReferenceLayerId")
          REFERENCES "core"."geoReferenceLayer"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_VIEW_GEO_REFERENCE_LAYER_VIEW_LAYER"
      ON "core"."viewGeoReferenceLayer" ("viewId", "geoReferenceLayerId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_VIEW_GEO_REFERENCE_LAYER_WORKSPACE_VIEW"
      ON "core"."viewGeoReferenceLayer" ("workspaceId", "viewId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "core"."IDX_VIEW_GEO_REFERENCE_LAYER_WORKSPACE_VIEW"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "core"."IDX_VIEW_GEO_REFERENCE_LAYER_VIEW_LAYER"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "core"."viewGeoReferenceLayer"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "core"."IDX_GEO_REFERENCE_LAYER_WORKSPACE_STATUS"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "core"."IDX_GEO_REFERENCE_LAYER_WORKSPACE_KEY"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "core"."geoReferenceLayer"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "core"."geoReferenceLayer_status_enum"`,
    );
  }
}
