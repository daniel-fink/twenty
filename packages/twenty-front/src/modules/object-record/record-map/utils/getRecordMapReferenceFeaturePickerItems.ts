import {
  type RecordMapReferenceFeaturePickerItem,
  type RecordMapReferenceLayer,
} from '@/object-record/record-map/types/RecordMapReferenceLayer';
import { getRecordMapReferenceLayerSwatchColor } from '@/object-record/record-map/utils/getRecordMapReferenceLayerSwatchColor';
import {
  getRecordMapReferenceOutlineLayerId,
  getRecordMapReferencePrimaryLayerId,
} from '@/object-record/record-map/utils/getRecordMapReferenceLayerMapIds';
import { isDefined } from 'twenty-shared/utils';

type RenderedReferenceFeatureHit = {
  id?: string | number;
  layer: {
    id: string;
  };
  properties?: {
    id?: string | number;
    title?: unknown;
  } | null;
};

const getLayerGeometryPriority = (layer: RecordMapReferenceLayer) => {
  if (layer.style.type === 'circle') {
    return 0;
  }

  if (layer.style.type === 'line') {
    return 1;
  }

  return 2;
};

const findReferenceLayerForRenderedFeature = ({
  featureLayerId,
  referenceLayers,
}: {
  featureLayerId: string;
  referenceLayers: RecordMapReferenceLayer[];
}) =>
  referenceLayers.find(
    (referenceLayer) =>
      featureLayerId === getRecordMapReferencePrimaryLayerId(referenceLayer) ||
      featureLayerId === getRecordMapReferenceOutlineLayerId(referenceLayer),
  );

export const getRecordMapReferenceFeaturePickerItems = ({
  features,
  referenceLayers,
}: {
  features: RenderedReferenceFeatureHit[] | undefined;
  referenceLayers: RecordMapReferenceLayer[];
}): RecordMapReferenceFeaturePickerItem[] => {
  const dedupedItems = new Map<
    string,
    RecordMapReferenceFeaturePickerItem & {
      geometryPriority: number;
      renderedFeatureIndex: number;
    }
  >();

  for (const [renderedFeatureIndex, feature] of (features ?? []).entries()) {
    const layer = findReferenceLayerForRenderedFeature({
      featureLayerId: feature.layer.id,
      referenceLayers,
    });

    const featureId = feature.properties?.id ?? feature.id;

    if (!isDefined(layer) || !isDefined(featureId)) {
      continue;
    }

    const normalizedFeatureId = String(featureId);

    if (normalizedFeatureId === '') {
      continue;
    }

    const dedupeKey = `${layer.id}:${normalizedFeatureId}`;

    if (dedupedItems.has(dedupeKey)) {
      continue;
    }

    dedupedItems.set(dedupeKey, {
      featureId: normalizedFeatureId,
      geometryPriority: getLayerGeometryPriority(layer),
      layerId: layer.id,
      layerName: layer.name,
      renderedFeatureIndex,
      swatchColor: getRecordMapReferenceLayerSwatchColor(layer.style),
      title:
        typeof feature.properties?.title === 'string' &&
        feature.properties.title !== ''
          ? feature.properties.title
          : layer.name,
    });
  }

  return [...dedupedItems.values()]
    .sort((firstItem, secondItem) => {
      const priorityComparison =
        firstItem.geometryPriority - secondItem.geometryPriority;

      if (priorityComparison !== 0) {
        return priorityComparison;
      }

      return firstItem.renderedFeatureIndex - secondItem.renderedFeatureIndex;
    })
    .map(
      ({
        geometryPriority: _geometryPriority,
        renderedFeatureIndex: _renderedFeatureIndex,
        ...item
      }) => item,
    );
};
