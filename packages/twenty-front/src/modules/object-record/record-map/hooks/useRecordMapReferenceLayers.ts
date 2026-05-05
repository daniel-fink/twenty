import { RECORD_MAP_REFERENCE_LAYER_ID_PREFIX } from '@/object-record/record-map/constants/record-map-reference-layer.constants';
import { RECORD_MAP_VECTOR_TILE_LAYER } from '@/object-record/record-map/constants/record-map-vector-tile-layer.constants';
import {
  type RecordMapReferenceLayerContribution,
  type RecordMapRenderedReferenceLayer,
} from '@/object-record/record-map/types/RecordMapReferenceLayerContribution';
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

const getReferenceLayerPrefix = (contributionId: string) =>
  `${RECORD_MAP_REFERENCE_LAYER_ID_PREFIX}-${contributionId.replace(
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

const addReferenceLayer = ({
  contribution,
  map,
}: {
  contribution: RecordMapReferenceLayerContribution;
  map: maplibregl.Map;
}): RecordMapRenderedReferenceLayer => {
  const sourceId = getReferenceLayerPrefix(contribution.contributionId);
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

export const useRecordMapReferenceLayers = ({
  map,
  referenceLayerContributions,
}: {
  map: maplibregl.Map | null;
  referenceLayerContributions: RecordMapReferenceLayerContribution[];
}) => {
  const [renderedReferenceLayers, setRenderedReferenceLayers] = useState<
    RecordMapRenderedReferenceLayer[]
  >([]);

  useEffect(() => {
    if (!isDefined(map)) {
      setRenderedReferenceLayers([]);

      return;
    }

    const visibleContributions = referenceLayerContributions.filter(
      (contribution) => contribution.isVisible,
    );
    const setPointerCursor = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const resetPointerCursor = () => {
      map.getCanvas().style.cursor = '';
    };

    const addReferenceLayers = () => {
      const renderedLayers = visibleContributions.map((contribution) =>
        addReferenceLayer({ contribution, map }),
      );

      for (const layerId of renderedLayers.flatMap((layer) => layer.layerIds)) {
        map.on('mouseenter', layerId, setPointerCursor);
        map.on('mouseleave', layerId, resetPointerCursor);
      }

      setRenderedReferenceLayers(renderedLayers);
    };

    if (map.isStyleLoaded()) {
      addReferenceLayers();
    } else {
      map.once('load', addReferenceLayers);
    }

    return () => {
      map.off('load', addReferenceLayers);
      setRenderedReferenceLayers([]);

      for (const contribution of [...visibleContributions].reverse()) {
        const layerPrefix = getReferenceLayerPrefix(
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
  }, [map, referenceLayerContributions]);

  return { renderedReferenceLayers };
};
