import { isDefined } from 'twenty-shared/utils';

import { type RecordMapContributedFeaturePickerItem } from '@/object-record/record-map/types/RecordMapRecordFeaturePicker';

const getSelectedFeatureKey = (item: RecordMapContributedFeaturePickerItem) =>
  `${item.contributionId}:${item.layerId}:${item.featureId}`;

export type NextRecordMapContributionSelection =
  | {
      activeItem: RecordMapContributedFeaturePickerItem;
      items: RecordMapContributedFeaturePickerItem[];
      status: 'selected';
    }
  | {
      activeItem: null;
      items: RecordMapContributedFeaturePickerItem[];
      status: 'cleared' | 'limit-exceeded';
    };

export const getNextRecordMapContributionSelection = ({
  activeFeatureId,
  currentItems,
  item,
  maxSelectedItems,
  shouldToggleSelection,
}: {
  activeFeatureId: string | null;
  currentItems: RecordMapContributedFeaturePickerItem[];
  item: RecordMapContributedFeaturePickerItem;
  maxSelectedItems: number;
  shouldToggleSelection: boolean;
}): NextRecordMapContributionSelection => {
  if (!shouldToggleSelection || !item.contribution.isMultiSelectEnabled) {
    return {
      activeItem: item,
      items: [item],
      status: 'selected',
    };
  }

  const isSameLayerSelection =
    currentItems.length > 0 && currentItems[0]?.layerId === item.layerId;
  const selectableCurrentItems = isSameLayerSelection ? currentItems : [];
  const selectedItemIndex = selectableCurrentItems.findIndex(
    (selectedItem) =>
      getSelectedFeatureKey(selectedItem) === getSelectedFeatureKey(item),
  );

  if (selectedItemIndex >= 0) {
    const nextItems = selectableCurrentItems.filter(
      (selectedItem) =>
        getSelectedFeatureKey(selectedItem) !== getSelectedFeatureKey(item),
    );

    if (nextItems.length === 0) {
      return {
        activeItem: null,
        items: [],
        status: 'cleared',
      };
    }

    const fallbackActiveItem =
      nextItems[selectedItemIndex] ?? nextItems.at(-1) ?? nextItems[0];

    if (!isDefined(fallbackActiveItem)) {
      return {
        activeItem: null,
        items: [],
        status: 'cleared',
      };
    }

    const activeItem =
      activeFeatureId === item.featureId
        ? fallbackActiveItem
        : (nextItems.find(
            (selectedItem) => selectedItem.featureId === activeFeatureId,
          ) ?? fallbackActiveItem);

    return {
      activeItem,
      items: nextItems,
      status: 'selected',
    };
  }

  if (selectableCurrentItems.length >= maxSelectedItems) {
    return {
      activeItem: null,
      items: selectableCurrentItems,
      status: 'limit-exceeded',
    };
  }

  return {
    activeItem: item,
    items: [...selectableCurrentItems, item],
    status: 'selected',
  };
};
