import { GraphQLFloat, GraphQLInputObjectType, GraphQLNonNull } from 'graphql';

import { FilterIs } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/input/filter-is.input-type';
import { GeometryScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars/geometry.scalar';

const GeometryDistanceFilterType = new GraphQLInputObjectType({
  name: 'GeometryDistanceFilter',
  fields: {
    point: { type: new GraphQLNonNull(GeometryScalarType) },
    distanceInMeters: { type: new GraphQLNonNull(GraphQLFloat) },
  },
});

const GeometryBboxFilterType = new GraphQLInputObjectType({
  name: 'GeometryBboxFilter',
  fields: {
    west: { type: new GraphQLNonNull(GraphQLFloat) },
    south: { type: new GraphQLNonNull(GraphQLFloat) },
    east: { type: new GraphQLNonNull(GraphQLFloat) },
    north: { type: new GraphQLNonNull(GraphQLFloat) },
  },
});

export const GeometryFilterType = new GraphQLInputObjectType({
  name: 'GeometryFilter',
  fields: {
    is: { type: FilterIs },
    withinDistance: { type: GeometryDistanceFilterType },
    withinBbox: { type: GeometryBboxFilterType },
    intersects: { type: GeometryScalarType },
    contains: { type: GeometryScalarType },
    within: { type: GeometryScalarType },
    near: { type: GeometryDistanceFilterType },
  },
});
