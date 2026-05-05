import { type RecordMapReferenceFeaturePickerItem } from '@/object-record/record-map/types/RecordMapRecordFeaturePicker';
import { type RecordMapRenderedReferenceLayer } from '@/object-record/record-map/types/RecordMapReferenceLayerContribution';
import { isDefined } from 'twenty-shared/utils';

type RenderedReferenceFeatureHit = {
  id?: string | number;
  layer: {
    id: string;
  };
  properties?: Record<string, unknown> | null;
};

const getLayerSwatchColor = (
  renderedLayer: RecordMapRenderedReferenceLayer,
) => {
  const style = renderedLayer.contribution.style;

  if (style?.type === 'line') {
    return style.lineColor;
  }

  if (style?.type === 'circle') {
    return style.circleColor;
  }

  return style?.fillColor ?? '#64748b';
};

export const getRecordMapReferenceFeaturePickerItems = ({
  features,
  renderedReferenceLayers,
}: {
  features: RenderedReferenceFeatureHit[] | undefined;
  renderedReferenceLayers: RecordMapRenderedReferenceLayer[];
}): RecordMapReferenceFeaturePickerItem[] => {
  const renderedLayersByLayerId = new Map<
    string,
    RecordMapRenderedReferenceLayer
  >();

  for (const renderedLayer of renderedReferenceLayers) {
    for (const layerId of renderedLayer.layerIds) {
      renderedLayersByLayerId.set(layerId, renderedLayer);
    }
  }

  const dedupedItems = new Map<string, RecordMapReferenceFeaturePickerItem>();

  for (const feature of features ?? []) {
    const renderedLayer = renderedLayersByLayerId.get(feature.layer.id);

    if (!isDefined(renderedLayer)) {
      continue;
    }

    const featureIdProperty =
      renderedLayer.contribution.featureIdProperty ?? 'selectedFeatureValue';
    const titleProperty = renderedLayer.contribution.titleProperty ?? 'title';
    const featureId =
      feature.properties?.[featureIdProperty] ??
      feature.properties?.id ??
      feature.id;

    if (!isDefined(featureId) || String(featureId) === '') {
      continue;
    }

    const title = feature.properties?.[titleProperty];
    const normalizedFeatureId = String(featureId);
    const itemKey = `${renderedLayer.contribution.contributionId}:${normalizedFeatureId}`;

    if (dedupedItems.has(itemKey)) {
      continue;
    }

    dedupedItems.set(itemKey, {
      contribution: renderedLayer.contribution,
      contributionId: renderedLayer.contribution.contributionId,
      featureId: normalizedFeatureId,
      layerId: renderedLayer.contribution.layerId,
      swatchColor: getLayerSwatchColor(renderedLayer),
      title:
        typeof title === 'string' && title !== ''
          ? title
          : renderedLayer.contribution.displayName,
      type: 'reference',
      viewId: renderedLayer.contribution.viewId,
    });
  }

  return [...dedupedItems.values()];
};
