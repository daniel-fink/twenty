import {
  isGeoJsonGeometry,
  isGeoJsonMultiPolygon,
  isGeoJsonPoint,
  isGeoJsonPolygon,
} from '@/types/GeoJsonPoint';

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

describe('isGeoJsonPolygon', () => {
  it('should accept strict WGS84 GeoJSON polygons', () => {
    expect(
      isGeoJsonPolygon({
        type: 'Polygon',
        coordinates: [
          [
            [-74.01, 40.7],
            [-74.0, 40.7],
            [-74.0, 40.71],
            [-74.01, 40.7],
          ],
        ],
      }),
    ).toBe(true);
  });

  it.each([
    { type: 'Polygon', coordinates: [] },
    { type: 'Polygon', coordinates: [[[-74.01, 40.7]]] },
    {
      type: 'Polygon',
      coordinates: [
        [
          [-74.01, 40.7],
          [-74.0, 40.7],
          [-74.0, 40.71],
          [-74.02, 40.72],
        ],
      ],
    },
    {
      type: 'Polygon',
      coordinates: [
        [
          [-181, 40.7],
          [-74.0, 40.7],
          [-74.0, 40.71],
          [-181, 40.7],
        ],
      ],
    },
  ])('should reject invalid GeoJSON polygon value %#', (value) => {
    expect(isGeoJsonPolygon(value)).toBe(false);
  });
});

describe('isGeoJsonMultiPolygon', () => {
  it('should accept strict WGS84 GeoJSON multipolygons', () => {
    const value = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [-74.01, 40.7],
            [-74.0, 40.7],
            [-74.0, 40.71],
            [-74.01, 40.7],
          ],
        ],
        [
          [
            [-73.99, 40.72],
            [-73.98, 40.72],
            [-73.98, 40.73],
            [-73.99, 40.72],
          ],
        ],
      ],
    };

    expect(isGeoJsonMultiPolygon(value)).toBe(true);
    expect(isGeoJsonGeometry(value)).toBe(true);
  });

  it.each([
    { type: 'MultiPolygon', coordinates: [] },
    { type: 'MultiPolygon', coordinates: [[]] },
    {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [-74.01, 40.7],
            [-74.0, 40.7],
            [-74.0, 40.71],
            [-74.02, 40.72],
          ],
        ],
      ],
    },
  ])('should reject invalid GeoJSON multipolygon value %#', (value) => {
    expect(isGeoJsonMultiPolygon(value)).toBe(false);
  });
});
