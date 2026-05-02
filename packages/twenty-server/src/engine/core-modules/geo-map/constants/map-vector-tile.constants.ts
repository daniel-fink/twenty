import { type GeoMapTilePolicy } from 'twenty-shared/types';

export const MAP_VECTOR_TILE_LAYER_NAME = 'records';

export const MAP_VECTOR_TILE_MIN_ZOOM = 9;

export const MAP_VECTOR_TILE_MAX_ZOOM = 22;

export const MAP_VECTOR_TILE_EXTENT = 4096;

export const MAP_VECTOR_TILE_BUFFER = 64;

export const MAP_VECTOR_TILE_MAX_FEATURES: number | null = null;

export const MAP_VECTOR_TILE_SIMPLIFICATION_MAX_ZOOM = 12;

export const WEB_MERCATOR_WORLD_WIDTH_METERS = 40_075_016.68557849;

export const DEFAULT_MAP_VECTOR_TILE_POLICY = {
  minZoom: MAP_VECTOR_TILE_MIN_ZOOM,
  maxZoom: MAP_VECTOR_TILE_MAX_ZOOM,
  extent: MAP_VECTOR_TILE_EXTENT,
  buffer: MAP_VECTOR_TILE_BUFFER,
  maxFeatureCount: MAP_VECTOR_TILE_MAX_FEATURES,
  simplification: {
    enabled: true,
    maxZoom: MAP_VECTOR_TILE_SIMPLIFICATION_MAX_ZOOM,
    toleranceMultiplier: 1,
  },
} as const satisfies GeoMapTilePolicy;
