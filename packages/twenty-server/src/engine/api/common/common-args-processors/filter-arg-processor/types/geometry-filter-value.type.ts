import { type GeoJsonGeometry, type GeoJsonPoint } from 'twenty-shared/types';

export type GeometryDistanceFilterValue = {
  point: GeoJsonPoint;
  distanceInMeters: number;
};

export type GeometryBboxFilterValue = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type GeometryFilterValue =
  | GeoJsonGeometry
  | GeometryDistanceFilterValue
  | GeometryBboxFilterValue;
