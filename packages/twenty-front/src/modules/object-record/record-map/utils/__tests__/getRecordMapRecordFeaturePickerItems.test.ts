import { RECORD_MAP_LAYER_COLORS } from '@/object-record/record-map/constants/record-map-layer-style.constants';
import { RECORD_MAP_VECTOR_TILE_LAYER } from '@/object-record/record-map/constants/record-map-vector-tile-layer.constants';
import { getRecordMapRecordFeaturePickerItems } from '@/object-record/record-map/utils/getRecordMapRecordFeaturePickerItems';

describe('getRecordMapRecordFeaturePickerItems', () => {
  it('returns one picker item for one rendered record feature', () => {
    expect(
      getRecordMapRecordFeaturePickerItems({
        features: [
          {
            layer: { id: RECORD_MAP_VECTOR_TILE_LAYER.pointLayerId },
            properties: {
              id: 'record-1',
              title: 'Acme',
            },
          },
        ],
        objectNameSingular: 'company',
      }),
    ).toEqual([
      {
        recordId: 'record-1',
        swatchColor: RECORD_MAP_LAYER_COLORS.blue,
        title: 'Acme',
        type: 'record',
      },
    ]);
  });

  it('deduplicates fill and line hits for the same record', () => {
    expect(
      getRecordMapRecordFeaturePickerItems({
        features: [
          {
            layer: { id: RECORD_MAP_VECTOR_TILE_LAYER.fillLayerId },
            properties: {
              id: 'record-1',
              title: 'Acme',
            },
          },
          {
            layer: { id: RECORD_MAP_VECTOR_TILE_LAYER.lineLayerId },
            properties: {
              id: 'record-1',
              title: 'Acme',
            },
          },
        ],
      }),
    ).toHaveLength(1);
  });

  it('ignores hits without a record layer or record id', () => {
    expect(
      getRecordMapRecordFeaturePickerItems({
        features: [
          {
            layer: { id: 'unrelated-layer' },
            properties: {
              id: 'unrelated-feature',
            },
          },
          {
            layer: { id: RECORD_MAP_VECTOR_TILE_LAYER.pointLayerId },
            properties: {},
          },
        ],
      }),
    ).toEqual([]);
  });

  it('sorts point features before polygon features', () => {
    expect(
      getRecordMapRecordFeaturePickerItems({
        features: [
          {
            layer: { id: RECORD_MAP_VECTOR_TILE_LAYER.fillLayerId },
            properties: {
              id: 'polygon-record',
              title: 'Polygon',
            },
          },
          {
            layer: { id: RECORD_MAP_VECTOR_TILE_LAYER.pointLayerId },
            properties: {
              id: 'point-record',
              title: 'Point',
            },
          },
        ],
      }).map((item) => item.recordId),
    ).toEqual(['point-record', 'polygon-record']);
  });

  it('falls back to the object label when the tile title is missing', () => {
    expect(
      getRecordMapRecordFeaturePickerItems({
        features: [
          {
            id: 'record-1',
            layer: { id: RECORD_MAP_VECTOR_TILE_LAYER.pointLayerId },
            properties: {},
          },
        ],
        objectNameSingular: 'company',
      })[0]?.title,
    ).toBe('Company record');
  });
});
