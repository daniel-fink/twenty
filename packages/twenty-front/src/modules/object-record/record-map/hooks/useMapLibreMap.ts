import {
  REACT_APP_MAP_VIEW_STYLE_URL,
  REACT_APP_SERVER_BASE_URL,
} from '~/config';

import { getTokenPair } from '@/apollo/utils/getTokenPair';
import { type RecordMapCamera } from '@/object-record/record-map/types/RecordMapCamera';
import { getInitialRecordMapCamera } from '@/object-record/record-map/utils/recordMapCamera';
import { useEffect, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';

import maplibregl from 'maplibre-gl';

export const useMapLibreMap = ({
  initialCamera,
  mapContainerElement,
  shouldRenderMap,
}: {
  initialCamera?: RecordMapCamera | null;
  mapContainerElement: HTMLDivElement | null;
  shouldRenderMap: boolean;
}) => {
  const [map, setMap] = useState<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!shouldRenderMap || !isDefined(mapContainerElement)) {
      return;
    }

    const camera = getInitialRecordMapCamera(initialCamera);

    const mapInstance = new maplibregl.Map({
      container: mapContainerElement,
      style: REACT_APP_MAP_VIEW_STYLE_URL,
      bearing: camera.bearing,
      center: [camera.longitude, camera.latitude],
      pitch: camera.pitch,
      zoom: camera.zoom,
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
  }, [initialCamera, mapContainerElement, shouldRenderMap]);

  return { map };
};
