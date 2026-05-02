import {
  REACT_APP_MAP_VIEW_STYLE_URL,
  REACT_APP_SERVER_BASE_URL,
} from '~/config';

import { getTokenPair } from '@/apollo/utils/getTokenPair';
import { useEffect, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';

import maplibregl from 'maplibre-gl';

const DEFAULT_MAP_CENTER = { latitude: 20, longitude: 0 };
const DEFAULT_MAP_ZOOM = 1.4;

export const useMapLibreMap = ({
  mapContainerElement,
  shouldRenderMap,
}: {
  mapContainerElement: HTMLDivElement | null;
  shouldRenderMap: boolean;
}) => {
  const [map, setMap] = useState<maplibregl.Map | null>(null);

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

  return { map };
};
