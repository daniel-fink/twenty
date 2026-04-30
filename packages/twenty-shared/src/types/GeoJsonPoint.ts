export type GeoJsonPoint = {
  type: 'Point';
  coordinates: [number, number];
};

export type FieldMetadataGeometrySettings = {
  geometryType: 'POINT';
  srid: 4326;
  isGeography: false;
};

export const DEFAULT_GEOMETRY_FIELD_SETTINGS = {
  geometryType: 'POINT',
  srid: 4326,
  isGeography: false,
} as const satisfies FieldMetadataGeometrySettings;

export const isGeoJsonPoint = (value: unknown): value is GeoJsonPoint => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('type' in value) ||
    !('coordinates' in value)
  ) {
    return false;
  }

  const candidate = value as Partial<GeoJsonPoint>;

  if (
    candidate.type !== 'Point' ||
    !Array.isArray(candidate.coordinates) ||
    candidate.coordinates.length !== 2
  ) {
    return false;
  }

  const [longitude, latitude] = candidate.coordinates;

  return (
    typeof longitude === 'number' &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90
  );
};
