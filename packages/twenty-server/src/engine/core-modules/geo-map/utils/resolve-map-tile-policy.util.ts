import {
  type GeoMapTilePolicy,
  type PartialGeoMapTilePolicy,
  validatePartialGeoMapTilePolicy,
} from 'twenty-shared/types';

import { DEFAULT_MAP_VECTOR_TILE_POLICY } from 'src/engine/core-modules/geo-map/constants/map-vector-tile.constants';

export const resolveMapTilePolicy = ({
  fieldPolicy,
  viewPolicy,
}: {
  fieldPolicy?: unknown;
  viewPolicy?: unknown;
}): GeoMapTilePolicy => {
  if (
    !validatePartialGeoMapTilePolicy(fieldPolicy) ||
    !validatePartialGeoMapTilePolicy(viewPolicy)
  ) {
    throw new Error('Invalid geo map tile policy');
  }

  const validFieldPolicy = fieldPolicy as PartialGeoMapTilePolicy | undefined;
  const validViewPolicy = viewPolicy as PartialGeoMapTilePolicy | undefined;

  const resolvedPolicy = {
    ...DEFAULT_MAP_VECTOR_TILE_POLICY,
    ...(validFieldPolicy ?? {}),
    ...(validViewPolicy ?? {}),
    simplification: {
      ...DEFAULT_MAP_VECTOR_TILE_POLICY.simplification,
      ...(validFieldPolicy?.simplification ?? {}),
      ...(validViewPolicy?.simplification ?? {}),
    },
  };

  if (resolvedPolicy.minZoom > resolvedPolicy.maxZoom) {
    throw new Error('Invalid geo map tile policy zoom range');
  }

  if (resolvedPolicy.simplification.maxZoom > resolvedPolicy.maxZoom) {
    throw new Error('Invalid geo map tile policy simplification zoom');
  }

  return resolvedPolicy;
};
