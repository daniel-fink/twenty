import { useFindManyRecordIndexTableParams } from '@/object-record/record-index/hooks/useFindManyRecordIndexTableParams';
import { useRecordIndexContextOrThrow } from '@/object-record/record-index/contexts/RecordIndexContext';
import { useListenToEventsForQuery } from '@/sse-db-event/hooks/useListenToEventsForQuery';

export const RecordMapSSESubscribeEffect = () => {
  const { objectNameSingular, recordIndexId } = useRecordIndexContextOrThrow();

  const { filter, orderBy } =
    useFindManyRecordIndexTableParams(objectNameSingular);

  useListenToEventsForQuery({
    queryId: `record-map-${recordIndexId}`,
    operationSignature: {
      objectNameSingular,
      variables: {
        filter,
        orderBy,
      },
    },
  });

  return null;
};
