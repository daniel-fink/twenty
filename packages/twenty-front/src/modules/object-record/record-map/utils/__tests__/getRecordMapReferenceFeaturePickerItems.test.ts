import { getRecordMapReferenceFeaturePickerItems } from '@/object-record/record-map/utils/getRecordMapReferenceFeaturePickerItems';

const contribution = {
  contributionId: 'view-1:layer-1',
  displayName: 'Parcels',
  featureDetailApplicationUniversalIdentifier:
    'b96a9f0c-356c-4d10-98a2-d487d3c2a658',
  featureDetailCallbackUrl: '/s/example/feature-detail',
  featureDetailFrontComponentUniversalIdentifier:
    '4dc7dffc-1b6a-4cf3-989c-981ff2a5f46c',
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

describe('getRecordMapReferenceFeaturePickerItems', () => {
  it('returns reference picker items from configured feature properties', () => {
    expect(
      getRecordMapReferenceFeaturePickerItems({
        features: [
          {
            layer: { id: 'reference-fill' },
            properties: {
              selectedFeatureValue: 'P-001',
              title: 'Parcel P-001',
            },
          },
        ],
        renderedReferenceLayers: [
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
        type: 'reference',
        viewId: contribution.viewId,
      },
    ]);
  });
});
