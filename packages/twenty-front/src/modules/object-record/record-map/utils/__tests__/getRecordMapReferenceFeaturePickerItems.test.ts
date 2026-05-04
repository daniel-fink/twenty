import {
  type RecordMapReferenceLayer,
  type RecordMapReferenceLayerStyle,
} from '@/object-record/record-map/types/RecordMapReferenceLayer';
import { getRecordMapReferenceFeaturePickerItems } from '@/object-record/record-map/utils/getRecordMapReferenceFeaturePickerItems';
import {
  getRecordMapReferenceOutlineLayerId,
  getRecordMapReferencePrimaryLayerId,
} from '@/object-record/record-map/utils/getRecordMapReferenceLayerMapIds';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const parcelsColor = themeCssVariables.accent.primary;
const transactionsColor = themeCssVariables.accent.accent6;

const createLayer = ({
  id,
  name,
  style,
}: {
  id: string;
  name: string;
  style: RecordMapReferenceLayerStyle;
}): RecordMapReferenceLayer => ({
  attachment: {
    defaultIsVisible: true,
    isVisible: true,
    position: 0,
  },
  id,
  key: id,
  name,
  source: {
    geometryType: 'Geometry',
  },
  style,
  tile: {
    maxZoom: 16,
    minZoom: 0,
  },
});

const parcelsLayer = createLayer({
  id: 'parcels',
  name: 'Parcels',
  style: {
    fillColor: parcelsColor,
    fillOpacity: 0.2,
    type: 'fill',
  },
});

const transactionsLayer = createLayer({
  id: 'transactions',
  name: 'Transactions',
  style: {
    circleColor: transactionsColor,
    circleRadius: 4,
    type: 'circle',
  },
});

describe('getRecordMapReferenceFeaturePickerItems', () => {
  it('returns one picker item for one rendered feature', () => {
    expect(
      getRecordMapReferenceFeaturePickerItems({
        features: [
          {
            layer: { id: getRecordMapReferencePrimaryLayerId(parcelsLayer) },
            properties: {
              id: 'parcel-1',
              title: '1 Main Street',
            },
          },
        ],
        referenceLayers: [parcelsLayer],
      }),
    ).toEqual([
      {
        featureId: 'parcel-1',
        layerId: 'parcels',
        layerName: 'Parcels',
        swatchColor: parcelsColor,
        title: '1 Main Street',
      },
    ]);
  });

  it('deduplicates primary and outline hits for the same feature', () => {
    expect(
      getRecordMapReferenceFeaturePickerItems({
        features: [
          {
            layer: { id: getRecordMapReferenceOutlineLayerId(parcelsLayer) },
            properties: {
              id: 'parcel-1',
              title: '1 Main Street',
            },
          },
          {
            layer: { id: getRecordMapReferencePrimaryLayerId(parcelsLayer) },
            properties: {
              id: 'parcel-1',
              title: '1 Main Street',
            },
          },
        ],
        referenceLayers: [parcelsLayer],
      }),
    ).toHaveLength(1);
  });

  it('ignores hits without a reference layer or feature id', () => {
    expect(
      getRecordMapReferenceFeaturePickerItems({
        features: [
          {
            layer: { id: 'unrelated-layer' },
            properties: {
              id: 'unrelated',
              title: 'Unrelated',
            },
          },
          {
            layer: { id: getRecordMapReferencePrimaryLayerId(parcelsLayer) },
            properties: {
              title: 'Missing ID',
            },
          },
        ],
        referenceLayers: [parcelsLayer],
      }),
    ).toEqual([]);
  });

  it('sorts point features before polygon features', () => {
    expect(
      getRecordMapReferenceFeaturePickerItems({
        features: [
          {
            layer: { id: getRecordMapReferencePrimaryLayerId(parcelsLayer) },
            properties: {
              id: 'parcel-1',
              title: '1 Main Street',
            },
          },
          {
            layer: {
              id: getRecordMapReferencePrimaryLayerId(transactionsLayer),
            },
            properties: {
              id: 'transaction-1',
              title: 'Transaction',
            },
          },
        ],
        referenceLayers: [parcelsLayer, transactionsLayer],
      }).map((item) => item.layerId),
    ).toEqual(['transactions', 'parcels']);
  });

  it('falls back to layer name when the tile title is missing', () => {
    expect(
      getRecordMapReferenceFeaturePickerItems({
        features: [
          {
            id: 'parcel-1',
            layer: { id: getRecordMapReferencePrimaryLayerId(parcelsLayer) },
            properties: {},
          },
        ],
        referenceLayers: [parcelsLayer],
      })[0]?.title,
    ).toBe('Parcels');
  });
});
