import { REACT_APP_MAP_VIEW_STYLE_URL } from '~/config';

import { useOpenRecordFromIndexView } from '@/object-record/record-index/hooks/useOpenRecordFromIndexView';
import { type RecordMapPoint } from '@/object-record/record-map/types/RecordMapPoint';
import { styled } from '@linaria/react';
import { useEffect, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const DEFAULT_MAP_CENTER = { latitude: 20, longitude: 0 };
const DEFAULT_MAP_ZOOM = 1.4;
const SINGLE_POINT_MAP_ZOOM = 12;

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
}: {
  loading: boolean;
  recordMapPoints: RecordMapPoint[];
}) => {
  const [mapContainerElement, setMapContainerElement] =
    useState<HTMLDivElement | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const { openRecordFromIndexView } = useOpenRecordFromIndexView();

  const hasMapStyle = REACT_APP_MAP_VIEW_STYLE_URL !== '';
  const shouldRenderMap =
    hasMapStyle && (loading || recordMapPoints.length > 0);

  useEffect(() => {
    if (!shouldRenderMap || !isDefined(mapContainerElement)) {
      return;
    }

    const mapInstance = new maplibregl.Map({
      container: mapContainerElement,
      style: REACT_APP_MAP_VIEW_STYLE_URL,
      center: [DEFAULT_MAP_CENTER.longitude, DEFAULT_MAP_CENTER.latitude],
      zoom: DEFAULT_MAP_ZOOM,
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
    if (!isDefined(map)) {
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
  }, [map, openRecordFromIndexView, recordMapPoints]);

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
    </StyledContainer>
  );
};
