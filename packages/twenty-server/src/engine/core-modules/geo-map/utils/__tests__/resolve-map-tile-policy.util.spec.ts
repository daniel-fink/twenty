import { DEFAULT_MAP_VECTOR_TILE_POLICY } from 'src/engine/core-modules/geo-map/constants/map-vector-tile.constants';
import { resolveMapTilePolicy } from 'src/engine/core-modules/geo-map/utils/resolve-map-tile-policy.util';

describe('resolveMapTilePolicy', () => {
  it('should return global defaults when no policy is configured', () => {
    expect(resolveMapTilePolicy({})).toEqual(DEFAULT_MAP_VECTOR_TILE_POLICY);
  });

  it('should merge field policy and view policy with view precedence', () => {
    expect(
      resolveMapTilePolicy({
        fieldPolicy: {
          minZoom: 13,
          maxZoom: 22,
          extent: 8192,
          simplification: {
            enabled: true,
            maxZoom: 14,
            toleranceMultiplier: 2,
          },
        },
        viewPolicy: {
          minZoom: 10,
          buffer: 128,
          simplification: {
            toleranceMultiplier: 0.5,
          },
        },
      }),
    ).toEqual({
      ...DEFAULT_MAP_VECTOR_TILE_POLICY,
      minZoom: 10,
      maxZoom: 22,
      extent: 8192,
      buffer: 128,
      simplification: {
        enabled: true,
        maxZoom: 14,
        toleranceMultiplier: 0.5,
      },
    });
  });

  it('should reject invalid policy values', () => {
    expect(() =>
      resolveMapTilePolicy({
        fieldPolicy: {
          minZoom: -1,
        },
      }),
    ).toThrow('Invalid geo map tile policy');
  });

  it('should reject invalid merged zoom ranges', () => {
    expect(() =>
      resolveMapTilePolicy({
        fieldPolicy: {
          minZoom: 13,
        },
        viewPolicy: {
          maxZoom: 12,
        },
      }),
    ).toThrow('Invalid geo map tile policy zoom range');
  });

  it('should reject simplification zoom above max zoom', () => {
    expect(() =>
      resolveMapTilePolicy({
        viewPolicy: {
          maxZoom: 12,
          simplification: {
            maxZoom: 13,
          },
        },
      }),
    ).toThrow('Invalid geo map tile policy simplification zoom');
  });
});
