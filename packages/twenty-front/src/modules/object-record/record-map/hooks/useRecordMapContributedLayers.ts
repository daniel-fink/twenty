import { RECORD_MAP_CONTRIBUTED_LAYER_ID_PREFIX } from '@/object-record/record-map/constants/record-map-contribution.constants';
import { RECORD_MAP_VECTOR_TILE_LAYER } from '@/object-record/record-map/constants/record-map-vector-tile-layer.constants';
import {
  type RecordMapLayerContribution,
  type RecordMapRenderedContributionLayer,
} from '@/object-record/record-map/types/RecordMapContribution';
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

const getContributedLayerPrefix = (contributionId: string) =>
  `${RECORD_MAP_CONTRIBUTED_LAYER_ID_PREFIX}-${contributionId.replace(
    /[^a-zA-Z0-9_-]/g,
    '-',
  )}`;

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

const addContributedLayer = ({
  contribution,
  map,
}: {
  contribution: RecordMapLayerContribution;
  map: maplibregl.Map;
}): RecordMapRenderedContributionLayer => {
  const sourceId = getContributedLayerPrefix(contribution.contributionId);
  const layerPrefix = sourceId;
  const style = contribution.style ?? {
    fillColor: '#64748b',
    fillOpacity: 0.24,
    type: 'fill' as const,
  };
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

    addLayer({
      map,
      layer: {
        id: fillLayerId,
        type: 'fill',
        source: sourceId,
        'source-layer': contribution.sourceLayerName,
        paint: {
          'fill-color': style.fillColor,
          'fill-opacity': style.fillOpacity ?? 0.24,
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
  }

  return {
    contribution,
    layerIds,
  };
};

export const useRecordMapContributedLayers = ({
  layerContributions,
  map,
}: {
  layerContributions: RecordMapLayerContribution[];
  map: maplibregl.Map | null;
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
    const setPointerCursor = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const resetPointerCursor = () => {
      map.getCanvas().style.cursor = '';
    };

    const addContributedLayers = () => {
      const renderedLayers = visibleContributions.map((contribution) =>
        addContributedLayer({ contribution, map }),
      );

      for (const layerId of renderedLayers.flatMap((layer) => layer.layerIds)) {
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
      setRenderedContributionLayers([]);

      for (const contribution of [...visibleContributions].reverse()) {
        const layerPrefix = getContributedLayerPrefix(
          contribution.contributionId,
        );
        const sourceId = layerPrefix;
        const layerIds = [
          `${layerPrefix}-fill`,
          `${layerPrefix}-outline`,
          `${layerPrefix}-line`,
          `${layerPrefix}-circle`,
        ];

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

  return { renderedContributionLayers };
};
