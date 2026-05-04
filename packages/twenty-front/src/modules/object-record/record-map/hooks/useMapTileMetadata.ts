import { REACT_APP_SERVER_BASE_URL } from '~/config';

import { ensureTokenPairIsFresh } from '@/apollo/utils/ensureTokenPairIsFresh';
import { type RecordMapBounds } from '@/object-record/record-map/utils/getPaddedRecordMapBounds';
import { useEffect, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';

export type RecordMapBoundsResponse = {
  bounds: RecordMapBounds | null;
  recordCount: number;
};

export type RecordMapTileJsonResponse = {
  minzoom: number;
  maxzoom: number;
};

export const fetchWithFreshToken = async ({
  abortController,
  forceRenewal = false,
  url,
}: {
  abortController: AbortController;
  forceRenewal?: boolean;
  url: string;
}) => {
  const tokenPair = await ensureTokenPairIsFresh({ forceRenewal });
  const token = tokenPair?.accessOrWorkspaceAgnosticToken?.token;

  return fetch(url, {
    headers: token
      ? {
          authorization: `Bearer ${token}`,
        }
      : undefined,
    signal: abortController.signal,
  });
};

export const useMapTileMetadata = ({
  tileSourceFilter,
  tileSourceViewId,
}: {
  tileSourceFilter: string;
  tileSourceViewId?: string;
}) => {
  const [tileBounds, setTileBounds] = useState<RecordMapBoundsResponse | null>(
    null,
  );
  const [tileJson, setTileJson] = useState<RecordMapTileJsonResponse | null>(
    null,
  );

  useEffect(() => {
    if (!isDefined(tileSourceViewId)) {
      setTileJson(null);

      return;
    }

    const abortController = new AbortController();
    const tileJsonUrl = `${REACT_APP_SERVER_BASE_URL}/rest/map/views/${tileSourceViewId}/tile-json`;

    void fetchWithFreshToken({ abortController, url: tileJsonUrl })
      .then((response) =>
        response.status === 401 || response.status === 403
          ? fetchWithFreshToken({
              abortController,
              forceRenewal: true,
              url: tileJsonUrl,
            })
          : response,
      )
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to load map tile policy');
        }

        return response.json() as Promise<RecordMapTileJsonResponse>;
      })
      .then((tileJsonResponse) => {
        setTileJson(tileJsonResponse);
      })
      .catch((error: Error) => {
        if (error.name === 'AbortError') {
          return;
        }

        setTileJson(null);
      });

    return () => {
      abortController.abort();
    };
  }, [tileSourceViewId]);

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

    void fetchWithFreshToken({ abortController, url: boundsUrl })
      .then((response) =>
        response.status === 401 || response.status === 403
          ? fetchWithFreshToken({
              abortController,
              forceRenewal: true,
              url: boundsUrl,
            })
          : response,
      )
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

  return { tileBounds, tileJson };
};
