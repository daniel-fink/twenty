import { type RecordMapPoint } from '@/object-record/record-map/types/RecordMapPoint';
import { type RecordMapTileSource } from '@/object-record/record-map/types/RecordMapTileSource';
import { useEffect } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import maplibregl from 'maplibre-gl';

const SINGLE_POINT_MAP_ZOOM = 12;

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

export const useRecordMapAddressMarkers = ({
  map,
  onMarkerClick,
  onRecordClick,
  recordMapPoints,
  tileSource,
}: {
  map: maplibregl.Map | null;
  onMarkerClick?: (point: maplibregl.Point) => void;
  onRecordClick: (recordId: string) => void;
  recordMapPoints: RecordMapPoint[];
  tileSource?: RecordMapTileSource;
}) => {
  useEffect(() => {
    if (!isDefined(map) || isDefined(tileSource)) {
      return;
    }

    const markers = recordMapPoints.map((point) => {
      const recordName = point.record.name ?? point.record.displayName;
      const markerElement = buildMarkerElement(recordName);

      markerElement.addEventListener('click', (event) => {
        if (isDefined(onMarkerClick)) {
          event.stopPropagation();
          onMarkerClick(map.project([point.longitude, point.latitude]));

          return;
        }

        onRecordClick(point.record.id);
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
  }, [map, onMarkerClick, onRecordClick, recordMapPoints, tileSource]);
};
