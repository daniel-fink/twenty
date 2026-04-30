import { REACT_APP_MAP_VIEW_STYLE_URL } from '~/config';

import { useOpenRecordFromIndexView } from '@/object-record/record-index/hooks/useOpenRecordFromIndexView';
import { type RecordMapPoint } from '@/object-record/record-map/types/RecordMapPoint';
import { styled } from '@linaria/react';
import { useEffect, useMemo, useRef } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import maplibregl, { type Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

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

const buildMarkerElement = () => {
  const markerElement = document.createElement('button');

  markerElement.type = 'button';
  markerElement.style.background = themeCssVariables.color.blue;
  markerElement.style.border = '2px solid #fff';
  markerElement.style.borderRadius = '50%';
  markerElement.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.28)';
  markerElement.style.cursor = 'pointer';
  markerElement.style.height = '18px';
  markerElement.style.padding = '0';
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
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRefs = useRef<Marker[]>([]);
  const { openRecordFromIndexView } = useOpenRecordFromIndexView();

  const hasMapStyle = REACT_APP_MAP_VIEW_STYLE_URL !== '';

  const center = useMemo(() => {
    const firstPoint = recordMapPoints[0];

    if (!isDefined(firstPoint)) {
      return { latitude: 20, longitude: 0 };
    }

    return firstPoint;
  }, [recordMapPoints]);

  useEffect(() => {
    if (!hasMapStyle || !isDefined(mapContainerRef.current)) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: REACT_APP_MAP_VIEW_STYLE_URL,
      center: [center.longitude, center.latitude],
      zoom: recordMapPoints.length === 0 ? 1.4 : 10,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
    mapRef.current = map;

    return () => {
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [center.latitude, center.longitude, hasMapStyle, recordMapPoints.length]);

  useEffect(() => {
    const map = mapRef.current;

    if (!isDefined(map)) {
      return;
    }

    markerRefs.current.forEach((marker) => marker.remove());
    markerRefs.current = [];

    recordMapPoints.forEach((point) => {
      const markerElement = buildMarkerElement();

      markerElement.addEventListener('click', () => {
        openRecordFromIndexView({ recordId: point.record.id });
      });

      const marker = new maplibregl.Marker({ element: markerElement })
        .setLngLat([point.longitude, point.latitude])
        .addTo(map);

      markerRefs.current.push(marker);
    });

    const firstPoint = recordMapPoints[0];

    if (recordMapPoints.length === 1 && isDefined(firstPoint)) {
      map.flyTo({
        center: [firstPoint.longitude, firstPoint.latitude],
        zoom: 12,
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
  }, [openRecordFromIndexView, recordMapPoints]);

  if (!hasMapStyle) {
    return (
      <StyledContainer>
        <StyledEmptyState>Map style is not configured.</StyledEmptyState>
      </StyledContainer>
    );
  }

  if (!loading && recordMapPoints.length === 0) {
    return (
      <StyledContainer>
        <StyledEmptyState>No records with coordinates to map.</StyledEmptyState>
      </StyledContainer>
    );
  }

  return (
    <StyledContainer>
      <StyledMapCanvas ref={mapContainerRef} />
    </StyledContainer>
  );
};
