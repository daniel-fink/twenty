import { REACT_APP_SERVER_BASE_URL } from '~/config';

import {
  fetchWithFreshToken,
  type RecordMapBoundsResponse,
} from '@/object-record/record-map/hooks/useMapTileMetadata';
import { type RecordMapReferenceLayer } from '@/object-record/record-map/types/RecordMapReferenceLayer';
import { type RecordMapBounds } from '@/object-record/record-map/utils/getPaddedRecordMapBounds';
import { useEffect, useMemo, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';

const mergeBounds = (
  boundsResponses: RecordMapBoundsResponse[],
): RecordMapBoundsResponse | null => {
  const bounds = boundsResponses
    .map((boundsResponse) => boundsResponse.bounds)
    .filter(isDefined);

  if (bounds.length === 0) {
    return null;
  }

  const mergedBounds = bounds.reduce<RecordMapBounds>(
    (currentBounds, nextBounds) => [
      Math.min(currentBounds[0], nextBounds[0]),
      Math.min(currentBounds[1], nextBounds[1]),
      Math.max(currentBounds[2], nextBounds[2]),
      Math.max(currentBounds[3], nextBounds[3]),
    ],
    bounds[0],
  );

  return {
    bounds: mergedBounds,
    recordCount: boundsResponses.reduce(
      (recordCount, boundsResponse) => recordCount + boundsResponse.recordCount,
      0,
    ),
  };
};

export const useMapReferenceLayerBounds = ({
  referenceLayers,
  viewId,
}: {
  referenceLayers: RecordMapReferenceLayer[];
  viewId?: string;
}) => {
  const [referenceLayerBounds, setReferenceLayerBounds] =
    useState<RecordMapBoundsResponse | null>(null);

  const visibleLayerIds = useMemo(
    () =>
      referenceLayers
        .filter((referenceLayer) => referenceLayer.attachment.isVisible)
        .map((referenceLayer) => referenceLayer.id),
    [referenceLayers],
  );
  const visibleLayerIdsKey = visibleLayerIds.join(',');

  useEffect(() => {
    if (!isDefined(viewId) || visibleLayerIds.length === 0) {
      setReferenceLayerBounds(null);

      return;
    }

    const abortController = new AbortController();

    void Promise.all(
      visibleLayerIds.map((layerId) =>
        fetchWithFreshToken({
          abortController,
          url: `${REACT_APP_SERVER_BASE_URL}/rest/map/views/${viewId}/reference-layers/${layerId}/bounds`,
        })
          .then((response) =>
            response.status === 401 || response.status === 403
              ? fetchWithFreshToken({
                  abortController,
                  forceRenewal: true,
                  url: `${REACT_APP_SERVER_BASE_URL}/rest/map/views/${viewId}/reference-layers/${layerId}/bounds`,
                })
              : response,
          )
          .then((response) => {
            if (!response.ok) {
              throw new Error('Failed to load reference layer bounds');
            }

            return response.json() as Promise<RecordMapBoundsResponse>;
          }),
      ),
    )
      .then((boundsResponses) => {
        setReferenceLayerBounds(mergeBounds(boundsResponses));
      })
      .catch((error: Error) => {
        if (error.name === 'AbortError') {
          return;
        }

        setReferenceLayerBounds(null);
      });

    return () => {
      abortController.abort();
    };
  }, [viewId, visibleLayerIds, visibleLayerIdsKey]);

  return { referenceLayerBounds };
};
