import { REACT_APP_SERVER_BASE_URL } from '~/config';

import { ensureTokenPairIsFresh } from '@/apollo/utils/ensureTokenPairIsFresh';
import { RECORD_MAP_REFERENCE_LAYER_CONTRIBUTION_ROUTES } from '@/object-record/record-map/constants/record-map-reference-layer.constants';
import {
  type RecordMapReferenceLayerContribution,
  type RecordMapReferenceLayerContributionsResponse,
} from '@/object-record/record-map/types/RecordMapReferenceLayerContribution';
import { useCallback, useEffect, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';

const postContributionRoute = async ({
  abortController,
  forceRenewal = false,
  route,
  viewId,
}: {
  abortController: AbortController;
  forceRenewal?: boolean;
  route: string;
  viewId: string;
}) => {
  const tokenPair = await ensureTokenPairIsFresh({ forceRenewal });
  const token = tokenPair?.accessOrWorkspaceAgnosticToken?.token;

  return fetch(`${REACT_APP_SERVER_BASE_URL}${route}`, {
    body: JSON.stringify({ viewId }),
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    method: 'POST',
    signal: abortController.signal,
  });
};

const fetchContributionRoute = async ({
  abortController,
  route,
  viewId,
}: {
  abortController: AbortController;
  route: string;
  viewId: string;
}) => {
  const response = await postContributionRoute({
    abortController,
    route,
    viewId,
  });
  const resolvedResponse =
    response.status === 401 || response.status === 403
      ? await postContributionRoute({
          abortController,
          forceRenewal: true,
          route,
          viewId,
        })
      : response;

  if (!resolvedResponse.ok) {
    throw new Error('Failed to load map reference layers');
  }

  const payload =
    (await resolvedResponse.json()) as RecordMapReferenceLayerContributionsResponse;

  return payload.status === 'success' ? payload.layers : [];
};

export const useRecordMapReferenceLayerContributions = ({
  tileSourceViewId,
}: {
  tileSourceViewId?: string;
}) => {
  const [contributions, setContributions] = useState<
    RecordMapReferenceLayerContribution[]
  >([]);

  const refreshReferenceLayerContributions = useCallback(() => {
    if (!isDefined(tileSourceViewId)) {
      setContributions([]);

      return;
    }

    const abortController = new AbortController();

    void Promise.all(
      RECORD_MAP_REFERENCE_LAYER_CONTRIBUTION_ROUTES.map((route) =>
        fetchContributionRoute({
          abortController,
          route,
          viewId: tileSourceViewId,
        }),
      ),
    )
      .then((responses) => {
        setContributions(
          responses
            .flat()
            .sort(
              (firstLayer, secondLayer) =>
                firstLayer.position - secondLayer.position,
            ),
        );
      })
      .catch((error: Error) => {
        if (error.name === 'AbortError') {
          return;
        }

        setContributions([]);
      });

    return () => {
      abortController.abort();
    };
  }, [tileSourceViewId]);

  useEffect(() => {
    return refreshReferenceLayerContributions();
  }, [refreshReferenceLayerContributions]);

  return {
    referenceLayerContributions: contributions,
    refreshReferenceLayerContributions,
    setReferenceLayerContributions: setContributions,
  };
};
