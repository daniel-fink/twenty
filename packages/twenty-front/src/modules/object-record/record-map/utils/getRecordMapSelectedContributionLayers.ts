import { type RecordMapLayerContribution } from '@/object-record/record-map/types/RecordMapContribution';
import { getRecordMapContributedLayerPrefix } from '@/object-record/record-map/utils/getRecordMapContributedLayerPrefix';

import type maplibregl from 'maplibre-gl';

export const getRecordMapSelectedContributionLayerIds = (
  contributionId: string,
) => {
  const layerPrefix = getRecordMapContributedLayerPrefix(contributionId);

  return {
    fillLayerId: `${layerPrefix}-selected-fill`,
    outlineLayerId: `${layerPrefix}-selected-outline`,
  };
};

export const getRecordMapSelectedContributionLayers = ({
  contribution,
  featureId,
}: {
  contribution: RecordMapLayerContribution;
  featureId: string;
}): maplibregl.LayerSpecification[] => {
  const style = contribution.style;

  if (style?.type !== 'fill' || !style.selectedStyle) {
    return [];
  }

  const sourceId = getRecordMapContributedLayerPrefix(
    contribution.contributionId,
  );
  const layerIds = getRecordMapSelectedContributionLayerIds(
    contribution.contributionId,
  );
  const featureIdProperty =
    contribution.featureIdProperty ?? 'selectedFeatureValue';
  const selectedFeatureFilter: maplibregl.FilterSpecification = [
    '==',
    ['to-string', ['get', featureIdProperty]],
    featureId,
  ];

  return [
    {
      id: layerIds.fillLayerId,
      type: 'fill',
      source: sourceId,
      'source-layer': contribution.sourceLayerName,
      filter: selectedFeatureFilter,
      paint: {
        'fill-color': style.selectedStyle.fillColor,
        'fill-opacity': style.selectedStyle.fillOpacity ?? 0.5,
      },
    },
    {
      id: layerIds.outlineLayerId,
      type: 'line',
      source: sourceId,
      'source-layer': `${contribution.sourceLayerName}-outline`,
      filter: selectedFeatureFilter,
      paint: {
        'line-color':
          style.selectedStyle.lineColor ?? style.lineColor ?? style.fillColor,
        'line-opacity': style.selectedStyle.lineOpacity ?? 1,
        'line-width': style.selectedStyle.lineWidth ?? 3,
      },
    },
  ];
};
