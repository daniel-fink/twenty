import { msg } from '@lingui/core/macro';
import {
  FieldMetadataType,
  isGeoJsonGeometry,
  isGeoJsonPoint,
} from 'twenty-shared/types';

import { type FilterOperator } from 'src/engine/api/common/common-args-processors/filter-arg-processor/types/filter-operator.type';
import {
  type GeometryBboxFilterValue,
  type GeometryDistanceFilterValue,
  type GeometryFilterValue,
} from 'src/engine/api/common/common-args-processors/filter-arg-processor/types/geometry-filter-value.type';
import {
  CommonQueryRunnerException,
  CommonQueryRunnerExceptionCode,
} from 'src/engine/api/common/common-query-runners/errors/common-query-runner.exception';
import { STANDARD_ERROR_MESSAGE } from 'src/engine/api/common/common-query-runners/errors/standard-error-message.constant';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const throwInvalidGeometryFilter = (
  fieldName: string,
  message = `Invalid geometry filter for field "${fieldName}"`,
): never => {
  throw new CommonQueryRunnerException(
    message,
    CommonQueryRunnerExceptionCode.INVALID_ARGS_FILTER,
    { userFriendlyMessage: STANDARD_ERROR_MESSAGE },
  );
};

const validateGeometryDistanceFilterValue = (
  value: unknown,
  fieldName: string,
): GeometryDistanceFilterValue => {
  if (typeof value !== 'object' || value === null || !('point' in value)) {
    return throwInvalidGeometryFilter(fieldName);
  }

  const candidate = value as Partial<GeometryDistanceFilterValue>;

  if (
    !isGeoJsonPoint(candidate.point) ||
    !isFiniteNumber(candidate.distanceInMeters) ||
    candidate.distanceInMeters <= 0
  ) {
    return throwInvalidGeometryFilter(
      fieldName,
      `Invalid distance geometry filter for field "${fieldName}"`,
    );
  }

  return {
    point: candidate.point,
    distanceInMeters: candidate.distanceInMeters,
  };
};

const validateGeometryBboxFilterValue = (
  value: unknown,
  fieldName: string,
): GeometryBboxFilterValue => {
  if (typeof value !== 'object' || value === null) {
    return throwInvalidGeometryFilter(fieldName);
  }

  const candidate = value as Partial<GeometryBboxFilterValue>;
  const { west, south, east, north } = candidate;

  if (
    !isFiniteNumber(west) ||
    !isFiniteNumber(south) ||
    !isFiniteNumber(east) ||
    !isFiniteNumber(north) ||
    west < -180 ||
    west > 180 ||
    east < -180 ||
    east > 180 ||
    south < -90 ||
    south > 90 ||
    north < -90 ||
    north > 90 ||
    west > east ||
    south > north
  ) {
    return throwInvalidGeometryFilter(
      fieldName,
      `Invalid bounding box geometry filter for field "${fieldName}"`,
    );
  }

  return { west, south, east, north };
};

export const validateGeometryFilterValueOrThrow = (
  operator: FilterOperator,
  value: unknown,
  fieldMetadata: FlatFieldMetadata,
  fieldName: string,
): GeometryFilterValue => {
  if (fieldMetadata.type !== FieldMetadataType.GEOMETRY) {
    return throwInvalidGeometryFilter(fieldName);
  }

  switch (operator) {
    case 'withinDistance':
    case 'near':
      return validateGeometryDistanceFilterValue(value, fieldName);

    case 'withinBbox':
      return validateGeometryBboxFilterValue(value, fieldName);

    case 'intersects':
    case 'contains':
    case 'within':
      if (!isGeoJsonGeometry(value)) {
        return throwInvalidGeometryFilter(
          fieldName,
          `Invalid GeoJSON geometry filter for field "${fieldName}"`,
        );
      }

      return value;

    default:
      throw new CommonQueryRunnerException(
        `Operator "${operator}" is not a geometry filter operator`,
        CommonQueryRunnerExceptionCode.INVALID_ARGS_FILTER,
        {
          userFriendlyMessage: msg`Invalid filter operator for geometry field.`,
        },
      );
  }
};
