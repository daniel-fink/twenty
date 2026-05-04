import { type RecordMapReferenceLayerStyle } from '@/object-record/record-map/types/RecordMapReferenceLayer';

export const getRecordMapReferenceLayerSwatchColor = (
  style: RecordMapReferenceLayerStyle,
) => {
  if (style.type === 'fill') {
    return style.fillColor;
  }

  if (style.type === 'line') {
    return style.lineColor;
  }

  return style.circleColor;
};
