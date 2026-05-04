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
    selectedFeatureValue?: string | number;
    title?: unknown;
    [key: string]: unknown;
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
      layer: RecordMapReferenceLayer;
      sortValues: unknown[];
    }
  >();

  for (const [renderedFeatureIndex, feature] of (features ?? []).entries()) {
    const layer = findReferenceLayerForRenderedFeature({
      featureLayerId: feature.layer.id,
      referenceLayers,
    });

    const selectedFeatureValue =
      feature.properties?.selectedFeatureValue ?? feature.properties?.id;

    if (!isDefined(layer) || !isDefined(selectedFeatureValue)) {
      continue;
    }

    const normalizedSelectedFeatureValue = String(selectedFeatureValue);

    if (normalizedSelectedFeatureValue === '') {
      continue;
    }

    const dedupeKey = `${layer.id}:${normalizedSelectedFeatureValue}`;

    if (dedupedItems.has(dedupeKey)) {
      continue;
    }

    dedupedItems.set(dedupeKey, {
      geometryPriority: getLayerGeometryPriority(layer),
      layer,
      layerId: layer.id,
      layerName: layer.name,
      renderedFeatureIndex,
      selectedFeatureValue: normalizedSelectedFeatureValue,
      sortValues: layer.query.sort.map(
        (_sort, index) => feature.properties?.[`sort_${index}`],
      ),
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

      if (firstItem.layerId === secondItem.layerId) {
        for (const [index, sort] of firstItem.layer.query.sort.entries()) {
          const firstValue = firstItem.sortValues[index];
          const secondValue = secondItem.sortValues[index];
          const comparison = String(firstValue ?? '').localeCompare(
            String(secondValue ?? ''),
            undefined,
            { numeric: true },
          );

          if (comparison !== 0) {
            return sort.direction === 'desc' ? -comparison : comparison;
          }
        }
      }

      return firstItem.renderedFeatureIndex - secondItem.renderedFeatureIndex;
    })
    .map(
      ({
        geometryPriority: _geometryPriority,
        layer: _layer,
        renderedFeatureIndex: _renderedFeatureIndex,
        sortValues: _sortValues,
        ...item
      }) => item,
    );
};
