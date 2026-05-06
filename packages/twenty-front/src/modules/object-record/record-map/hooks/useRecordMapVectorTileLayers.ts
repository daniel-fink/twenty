import { REACT_APP_SERVER_BASE_URL } from '~/config';

import { ensureTokenPairIsFresh } from '@/apollo/utils/ensureTokenPairIsFresh';
import { RECORD_MAP_LAYER_COLORS } from '@/object-record/record-map/constants/record-map-layer-style.constants';
import { RECORD_MAP_VECTOR_TILE_LAYER } from '@/object-record/record-map/constants/record-map-vector-tile-layer.constants';
import { type RecordMapTileJsonResponse } from '@/object-record/record-map/hooks/useMapTileMetadata';
import {
  type RecordMapFeaturePickerItem,
  type RecordMapReferenceFeaturePickerItem,
  type RecordMapRecordFeaturePickerState,
} from '@/object-record/record-map/types/RecordMapRecordFeaturePicker';
import { type RecordMapRenderedReferenceLayer } from '@/object-record/record-map/types/RecordMapReferenceLayerContribution';
import { type RecordMapSelectedFeature } from '@/object-record/record-map/types/RecordMapSelectedFeature';
import { getRecordMapRecordFeaturePickerItems } from '@/object-record/record-map/utils/getRecordMapRecordFeaturePickerItems';
import { getRecordMapReferenceFeaturePickerItems } from '@/object-record/record-map/utils/getRecordMapReferenceFeaturePickerItems';
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

const RECORD_MAP_SELECTED_FEATURE_LAYER = {
  fillLayerId: 'record-map-selected-feature-fill',
  lineLayerId: 'record-map-selected-feature-line',
  pointLayerId: 'record-map-selected-feature-point',
} as const;

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
  isSidePanelOpened,
  objectNameSingular,
  onFeatureClick,
  onReferenceFeatureClick,
  renderedReferenceLayers,
  tileJson,
  tileSourceFilter,
  tileSourceViewId,
}: {
  map: maplibregl.Map | null;
  isSidePanelOpened: boolean;
  objectNameSingular?: string;
  onFeatureClick: (recordId: string) => void;
  onReferenceFeatureClick: (item: RecordMapReferenceFeaturePickerItem) => void;
  renderedReferenceLayers: RecordMapRenderedReferenceLayer[];
  tileJson: RecordMapTileJsonResponse | null;
  tileSourceFilter: string;
  tileSourceViewId?: string;
}) => {
  const [featurePicker, setFeaturePicker] =
    useState<RecordMapRecordFeaturePickerState | null>(null);
  const [selectedFeature, setSelectedFeature] =
    useState<RecordMapSelectedFeature | null>(null);

  const closeFeaturePicker = useCallback(() => {
    setFeaturePicker(null);
  }, []);

  const openRecordFeature = useCallback(
    (item: RecordMapFeaturePickerItem) => {
      setFeaturePicker(null);
      setSelectedFeature(item.selectedFeature);
      if (item.type === 'record') {
        onFeatureClick(item.recordId);

        return;
      }

      onReferenceFeatureClick(item);
    },
    [onFeatureClick, onReferenceFeatureClick],
  );

  useEffect(() => {
    setFeaturePicker(null);
    setSelectedFeature(null);
  }, [renderedReferenceLayers, tileSourceFilter, tileSourceViewId]);

  useEffect(() => {
    if (!isSidePanelOpened) {
      setSelectedFeature(null);
      setFeaturePicker(null);
    }
  }, [isSidePanelOpened]);

  useEffect(() => {
    if (!isDefined(map)) {
      return;
    }

    const clearSelectedFeature = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedFeature(null);
        setFeaturePicker(null);
      }
    };

    window.addEventListener('keydown', clearSelectedFeature);

    return () => {
      window.removeEventListener('keydown', clearSelectedFeature);
    };
  }, [map]);

  useEffect(() => {
    if (!isDefined(map)) {
      return;
    }

    const selectedLayerIds = [
      RECORD_MAP_SELECTED_FEATURE_LAYER.fillLayerId,
      RECORD_MAP_SELECTED_FEATURE_LAYER.lineLayerId,
      RECORD_MAP_SELECTED_FEATURE_LAYER.pointLayerId,
    ];
    const removeSelectedFeatureLayers = () => {
      for (const layerId of selectedLayerIds) {
        if (hasLayer(map, layerId)) {
          map.removeLayer(layerId);
        }
      }
    };
    const addSelectedFeatureLayers = () => {
      removeSelectedFeatureLayers();

      if (
        !isDefined(selectedFeature) ||
        !hasSource(map, selectedFeature.sourceId)
      ) {
        return;
      }

      const baseFilter = [
        '==',
        ['to-string', ['get', selectedFeature.featureIdProperty]],
        selectedFeature.featureId,
      ];
      const geometryFilter = (geometryType: string) =>
        [
          'all',
          baseFilter,
          ['==', ['geometry-type'], geometryType],
        ] as unknown as maplibregl.FilterSpecification;

      map.addLayer({
        id: RECORD_MAP_SELECTED_FEATURE_LAYER.fillLayerId,
        type: 'fill',
        source: selectedFeature.sourceId,
        'source-layer': selectedFeature.sourceLayer,
        filter: geometryFilter('Polygon'),
        paint: {
          'fill-color': selectedFeature.swatchColor,
          'fill-opacity': 0.32,
        },
      });
      map.addLayer({
        id: RECORD_MAP_SELECTED_FEATURE_LAYER.lineLayerId,
        type: 'line',
        source: selectedFeature.sourceId,
        'source-layer': selectedFeature.sourceLayer,
        filter: [
          'any',
          geometryFilter('Polygon'),
          geometryFilter('LineString'),
        ] as maplibregl.FilterSpecification,
        paint: {
          'line-color': selectedFeature.swatchColor,
          'line-opacity': 1,
          'line-width': 3,
        },
      });
      map.addLayer({
        id: RECORD_MAP_SELECTED_FEATURE_LAYER.pointLayerId,
        type: 'circle',
        source: selectedFeature.sourceId,
        'source-layer': selectedFeature.sourceLayer,
        filter: geometryFilter('Point'),
        paint: {
          'circle-color': selectedFeature.swatchColor,
          'circle-radius': 8,
          'circle-stroke-color': RECORD_MAP_LAYER_COLORS.white,
          'circle-stroke-width': 2,
        },
      });
    };

    if (map.isStyleLoaded()) {
      addSelectedFeatureLayers();
    } else {
      map.once('load', addSelectedFeatureLayers);
    }

    return () => {
      map.off('load', addSelectedFeatureLayers);
      removeSelectedFeatureLayers();
    };
  }, [map, selectedFeature]);

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
    const handleMapClick = (event: maplibregl.MapMouseEvent) => {
      const recordLayerIds = RECORD_MAP_VECTOR_TILE_LAYER.layerIds.filter(
        (layerId) => hasLayer(map, layerId),
      );
      const features =
        recordLayerIds.length > 0
          ? map.queryRenderedFeatures(
              [
                [event.point.x - 8, event.point.y - 8],
                [event.point.x + 8, event.point.y + 8],
              ],
              {
                layers: recordLayerIds,
              },
            )
          : [];
      const recordPickerItems = getRecordMapRecordFeaturePickerItems({
        features,
        objectNameSingular,
      });
      const referenceLayerIds = renderedReferenceLayers.flatMap(
        (renderedLayer) =>
          renderedLayer.layerIds.filter((layerId) => hasLayer(map, layerId)),
      );
      const referenceFeatures =
        referenceLayerIds.length > 0
          ? map.queryRenderedFeatures(
              [
                [event.point.x - 8, event.point.y - 8],
                [event.point.x + 8, event.point.y + 8],
              ],
              {
                layers: referenceLayerIds,
              },
            )
          : [];
      const referencePickerItems = getRecordMapReferenceFeaturePickerItems({
        features: referenceFeatures,
        renderedReferenceLayers,
      });
      const pickerItems = [...recordPickerItems, ...referencePickerItems];

      if (pickerItems.length === 0) {
        setFeaturePicker(null);
        setSelectedFeature(null);

        return;
      }

      if (pickerItems.length === 1) {
        const firstPickerItem = pickerItems[0];

        if (!isDefined(firstPickerItem)) {
          return;
        }

        openRecordFeature(firstPickerItem);

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
      if (!isDefined(map.getSource(RECORD_MAP_VECTOR_TILE_LAYER.sourceId))) {
        map.addSource(RECORD_MAP_VECTOR_TILE_LAYER.sourceId, {
          type: 'vector',
          tiles: [tileUrl],
          minzoom: loadedTileJson.minzoom,
          maxzoom: loadedTileJson.maxzoom,
        });
      }

      if (!hasLayer(map, RECORD_MAP_VECTOR_TILE_LAYER.fillLayerId)) {
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
      }

      if (!hasLayer(map, RECORD_MAP_VECTOR_TILE_LAYER.lineLayerId)) {
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
      }

      if (!hasLayer(map, RECORD_MAP_VECTOR_TILE_LAYER.pointLayerId)) {
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

      RECORD_MAP_VECTOR_TILE_LAYER.layerIds.forEach((layerId) => {
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

    const closePickerOnMapChange = () => {
      setFeaturePicker(null);
    };

    map.on('dragstart', closePickerOnMapChange);
    map.on('movestart', closePickerOnMapChange);
    map.on('zoomstart', closePickerOnMapChange);
    map.on('click', handleMapClick);

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
    isSidePanelOpened,
    objectNameSingular,
    onFeatureClick,
    onReferenceFeatureClick,
    openRecordFeature,
    renderedReferenceLayers,
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
