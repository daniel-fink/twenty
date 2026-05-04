import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddGeoReferenceLayerSidebarContract1776300000000
  implements MigrationInterface
{
  name = 'AddGeoReferenceLayerSidebarContract1776300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "core"."geoReferenceLayer"
      ADD COLUMN IF NOT EXISTS "sidebarContractPath" text
    `);

    await queryRunner.query(`
      ALTER TABLE "core"."geoReferenceLayer"
      ADD COLUMN IF NOT EXISTS "sidebarContract" jsonb NOT NULL DEFAULT
        '{
          "version": 1,
          "tabId": "attributes",
          "title": "Attributes",
          "dataset": "reference",
          "query": {
            "type": "single",
            "selectedFeatureField": "id",
            "targetField": "id",
            "selectionTitle": {
              "fields": ["id"],
              "fallback": "selectedFeatureValue"
            },
            "sort": []
          },
          "sections": []
        }'::jsonb
    `);

    await queryRunner.query(`
      ALTER TABLE "core"."geoReferenceLayer"
      ALTER COLUMN "title" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "core"."geoReferenceLayer"
      DROP COLUMN IF EXISTS "sidebarContract"
    `);

    await queryRunner.query(`
      ALTER TABLE "core"."geoReferenceLayer"
      DROP COLUMN IF EXISTS "sidebarContractPath"
    `);

    await queryRunner.query(`
      ALTER TABLE "core"."geoReferenceLayer"
      ALTER COLUMN "title" SET NOT NULL
    `);
  }
}
