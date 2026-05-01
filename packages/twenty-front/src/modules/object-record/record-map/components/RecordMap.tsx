import {
  REACT_APP_MAP_VIEW_STYLE_URL,
  REACT_APP_SERVER_BASE_URL,
} from '~/config';

import { getTokenPair } from '@/apollo/utils/getTokenPair';
import { useOpenRecordFromIndexView } from '@/object-record/record-index/hooks/useOpenRecordFromIndexView';
import {
  RECORD_MAP_LAYER_BLUE,
  RECORD_MAP_LAYER_WHITE,
} from '@/object-record/record-map/constants/record-map-layer-style.constants';
import { type RecordMapPoint } from '@/object-record/record-map/types/RecordMapPoint';
import {
  getPaddedRecordMapBounds,
  type RecordMapBounds,
} from '@/object-record/record-map/utils/getPaddedRecordMapBounds';
import { styled } from '@linaria/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { IconTarget } from 'twenty-ui/display';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const DEFAULT_MAP_CENTER = { latitude: 20, longitude: 0 };
const DEFAULT_MAP_ZOOM = 1.4;
const SINGLE_POINT_MAP_ZOOM = 12;
const RECORD_TILE_SOURCE_ID = 'record-map-vector-tiles';
const RECORD_TILE_SOURCE_LAYER = 'records';
const RECORD_TILE_FILL_LAYER_ID = 'record-map-polygons-fill';
const RECORD_TILE_LINE_LAYER_ID = 'record-map-polygons-line';
const RECORD_TILE_POINT_LAYER_ID = 'record-map-points';

type RecordMapTileSource = {
  viewId: string;
  filter?: Record<string, unknown>;
};

type RecordMapBoundsResponse = {
  bounds: RecordMapBounds | null;
  recordCount: number;
};

const StyledContainer = styled.div`
  background: ${themeCssVariables.color.gray10};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  box-sizing: border-box;
  height: 100%;
  min-height: 320px;
  overflow: hidden;
  position: relative;
  width: 100%;

  .maplibregl-ctrl-bottom-left,
  .maplibregl-ctrl-bottom-right {
    display: none;
  }
`;

const StyledMapCanvas = styled.div`
  height: 100%;
  width: 100%;
`;

const StyledMapControlContainer = styled.div`
  position: absolute;
  right: 10px;
  top: 88px;
  z-index: 1;
`;

const StyledMapControlButton = styled.button`
  align-items: center;
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.strong};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-shadow: ${themeCssVariables.boxShadow.light};
  color: ${themeCssVariables.font.color.tertiary};
  cursor: pointer;
  display: flex;
  height: 29px;
  justify-content: center;
  padding: 0;
  width: 29px;

  &:hover {
    background: ${themeCssVariables.background.transparent.lighter};
  }

  &:disabled {
    color: ${themeCssVariables.font.color.extraLight};
    cursor: not-allowed;
  }
`;

const StyledEmptyState = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  font-size: ${themeCssVariables.font.size.md};
  height: 100%;
  justify-content: center;
  padding: ${themeCssVariables.spacing[8]};
  text-align: center;
`;

const buildMarkerElement = (recordName?: string) => {
  const markerElement = document.createElement('button');
  const accessibleName = isDefined(recordName)
    ? `Open ${recordName}`
    : 'Open map record';

  markerElement.type = 'button';
  markerElement.setAttribute('aria-label', accessibleName);
  markerElement.style.background = themeCssVariables.color.blue;
  markerElement.style.border = `2px solid ${themeCssVariables.background.primary}`;
  markerElement.style.borderRadius = '50%';
  markerElement.style.boxShadow = themeCssVariables.boxShadow.strong;
  markerElement.style.cursor = 'pointer';
  markerElement.style.height = '18px';
  markerElement.style.padding = '0';
  markerElement.title = accessibleName;
  markerElement.style.width = '18px';

  return markerElement;
};

export const RecordMap = ({
  loading,
  recordMapPoints,
  tileSource,
}: {
  loading: boolean;
  recordMapPoints: RecordMapPoint[];
  tileSource?: RecordMapTileSource;
}) => {
  const [mapContainerElement, setMapContainerElement] =
    useState<HTMLDivElement | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [tileBounds, setTileBounds] = useState<RecordMapBoundsResponse | null>(
    null,
  );
  const hasAutoFitTileBoundsRef = useRef(false);
  const hasUserMovedTileMapRef = useRef(false);
  const isFittingTileBoundsRef = useRef(false);
  const { openRecordFromIndexView } = useOpenRecordFromIndexView();

  const hasMapStyle = REACT_APP_MAP_VIEW_STYLE_URL !== '';
  const shouldRenderMap =
    hasMapStyle &&
    (isDefined(tileSource) || loading || recordMapPoints.length > 0);
  const tileSourceViewId = tileSource?.viewId;
  const tileSourceFilter = JSON.stringify(tileSource?.filter ?? {});

  const fitMapToTileBounds = useCallback(() => {
    if (!isDefined(map) || !isDefined(tileBounds?.bounds)) {
      return;
    }

    isFittingTileBoundsRef.current = true;

    map.once('moveend', () => {
      isFittingTileBoundsRef.current = false;
    });
    window.setTimeout(() => {
      isFittingTileBoundsRef.current = false;
    }, 750);

    map.fitBounds(getPaddedRecordMapBounds(tileBounds.bounds), {
      padding: 64,
      maxZoom: 12,
      essential: true,
    });
  }, [map, tileBounds]);

  useEffect(() => {
    if (!shouldRenderMap || !isDefined(mapContainerElement)) {
      return;
    }

    const mapInstance = new maplibregl.Map({
      container: mapContainerElement,
      style: REACT_APP_MAP_VIEW_STYLE_URL,
      center: [DEFAULT_MAP_CENTER.longitude, DEFAULT_MAP_CENTER.latitude],
      zoom: DEFAULT_MAP_ZOOM,
      transformRequest: (url): maplibregl.RequestParameters => {
        if (!url.startsWith(REACT_APP_SERVER_BASE_URL)) {
          return { url };
        }

        const token = getTokenPair()?.accessOrWorkspaceAgnosticToken?.token;

        return {
          url,
          headers: token
            ? {
                authorization: `Bearer ${token}`,
              }
            : undefined,
        };
      },
    });

    mapInstance.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
    );
    setMap(mapInstance);

    return () => {
      setMap((currentMap) => (currentMap === mapInstance ? null : currentMap));
      mapInstance.remove();
    };
  }, [mapContainerElement, shouldRenderMap]);

  useEffect(() => {
    hasAutoFitTileBoundsRef.current = false;
    hasUserMovedTileMapRef.current = false;
  }, [tileSourceViewId]);

  useEffect(() => {
    hasAutoFitTileBoundsRef.current = false;
  }, [tileSourceFilter]);

  useEffect(() => {
    if (!isDefined(map) || !isDefined(tileSourceViewId)) {
      return;
    }

    const markUserMovedMap = () => {
      if (!isFittingTileBoundsRef.current) {
        hasUserMovedTileMapRef.current = true;
      }
    };

    map.on('dragstart', markUserMovedMap);
    map.on('zoomstart', markUserMovedMap);

    return () => {
      map.off('dragstart', markUserMovedMap);
      map.off('zoomstart', markUserMovedMap);
    };
  }, [map, tileSourceViewId]);

  useEffect(() => {
    if (!isDefined(map) || isDefined(tileSource)) {
      return;
    }

    const markers = recordMapPoints.map((point) => {
      const recordName = point.record.name ?? point.record.displayName;
      const markerElement = buildMarkerElement(recordName);

      markerElement.addEventListener('click', () => {
        openRecordFromIndexView({ recordId: point.record.id });
      });

      const marker = new maplibregl.Marker({ element: markerElement })
        .setLngLat([point.longitude, point.latitude])
        .addTo(map);

      return marker;
    });

    const firstPoint = recordMapPoints[0];

    if (recordMapPoints.length === 1 && isDefined(firstPoint)) {
      map.flyTo({
        center: [firstPoint.longitude, firstPoint.latitude],
        zoom: SINGLE_POINT_MAP_ZOOM,
        essential: true,
      });
    }

    if (recordMapPoints.length > 1) {
      const bounds = new maplibregl.LngLatBounds();

      recordMapPoints.forEach((point) => {
        bounds.extend([point.longitude, point.latitude]);
      });

      map.fitBounds(bounds, {
        padding: 64,
        maxZoom: 12,
      });
    }

    return () => {
      markers.forEach((marker) => marker.remove());
    };
  }, [map, openRecordFromIndexView, recordMapPoints, tileSource]);

  useEffect(() => {
    if (!isDefined(map) || !isDefined(tileSourceViewId)) {
      return;
    }

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
        openRecordFromIndexView({ recordId });
      }
    };
    const setPointerCursor = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const resetPointerCursor = () => {
      map.getCanvas().style.cursor = '';
    };
    const hasLayer = (layerId: string) => {
      try {
        return isDefined(map.getLayer(layerId));
      } catch {
        return false;
      }
    };
    const hasSource = (sourceId: string) => {
      try {
        return isDefined(map.getSource(sourceId));
      } catch {
        return false;
      }
    };
    const addTileLayers = () => {
      if (isDefined(map.getSource(RECORD_TILE_SOURCE_ID))) {
        return;
      }

      map.addSource(RECORD_TILE_SOURCE_ID, {
        type: 'vector',
        tiles: [tileUrl],
        minzoom: 0,
        maxzoom: 22,
      });

      map.addLayer({
        id: RECORD_TILE_FILL_LAYER_ID,
        type: 'fill',
        source: RECORD_TILE_SOURCE_ID,
        'source-layer': RECORD_TILE_SOURCE_LAYER,
        paint: {
          'fill-color': RECORD_MAP_LAYER_BLUE,
          'fill-opacity': 0.24,
        },
      });

      map.addLayer({
        id: RECORD_TILE_LINE_LAYER_ID,
        type: 'line',
        source: RECORD_TILE_SOURCE_ID,
        'source-layer': RECORD_TILE_SOURCE_LAYER,
        paint: {
          'line-color': RECORD_MAP_LAYER_BLUE,
          'line-width': 1.4,
        },
      });

      map.addLayer({
        id: RECORD_TILE_POINT_LAYER_ID,
        type: 'circle',
        source: RECORD_TILE_SOURCE_ID,
        'source-layer': RECORD_TILE_SOURCE_LAYER,
        paint: {
          'circle-color': RECORD_MAP_LAYER_BLUE,
          'circle-radius': 5,
          'circle-stroke-color': RECORD_MAP_LAYER_WHITE,
          'circle-stroke-width': 1.5,
        },
      });

      layerIds.forEach((layerId) => {
        map.on('click', layerId, handleFeatureClick);
        map.on('mouseenter', layerId, setPointerCursor);
        map.on('mouseleave', layerId, resetPointerCursor);
      });
    };

    if (map.isStyleLoaded()) {
      addTileLayers();
    } else {
      map.once('load', addTileLayers);
    }

    return () => {
      map.off('load', addTileLayers);

      layerIds.forEach((layerId) => {
        if (hasLayer(layerId)) {
          map.off('click', layerId, handleFeatureClick);
          map.off('mouseenter', layerId, setPointerCursor);
          map.off('mouseleave', layerId, resetPointerCursor);
          map.removeLayer(layerId);
        }
      });

      if (hasSource(RECORD_TILE_SOURCE_ID)) {
        map.removeSource(RECORD_TILE_SOURCE_ID);
      }
    };
  }, [map, openRecordFromIndexView, tileSourceFilter, tileSourceViewId]);

  useEffect(() => {
    if (!isDefined(tileSourceViewId)) {
      setTileBounds(null);

      return;
    }

    const abortController = new AbortController();
    const tileFilterQuery =
      tileSourceFilter === '{}'
        ? ''
        : `?filter=${encodeURIComponent(tileSourceFilter)}`;
    const boundsUrl = `${REACT_APP_SERVER_BASE_URL}/rest/map/views/${tileSourceViewId}/bounds${tileFilterQuery}`;
    const token = getTokenPair()?.accessOrWorkspaceAgnosticToken?.token;

    void fetch(boundsUrl, {
      headers: token
        ? {
            authorization: `Bearer ${token}`,
          }
        : undefined,
      signal: abortController.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to load map bounds');
        }

        return response.json() as Promise<RecordMapBoundsResponse>;
      })
      .then((boundsResponse) => {
        setTileBounds(boundsResponse);
      })
      .catch((error: Error) => {
        if (error.name === 'AbortError') {
          return;
        }

        setTileBounds(null);
      });

    return () => {
      abortController.abort();
    };
  }, [tileSourceFilter, tileSourceViewId]);

  useEffect(() => {
    if (
      !isDefined(tileBounds?.bounds) ||
      hasUserMovedTileMapRef.current ||
      hasAutoFitTileBoundsRef.current
    ) {
      return;
    }

    fitMapToTileBounds();
    hasAutoFitTileBoundsRef.current = true;
  }, [fitMapToTileBounds, tileBounds]);

  if (!hasMapStyle) {
    return (
      <StyledContainer>
        <StyledEmptyState>Map style is not configured.</StyledEmptyState>
      </StyledContainer>
    );
  }

  if (!shouldRenderMap) {
    return (
      <StyledContainer>
        <StyledEmptyState>No records with coordinates to map.</StyledEmptyState>
      </StyledContainer>
    );
  }

  return (
    <StyledContainer>
      <StyledMapCanvas ref={setMapContainerElement} />
      {isDefined(tileSource) && (
        <StyledMapControlContainer>
          <StyledMapControlButton
            aria-label="Zoom to objects"
            disabled={!isDefined(tileBounds?.bounds)}
            onClick={fitMapToTileBounds}
            title="Zoom to objects"
            type="button"
          >
            <IconTarget size={16} />
          </StyledMapControlButton>
        </StyledMapControlContainer>
      )}
    </StyledContainer>
  );
};
