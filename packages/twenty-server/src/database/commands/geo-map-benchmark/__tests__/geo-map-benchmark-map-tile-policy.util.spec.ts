import {
  buildGeoMapBenchmarkMapTilePolicy,
  parseGeoMapBenchmarkMaxFeatureCountOption,
  parseGeoMapBenchmarkZoomOption,
} from 'src/database/commands/geo-map-benchmark/geo-map-benchmark-map-tile-policy.util';
import { parseGeoMapBenchmarkTiles } from 'src/database/commands/geo-map-tile-benchmark.command';

describe('geo map benchmark map tile policy utilities', () => {
  it('should apply Microsoft building defaults as a benchmark smoke policy', () => {
    expect(
      buildGeoMapBenchmarkMapTilePolicy({
        objectNameSingular: 'geoBenchmarkMicrosoftUsBuildings',
      }),
    ).toEqual({
      minZoom: 13,
      maxZoom: 22,
    });
  });

  it('should let explicit benchmark tile policy options override defaults', () => {
    expect(
      buildGeoMapBenchmarkMapTilePolicy({
        objectNameSingular: 'geoBenchmarkMicrosoftUsBuildings',
        mapMaxFeatureCount: 50_000,
        mapMaxZoom: 18,
        mapMinZoom: 10,
      }),
    ).toEqual({
      maxFeatureCount: 50_000,
      maxZoom: 18,
      minZoom: 10,
    });
  });

  it('should reject invalid zoom and feature budget options', () => {
    expect(() =>
      parseGeoMapBenchmarkZoomOption({
        value: '23',
        optionName: '--map-max-zoom',
      }),
    ).toThrow('--map-max-zoom must be an integer between 0 and 22');

    expect(() => parseGeoMapBenchmarkMaxFeatureCountOption('0')).toThrow(
      '--map-max-feature-count must be a positive integer',
    );

    expect(() =>
      buildGeoMapBenchmarkMapTilePolicy({
        objectNameSingular: 'geoBenchmarkFeature',
        mapMaxZoom: 9,
        mapMinZoom: 10,
      }),
    ).toThrow('--map-min-zoom cannot be greater than --map-max-zoom');
  });

  it('should parse smoke benchmark tile coordinates and reject out-of-range values', () => {
    expect(parseGeoMapBenchmarkTiles('0/0/0,4/8/5,12/2048/1365')).toEqual([
      { z: 0, x: 0, y: 0 },
      { z: 4, x: 8, y: 5 },
      { z: 12, x: 2048, y: 1365 },
    ]);

    for (const tiles of [
      '1/2/0',
      '1/0/2',
      '1/-1/0',
      '1/0',
      '1/a/0',
      '23/0/0',
    ]) {
      expect(() => parseGeoMapBenchmarkTiles(tiles)).toThrow(
        'Invalid tile coordinate',
      );
    }
  });
});
