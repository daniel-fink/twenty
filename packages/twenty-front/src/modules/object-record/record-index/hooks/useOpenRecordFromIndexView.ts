import { useSidePanelMenu } from '@/side-panel/hooks/useSidePanelMenu';
import { useOpenRecordInSidePanel } from '@/side-panel/hooks/useOpenRecordInSidePanel';
import { MAIN_CONTEXT_STORE_INSTANCE_ID } from '@/context-store/constants/MainContextStoreInstanceId';
import { contextStoreRecordShowParentViewComponentState } from '@/context-store/states/contextStoreRecordShowParentViewComponentState';
import { currentRecordFilterGroupsComponentState } from '@/object-record/record-filter-group/states/currentRecordFilterGroupsComponentState';
import { currentRecordFiltersComponentState } from '@/object-record/record-filter/states/currentRecordFiltersComponentState';
import {
  type RecordIndexContextValue,
  useRecordIndexContext,
  useRecordIndexContextOrThrow,
} from '@/object-record/record-index/contexts/RecordIndexContext';
import { recordIndexOpenRecordInState } from '@/object-record/record-index/states/recordIndexOpenRecordInState';
import { currentRecordSortsComponentState } from '@/object-record/record-sort/states/currentRecordSortsComponentState';
import { canOpenObjectInSidePanel } from '@/object-record/utils/canOpenObjectInSidePanel';
import { useAtomComponentStateCallbackState } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateCallbackState';
import { ViewOpenRecordIn } from '~/generated-metadata/graphql';
import { useStore } from 'jotai';
import { useCallback } from 'react';
import { AppPath } from 'twenty-shared/types';
import { useIsMobile } from 'twenty-ui/utilities';
import { useNavigateApp } from '~/hooks/useNavigateApp';

const FALLBACK_RECORD_INDEX_ID = 'fallback-record-index';

const useOpenRecordFromIndexViewInternal = ({
  fallbackObjectNameSingular,
  recordIndexContext,
}: {
  fallbackObjectNameSingular?: string;
  recordIndexContext: RecordIndexContextValue | undefined;
}) => {
  const recordIndexId =
    recordIndexContext?.recordIndexId ?? FALLBACK_RECORD_INDEX_ID;
  const objectNameSingular =
    recordIndexContext?.objectNameSingular ?? fallbackObjectNameSingular;

  const navigate = useNavigateApp();
  const { openRecordInSidePanel } = useOpenRecordInSidePanel();

  const isMobile = useIsMobile();

  const currentRecordFilters = useAtomComponentStateCallbackState(
    currentRecordFiltersComponentState,
    recordIndexId,
  );

  const currentRecordSorts = useAtomComponentStateCallbackState(
    currentRecordSortsComponentState,
    recordIndexId,
  );

  const currentRecordFilterGroups = useAtomComponentStateCallbackState(
    currentRecordFilterGroupsComponentState,
    recordIndexId,
  );

  const { closeSidePanelMenu } = useSidePanelMenu();

  const store = useStore();

  const openRecordFromIndexView = useCallback(
    ({ recordId }: { recordId: string }) => {
      if (objectNameSingular === undefined) {
        return;
      }

      if (recordIndexContext === undefined) {
        closeSidePanelMenu();
        navigate(AppPath.RecordShowPage, {
          objectNameSingular,
          objectRecordId: recordId,
        });

        return;
      }

      const recordIndexOpenRecordIn = store.get(
        recordIndexOpenRecordInState.atom,
      );

      const parentViewFilters = store.get(currentRecordFilters);

      const parentViewSorts = store.get(currentRecordSorts);

      const parentViewFilterGroups = store.get(currentRecordFilterGroups);

      store.set(
        contextStoreRecordShowParentViewComponentState.atomFamily({
          instanceId: MAIN_CONTEXT_STORE_INSTANCE_ID,
        }),
        {
          parentViewComponentId: recordIndexId,
          parentViewObjectNameSingular: objectNameSingular,
          parentViewFilterGroups,
          parentViewFilters,
          parentViewSorts,
        },
      );

      if (
        !isMobile &&
        recordIndexOpenRecordIn === ViewOpenRecordIn.SIDE_PANEL &&
        canOpenObjectInSidePanel(objectNameSingular)
      ) {
        openRecordInSidePanel({
          recordId,
          objectNameSingular,
          resetNavigationStack: true,
        });
      } else {
        closeSidePanelMenu();
        navigate(AppPath.RecordShowPage, {
          objectNameSingular,
          objectRecordId: recordId,
        });
      }
    },
    [
      currentRecordFilters,
      currentRecordSorts,
      currentRecordFilterGroups,
      recordIndexId,
      recordIndexContext,
      objectNameSingular,
      navigate,
      openRecordInSidePanel,
      isMobile,
      closeSidePanelMenu,
      store,
    ],
  );

  return { openRecordFromIndexView };
};

export const useOpenRecordFromIndexView = () => {
  const recordIndexContext = useRecordIndexContextOrThrow();

  return useOpenRecordFromIndexViewInternal({
    recordIndexContext,
  });
};

export const useOpenRecordFromIndexViewOptional = ({
  fallbackObjectNameSingular,
}: {
  fallbackObjectNameSingular?: string;
}) => {
  const recordIndexContext = useRecordIndexContext();

  return useOpenRecordFromIndexViewInternal({
    fallbackObjectNameSingular,
    recordIndexContext,
  });
};
