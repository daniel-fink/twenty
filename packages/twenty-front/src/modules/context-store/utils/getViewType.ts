import { ContextStoreViewType } from '@/context-store/types/ContextStoreViewType';
import { type View } from '@/views/types/View';
import { ViewType } from '@/views/types/ViewType';

export const getViewType = ({
  isRecordIndexPage,
  view,
}: {
  isRecordIndexPage: boolean;
  view?: View;
}) => {
  if (isRecordIndexPage) {
    if (view?.type === ViewType.KANBAN) {
      return ContextStoreViewType.Kanban;
    }

    if (view?.type === ViewType.MAP) {
      return ContextStoreViewType.Map;
    }

    return ContextStoreViewType.Table;
  }

  return null;
};
