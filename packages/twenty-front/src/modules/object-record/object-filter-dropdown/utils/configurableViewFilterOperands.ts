import { ViewFilterOperand } from 'twenty-shared/types';

export const configurableViewFilterOperands = new Set<ViewFilterOperand>([
  ViewFilterOperand.IS,
  ViewFilterOperand.IS_NOT_NULL,
  ViewFilterOperand.IS_NOT,
  ViewFilterOperand.LESS_THAN_OR_EQUAL,
  ViewFilterOperand.GREATER_THAN_OR_EQUAL,
  ViewFilterOperand.IS_BEFORE,
  ViewFilterOperand.IS_AFTER,
  ViewFilterOperand.CONTAINS,
  ViewFilterOperand.DOES_NOT_CONTAIN,
  ViewFilterOperand.IS_RELATIVE,
  ViewFilterOperand.WITHIN_DISTANCE,
  ViewFilterOperand.WITHIN_BBOX,
  ViewFilterOperand.INTERSECTS,
  ViewFilterOperand.CONTAINS_GEOMETRY,
  ViewFilterOperand.WITHIN_GEOMETRY,
  ViewFilterOperand.NEAR,
]);
