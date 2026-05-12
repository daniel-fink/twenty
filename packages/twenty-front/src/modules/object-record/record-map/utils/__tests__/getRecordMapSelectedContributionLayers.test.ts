import { type RecordMapLayerContribution } from '@/object-record/record-map/types/RecordMapContribution';
import { getRecordMapSelectedContributionLayers } from '@/object-record/record-map/utils/getRecordMapSelectedContributionLayers';

const baseContribution: RecordMapLayerContribution = {
  contributionId: 'view-1:layer-1',
  displayName: 'Parcels',
  featureIdProperty: 'selectedFeatureValue',
  isMultiSelectEnabled: false,
  isVisible: true,
  layerId: 'layer-1',
  position: 20,
  sourceLayerName: 'parcels',
  tileJsonUrl: 'https://example.com/parcels.json',
  viewId: 'view-1',
};

describe('getRecordMapSelectedContributionLayers', () => {
  it('returns selected fill and line overlays for fill contributions with selected styles', () => {
    expect(
      getRecordMapSelectedContributionLayers({
        contribution: {
          ...baseContribution,
          style: {
            fillColor: '#2563EB',
            fillOpacity: 0,
            lineColor: '#404040',
            lineWidth: 1,
            selectedStyle: {
              fillColor: '#44A8FF',
              fillOpacity: 0.5,
              lineColor: '#404040',
              lineWidth: 3,
            },
            type: 'fill',
          },
        },
        activeFeatureId: 'P-001',
        featureIds: ['P-001'],
      }),
    ).toEqual([
      expect.objectContaining({
        filter: [
          'in',
          ['to-string', ['get', 'selectedFeatureValue']],
          ['literal', ['P-001']],
        ],
        paint: {
          'fill-color': '#44A8FF',
          'fill-opacity': 0.5,
        },
        type: 'fill',
      }),
      expect.objectContaining({
        filter: [
          'in',
          ['to-string', ['get', 'selectedFeatureValue']],
          ['literal', ['P-001']],
        ],
        paint: {
          'line-color': '#404040',
          'line-opacity': 1,
          'line-width': 3,
        },
        type: 'line',
      }),
      expect.objectContaining({
        filter: ['==', ['to-string', ['get', 'selectedFeatureValue']], 'P-001'],
        paint: expect.objectContaining({
          'line-width': 4,
        }),
        type: 'line',
      }),
    ]);
  });

  it('returns no overlays for contributions without selected styles', () => {
    expect(
      getRecordMapSelectedContributionLayers({
        contribution: {
          ...baseContribution,
          style: {
            fillColor: '#2563EB',
            fillOpacity: 0,
            type: 'fill',
          },
        },
        activeFeatureId: 'P-001',
        featureIds: ['P-001'],
      }),
    ).toEqual([]);
  });

  it('returns selected overlays for multiple feature ids and a distinct active outline', () => {
    expect(
      getRecordMapSelectedContributionLayers({
        contribution: {
          ...baseContribution,
          style: {
            fillColor: '#2563EB',
            fillOpacity: 0,
            lineColor: '#404040',
            lineWidth: 1,
            selectedStyle: {
              fillColor: '#44A8FF',
              fillOpacity: 0.5,
              lineColor: '#404040',
              lineWidth: 3,
            },
            type: 'fill',
          },
        },
        activeFeatureId: 'P-002',
        featureIds: ['P-001', 'P-002'],
      }),
    ).toEqual([
      expect.objectContaining({
        filter: [
          'in',
          ['to-string', ['get', 'selectedFeatureValue']],
          ['literal', ['P-001', 'P-002']],
        ],
        type: 'fill',
      }),
      expect.objectContaining({
        filter: [
          'in',
          ['to-string', ['get', 'selectedFeatureValue']],
          ['literal', ['P-001', 'P-002']],
        ],
        type: 'line',
      }),
      expect.objectContaining({
        filter: ['==', ['to-string', ['get', 'selectedFeatureValue']], 'P-002'],
        paint: expect.objectContaining({
          'line-width': 4,
        }),
        type: 'line',
      }),
    ]);
  });
});
