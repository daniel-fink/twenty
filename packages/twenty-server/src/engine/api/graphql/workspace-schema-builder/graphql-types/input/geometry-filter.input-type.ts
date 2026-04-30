import { GraphQLInputObjectType } from 'graphql';

import { FilterIs } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/input/filter-is.input-type';

export const GeometryFilterType = new GraphQLInputObjectType({
  name: 'GeometryFilter',
  fields: {
    is: { type: FilterIs },
  },
});
