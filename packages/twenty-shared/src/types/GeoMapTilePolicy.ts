export type GeoMapTilePolicySimplification = {
  enabled: boolean;
  maxZoom: number;
  toleranceMultiplier: number;
};

export type GeoMapTilePolicy = {
  minZoom: number;
  maxZoom: number;
  extent: number;
  buffer: number;
  maxFeatureCount: number | null;
  simplification: GeoMapTilePolicySimplification;
};

export type PartialGeoMapTilePolicy = Partial<
  Omit<GeoMapTilePolicy, 'simplification'>
> & {
  simplification?: Partial<GeoMapTilePolicySimplification>;
};

export const validatePartialGeoMapTilePolicy = (
  value: unknown,
): value is PartialGeoMapTilePolicy => {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const policy = value as PartialGeoMapTilePolicy;

  if (
    policy.minZoom !== undefined &&
    (!Number.isInteger(policy.minZoom) ||
      policy.minZoom < 0 ||
      policy.minZoom > 22)
  ) {
    return false;
  }

  if (
    policy.maxZoom !== undefined &&
    (!Number.isInteger(policy.maxZoom) ||
      policy.maxZoom < 0 ||
      policy.maxZoom > 22)
  ) {
    return false;
  }

  if (
    policy.minZoom !== undefined &&
    policy.maxZoom !== undefined &&
    policy.minZoom > policy.maxZoom
  ) {
    return false;
  }

  if (
    policy.extent !== undefined &&
    (!Number.isInteger(policy.extent) || policy.extent <= 0)
  ) {
    return false;
  }

  if (
    policy.buffer !== undefined &&
    (!Number.isInteger(policy.buffer) || policy.buffer < 0)
  ) {
    return false;
  }

  if (
    policy.maxFeatureCount !== undefined &&
    policy.maxFeatureCount !== null &&
    (!Number.isInteger(policy.maxFeatureCount) || policy.maxFeatureCount <= 0)
  ) {
    return false;
  }

  if (policy.simplification !== undefined) {
    if (
      typeof policy.simplification !== 'object' ||
      policy.simplification === null ||
      Array.isArray(policy.simplification)
    ) {
      return false;
    }

    if (
      policy.simplification.enabled !== undefined &&
      typeof policy.simplification.enabled !== 'boolean'
    ) {
      return false;
    }

    if (
      policy.simplification.maxZoom !== undefined &&
      (!Number.isInteger(policy.simplification.maxZoom) ||
        policy.simplification.maxZoom < 0 ||
        policy.simplification.maxZoom > 22)
    ) {
      return false;
    }

    if (
      policy.simplification.toleranceMultiplier !== undefined &&
      (typeof policy.simplification.toleranceMultiplier !== 'number' ||
        !Number.isFinite(policy.simplification.toleranceMultiplier) ||
        policy.simplification.toleranceMultiplier < 0)
    ) {
      return false;
    }
  }

  return true;
};
