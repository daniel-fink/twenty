import { type RecordMapLayerContribution } from '@/object-record/record-map/types/RecordMapContribution';
import { getRecordMapContributedFeaturePickerItems } from '@/object-record/record-map/utils/getRecordMapContributedFeaturePickerItems';

const contribution: RecordMapLayerContribution = {
  contributionId: 'view-1:layer-1',
  displayName: 'Parcels',
  featureSelectionAction: {
    applicationUniversalIdentifier: 'b96a9f0c-356c-4d10-98a2-d487d3c2a658',
    frontComponentUniversalIdentifier: '4dc7dffc-1b6a-4cf3-989c-981ff2a5f46c',
    type: 'OPEN_FRONT_COMPONENT',
  },
  featureIdProperty: 'selectedFeatureValue',
  isVisible: true,
  layerId: 'layer-1',
  position: 10,
  sourceLayerName: 'parcels',
  style: {
    fillColor: '#2563eb',
    fillOpacity: 0.24,
    type: 'fill' as const,
  },
  titleProperty: 'title',
  tileJsonUrl: 'https://example.com/tile-json',
  viewId: 'view-1',
};

describe('getRecordMapContributedFeaturePickerItems', () => {
  it('returns contributed picker items from configured feature properties', () => {
    expect(
      getRecordMapContributedFeaturePickerItems({
        features: [
          {
            layer: { id: 'reference-fill' },
            properties: {
              selectedFeatureValue: 'P-001',
              title: 'Parcel P-001',
            },
          },
        ],
        renderedContributionLayers: [
          {
            contribution,
            layerIds: ['reference-fill'],
          },
        ],
      }),
    ).toEqual([
      {
        contribution,
        contributionId: contribution.contributionId,
        featureId: 'P-001',
        layerId: contribution.layerId,
        swatchColor: '#2563eb',
        title: 'Parcel P-001',
        type: 'contribution',
        viewId: contribution.viewId,
      },
    ]);
  });
});
