import { type MapFieldSource } from '@/object-record/record-map/types/MapFieldSource';
import { type RecordMapPoint } from '@/object-record/record-map/types/RecordMapPoint';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { FieldMetadataType } from '~/generated-metadata/graphql';

const parseCoordinate = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsedValue = Number(value);

    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  return null;
};

export const extractRecordMapCoordinates = ({
  record,
  mapFieldSource,
}: {
  record: ObjectRecord;
  mapFieldSource: MapFieldSource;
}): RecordMapPoint | null => {
  const fieldValue = record[mapFieldSource.fieldName];
  const latitude =
    mapFieldSource.type === FieldMetadataType.GEOMETRY
      ? parseCoordinate(fieldValue?.coordinates?.[1])
      : parseCoordinate(fieldValue?.addressLat);
  const longitude =
    mapFieldSource.type === FieldMetadataType.GEOMETRY
      ? parseCoordinate(fieldValue?.coordinates?.[0])
      : parseCoordinate(fieldValue?.addressLng);

  if (
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return {
    record,
    latitude,
    longitude,
  };
};
