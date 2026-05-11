import { type RecordMapLayerContributionStyle } from '@/object-record/record-map/types/RecordMapContribution';

import type maplibregl from 'maplibre-gl';

export const resolveRecordMapContributionFillColor = (
  style: Extract<RecordMapLayerContributionStyle, { type: 'fill' }>,
): string | maplibregl.ExpressionSpecification => {
  if (!style.fillColorProperty) {
    return style.fillColor;
  }

  return ['coalesce', ['get', style.fillColorProperty], style.fillColor];
};
