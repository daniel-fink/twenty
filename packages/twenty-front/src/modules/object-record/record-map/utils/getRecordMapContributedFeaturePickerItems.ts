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

const isHexColor = (value: unknown): value is string =>
  typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value);

const getRecordMapContributionSwatchBackground = (
  renderedLayer: RecordMapRenderedContributionLayer,
): string => {
  const style = renderedLayer.contribution.style;

  if (style?.type === 'fill') {
    if (
      style.swatch?.type === 'palette' &&
      Array.isArray(style.swatch.colors)
    ) {
      const colors = style.swatch.colors.filter(isHexColor);

      if (colors.length >= 2) {
        return `linear-gradient(90deg, ${colors.join(', ')})`;
      }
    }

    return [style.fillColor, style.lineColor].find(isHexColor) ?? '#64748b';
  }

  if (style?.type === 'line') {
    return isHexColor(style.lineColor) ? style.lineColor : '#64748b';
  }

  if (style?.type === 'circle') {
    return isHexColor(style.circleColor) ? style.circleColor : '#64748b';
  }

  return '#64748b';
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
    for (const layerId of [
      ...renderedLayer.layerIds,
      ...renderedLayer.hitLayerIds,
    ]) {
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
    const itemKey = [
      renderedLayer.contribution.viewId,
      renderedLayer.contribution.layerId,
      normalizedFeatureId,
    ].join(':');

    if (dedupedItems.has(itemKey)) {
      continue;
    }

    dedupedItems.set(itemKey, {
      contribution: renderedLayer.contribution,
      contributionId: renderedLayer.contribution.contributionId,
      featureId: normalizedFeatureId,
      layerId: renderedLayer.contribution.layerId,
      swatchColor: getRecordMapContributionSwatchBackground(renderedLayer),
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
