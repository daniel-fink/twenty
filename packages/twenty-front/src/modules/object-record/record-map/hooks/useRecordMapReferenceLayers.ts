import { REACT_APP_SERVER_BASE_URL } from '~/config';

import { useNavigateSidePanel } from '@/side-panel/hooks/useNavigateSidePanel';
import { RECORD_MAP_LAYER_COLORS } from '@/object-record/record-map/constants/record-map-layer-style.constants';
import {
  type RecordMapReferenceLayer,
  type RecordMapReferenceLayerStyle,
} from '@/object-record/record-map/types/RecordMapReferenceLayer';
import { ensureTokenPairIsFresh } from '@/apollo/utils/ensureTokenPairIsFresh';
import { useEffect } from 'react';
import { SidePanelPages } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { IconMap } from 'twenty-ui/display';

import type maplibregl from 'maplibre-gl';

const RECORD_TILE_FILL_LAYER_ID = 'record-map-polygons-fill';
const REFERENCE_LAYER_CLICK_RADIUS_PIXELS = 8;

const getSourceId = (layer: RecordMapReferenceLayer) =>
  `record-map-reference-source-${layer.id}`;

const getPrimaryLayerId = (layer: RecordMapReferenceLayer) =>
  `record-map-reference-layer-${layer.id}`;

const getOutlineLayerId = (layer: RecordMapReferenceLayer) =>
  `record-map-reference-layer-${layer.id}-outline`;

const getOutlineSourceLayerKey = (layer: RecordMapReferenceLayer) =>
  `${layer.key}-outline`;

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

const getBeforeLayerId = (map: maplibregl.Map) =>
  hasLayer(map, RECORD_TILE_FILL_LAYER_ID)
    ? RECORD_TILE_FILL_LAYER_ID
    : undefined;

const addStyledLayer = ({
  beforeLayerId,
  layer,
  map,
  sourceId,
  style,
}: {
  beforeLayerId?: string;
  layer: RecordMapReferenceLayer;
  map: maplibregl.Map;
  sourceId: string;
  style: RecordMapReferenceLayerStyle;
}) => {
  if (style.type === 'fill') {
    map.addLayer(
      {
        id: getPrimaryLayerId(layer),
        type: 'fill',
        source: sourceId,
        'source-layer': layer.key,
        paint: {
          'fill-color': style.fillColor,
          'fill-opacity': style.fillOpacity,
        },
      },
      beforeLayerId,
    );

    map.addLayer(
      {
        id: getOutlineLayerId(layer),
        type: 'line',
        source: sourceId,
        'source-layer': getOutlineSourceLayerKey(layer),
        paint: {
          'line-color': style.lineColor ?? style.fillColor,
          'line-opacity': style.lineOpacity ?? 0.8,
          'line-width': style.lineWidth ?? 1,
        },
      },
      beforeLayerId,
    );

    return;
  }

  if (style.type === 'line') {
    map.addLayer(
      {
        id: getPrimaryLayerId(layer),
        type: 'line',
        source: sourceId,
        'source-layer': layer.key,
        paint: {
          'line-color': style.lineColor,
          'line-opacity': style.lineOpacity ?? 0.8,
          'line-width': style.lineWidth,
        },
      },
      beforeLayerId,
    );

    return;
  }

  map.addLayer(
    {
      id: getPrimaryLayerId(layer),
      type: 'circle',
      source: sourceId,
      'source-layer': layer.key,
      paint: {
        'circle-color': style.circleColor,
        'circle-opacity': style.circleOpacity ?? 0.85,
        'circle-radius': style.circleRadius,
        'circle-stroke-color':
          style.circleStrokeColor ?? RECORD_MAP_LAYER_COLORS.white,
        'circle-stroke-width': style.circleStrokeWidth ?? 1,
      },
    },
    beforeLayerId,
  );
};

export const useRecordMapReferenceLayers = ({
  map,
  referenceLayers,
  viewId,
}: {
  map: maplibregl.Map | null;
  referenceLayers: RecordMapReferenceLayer[];
  viewId?: string;
}) => {
  const { navigateSidePanel } = useNavigateSidePanel();

  useEffect(() => {
    if (!isDefined(map) || !isDefined(viewId)) {
      return;
    }

    const visibleReferenceLayers = referenceLayers.filter(
      (layer) => layer.attachment.isVisible,
    );

    if (visibleReferenceLayers.length === 0) {
      return;
    }

    const layerIds = visibleReferenceLayers.flatMap((layer) => [
      getPrimaryLayerId(layer),
      getOutlineLayerId(layer),
    ]);
    const getRenderedReferenceLayerIds = () =>
      layerIds.filter((layerId) => hasLayer(map, layerId));
    const handleFeatureClick = (
      features: maplibregl.MapGeoJSONFeature[] | undefined,
    ) => {
      const feature = features?.[0];
      const featureId = feature?.properties?.id ?? feature?.id;
      const featureLayerId = feature?.layer.id;
      const layer = visibleReferenceLayers.find(
        (visibleLayer) =>
          featureLayerId === getPrimaryLayerId(visibleLayer) ||
          featureLayerId === getOutlineLayerId(visibleLayer),
      );

      if (!isDefined(layer) || !isDefined(featureId)) {
        return;
      }

      const featureTitle =
        typeof feature?.properties?.title === 'string'
          ? feature.properties.title
          : layer.name;

      navigateSidePanel({
        page: SidePanelPages.ViewMapReferenceFeature,
        pageIcon: IconMap,
        pageId: encodeURIComponent(
          JSON.stringify({
            featureId: String(featureId),
            layerId: layer.id,
            viewId,
          }),
        ),
        pageTitle: featureTitle,
      });
    };
    const handleMapClick = (event: maplibregl.MapMouseEvent) => {
      const renderedLayerIds = getRenderedReferenceLayerIds();

      if (renderedLayerIds.length === 0) {
        return;
      }

      handleFeatureClick(
        map.queryRenderedFeatures(
          [
            [
              event.point.x - REFERENCE_LAYER_CLICK_RADIUS_PIXELS,
              event.point.y - REFERENCE_LAYER_CLICK_RADIUS_PIXELS,
            ],
            [
              event.point.x + REFERENCE_LAYER_CLICK_RADIUS_PIXELS,
              event.point.y + REFERENCE_LAYER_CLICK_RADIUS_PIXELS,
            ],
          ],
          {
            layers: renderedLayerIds,
          },
        ),
      );
    };
    const setPointerCursor = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const resetPointerCursor = () => {
      map.getCanvas().style.cursor = '';
    };
    const addReferenceLayers = () => {
      for (const layer of visibleReferenceLayers) {
        const sourceId = getSourceId(layer);

        if (!hasSource(map, sourceId)) {
          map.addSource(sourceId, {
            type: 'vector',
            tiles: [
              `${REACT_APP_SERVER_BASE_URL}/rest/map/views/${viewId}/reference-layers/${layer.id}/tiles/{z}/{x}/{y}.mvt`,
            ],
            minzoom: layer.tile.minZoom,
            maxzoom: layer.tile.maxZoom,
          });
        }

        if (!hasLayer(map, getPrimaryLayerId(layer))) {
          addStyledLayer({
            beforeLayerId: getBeforeLayerId(map),
            layer,
            map,
            sourceId,
            style: layer.style,
          });
        }
      }

      for (const layerId of layerIds) {
        if (hasLayer(map, layerId)) {
          map.on('mouseenter', layerId, setPointerCursor);
          map.on('mouseleave', layerId, resetPointerCursor);
        }
      }

      map.on('click', handleMapClick);
    };
    const addReferenceLayersWithFreshToken = () => {
      void ensureTokenPairIsFresh().finally(addReferenceLayers);
    };

    if (map.isStyleLoaded()) {
      addReferenceLayersWithFreshToken();
    } else {
      map.once('load', addReferenceLayersWithFreshToken);
    }

    return () => {
      map.off('load', addReferenceLayersWithFreshToken);

      for (const layerId of [...layerIds].reverse()) {
        if (hasLayer(map, layerId)) {
          map.off('mouseenter', layerId, setPointerCursor);
          map.off('mouseleave', layerId, resetPointerCursor);
          map.removeLayer(layerId);
        }
      }

      map.off('click', handleMapClick);

      for (const layer of visibleReferenceLayers) {
        const sourceId = getSourceId(layer);

        if (hasSource(map, sourceId)) {
          map.removeSource(sourceId);
        }
      }
    };
  }, [map, navigateSidePanel, referenceLayers, viewId]);
};
