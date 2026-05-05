import { extractRecordMapCoordinates } from '@/object-record/record-map/utils/extractRecordMapCoordinates';
import { FieldMetadataType } from '~/generated-metadata/graphql';

const geometryMapFieldSource = {
  fieldMetadataId: 'location-field-id',
  fieldName: 'location',
  type: FieldMetadataType.GEOMETRY,
} as const;

describe('extractRecordMapCoordinates', () => {
  it('returns null when coordinates are missing', () => {
    expect(
      extractRecordMapCoordinates({
        record: {
          __typename: 'Company',
          id: 'record-id',
          location: {
            type: 'Point',
            coordinates: [-74.006],
          },
        },
        mapFieldSource: geometryMapFieldSource,
      }),
    ).toBeNull();
  });

  it('returns null when coordinates are invalid strings', () => {
    expect(
      extractRecordMapCoordinates({
        record: {
          __typename: 'Company',
          id: 'record-id',
          location: {
            type: 'Point',
            coordinates: ['-74.006', 'not-a-coordinate'],
          },
        },
        mapFieldSource: geometryMapFieldSource,
      }),
    ).toBeNull();
  });

  it('returns null when coordinates are out of bounds', () => {
    expect(
      extractRecordMapCoordinates({
        record: {
          __typename: 'Company',
          id: 'record-id',
          location: {
            type: 'Point',
            coordinates: [-74.006, 95],
          },
        },
        mapFieldSource: geometryMapFieldSource,
      }),
    ).toBeNull();
  });

  it('extracts valid GeoJSON point geometry coordinates', () => {
    const record = {
      __typename: 'Company',
      id: 'record-id',
      location: {
        type: 'Point',
        coordinates: [-74.006, 40.7128],
      },
    };

    expect(
      extractRecordMapCoordinates({
        record,
        mapFieldSource: geometryMapFieldSource,
      }),
    ).toEqual({
      record,
      latitude: 40.7128,
      longitude: -74.006,
    });
  });

  it('returns null when GeoJSON point geometry coordinates are invalid', () => {
    expect(
      extractRecordMapCoordinates({
        record: {
          __typename: 'Company',
          id: 'record-id',
          location: {
            type: 'Point',
            coordinates: [-74.006],
          },
        },
        mapFieldSource: geometryMapFieldSource,
      }),
    ).toBeNull();
  });

  it('returns null when GeoJSON point geometry coordinates are out of bounds', () => {
    expect(
      extractRecordMapCoordinates({
        record: {
          __typename: 'Company',
          id: 'record-id',
          location: {
            type: 'Point',
            coordinates: [-74.006, 95],
          },
        },
        mapFieldSource: geometryMapFieldSource,
      }),
    ).toBeNull();
  });
});
