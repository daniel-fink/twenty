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
  isMultiSelectEnabled: false,
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

const createContribution = ({
  contributionId,
  style,
}: {
  contributionId: string;
  style: RecordMapLayerContribution['style'];
}): RecordMapLayerContribution => ({
  ...contribution,
  contributionId,
  style,
});

const getFirstSwatchColor = (targetContribution: RecordMapLayerContribution) =>
  getRecordMapContributedFeaturePickerItems({
    features: [
      {
        layer: { id: 'reference-layer' },
        properties: {
          selectedFeatureValue: 'F-001',
          title: 'Feature 001',
        },
      },
    ],
    renderedContributionLayers: [
      {
        contribution: targetContribution,
        hitLayerIds: [],
        layerIds: ['reference-layer'],
      },
    ],
  })[0]?.swatchColor;

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
            hitLayerIds: ['reference-fill-hit'],
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

  it('returns picker items from generic transparent hit layers', () => {
    expect(
      getRecordMapContributedFeaturePickerItems({
        features: [
          {
            layer: { id: 'reference-fill-hit' },
            properties: {
              selectedFeatureValue: 'P-001',
              title: 'Parcel P-001',
            },
          },
        ],
        renderedContributionLayers: [
          {
            contribution,
            hitLayerIds: ['reference-fill-hit'],
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

  it('dedupes base and pinned overlay hits for the same contributed feature', () => {
    const overlayContribution: RecordMapLayerContribution = {
      ...contribution,
      contributionId: 'opportunity:record-1:layer-1',
      isPinnedOverlay: true,
      position: Number.MAX_SAFE_INTEGER,
    };

    expect(
      getRecordMapContributedFeaturePickerItems({
        features: [
          {
            layer: { id: 'overlay-fill-hit' },
            properties: {
              selectedFeatureValue: 'P-001',
              title: 'Parcel P-001',
            },
          },
          {
            layer: { id: 'reference-fill-hit' },
            properties: {
              selectedFeatureValue: 'P-001',
              title: 'Parcel P-001',
            },
          },
        ],
        renderedContributionLayers: [
          {
            contribution: overlayContribution,
            hitLayerIds: ['overlay-fill-hit'],
            layerIds: ['overlay-fill'],
          },
          {
            contribution,
            hitLayerIds: ['reference-fill-hit'],
            layerIds: ['reference-fill'],
          },
        ],
      }),
    ).toHaveLength(1);
  });

  it('uses palette swatch gradients before static fill colors', () => {
    expect(
      getFirstSwatchColor(
        createContribution({
          contributionId: 'view-1:forecast',
          style: {
            fillColor: '#2563EB',
            fillOpacity: 0.5,
            swatch: {
              colors: ['#a50026', '#ffffbf', '#006837'],
              name: 'RdYlGn',
              type: 'palette',
            },
            type: 'fill',
          },
        }),
      ),
    ).toBe('linear-gradient(90deg, #a50026, #ffffbf, #006837)');
  });

  it('uses static colors for fill, line, and circle layers', () => {
    expect(
      getFirstSwatchColor(
        createContribution({
          contributionId: 'view-1:fill',
          style: {
            fillColor: '#2563EB',
            fillOpacity: 0.24,
            type: 'fill',
          },
        }),
      ),
    ).toBe('#2563EB');

    expect(
      getFirstSwatchColor(
        createContribution({
          contributionId: 'view-1:line',
          style: {
            lineColor: '#334155',
            lineWidth: 1,
            type: 'line',
          },
        }),
      ),
    ).toBe('#334155');

    expect(
      getFirstSwatchColor(
        createContribution({
          contributionId: 'view-1:circle',
          style: {
            circleColor: '#F97316',
            circleRadius: 5,
            type: 'circle',
          },
        }),
      ),
    ).toBe('#F97316');
  });

  it('falls back when swatch and static colors are invalid or missing', () => {
    expect(
      getFirstSwatchColor(
        createContribution({
          contributionId: 'view-1:invalid-swatch',
          style: {
            fillColor: '#2563EB',
            fillOpacity: 0.24,
            swatch: {
              colors: ['red', '#ffffbf'],
              type: 'palette',
            },
            type: 'fill',
          },
        }),
      ),
    ).toBe('#2563EB');

    expect(
      getFirstSwatchColor(
        createContribution({
          contributionId: 'view-1:missing-style',
          style: null,
        }),
      ),
    ).toBe('#64748b');
  });
});
