import { useGetCurrentViewOnly } from '@/views/hooks/useGetCurrentViewOnly';

import { RecordMap } from '@/object-record/record-map/components/RecordMap';
import { RecordIndexMapDataLoaderEffect } from '@/object-record/record-map/components/RecordIndexMapDataLoaderEffect';
import { RecordMapSSESubscribeEffect } from '@/object-record/record-map/components/RecordMapSSESubscribeEffect';
import { useRecordMapRecords } from '@/object-record/record-map/hooks/useRecordMapRecords';
import { type MapFieldSource } from '@/object-record/record-map/types/MapFieldSource';
import {
  isValidMapFieldMetadataItem,
  type MapFieldMetadataItem,
} from '@/object-record/record-map/utils/isValidMapFieldMetadataItem';
import { RecordComponentInstanceContextsWrapper } from '@/object-record/components/RecordComponentInstanceContextsWrapper';
import { useRecordIndexContextOrThrow } from '@/object-record/record-index/contexts/RecordIndexContext';
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
        mapFieldSource={mapFieldSource}
        objectNameSingular={objectNameSingular}
      />
    </RecordComponentInstanceContextsWrapper>
  );
};

const RecordIndexMapContent = ({
  mapFieldSource,
  objectNameSingular,
}: {
  mapFieldSource: MapFieldSource;
  objectNameSingular: string;
}) => {
  const { records, recordMapPoints, loading } = useRecordMapRecords({
    mapFieldSource,
    objectNameSingular,
  });

  return (
    <>
      <RecordMap loading={loading} recordMapPoints={recordMapPoints} />
      <RecordMapSSESubscribeEffect />
      <RecordIndexMapDataLoaderEffect records={records} />
    </>
  );
};
