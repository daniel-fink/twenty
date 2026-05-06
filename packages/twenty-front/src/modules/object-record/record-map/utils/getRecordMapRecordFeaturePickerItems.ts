import { RECORD_MAP_LAYER_COLORS } from '@/object-record/record-map/constants/record-map-layer-style.constants';
import { RECORD_MAP_VECTOR_TILE_LAYER } from '@/object-record/record-map/constants/record-map-vector-tile-layer.constants';
import { type RecordMapRecordFeaturePickerItem } from '@/object-record/record-map/types/RecordMapRecordFeaturePicker';
import { capitalize, isDefined } from 'twenty-shared/utils';

type RenderedRecordFeatureHit = {
  id?: string | number;
  layer: {
    id: string;
  };
  properties?: {
    id?: string | number;
    title?: unknown;
  } | null;
};

const getLayerGeometryPriority = (layerId: string) => {
  if (layerId === RECORD_MAP_VECTOR_TILE_LAYER.pointLayerId) {
    return 0;
  }

  if (layerId === RECORD_MAP_VECTOR_TILE_LAYER.lineLayerId) {
    return 1;
  }

  return 2;
};

const getRecordTitle = ({
  feature,
  objectNameSingular,
}: {
  feature: RenderedRecordFeatureHit;
  objectNameSingular?: string;
}) => {
  if (
    typeof feature.properties?.title === 'string' &&
    feature.properties.title !== ''
  ) {
    return feature.properties.title;
  }

  return isDefined(objectNameSingular)
    ? `${capitalize(objectNameSingular)} record`
    : 'Record';
};

export const getRecordMapRecordFeaturePickerItems = ({
  features,
  objectNameSingular,
}: {
  features: RenderedRecordFeatureHit[] | undefined;
  objectNameSingular?: string;
}): RecordMapRecordFeaturePickerItem[] => {
  const dedupedItems = new Map<
    string,
    RecordMapRecordFeaturePickerItem & {
      geometryPriority: number;
      renderedFeatureIndex: number;
    }
  >();

  for (const [renderedFeatureIndex, feature] of (features ?? []).entries()) {
    if (
      feature.layer.id !== RECORD_MAP_VECTOR_TILE_LAYER.pointLayerId &&
      feature.layer.id !== RECORD_MAP_VECTOR_TILE_LAYER.lineLayerId &&
      feature.layer.id !== RECORD_MAP_VECTOR_TILE_LAYER.fillLayerId
    ) {
      continue;
    }

    const recordId = feature.properties?.id ?? feature.id;

    if (!isDefined(recordId)) {
      continue;
    }

    const normalizedRecordId = String(recordId);

    if (normalizedRecordId === '') {
      continue;
    }

    const geometryPriority = getLayerGeometryPriority(feature.layer.id);
    const existingItem = dedupedItems.get(normalizedRecordId);

    if (
      isDefined(existingItem) &&
      existingItem.geometryPriority <= geometryPriority
    ) {
      continue;
    }

    dedupedItems.set(normalizedRecordId, {
      geometryPriority,
      recordId: normalizedRecordId,
      renderedFeatureIndex,
      selectedFeature: {
        featureId: normalizedRecordId,
        featureIdProperty: 'id',
        sourceId: RECORD_MAP_VECTOR_TILE_LAYER.sourceId,
        sourceLayer: RECORD_MAP_VECTOR_TILE_LAYER.sourceLayer,
        swatchColor: RECORD_MAP_LAYER_COLORS.blue,
        type: 'record',
      },
      swatchColor: RECORD_MAP_LAYER_COLORS.blue,
      title: getRecordTitle({
        feature,
        objectNameSingular,
      }),
      type: 'record',
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
