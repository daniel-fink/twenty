import { type PartialGeoMapTilePolicy } from '@/types/GeoMapTilePolicy';

export type GeoJsonPoint = {
  type: 'Point';
  coordinates: [number, number];
};

export type GeoJsonLinearRing = [number, number][];

export type GeoJsonPolygon = {
  type: 'Polygon';
  coordinates: GeoJsonLinearRing[];
};

export type GeoJsonMultiPolygon = {
  type: 'MultiPolygon';
  coordinates: GeoJsonLinearRing[][];
};

export type GeoJsonGeometry =
  | GeoJsonPoint
  | GeoJsonPolygon
  | GeoJsonMultiPolygon;

export type GeometryType = 'POINT' | 'POLYGON' | 'MULTIPOLYGON' | 'GEOMETRY';

export type FieldMetadataGeometrySettings = {
  geometryType: GeometryType;
  srid: 4326;
  isGeography: false;
  mapTilePolicy?: PartialGeoMapTilePolicy;
};

export const DEFAULT_GEOMETRY_FIELD_SETTINGS = {
  geometryType: 'POINT',
  srid: 4326,
  isGeography: false,
} as const satisfies FieldMetadataGeometrySettings;

const isGeoJsonPosition = (value: unknown): value is [number, number] => {
  if (!Array.isArray(value) || value.length !== 2) {
    return false;
  }

  const [longitude, latitude] = value;

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

const isGeoJsonLinearRing = (value: unknown): value is GeoJsonLinearRing => {
  if (!Array.isArray(value) || value.length < 4) {
    return false;
  }

  if (!value.every(isGeoJsonPosition)) {
    return false;
  }

  const firstPosition = value[0];
  const lastPosition = value[value.length - 1];

  return (
    firstPosition[0] === lastPosition[0] && firstPosition[1] === lastPosition[1]
  );
};

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

  if (candidate.type !== 'Point') {
    return false;
  }

  return isGeoJsonPosition(candidate.coordinates);
};

export const isGeoJsonPolygon = (value: unknown): value is GeoJsonPolygon => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('type' in value) ||
    !('coordinates' in value)
  ) {
    return false;
  }

  const candidate = value as Partial<GeoJsonPolygon>;

  return (
    candidate.type === 'Polygon' &&
    Array.isArray(candidate.coordinates) &&
    candidate.coordinates.length > 0 &&
    candidate.coordinates.every(isGeoJsonLinearRing)
  );
};

export const isGeoJsonMultiPolygon = (
  value: unknown,
): value is GeoJsonMultiPolygon => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('type' in value) ||
    !('coordinates' in value)
  ) {
    return false;
  }

  const candidate = value as Partial<GeoJsonMultiPolygon>;

  return (
    candidate.type === 'MultiPolygon' &&
    Array.isArray(candidate.coordinates) &&
    candidate.coordinates.length > 0 &&
    candidate.coordinates.every(
      (polygon) =>
        Array.isArray(polygon) &&
        polygon.length > 0 &&
        polygon.every(isGeoJsonLinearRing),
    )
  );
};

export const isGeoJsonGeometry = (value: unknown): value is GeoJsonGeometry =>
  isGeoJsonPoint(value) ||
  isGeoJsonPolygon(value) ||
  isGeoJsonMultiPolygon(value);
