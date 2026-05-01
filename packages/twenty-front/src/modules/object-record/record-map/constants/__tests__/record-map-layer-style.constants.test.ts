import { RECORD_MAP_LAYER_COLORS } from '@/object-record/record-map/constants/record-map-layer-style.constants';

describe('record map layer style constants', () => {
  it('should expose concrete colors for MapLibre paint values', () => {
    expect(RECORD_MAP_LAYER_COLORS.blue).not.toContain('var(');
    expect(RECORD_MAP_LAYER_COLORS.white).not.toContain('var(');
    expect(RECORD_MAP_LAYER_COLORS.blue).not.toContain('color(');
    expect(RECORD_MAP_LAYER_COLORS.white).not.toContain('color(');
    expect(RECORD_MAP_LAYER_COLORS.blue).toMatch(
      /^rgb\(\d{1,3}, \d{1,3}, \d{1,3}\)$/,
    );
    expect(RECORD_MAP_LAYER_COLORS.white).toMatch(
      /^rgb\(\d{1,3}, \d{1,3}, \d{1,3}\)$/,
    );
  });
});
