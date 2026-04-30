import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { useRelevantRecordsGqlFields } from '@/object-record/record-field/hooks/useRelevantRecordsGqlFields';
import { useFindManyRecordIndexTableParams } from '@/object-record/record-index/hooks/useFindManyRecordIndexTableParams';
import { extractRecordMapCoordinates } from '@/object-record/record-map/utils/extractRecordMapCoordinates';
import { type MapFieldSource } from '@/object-record/record-map/types/MapFieldSource';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { useMemo } from 'react';
import { isDefined } from 'twenty-shared/utils';

const RECORD_MAP_QUERY_LIMIT = 500;

export const useRecordMapRecords = ({
  mapFieldSource,
  objectNameSingular,
}: {
  mapFieldSource: MapFieldSource;
  objectNameSingular: string;
}) => {
  const params = useFindManyRecordIndexTableParams(objectNameSingular);
  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular,
  });

  const recordGqlFields = useRelevantRecordsGqlFields({
    objectMetadataItem,
    additionalFieldMetadataId: mapFieldSource.fieldMetadataId,
  });

  const { records, loading } = useFindManyRecords<ObjectRecord>({
    ...params,
    recordGqlFields,
    limit: RECORD_MAP_QUERY_LIMIT,
  });

  const recordMapPoints = useMemo(
    () =>
      records
        .map((record) =>
          extractRecordMapCoordinates({
            record,
            mapFieldSource,
          }),
        )
        .filter(isDefined),
    [mapFieldSource, records],
  );

  return {
    records,
    recordMapPoints,
    loading,
  };
};
