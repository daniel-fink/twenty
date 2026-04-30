import { GraphQLScalarType, Kind, type ValueNode } from 'graphql';
import { isGeoJsonPoint, type GeoJsonPoint } from 'twenty-shared/types';

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

const checkGeoJsonPoint = (value: unknown): GeoJsonPoint => {
  if (isGeoJsonPoint(value)) {
    return value;
  }

  throw new ValidationError(
    'Invalid geometry value. Geometry must be a GeoJSON Point with WGS84 coordinates [longitude, latitude].',
  );
};

export const GeometryScalarType = new GraphQLScalarType({
  name: 'Geometry',
  description: 'GeoJSON Point geometry using WGS84 coordinates',
  serialize: checkGeoJsonPoint,
  parseValue: checkGeoJsonPoint,
  parseLiteral(ast): GeoJsonPoint {
    return checkGeoJsonPoint(parseObjectLiteral(ast));
  },
});
