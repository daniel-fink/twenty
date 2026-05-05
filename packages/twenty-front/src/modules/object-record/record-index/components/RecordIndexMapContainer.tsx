import { useGetCurrentViewOnly } from '@/views/hooks/useGetCurrentViewOnly';

import { RecordMap } from '@/object-record/record-map/components/RecordMap';
import { useFindManyRecordIndexTableParams } from '@/object-record/record-index/hooks/useFindManyRecordIndexTableParams';
import { type MapFieldSource } from '@/object-record/record-map/types/MapFieldSource';
import {
  isValidMapFieldMetadataItem,
  type MapFieldMetadataItem,
} from '@/object-record/record-map/utils/isValidMapFieldMetadataItem';
import { RecordComponentInstanceContextsWrapper } from '@/object-record/components/RecordComponentInstanceContextsWrapper';
import { useRecordIndexContextOrThrow } from '@/object-record/record-index/contexts/RecordIndexContext';
import { useUpsertRecordFilter } from '@/object-record/record-filter/hooks/useUpsertRecordFilter';
import { buildRecordMapSearchAreaRecordFilter } from '@/object-record/record-map/utils/buildRecordMapSearchAreaRecordFilter';
import { type RecordMapBounds } from '@/object-record/record-map/utils/getPaddedRecordMapBounds';
import { isDefined } from 'twenty-shared/utils';

type RecordIndexMapContainerProps = {
  recordMapInstanceId: string;
};

export const RecordIndexMapContainer = ({
  recordMapInstanceId,
}: RecordIndexMapContainerProps) => {
  const { currentView } = useGetCurrentViewOnly();
  const { objectMetadataItem, objectNameSingular } =
    useRecordIndexContextOrThrow();

  const mapFieldMetadataItem = objectMetadataItem.readableFields.find(
    (field): field is MapFieldMetadataItem =>
      field.id === currentView?.mapFieldMetadataId &&
      isValidMapFieldMetadataItem(field),
  );

  if (!isDefined(currentView?.mapFieldMetadataId)) {
    return null;
  }

  if (!isDefined(mapFieldMetadataItem)) {
    return null;
  }

  const mapFieldSource = {
    fieldMetadataId: mapFieldMetadataItem.id,
    fieldName: mapFieldMetadataItem.name,
    type: mapFieldMetadataItem.type,
  } satisfies MapFieldSource;

  return (
    <RecordComponentInstanceContextsWrapper
      componentInstanceId={recordMapInstanceId}
    >
      <RecordIndexMapContent
        viewId={currentView.id}
        mapFieldSource={mapFieldSource}
        objectNameSingular={objectNameSingular}
      />
    </RecordComponentInstanceContextsWrapper>
  );
};

const RecordIndexMapContent = ({
  viewId,
  mapFieldSource,
  objectNameSingular,
}: {
  viewId: string;
  mapFieldSource: MapFieldSource;
  objectNameSingular: string;
}) => {
  return (
    <RecordIndexGeometryMapContent
      viewId={viewId}
      mapFieldSource={mapFieldSource}
      objectNameSingular={objectNameSingular}
    />
  );
};

const RecordIndexGeometryMapContent = ({
  viewId,
  mapFieldSource,
  objectNameSingular,
}: {
  viewId: string;
  mapFieldSource: MapFieldSource;
  objectNameSingular: string;
}) => {
  const { filter } = useFindManyRecordIndexTableParams(objectNameSingular);
  const { upsertRecordFilter } = useUpsertRecordFilter();

  const handleSearchThisArea = (bounds: RecordMapBounds) => {
    upsertRecordFilter(
      buildRecordMapSearchAreaRecordFilter({
        bounds,
        mapFieldSource,
      }),
    );
  };

  return (
    <RecordMap
      loading={false}
      objectNameSingular={objectNameSingular}
      recordMapPoints={[]}
      onSearchThisArea={handleSearchThisArea}
      tileSource={{ viewId, filter }}
    />
  );
};
