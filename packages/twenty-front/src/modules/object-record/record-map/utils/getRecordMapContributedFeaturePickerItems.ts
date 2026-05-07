import { type RecordMapContributedFeaturePickerItem } from '@/object-record/record-map/types/RecordMapRecordFeaturePicker';
import { type RecordMapRenderedContributionLayer } from '@/object-record/record-map/types/RecordMapContribution';
import { isDefined } from 'twenty-shared/utils';

type RenderedContributionFeatureHit = {
  id?: string | number;
  layer: {
    id: string;
  };
  properties?: Record<string, unknown> | null;
};

const getLayerSwatchColor = (
  renderedLayer: RecordMapRenderedContributionLayer,
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

export const getRecordMapContributedFeaturePickerItems = ({
  features,
  renderedContributionLayers,
}: {
  features: RenderedContributionFeatureHit[] | undefined;
  renderedContributionLayers: RecordMapRenderedContributionLayer[];
}): RecordMapContributedFeaturePickerItem[] => {
  const renderedLayersByLayerId = new Map<
    string,
    RecordMapRenderedContributionLayer
  >();

  for (const renderedLayer of renderedContributionLayers) {
    for (const layerId of renderedLayer.layerIds) {
      renderedLayersByLayerId.set(layerId, renderedLayer);
    }
  }

  const dedupedItems = new Map<string, RecordMapContributedFeaturePickerItem>();

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
      type: 'contribution',
      viewId: renderedLayer.contribution.viewId,
    });
  }

  return [...dedupedItems.values()];
};
