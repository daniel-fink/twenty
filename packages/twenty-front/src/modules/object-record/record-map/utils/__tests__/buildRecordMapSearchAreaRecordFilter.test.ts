import { buildRecordMapSearchAreaRecordFilter } from '@/object-record/record-map/utils/buildRecordMapSearchAreaRecordFilter';
import { ViewFilterOperand } from 'twenty-shared/types';
import { FieldMetadataType } from '~/generated-metadata/graphql';

describe('buildRecordMapSearchAreaRecordFilter', () => {
  it('should build a temporary bbox geometry record filter', () => {
    const recordFilter = buildRecordMapSearchAreaRecordFilter({
      bounds: [-74.1, 40.6, -73.7, 40.9],
      mapFieldSource: {
        fieldMetadataId: 'field-id',
        fieldName: 'geometry',
        type: FieldMetadataType.GEOMETRY,
      },
    });

    expect(recordFilter).toEqual({
      id: 'record-map-search-this-area-field-id',
      displayValue: '-74.1000, 40.6000, -73.7000, 40.9000',
      fieldMetadataId: 'field-id',
      label: 'geometry',
      operand: ViewFilterOperand.WITHIN_BBOX,
      type: 'GEOMETRY',
      value: JSON.stringify({
        west: -74.1,
        south: 40.6,
        east: -73.7,
        north: 40.9,
      }),
    });
  });
});
