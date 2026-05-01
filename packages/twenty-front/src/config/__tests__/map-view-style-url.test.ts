import { DEFAULT_MAP_VIEW_STYLE_URL } from '~/config';

describe('DEFAULT_MAP_VIEW_STYLE_URL', () => {
  it('should use CartoDB Positron GL as the default map style', () => {
    expect(DEFAULT_MAP_VIEW_STYLE_URL).toBe(
      'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    );
  });
});
