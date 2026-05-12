import { RECORD_MAP_VECTOR_TILE_LAYER } from '@/object-record/record-map/constants/record-map-vector-tile-layer.constants';
import {
  type RecordMapLayerContribution,
  type RecordMapRenderedContributionLayer,
  type RecordMapSelectedContributionFeature,
} from '@/object-record/record-map/types/RecordMapContribution';
import { getRecordMapContributedLayerPrefix } from '@/object-record/record-map/utils/getRecordMapContributedLayerPrefix';
import { getRecordMapContributionRenderOrder } from '@/object-record/record-map/utils/getRecordMapContributionRenderOrder';
import {
  getRecordMapSelectedContributionLayerIds,
  getRecordMapSelectedContributionLayers,
} from '@/object-record/record-map/utils/getRecordMapSelectedContributionLayers';
import { resolveRecordMapContributionFillColor } from '@/object-record/record-map/utils/resolveRecordMapContributionFillColor';
import { useEffect, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';

import type maplibregl from 'maplibre-gl';

const hasLayer = (map: maplibregl.Map, layerId: string) => {
  try {
    return isDefined(map.getLayer(layerId));
  } catch {
    return false;
  }
};

const hasSource = (map: maplibregl.Map, sourceId: string) => {
  try {
    return isDefined(map.getSource(sourceId));
  } catch {
    return false;
  }
};

const removeSelectedContributionLayers = ({
  contributionId,
  map,
}: {
  contributionId: string;
  map: maplibregl.Map;
}) => {
  const selectedLayerIds =
    getRecordMapSelectedContributionLayerIds(contributionId);

  for (const layerId of [
    selectedLayerIds.activeOutlineLayerId,
    selectedLayerIds.fillLayerId,
    selectedLayerIds.outlineLayerId,
  ]) {
    if (hasLayer(map, layerId)) {
      map.removeLayer(layerId);
    }
  }
};

const addLayer = ({
  layer,
  map,
}: {
  layer: maplibregl.LayerSpecification;
  map: maplibregl.Map;
}) => {
  const beforeId = hasLayer(map, RECORD_MAP_VECTOR_TILE_LAYER.fillLayerId)
    ? RECORD_MAP_VECTOR_TILE_LAYER.fillLayerId
    : undefined;

  map.addLayer(layer, beforeId);
};

const resolveRecordMapContributionFillOpacity = (
  style: Extract<RecordMapLayerContribution['style'], { type: 'fill' }>,
): number | maplibregl.ExpressionSpecification => {
  const fallbackOpacity = style.fillOpacity ?? 0.24;

  return isDefined(style.fillOpacityProperty)
    ? ([
        'to-number',
        ['get', style.fillOpacityProperty],
        fallbackOpacity,
      ] as maplibregl.ExpressionSpecification)
    : fallbackOpacity;
};

const addContributedLayer = ({
  contribution,
  map,
}: {
  contribution: RecordMapLayerContribution;
  map: maplibregl.Map;
}): RecordMapRenderedContributionLayer => {
  const sourceId = getRecordMapContributedLayerPrefix(
    contribution.contributionId,
  );
  const layerPrefix = sourceId;
  const style = contribution.style ?? {
    fillColor: '#64748b',
    fillOpacity: 0.24,
    type: 'fill' as const,
  };
  const hitLayerIds: string[] = [];
  const layerIds: string[] = [];

  if (!hasSource(map, sourceId)) {
    map.addSource(sourceId, {
      type: 'vector',
      url: contribution.tileJsonUrl,
    });
  }

  if (style.type === 'fill') {
    const fillLayerId = `${layerPrefix}-fill`;
    const outlineLayerId = `${layerPrefix}-outline`;
    const hitLayerId = `${layerPrefix}-hit`;

    addLayer({
      map,
      layer: {
        id: fillLayerId,
        type: 'fill',
        source: sourceId,
        'source-layer': contribution.sourceLayerName,
        paint: {
          'fill-color': resolveRecordMapContributionFillColor(style),
          'fill-opacity': resolveRecordMapContributionFillOpacity(style),
        },
      },
    });
    addLayer({
      map,
      layer: {
        id: hitLayerId,
        type: 'fill',
        source: sourceId,
        'source-layer': contribution.sourceLayerName,
        paint: {
          'fill-color': '#000000',
          'fill-opacity': 0.01,
        },
      },
    });
    addLayer({
      map,
      layer: {
        id: outlineLayerId,
        type: 'line',
        source: sourceId,
        'source-layer': `${contribution.sourceLayerName}-outline`,
        paint: {
          'line-color': style.lineColor ?? style.fillColor,
          'line-opacity': style.lineOpacity ?? 0.8,
          'line-width': style.lineWidth ?? 1,
        },
      },
    });
    layerIds.push(fillLayerId, outlineLayerId);
    hitLayerIds.push(hitLayerId);
  }

  if (style.type === 'line') {
    const lineLayerId = `${layerPrefix}-line`;

    addLayer({
      map,
      layer: {
        id: lineLayerId,
        type: 'line',
        source: sourceId,
        'source-layer': contribution.sourceLayerName,
        paint: {
          'line-color': style.lineColor,
          'line-opacity': style.lineOpacity ?? 0.8,
          'line-width': style.lineWidth,
        },
      },
    });
    layerIds.push(lineLayerId);
    hitLayerIds.push(lineLayerId);
  }

  if (style.type === 'circle') {
    const circleLayerId = `${layerPrefix}-circle`;

    addLayer({
      map,
      layer: {
        id: circleLayerId,
        type: 'circle',
        source: sourceId,
        'source-layer': contribution.sourceLayerName,
        paint: {
          'circle-color': style.circleColor,
          'circle-opacity': style.circleOpacity ?? 0.9,
          'circle-radius': style.circleRadius ?? 5,
          'circle-stroke-color': style.circleStrokeColor ?? '#ffffff',
          'circle-stroke-width': style.circleStrokeWidth ?? 1,
        },
      },
    });
    layerIds.push(circleLayerId);
    hitLayerIds.push(circleLayerId);
  }

  return {
    contribution,
    hitLayerIds,
    layerIds,
  };
};

export const useRecordMapContributedLayers = ({
  layerContributions,
  map,
  selectedContributionFeature,
}: {
  layerContributions: RecordMapLayerContribution[];
  map: maplibregl.Map | null;
  selectedContributionFeature: RecordMapSelectedContributionFeature | null;
}) => {
  const [renderedContributionLayers, setRenderedContributionLayers] = useState<
    RecordMapRenderedContributionLayer[]
  >([]);

  useEffect(() => {
    if (!isDefined(map)) {
      setRenderedContributionLayers([]);

      return;
    }

    const visibleContributions = layerContributions.filter(
      (contribution) => contribution.isVisible,
    );
    setRenderedContributionLayers([]);

    const setPointerCursor = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const resetPointerCursor = () => {
      map.getCanvas().style.cursor = '';
    };

    const addContributedLayers = () => {
      const renderedLayers = getRecordMapContributionRenderOrder(
        visibleContributions,
      ).map((contribution) => addContributedLayer({ contribution, map }));

      for (const layerId of renderedLayers.flatMap((layer) => [
        ...layer.layerIds,
        ...layer.hitLayerIds,
      ])) {
        map.on('mouseenter', layerId, setPointerCursor);
        map.on('mouseleave', layerId, resetPointerCursor);
      }

      setRenderedContributionLayers(renderedLayers);
    };

    if (map.isStyleLoaded()) {
      addContributedLayers();
    } else {
      map.once('load', addContributedLayers);
    }

    return () => {
      map.off('load', addContributedLayers);

      for (const contribution of [...visibleContributions].reverse()) {
        const layerPrefix = getRecordMapContributedLayerPrefix(
          contribution.contributionId,
        );
        const sourceId = layerPrefix;
        const layerIds = [
          `${layerPrefix}-fill`,
          `${layerPrefix}-outline`,
          `${layerPrefix}-hit`,
          `${layerPrefix}-line`,
          `${layerPrefix}-circle`,
        ];

        removeSelectedContributionLayers({
          contributionId: contribution.contributionId,
          map,
        });

        for (const layerId of layerIds) {
          if (hasLayer(map, layerId)) {
            map.off('mouseenter', layerId, setPointerCursor);
            map.off('mouseleave', layerId, resetPointerCursor);
            map.removeLayer(layerId);
          }
        }

        if (hasSource(map, sourceId)) {
          map.removeSource(sourceId);
        }
      }
    };
  }, [layerContributions, map]);

  useEffect(() => {
    if (!isDefined(map)) {
      return;
    }

    const removeSelectedLayers = () => {
      for (const renderedLayer of renderedContributionLayers) {
        removeSelectedContributionLayers({
          contributionId: renderedLayer.contribution.contributionId,
          map,
        });
      }
    };

    removeSelectedLayers();

    if (selectedContributionFeature === null) {
      return removeSelectedLayers;
    }

    const selectedRenderedLayer = renderedContributionLayers.find(
      (renderedLayer) =>
        renderedLayer.contribution.contributionId ===
        selectedContributionFeature.contributionId,
    );

    if (!isDefined(selectedRenderedLayer)) {
      return removeSelectedLayers;
    }

    const selectedLayers = getRecordMapSelectedContributionLayers({
      activeFeatureId: selectedContributionFeature.activeFeatureId,
      contribution: selectedRenderedLayer.contribution,
      featureIds: selectedContributionFeature.featureIds,
    });

    for (const layer of selectedLayers) {
      addLayer({ layer, map });
    }

    return removeSelectedLayers;
  }, [map, renderedContributionLayers, selectedContributionFeature]);

  return { renderedContributionLayers };
};
