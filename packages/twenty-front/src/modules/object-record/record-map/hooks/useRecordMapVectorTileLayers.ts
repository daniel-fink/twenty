import { REACT_APP_SERVER_BASE_URL } from '~/config';

import { ensureTokenPairIsFresh } from '@/apollo/utils/ensureTokenPairIsFresh';
import { RECORD_MAP_LAYER_COLORS } from '@/object-record/record-map/constants/record-map-layer-style.constants';
import { RECORD_MAP_VECTOR_TILE_LAYER } from '@/object-record/record-map/constants/record-map-vector-tile-layer.constants';
import { type RecordMapTileJsonResponse } from '@/object-record/record-map/hooks/useMapTileMetadata';
import {
  type RecordMapRecordFeaturePickerItem,
  type RecordMapRecordFeaturePickerState,
} from '@/object-record/record-map/types/RecordMapRecordFeaturePicker';
import { getRecordMapRecordFeaturePickerItems } from '@/object-record/record-map/utils/getRecordMapRecordFeaturePickerItems';
import { useCallback, useEffect, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';

import type maplibregl from 'maplibre-gl';

const RECORD_TILE_POLYGON_FILTER: maplibregl.FilterSpecification = [
  '==',
  ['geometry-type'],
  'Polygon',
];
const RECORD_TILE_LINE_FILTER: maplibregl.FilterSpecification = [
  '==',
  ['geometry-type'],
  'LineString',
];
const RECORD_TILE_POINT_FILTER: maplibregl.FilterSpecification = [
  '==',
  ['geometry-type'],
  'Point',
];

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

export const useRecordMapVectorTileLayers = ({
  map,
  objectNameSingular,
  onFeatureClick,
  tileJson,
  tileSourceFilter,
  tileSourceViewId,
}: {
  map: maplibregl.Map | null;
  objectNameSingular?: string;
  onFeatureClick: (recordId: string) => void;
  tileJson: RecordMapTileJsonResponse | null;
  tileSourceFilter: string;
  tileSourceViewId?: string;
}) => {
  const [featurePicker, setFeaturePicker] =
    useState<RecordMapRecordFeaturePickerState | null>(null);

  const closeFeaturePicker = useCallback(() => {
    setFeaturePicker(null);
  }, []);

  const openRecordFeature = useCallback(
    (item: RecordMapRecordFeaturePickerItem) => {
      setFeaturePicker(null);
      onFeatureClick(item.recordId);
    },
    [onFeatureClick],
  );

  useEffect(() => {
    if (!isDefined(map) || !isDefined(tileSourceViewId) || tileJson === null) {
      return;
    }

    setFeaturePicker(null);

    const loadedTileJson = tileJson;
    const tileFilterQuery =
      tileSourceFilter === '{}'
        ? ''
        : `?filter=${encodeURIComponent(tileSourceFilter)}`;
    const tileUrl = `${REACT_APP_SERVER_BASE_URL}/rest/map/views/${tileSourceViewId}/tiles/{z}/{x}/{y}.mvt${tileFilterQuery}`;
    const handleMapClick = (event: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(
        [
          [event.point.x - 8, event.point.y - 8],
          [event.point.x + 8, event.point.y + 8],
        ],
        {
          layers: [...RECORD_MAP_VECTOR_TILE_LAYER.layerIds],
        },
      );
      const pickerItems = getRecordMapRecordFeaturePickerItems({
        features,
        objectNameSingular,
      });

      if (pickerItems.length === 0) {
        setFeaturePicker(null);

        return;
      }

      if (pickerItems.length === 1) {
        const firstPickerItem = pickerItems[0];

        if (!isDefined(firstPickerItem)) {
          return;
        }

        setFeaturePicker(null);
        onFeatureClick(firstPickerItem.recordId);

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

    const addTileLayers = () => {
      if (isDefined(map.getSource(RECORD_MAP_VECTOR_TILE_LAYER.sourceId))) {
        return;
      }

      map.addSource(RECORD_MAP_VECTOR_TILE_LAYER.sourceId, {
        type: 'vector',
        tiles: [tileUrl],
        minzoom: loadedTileJson.minzoom,
        maxzoom: loadedTileJson.maxzoom,
      });

      map.addLayer({
        id: RECORD_MAP_VECTOR_TILE_LAYER.fillLayerId,
        type: 'fill',
        source: RECORD_MAP_VECTOR_TILE_LAYER.sourceId,
        'source-layer': RECORD_MAP_VECTOR_TILE_LAYER.sourceLayer,
        filter: RECORD_TILE_POLYGON_FILTER,
        paint: {
          'fill-color': RECORD_MAP_LAYER_COLORS.blue,
          'fill-opacity': 0.24,
        },
      });

      map.addLayer({
        id: RECORD_MAP_VECTOR_TILE_LAYER.lineLayerId,
        type: 'line',
        source: RECORD_MAP_VECTOR_TILE_LAYER.sourceId,
        'source-layer': RECORD_MAP_VECTOR_TILE_LAYER.sourceLayer,
        filter: RECORD_TILE_LINE_FILTER,
        paint: {
          'line-color': RECORD_MAP_LAYER_COLORS.blue,
          'line-width': 1.4,
        },
      });

      map.addLayer({
        id: RECORD_MAP_VECTOR_TILE_LAYER.pointLayerId,
        type: 'circle',
        source: RECORD_MAP_VECTOR_TILE_LAYER.sourceId,
        'source-layer': RECORD_MAP_VECTOR_TILE_LAYER.sourceLayer,
        filter: RECORD_TILE_POINT_FILTER,
        paint: {
          'circle-color': RECORD_MAP_LAYER_COLORS.blue,
          'circle-radius': 5,
          'circle-stroke-color': RECORD_MAP_LAYER_COLORS.white,
          'circle-stroke-width': 1.5,
        },
      });

      RECORD_MAP_VECTOR_TILE_LAYER.layerIds.forEach((layerId) => {
        map.on('mouseenter', layerId, setPointerCursor);
        map.on('mouseleave', layerId, resetPointerCursor);
      });
      map.on('click', handleMapClick);
    };
    const addTileLayersWithFreshToken = () => {
      void ensureTokenPairIsFresh().finally(addTileLayers);
    };

    if (map.isStyleLoaded()) {
      addTileLayersWithFreshToken();
    } else {
      map.once('load', addTileLayersWithFreshToken);
    }

    const closePickerOnMapChange = () => {
      setFeaturePicker(null);
    };

    map.on('dragstart', closePickerOnMapChange);
    map.on('movestart', closePickerOnMapChange);
    map.on('zoomstart', closePickerOnMapChange);

    return () => {
      map.off('load', addTileLayersWithFreshToken);
      map.off('click', handleMapClick);
      map.off('dragstart', closePickerOnMapChange);
      map.off('movestart', closePickerOnMapChange);
      map.off('zoomstart', closePickerOnMapChange);

      RECORD_MAP_VECTOR_TILE_LAYER.layerIds.forEach((layerId) => {
        if (hasLayer(map, layerId)) {
          map.off('mouseenter', layerId, setPointerCursor);
          map.off('mouseleave', layerId, resetPointerCursor);
          map.removeLayer(layerId);
        }
      });

      if (hasSource(map, RECORD_MAP_VECTOR_TILE_LAYER.sourceId)) {
        map.removeSource(RECORD_MAP_VECTOR_TILE_LAYER.sourceId);
      }
    };
  }, [
    map,
    objectNameSingular,
    onFeatureClick,
    tileJson,
    tileSourceFilter,
    tileSourceViewId,
  ]);

  return {
    closeFeaturePicker,
    featurePicker,
    openRecordFeature,
  };
};
