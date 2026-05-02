import { type PartialGeoMapTilePolicy } from 'twenty-shared/types';

const MICROSOFT_BUILDINGS_OBJECT_NAME_PATTERN =
  /geoBenchmarkMicrosoft.*Buildings/i;

export type GeoMapBenchmarkMapTilePolicyOptions = {
  objectNameSingular: string;
  mapMinZoom?: number;
  mapMaxZoom?: number;
  mapMaxFeatureCount?: number | null;
};

export const parseGeoMapBenchmarkZoomOption = ({
  value,
  optionName,
}: {
  value: string;
  optionName: string;
}): number => {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 0 || parsedValue > 22) {
    throw new Error(`${optionName} must be an integer between 0 and 22`);
  }

  return parsedValue;
};

export const parseGeoMapBenchmarkMaxFeatureCountOption = (
  value: string,
): number => {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error('--map-max-feature-count must be a positive integer');
  }

  return parsedValue;
};

export const buildGeoMapBenchmarkMapTilePolicy = ({
  objectNameSingular,
  mapMinZoom,
  mapMaxZoom,
  mapMaxFeatureCount,
}: GeoMapBenchmarkMapTilePolicyOptions):
  | PartialGeoMapTilePolicy
  | undefined => {
  const shouldApplyBuildingDefaults =
    MICROSOFT_BUILDINGS_OBJECT_NAME_PATTERN.test(objectNameSingular);

  const minZoom = mapMinZoom ?? (shouldApplyBuildingDefaults ? 13 : undefined);
  const maxZoom = mapMaxZoom ?? (shouldApplyBuildingDefaults ? 22 : undefined);

  if (
    minZoom === undefined &&
    maxZoom === undefined &&
    mapMaxFeatureCount === undefined
  ) {
    return undefined;
  }

  if (minZoom !== undefined && maxZoom !== undefined && minZoom > maxZoom) {
    throw new Error('--map-min-zoom cannot be greater than --map-max-zoom');
  }

  return {
    ...(minZoom !== undefined ? { minZoom } : {}),
    ...(maxZoom !== undefined ? { maxZoom } : {}),
    ...(mapMaxFeatureCount !== undefined
      ? { maxFeatureCount: mapMaxFeatureCount }
      : {}),
  };
};
