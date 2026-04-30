import { isGeoJsonPoint } from '@/types/GeoJsonPoint';

describe('isGeoJsonPoint', () => {
  it('should accept strict WGS84 GeoJSON points', () => {
    expect(
      isGeoJsonPoint({
        type: 'Point',
        coordinates: [-122.0841, 37.422],
      }),
    ).toBe(true);
  });

  it.each([
    null,
    { type: 'LineString', coordinates: [-122.0841, 37.422] },
    { type: 'Point', coordinates: [-122.0841] },
    { type: 'Point', coordinates: [-122.0841, 37.422, 10] },
    { type: 'Point', coordinates: ['-122.0841', 37.422] },
    { type: 'Point', coordinates: [Number.NaN, 37.422] },
    { type: 'Point', coordinates: [-181, 37.422] },
    { type: 'Point', coordinates: [-122.0841, 91] },
  ])('should reject invalid GeoJSON point value %#', (value) => {
    expect(isGeoJsonPoint(value)).toBe(false);
  });
});
