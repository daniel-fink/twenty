import { type RecordMapReferenceLayer } from '@/object-record/record-map/types/RecordMapReferenceLayer';

export const getRecordMapReferenceSourceId = (layer: RecordMapReferenceLayer) =>
  `record-map-reference-source-${layer.id}`;

export const getRecordMapReferencePrimaryLayerId = (
  layer: RecordMapReferenceLayer,
) => `record-map-reference-layer-${layer.id}`;

export const getRecordMapReferenceOutlineLayerId = (
  layer: RecordMapReferenceLayer,
) => `record-map-reference-layer-${layer.id}-outline`;

export const getRecordMapReferenceOutlineSourceLayerKey = (
  layer: RecordMapReferenceLayer,
) => `${layer.key}-outline`;
