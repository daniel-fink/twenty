import { REACT_APP_SERVER_BASE_URL } from '~/config';

import { ensureTokenPairIsFresh } from '@/apollo/utils/ensureTokenPairIsFresh';
import { RECORD_MAP_LAYER_COLORS } from '@/object-record/record-map/constants/record-map-layer-style.constants';
import { RECORD_MAP_VECTOR_TILE_LAYER } from '@/object-record/record-map/constants/record-map-vector-tile-layer.constants';
import { type RecordMapTileJsonResponse } from '@/object-record/record-map/hooks/useMapTileMetadata';
import {
  type RecordMapFeaturePickerItem,
  type RecordMapContributedFeaturePickerItem,
  type RecordMapRecordFeaturePickerState,
} from '@/object-record/record-map/types/RecordMapRecordFeaturePicker';
import { type RecordMapRenderedContributionLayer } from '@/object-record/record-map/types/RecordMapContribution';
import { type RecordMapPoint } from '@/object-record/record-map/types/RecordMapPoint';
import { getRecordMapContributedFeaturePickerItems } from '@/object-record/record-map/utils/getRecordMapContributedFeaturePickerItems';
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

const MAP_FEATURE_PICKER_QUERY_RADIUS = 8;
const MAP_ADDRESS_MARKER_PICKER_RADIUS = 12;

export const useRecordMapVectorTileLayers = ({
  areAddressMarkersRendered,
  map,
  objectNameSingular,
  onContributedFeatureClick,
  onFeatureClick,
  recordMapPoints,
  renderedContributionLayers,
  tileJson,
  tileSourceFilter,
  tileSourceViewId,
}: {
  areAddressMarkersRendered: boolean;
  map: maplibregl.Map | null;
  objectNameSingular?: string;
  onContributedFeatureClick: (
    item: RecordMapContributedFeaturePickerItem,
  ) => void;
  onFeatureClick: (recordId: string) => void;
  recordMapPoints: RecordMapPoint[];
  renderedContributionLayers: RecordMapRenderedContributionLayer[];
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
    (item: RecordMapFeaturePickerItem) => {
      setFeaturePicker(null);
      if (item.type === 'record') {
        onFeatureClick(item.recordId);

        return;
      }

      onContributedFeatureClick(item);
    },
    [onContributedFeatureClick, onFeatureClick],
  );

  const getRecordPickerItemsAtPoint = useCallback(
    (point: maplibregl.Point) => {
      if (!isDefined(map)) {
        return [];
      }

      const recordLayerIds = RECORD_MAP_VECTOR_TILE_LAYER.layerIds.filter(
        (layerId) => hasLayer(map, layerId),
      );
      const features =
        recordLayerIds.length > 0
          ? map.queryRenderedFeatures(
              [
                [
                  point.x - MAP_FEATURE_PICKER_QUERY_RADIUS,
                  point.y - MAP_FEATURE_PICKER_QUERY_RADIUS,
                ],
                [
                  point.x + MAP_FEATURE_PICKER_QUERY_RADIUS,
                  point.y + MAP_FEATURE_PICKER_QUERY_RADIUS,
                ],
              ],
              {
                layers: recordLayerIds,
              },
            )
          : [];

      return getRecordMapRecordFeaturePickerItems({
        features,
        objectNameSingular,
      });
    },
    [map, objectNameSingular],
  );

  const getAddressMarkerPickerItemsAtPoint = useCallback(
    (point: maplibregl.Point) => {
      if (!isDefined(map) || !areAddressMarkersRendered) {
        return [];
      }

      return recordMapPoints
        .filter((recordMapPoint) => {
          const markerPoint = map.project([
            recordMapPoint.longitude,
            recordMapPoint.latitude,
          ]);

          return (
            Math.abs(markerPoint.x - point.x) <=
              MAP_ADDRESS_MARKER_PICKER_RADIUS &&
            Math.abs(markerPoint.y - point.y) <=
              MAP_ADDRESS_MARKER_PICKER_RADIUS
          );
        })
        .map(
          (recordMapPoint): RecordMapFeaturePickerItem => ({
            recordId: recordMapPoint.record.id,
            swatchColor: RECORD_MAP_LAYER_COLORS.blue,
            title:
              recordMapPoint.record.name ??
              recordMapPoint.record.displayName ??
              (isDefined(objectNameSingular)
                ? `${objectNameSingular} record`
                : 'Record'),
            type: 'record',
          }),
        );
    },
    [areAddressMarkersRendered, map, objectNameSingular, recordMapPoints],
  );

  const getContributedPickerItemsAtPoint = useCallback(
    (point: maplibregl.Point) => {
      if (!isDefined(map)) {
        return [];
      }

      const contributedLayerIds = renderedContributionLayers.flatMap(
        (renderedLayer) =>
          renderedLayer.hitLayerIds.filter((layerId) => hasLayer(map, layerId)),
      );
      const contributedFeatures =
        contributedLayerIds.length > 0
          ? map.queryRenderedFeatures(
              [
                [
                  point.x - MAP_FEATURE_PICKER_QUERY_RADIUS,
                  point.y - MAP_FEATURE_PICKER_QUERY_RADIUS,
                ],
                [
                  point.x + MAP_FEATURE_PICKER_QUERY_RADIUS,
                  point.y + MAP_FEATURE_PICKER_QUERY_RADIUS,
                ],
              ],
              {
                layers: contributedLayerIds,
              },
            )
          : [];

      return getRecordMapContributedFeaturePickerItems({
        features: contributedFeatures,
        renderedContributionLayers,
      });
    },
    [map, renderedContributionLayers],
  );

  const openPickerItems = useCallback(
    ({
      items,
      point,
    }: {
      items: RecordMapFeaturePickerItem[];
      point: maplibregl.Point;
    }) => {
      if (items.length === 0) {
        setFeaturePicker(null);

        return;
      }

      if (items.length === 1) {
        const firstPickerItem = items[0];

        if (!isDefined(firstPickerItem)) {
          return;
        }

        setFeaturePicker(null);
        if (firstPickerItem.type === 'record') {
          onFeatureClick(firstPickerItem.recordId);
        } else {
          onContributedFeatureClick(firstPickerItem);
        }

        return;
      }

      setFeaturePicker({
        items,
        position: {
          x: point.x,
          y: point.y,
        },
      });
    },
    [onContributedFeatureClick, onFeatureClick],
  );

  const openFeaturePickerAtPoint = useCallback(
    (point: maplibregl.Point) => {
      openPickerItems({
        items: [
          ...getRecordPickerItemsAtPoint(point),
          ...getAddressMarkerPickerItemsAtPoint(point),
          ...getContributedPickerItemsAtPoint(point),
        ],
        point,
      });
    },
    [
      getAddressMarkerPickerItemsAtPoint,
      getContributedPickerItemsAtPoint,
      getRecordPickerItemsAtPoint,
      openPickerItems,
    ],
  );

  useEffect(() => {
    if (!isDefined(map)) {
      return;
    }

    const hasNativeTileSource =
      isDefined(tileSourceViewId) && tileJson !== null;
    const tileUrl = hasNativeTileSource
      ? `${REACT_APP_SERVER_BASE_URL}/rest/map/views/${tileSourceViewId}/tiles/{z}/{x}/{y}.mvt${
          tileSourceFilter === '{}'
            ? ''
            : `?filter=${encodeURIComponent(tileSourceFilter)}`
        }`
      : null;
    const handleMapClick = (event: maplibregl.MapMouseEvent) => {
      openFeaturePickerAtPoint(event.point);
    };
    const setPointerCursor = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const resetPointerCursor = () => {
      map.getCanvas().style.cursor = '';
    };

    const bindRecordLayerInteractions = () => {
      RECORD_MAP_VECTOR_TILE_LAYER.layerIds.forEach((layerId) => {
        if (hasLayer(map, layerId)) {
          map.on('mouseenter', layerId, setPointerCursor);
          map.on('mouseleave', layerId, resetPointerCursor);
        }
      });
    };

    const addTileLayers = () => {
      if (!hasNativeTileSource || tileUrl === null) {
        return;
      }

      if (!isDefined(map.getSource(RECORD_MAP_VECTOR_TILE_LAYER.sourceId))) {
        map.addSource(RECORD_MAP_VECTOR_TILE_LAYER.sourceId, {
          type: 'vector',
          tiles: [tileUrl],
          minzoom: tileJson.minzoom,
          maxzoom: tileJson.maxzoom,
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
      }

      bindRecordLayerInteractions();
    };
    const addTileLayersWithFreshToken = () => {
      void ensureTokenPairIsFresh().finally(addTileLayers);
    };

    map.on('click', handleMapClick);

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
    openFeaturePickerAtPoint,
    tileJson,
    tileSourceFilter,
    tileSourceViewId,
  ]);

  return {
    closeFeaturePicker,
    featurePicker,
    openFeaturePickerAtPoint,
    openRecordFeature,
  };
};
