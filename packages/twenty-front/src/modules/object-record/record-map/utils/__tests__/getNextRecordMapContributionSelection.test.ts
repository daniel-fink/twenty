import { type RecordMapLayerContribution } from '@/object-record/record-map/types/RecordMapContribution';
import { type RecordMapContributedFeaturePickerItem } from '@/object-record/record-map/types/RecordMapRecordFeaturePicker';
import { getNextRecordMapContributionSelection } from '@/object-record/record-map/utils/getNextRecordMapContributionSelection';

const enabledContribution: RecordMapLayerContribution = {
  contributionId: 'view-1:layer-1',
  displayName: 'Parcels',
  featureSelectionAction: {
    applicationUniversalIdentifier: 'b96a9f0c-356c-4d10-98a2-d487d3c2a658',
    frontComponentUniversalIdentifier: '4dc7dffc-1b6a-4cf3-989c-981ff2a5f46c',
    type: 'OPEN_FRONT_COMPONENT',
  },
  featureIdProperty: 'selectedFeatureValue',
  isMultiSelectEnabled: true,
  isVisible: true,
  layerId: 'layer-1',
  position: 10,
  sourceLayerName: 'parcels',
  style: {
    fillColor: '#2563eb',
    fillOpacity: 0.24,
    type: 'fill',
  },
  titleProperty: 'title',
  tileJsonUrl: 'https://example.com/tile-json',
  viewId: 'view-1',
};

const disabledContribution: RecordMapLayerContribution = {
  ...enabledContribution,
  contributionId: 'view-1:transactions',
  displayName: 'Transactions',
  isMultiSelectEnabled: false,
  layerId: 'transactions-layer',
  sourceLayerName: 'transactions',
};

const createItem = ({
  contribution = enabledContribution,
  featureId,
  layerId = contribution.layerId,
}: {
  contribution?: RecordMapLayerContribution;
  featureId: string;
  layerId?: string;
}): RecordMapContributedFeaturePickerItem => ({
  contribution,
  contributionId: contribution.contributionId,
  featureId,
  layerId,
  swatchColor: '#2563eb',
  title: `Feature ${featureId}`,
  type: 'contribution',
  viewId: contribution.viewId,
});

describe('getNextRecordMapContributionSelection', () => {
  it('replaces selection on normal click', () => {
    const currentItems = [createItem({ featureId: 'P-001' })];
    const nextItem = createItem({ featureId: 'P-002' });

    expect(
      getNextRecordMapContributionSelection({
        activeFeatureId: 'P-001',
        currentItems,
        item: nextItem,
        maxSelectedItems: 10,
        shouldToggleSelection: false,
      }),
    ).toEqual({
      activeItem: nextItem,
      items: [nextItem],
      status: 'selected',
    });
  });

  it('adds enabled same-layer features on Shift-click', () => {
    const currentItems = [createItem({ featureId: 'P-001' })];
    const nextItem = createItem({ featureId: 'P-002' });

    expect(
      getNextRecordMapContributionSelection({
        activeFeatureId: 'P-001',
        currentItems,
        item: nextItem,
        maxSelectedItems: 10,
        shouldToggleSelection: true,
      }),
    ).toEqual({
      activeItem: nextItem,
      items: [...currentItems, nextItem],
      status: 'selected',
    });
  });

  it('removes selected features on Shift-click and moves active to next then previous item', () => {
    const firstItem = createItem({ featureId: 'P-001' });
    const secondItem = createItem({ featureId: 'P-002' });
    const thirdItem = createItem({ featureId: 'P-003' });
    const currentItems = [firstItem, secondItem, thirdItem];

    expect(
      getNextRecordMapContributionSelection({
        activeFeatureId: 'P-002',
        currentItems,
        item: secondItem,
        maxSelectedItems: 10,
        shouldToggleSelection: true,
      }),
    ).toEqual({
      activeItem: thirdItem,
      items: [firstItem, thirdItem],
      status: 'selected',
    });

    expect(
      getNextRecordMapContributionSelection({
        activeFeatureId: 'P-003',
        currentItems,
        item: thirdItem,
        maxSelectedItems: 10,
        shouldToggleSelection: true,
      }),
    ).toEqual({
      activeItem: secondItem,
      items: [firstItem, secondItem],
      status: 'selected',
    });
  });

  it('clears selection after removing the last selected feature', () => {
    const currentItem = createItem({ featureId: 'P-001' });

    expect(
      getNextRecordMapContributionSelection({
        activeFeatureId: 'P-001',
        currentItems: [currentItem],
        item: currentItem,
        maxSelectedItems: 10,
        shouldToggleSelection: true,
      }),
    ).toEqual({
      activeItem: null,
      items: [],
      status: 'cleared',
    });
  });

  it('resets to the clicked feature when Shift-click crosses layers', () => {
    const currentItems = [createItem({ featureId: 'P-001' })];
    const nextItem = createItem({
      featureId: 'P-010',
      layerId: 'layer-2',
    });

    expect(
      getNextRecordMapContributionSelection({
        activeFeatureId: 'P-001',
        currentItems,
        item: nextItem,
        maxSelectedItems: 10,
        shouldToggleSelection: true,
      }),
    ).toEqual({
      activeItem: nextItem,
      items: [nextItem],
      status: 'selected',
    });
  });

  it('falls back to single selection for disabled layers even with Shift-click', () => {
    const currentItems = [createItem({ featureId: 'P-001' })];
    const nextItem = createItem({
      contribution: disabledContribution,
      featureId: 'T-001',
    });

    expect(
      getNextRecordMapContributionSelection({
        activeFeatureId: 'P-001',
        currentItems,
        item: nextItem,
        maxSelectedItems: 10,
        shouldToggleSelection: true,
      }),
    ).toEqual({
      activeItem: nextItem,
      items: [nextItem],
      status: 'selected',
    });
  });

  it('returns a limit status without adding an eleventh item', () => {
    const currentItems = Array.from({ length: 10 }, (_, index) =>
      createItem({ featureId: `P-${String(index + 1).padStart(3, '0')}` }),
    );

    expect(
      getNextRecordMapContributionSelection({
        activeFeatureId: 'P-001',
        currentItems,
        item: createItem({ featureId: 'P-011' }),
        maxSelectedItems: 10,
        shouldToggleSelection: true,
      }),
    ).toEqual({
      activeItem: null,
      items: currentItems,
      status: 'limit-exceeded',
    });
  });
});
