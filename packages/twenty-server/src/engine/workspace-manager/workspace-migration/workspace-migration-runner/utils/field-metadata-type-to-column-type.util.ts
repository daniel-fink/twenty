import {
  FieldMetadataType,
  type FieldMetadataGeometrySettings,
} from 'twenty-shared/types';

import {
  WorkspaceMigrationActionExecutionException,
  WorkspaceMigrationActionExecutionExceptionCode,
} from 'src/engine/workspace-manager/workspace-migration/workspace-migration-runner/exceptions/workspace-migration-action-execution.exception';
import { isTextColumnType } from 'src/engine/workspace-manager/workspace-migration/workspace-migration-runner/utils/is-text-column-type.util';

const geometryTypeToPostgresGeometryType = (
  geometryType: FieldMetadataGeometrySettings['geometryType'] = 'POINT',
) => {
  switch (geometryType) {
    case 'POINT':
      return 'Point';
    case 'POLYGON':
      return 'Polygon';
    case 'MULTIPOLYGON':
      return 'MultiPolygon';
    case 'GEOMETRY':
      return 'Geometry';
  }
};

export const fieldMetadataTypeToColumnType = <Type extends FieldMetadataType>(
  fieldMetadataType: Type,
  settings?: FieldMetadataGeometrySettings | null,
): string => {
  /**
   * Composite types are not implemented here, as they are flattened by their composite definitions.
   * See src/metadata/field-metadata/composite-types for more information.
   */
  if (isTextColumnType(fieldMetadataType)) {
    return 'text';
  }
  switch (fieldMetadataType) {
    case FieldMetadataType.UUID:
      return 'uuid';
    case FieldMetadataType.NUMERIC:
      return 'numeric';
    case FieldMetadataType.NUMBER:
    case FieldMetadataType.POSITION:
      return 'float';
    case FieldMetadataType.BOOLEAN:
      return 'boolean';
    case FieldMetadataType.DATE_TIME:
      return 'timestamptz';
    case FieldMetadataType.DATE:
      return 'date';
    case FieldMetadataType.RATING:
    case FieldMetadataType.SELECT:
    case FieldMetadataType.MULTI_SELECT:
      return 'enum';
    case FieldMetadataType.FILES:
    case FieldMetadataType.RAW_JSON:
      return 'jsonb';
    case FieldMetadataType.TS_VECTOR:
      return 'tsvector';
    case FieldMetadataType.GEOMETRY:
      return `geometry(${geometryTypeToPostgresGeometryType(settings?.geometryType)}, 4326)`;
    default:
      throw new WorkspaceMigrationActionExecutionException({
        message: `Cannot convert ${fieldMetadataType} to column type.`,
        code: WorkspaceMigrationActionExecutionExceptionCode.UNSUPPORTED_FIELD_METADATA_TYPE,
      });
  }
};
