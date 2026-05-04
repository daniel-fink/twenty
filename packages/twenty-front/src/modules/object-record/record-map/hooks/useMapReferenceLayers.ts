import { REACT_APP_SERVER_BASE_URL } from '~/config';

import { RECORD_MAP_REFERENCE_LAYERS_CHANGED } from '@/object-record/record-map/constants/record-map-reference-layer.constants';
import { fetchWithFreshToken } from '@/object-record/record-map/hooks/useMapTileMetadata';
import { type RecordMapReferenceLayer } from '@/object-record/record-map/types/RecordMapReferenceLayer';
import { useCallback, useEffect, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';

export const useMapReferenceLayers = ({ viewId }: { viewId?: string }) => {
  const [referenceLayers, setReferenceLayers] = useState<
    RecordMapReferenceLayer[]
  >([]);
  const [isLoadingReferenceLayers, setIsLoadingReferenceLayers] =
    useState(false);
  const [referenceLayersError, setReferenceLayersError] =
    useState<Error | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reloadReferenceLayers = useCallback(() => {
    setReloadToken((currentReloadToken) => currentReloadToken + 1);
  }, []);

  useEffect(() => {
    window.addEventListener(
      RECORD_MAP_REFERENCE_LAYERS_CHANGED,
      reloadReferenceLayers,
    );

    return () => {
      window.removeEventListener(
        RECORD_MAP_REFERENCE_LAYERS_CHANGED,
        reloadReferenceLayers,
      );
    };
  }, [reloadReferenceLayers]);

  useEffect(() => {
    if (!isDefined(viewId)) {
      setReferenceLayers([]);
      setReferenceLayersError(null);

      return;
    }

    const abortController = new AbortController();
    const url = `${REACT_APP_SERVER_BASE_URL}/rest/map/views/${viewId}/reference-layers`;

    setIsLoadingReferenceLayers(true);

    void fetchWithFreshToken({ abortController, url })
      .then((response) =>
        response.status === 401 || response.status === 403
          ? fetchWithFreshToken({
              abortController,
              forceRenewal: true,
              url,
            })
          : response,
      )
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to load reference layers');
        }

        return response.json() as Promise<RecordMapReferenceLayer[]>;
      })
      .then((layers) => {
        setReferenceLayers(layers);
        setReferenceLayersError(null);
      })
      .catch((error: Error) => {
        if (error.name === 'AbortError') {
          return;
        }

        setReferenceLayers([]);
        setReferenceLayersError(error);
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setIsLoadingReferenceLayers(false);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [reloadToken, viewId]);

  return {
    isLoadingReferenceLayers,
    referenceLayers,
    referenceLayersError,
    reloadReferenceLayers,
  };
};
