import { MigrationInterface, QueryRunner } from 'typeorm';

const SPATIAL_VIEW_FILTER_OPERANDS = [
  'WITHIN_DISTANCE',
  'WITHIN_BBOX',
  'INTERSECTS',
  'CONTAINS_GEOMETRY',
  'WITHIN_GEOMETRY',
  'NEAR',
] as const;

export class AddSpatialViewFilterOperands1776000000000
  implements MigrationInterface
{
  name = 'AddSpatialViewFilterOperands1776000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const operand of SPATIAL_VIEW_FILTER_OPERANDS) {
      await queryRunner.query(
        `ALTER TYPE "core"."viewFilter_operand_enum" ADD VALUE IF NOT EXISTS '${operand}'`,
      );
    }
  }

  public async down(): Promise<void> {
    // PostgreSQL cannot safely drop enum values in-place once view filters may
    // reference them.
  }
}
