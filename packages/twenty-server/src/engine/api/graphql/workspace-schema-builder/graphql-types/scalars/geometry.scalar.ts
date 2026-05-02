import { GraphQLScalarType, Kind, type ValueNode } from 'graphql';
import { isGeoJsonGeometry, type GeoJsonGeometry } from 'twenty-shared/types';

import { ValidationError } from 'src/engine/core-modules/graphql/utils/graphql-errors.util';

const parseObjectLiteral = (ast: ValueNode): unknown => {
  switch (ast.kind) {
    case Kind.OBJECT:
      return Object.fromEntries(
        ast.fields.map((field) => [
          field.name.value,
          parseObjectLiteral(field.value),
        ]),
      );
    case Kind.LIST:
      return ast.values.map(parseObjectLiteral);
    case Kind.STRING:
      return ast.value;
    case Kind.INT:
    case Kind.FLOAT:
      return Number(ast.value);
    case Kind.NULL:
      return null;
    default:
      return undefined;
  }
};

const checkGeoJsonGeometry = (value: unknown): GeoJsonGeometry => {
  if (isGeoJsonGeometry(value)) {
    return value;
  }

  throw new ValidationError(
    'Invalid geometry value. Geometry must be a GeoJSON Point, Polygon, or MultiPolygon with WGS84 coordinates.',
  );
};

export const GeometryScalarType = new GraphQLScalarType({
  name: 'Geometry',
  description:
    'GeoJSON Point, Polygon, or MultiPolygon using WGS84 coordinates',
  serialize: checkGeoJsonGeometry,
  parseValue: checkGeoJsonGeometry,
  parseLiteral(ast): GeoJsonGeometry {
    return checkGeoJsonGeometry(parseObjectLiteral(ast));
  },
});
