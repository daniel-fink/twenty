import { REACT_APP_SERVER_BASE_URL } from '~/config';

import { useNavigateSidePanel } from '@/side-panel/hooks/useNavigateSidePanel';
import { RECORD_MAP_LAYER_COLORS } from '@/object-record/record-map/constants/record-map-layer-style.constants';
import {
  type RecordMapReferenceFeaturePickerItem,
  type RecordMapReferenceFeaturePickerState,
  type RecordMapReferenceLayer,
  type RecordMapReferenceLayerStyle,
} from '@/object-record/record-map/types/RecordMapReferenceLayer';
import { getRecordMapReferenceFeaturePickerItems } from '@/object-record/record-map/utils/getRecordMapReferenceFeaturePickerItems';
import {
  getRecordMapReferenceOutlineLayerId,
  getRecordMapReferenceOutlineSourceLayerKey,
  getRecordMapReferencePrimaryLayerId,
  getRecordMapReferenceSourceId,
} from '@/object-record/record-map/utils/getRecordMapReferenceLayerMapIds';
import { ensureTokenPairIsFresh } from '@/apollo/utils/ensureTokenPairIsFresh';
import { useCallback, useEffect, useState } from 'react';
import { SidePanelPages } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { IconMap } from 'twenty-ui/display';

import type maplibregl from 'maplibre-gl';

const RECORD_TILE_FILL_LAYER_ID = 'record-map-polygons-fill';
const REFERENCE_LAYER_CLICK_RADIUS_PIXELS = 8;

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
        id: getRecordMapReferencePrimaryLayerId(layer),
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
        id: getRecordMapReferenceOutlineLayerId(layer),
        type: 'line',
        source: sourceId,
        'source-layer': getRecordMapReferenceOutlineSourceLayerKey(layer),
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
        id: getRecordMapReferencePrimaryLayerId(layer),
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
      id: getRecordMapReferencePrimaryLayerId(layer),
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
  const [featurePicker, setFeaturePicker] =
    useState<RecordMapReferenceFeaturePickerState | null>(null);

  const closeFeaturePicker = useCallback(() => {
    setFeaturePicker(null);
  }, []);

  const openReferenceFeature = useCallback(
    (feature: RecordMapReferenceFeaturePickerItem) => {
      if (!isDefined(viewId)) {
        return;
      }

      setFeaturePicker(null);

      navigateSidePanel({
        page: SidePanelPages.ViewMapReferenceFeature,
        pageIcon: IconMap,
        pageId: encodeURIComponent(
          JSON.stringify({
            selectedFeatureValue: feature.selectedFeatureValue,
            layerId: feature.layerId,
            viewId,
          }),
        ),
        pageTitle: feature.title,
      });
    },
    [navigateSidePanel, viewId],
  );

  useEffect(() => {
    if (!isDefined(map) || !isDefined(viewId)) {
      setFeaturePicker(null);
      return;
    }

    setFeaturePicker(null);

    const visibleReferenceLayers = referenceLayers.filter(
      (layer) => layer.attachment.isVisible,
    );

    if (visibleReferenceLayers.length === 0) {
      setFeaturePicker(null);
      return;
    }

    const layerIds = visibleReferenceLayers.flatMap((layer) => [
      getRecordMapReferencePrimaryLayerId(layer),
      getRecordMapReferenceOutlineLayerId(layer),
    ]);
    const getRenderedReferenceLayerIds = () =>
      layerIds.filter((layerId) => hasLayer(map, layerId));
    const handleMapClick = (event: maplibregl.MapMouseEvent) => {
      const renderedLayerIds = getRenderedReferenceLayerIds();

      if (renderedLayerIds.length === 0) {
        setFeaturePicker(null);
        return;
      }

      const pickerItems = getRecordMapReferenceFeaturePickerItems({
        features: map.queryRenderedFeatures(
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
        referenceLayers: visibleReferenceLayers,
      });

      if (pickerItems.length === 0) {
        setFeaturePicker(null);
        return;
      }

      if (pickerItems.length === 1 && isDefined(pickerItems[0])) {
        openReferenceFeature(pickerItems[0]);
        return;
      }

      setFeaturePicker({
        items: pickerItems,
        position: {
          x: event.point.x,
          y: event.point.y,
        },
      });
    };
    const setPointerCursor = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const resetPointerCursor = () => {
      map.getCanvas().style.cursor = '';
    };
    const closeFeaturePickerOnMapMove = () => {
      setFeaturePicker(null);
    };
    const addReferenceLayers = () => {
      for (const layer of visibleReferenceLayers) {
        const sourceId = getRecordMapReferenceSourceId(layer);

        if (!hasSource(map, sourceId)) {
          map.addSource(sourceId, {
            attribution: layer.attribution ?? undefined,
            type: 'vector',
            tiles: [
              `${REACT_APP_SERVER_BASE_URL}/rest/map/views/${viewId}/reference-layers/${layer.id}/tiles/{z}/{x}/{y}.mvt`,
            ],
            minzoom: layer.tile.minZoom,
            maxzoom: layer.tile.maxZoom,
          });
        }

        if (!hasLayer(map, getRecordMapReferencePrimaryLayerId(layer))) {
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
      map.on('dragstart', closeFeaturePickerOnMapMove);
      map.on('movestart', closeFeaturePickerOnMapMove);
      map.on('zoomstart', closeFeaturePickerOnMapMove);
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
      map.off('dragstart', closeFeaturePickerOnMapMove);
      map.off('movestart', closeFeaturePickerOnMapMove);
      map.off('zoomstart', closeFeaturePickerOnMapMove);

      for (const layer of visibleReferenceLayers) {
        const sourceId = getRecordMapReferenceSourceId(layer);

        if (hasSource(map, sourceId)) {
          map.removeSource(sourceId);
        }
      }
    };
  }, [map, openReferenceFeature, referenceLayers, viewId]);

  return {
    closeFeaturePicker,
    featurePicker,
    openReferenceFeature,
  };
};
