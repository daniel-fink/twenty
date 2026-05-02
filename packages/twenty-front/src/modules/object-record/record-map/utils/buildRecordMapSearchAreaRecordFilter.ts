import { type RecordFilter } from '@/object-record/record-filter/types/RecordFilter';
import { type MapFieldSource } from '@/object-record/record-map/types/MapFieldSource';
import { type RecordMapBounds } from '@/object-record/record-map/utils/getPaddedRecordMapBounds';
import { ViewFilterOperand } from 'twenty-shared/types';

export const buildRecordMapSearchAreaRecordFilter = ({
  bounds,
  mapFieldSource,
}: {
  bounds: RecordMapBounds;
  mapFieldSource: MapFieldSource;
}): RecordFilter => {
  const [west, south, east, north] = bounds;

  return {
    id: `record-map-search-this-area-${mapFieldSource.fieldMetadataId}`,
    fieldMetadataId: mapFieldSource.fieldMetadataId,
    label: mapFieldSource.fieldName,
    operand: ViewFilterOperand.WITHIN_BBOX,
    type: 'GEOMETRY',
    value: JSON.stringify({ west, south, east, north }),
    displayValue: `${west.toFixed(4)}, ${south.toFixed(4)}, ${east.toFixed(
      4,
    )}, ${north.toFixed(4)}`,
  };
};
