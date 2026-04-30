import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { useRecordIndexContextOrThrow } from '@/object-record/record-index/contexts/RecordIndexContext';
import { useUpsertRecordsInStore } from '@/object-record/record-store/hooks/useUpsertRecordsInStore';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { useSetAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useSetAtomComponentState';
import { useEffect } from 'react';

export const RecordIndexMapDataLoaderEffect = ({
  records,
}: {
  records: ObjectRecord[];
}) => {
  const { recordIndexId } = useRecordIndexContextOrThrow();
  const { upsertRecordsInStore } = useUpsertRecordsInStore();

  const setContextStoreTargetedRecordsRule = useSetAtomComponentState(
    contextStoreTargetedRecordsRuleComponentState,
    recordIndexId,
  );

  useEffect(() => {
    upsertRecordsInStore({ partialRecords: records });
  }, [records, upsertRecordsInStore]);

  useEffect(() => {
    setContextStoreTargetedRecordsRule({
      mode: 'selection',
      selectedRecordIds: [],
    });
  }, [setContextStoreTargetedRecordsRule]);

  return null;
};
