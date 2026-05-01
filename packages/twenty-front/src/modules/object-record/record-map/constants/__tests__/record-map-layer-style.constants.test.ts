import {
  RECORD_MAP_LAYER_BLUE,
  RECORD_MAP_LAYER_WHITE,
} from '@/object-record/record-map/constants/record-map-layer-style.constants';

describe('record map layer style constants', () => {
  it('should expose concrete colors for MapLibre paint values', () => {
    expect(RECORD_MAP_LAYER_BLUE).toMatch(/^#[0-9a-f]{6}$/i);
    expect(RECORD_MAP_LAYER_WHITE).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
