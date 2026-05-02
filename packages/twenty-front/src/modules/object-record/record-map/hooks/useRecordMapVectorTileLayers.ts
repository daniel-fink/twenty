import { REACT_APP_SERVER_BASE_URL } from '~/config';

import { ensureTokenPairIsFresh } from '@/apollo/utils/ensureTokenPairIsFresh';
import { RECORD_MAP_LAYER_COLORS } from '@/object-record/record-map/constants/record-map-layer-style.constants';
import { type RecordMapTileJsonResponse } from '@/object-record/record-map/hooks/useMapTileMetadata';
import { useEffect } from 'react';
import { isDefined } from 'twenty-shared/utils';

import type maplibregl from 'maplibre-gl';

const RECORD_TILE_SOURCE_ID = 'record-map-vector-tiles';
const RECORD_TILE_SOURCE_LAYER = 'records';
const RECORD_TILE_FILL_LAYER_ID = 'record-map-polygons-fill';
const RECORD_TILE_LINE_LAYER_ID = 'record-map-polygons-line';
const RECORD_TILE_POINT_LAYER_ID = 'record-map-points';
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
  onFeatureClick,
  tileJson,
  tileSourceFilter,
  tileSourceViewId,
}: {
  map: maplibregl.Map | null;
  onFeatureClick: (recordId: string) => void;
  tileJson: RecordMapTileJsonResponse | null;
  tileSourceFilter: string;
  tileSourceViewId?: string;
}) => {
  useEffect(() => {
    if (!isDefined(map) || !isDefined(tileSourceViewId) || tileJson === null) {
      return;
    }

    const loadedTileJson = tileJson;
    const tileFilterQuery =
      tileSourceFilter === '{}'
        ? ''
        : `?filter=${encodeURIComponent(tileSourceFilter)}`;
    const tileUrl = `${REACT_APP_SERVER_BASE_URL}/rest/map/views/${tileSourceViewId}/tiles/{z}/{x}/{y}.mvt${tileFilterQuery}`;
    const layerIds = [
      RECORD_TILE_FILL_LAYER_ID,
      RECORD_TILE_LINE_LAYER_ID,
      RECORD_TILE_POINT_LAYER_ID,
    ];
    const handleFeatureClick = (event: maplibregl.MapLayerMouseEvent) => {
      const recordId = event.features?.[0]?.properties?.id;

      if (typeof recordId === 'string') {
        onFeatureClick(recordId);
      }
    };
    const setPointerCursor = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const resetPointerCursor = () => {
      map.getCanvas().style.cursor = '';
    };

    const addTileLayers = () => {
      if (isDefined(map.getSource(RECORD_TILE_SOURCE_ID))) {
        return;
      }

      map.addSource(RECORD_TILE_SOURCE_ID, {
        type: 'vector',
        tiles: [tileUrl],
        minzoom: loadedTileJson.minzoom,
        maxzoom: loadedTileJson.maxzoom,
      });

      map.addLayer({
        id: RECORD_TILE_FILL_LAYER_ID,
        type: 'fill',
        source: RECORD_TILE_SOURCE_ID,
        'source-layer': RECORD_TILE_SOURCE_LAYER,
        filter: RECORD_TILE_POLYGON_FILTER,
        paint: {
          'fill-color': RECORD_MAP_LAYER_COLORS.blue,
          'fill-opacity': 0.24,
        },
      });

      map.addLayer({
        id: RECORD_TILE_LINE_LAYER_ID,
        type: 'line',
        source: RECORD_TILE_SOURCE_ID,
        'source-layer': RECORD_TILE_SOURCE_LAYER,
        filter: RECORD_TILE_LINE_FILTER,
        paint: {
          'line-color': RECORD_MAP_LAYER_COLORS.blue,
          'line-width': 1.4,
        },
      });

      map.addLayer({
        id: RECORD_TILE_POINT_LAYER_ID,
        type: 'circle',
        source: RECORD_TILE_SOURCE_ID,
        'source-layer': RECORD_TILE_SOURCE_LAYER,
        filter: RECORD_TILE_POINT_FILTER,
        paint: {
          'circle-color': RECORD_MAP_LAYER_COLORS.blue,
          'circle-radius': 5,
          'circle-stroke-color': RECORD_MAP_LAYER_COLORS.white,
          'circle-stroke-width': 1.5,
        },
      });

      layerIds.forEach((layerId) => {
        map.on('click', layerId, handleFeatureClick);
        map.on('mouseenter', layerId, setPointerCursor);
        map.on('mouseleave', layerId, resetPointerCursor);
      });
    };
    const addTileLayersWithFreshToken = () => {
      void ensureTokenPairIsFresh().finally(addTileLayers);
    };

    if (map.isStyleLoaded()) {
      addTileLayersWithFreshToken();
    } else {
      map.once('load', addTileLayersWithFreshToken);
    }

    return () => {
      map.off('load', addTileLayersWithFreshToken);

      layerIds.forEach((layerId) => {
        if (hasLayer(map, layerId)) {
          map.off('click', layerId, handleFeatureClick);
          map.off('mouseenter', layerId, setPointerCursor);
          map.off('mouseleave', layerId, resetPointerCursor);
          map.removeLayer(layerId);
        }
      });

      if (hasSource(map, RECORD_TILE_SOURCE_ID)) {
        map.removeSource(RECORD_TILE_SOURCE_ID);
      }
    };
  }, [map, onFeatureClick, tileJson, tileSourceFilter, tileSourceViewId]);
};
