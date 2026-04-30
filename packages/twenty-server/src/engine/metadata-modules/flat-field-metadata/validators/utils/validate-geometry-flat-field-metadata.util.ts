import { msg } from '@lingui/core/macro';
import {
  DEFAULT_GEOMETRY_FIELD_SETTINGS,
  FieldMetadataType,
  type FieldMetadataGeometrySettings,
} from 'twenty-shared/types';

import { FieldMetadataExceptionCode } from 'src/engine/metadata-modules/field-metadata/field-metadata.exception';
import { type FlatFieldMetadataTypeValidationArgs } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata-type-validator.type';
import { type FlatFieldMetadataValidationError } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata-validation-error.type';

export const validateGeometryFlatFieldMetadata = ({
  flatEntityToValidate,
}: FlatFieldMetadataTypeValidationArgs<FieldMetadataType.GEOMETRY>): FlatFieldMetadataValidationError[] => {
  const settings = (
    flatEntityToValidate as unknown as {
      universalSettings: FieldMetadataGeometrySettings | null;
    }
  ).universalSettings;

  if (
    settings?.geometryType === DEFAULT_GEOMETRY_FIELD_SETTINGS.geometryType &&
    settings?.srid === DEFAULT_GEOMETRY_FIELD_SETTINGS.srid &&
    settings?.isGeography === DEFAULT_GEOMETRY_FIELD_SETTINGS.isGeography
  ) {
    return [];
  }

  return [
    {
      code: FieldMetadataExceptionCode.INVALID_FIELD_INPUT,
      message:
        'Geometry field settings must be fixed to Point geometry with SRID 4326.',
      value: settings,
      userFriendlyMessage: msg`Geometry fields must use Point coordinates.`,
    },
  ];
};
