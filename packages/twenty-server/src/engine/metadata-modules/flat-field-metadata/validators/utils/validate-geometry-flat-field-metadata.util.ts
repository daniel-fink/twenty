import { msg } from '@lingui/core/macro';
import {
  FieldMetadataType,
  type GeometryType,
  type FieldMetadataGeometrySettings,
} from 'twenty-shared/types';

import { FieldMetadataExceptionCode } from 'src/engine/metadata-modules/field-metadata/field-metadata.exception';
import { type FlatFieldMetadataTypeValidationArgs } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata-type-validator.type';
import { type FlatFieldMetadataValidationError } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata-validation-error.type';

const ALLOWED_GEOMETRY_TYPES = [
  'POINT',
  'POLYGON',
  'MULTIPOLYGON',
  'GEOMETRY',
] as const satisfies GeometryType[];

export const validateGeometryFlatFieldMetadata = ({
  flatEntityToValidate,
}: FlatFieldMetadataTypeValidationArgs<FieldMetadataType.GEOMETRY>): FlatFieldMetadataValidationError[] => {
  const settings = (
    flatEntityToValidate as unknown as {
      universalSettings: FieldMetadataGeometrySettings | null;
    }
  ).universalSettings;

  if (
    settings?.srid === 4326 &&
    settings?.isGeography === false &&
    ALLOWED_GEOMETRY_TYPES.includes(settings.geometryType)
  ) {
    return [];
  }

  return [
    {
      code: FieldMetadataExceptionCode.INVALID_FIELD_INPUT,
      message:
        'Geometry field settings must use POINT, POLYGON, MULTIPOLYGON, or GEOMETRY with SRID 4326.',
      value: settings,
      userFriendlyMessage: msg`Geometry fields must use supported coordinates with SRID 4326.`,
    },
  ];
};
