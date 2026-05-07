import { REACT_APP_SERVER_BASE_URL } from '~/config';

import { ensureTokenPairIsFresh } from '@/apollo/utils/ensureTokenPairIsFresh';
import { RECORD_MAP_EXTENSION_CONTRIBUTION_ROUTES } from '@/object-record/record-map/constants/record-map-contribution.constants';
import {
  type RecordMapControlContribution,
  type RecordMapLayerContribution,
  type RecordMapContributionsResponse,
} from '@/object-record/record-map/types/RecordMapContribution';
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
    throw new Error('Failed to load map contributions');
  }

  const payload =
    (await resolvedResponse.json()) as RecordMapContributionsResponse;

  return payload.status === 'success'
    ? {
        controls: payload.controls ?? [],
        layers: payload.layers,
      }
    : {
        controls: [],
        layers: [],
      };
};

export const useRecordMapContributions = ({
  tileSourceViewId,
}: {
  tileSourceViewId?: string;
}) => {
  const [layerContributions, setLayerContributions] = useState<
    RecordMapLayerContribution[]
  >([]);
  const [controlContributions, setControlContributions] = useState<
    RecordMapControlContribution[]
  >([]);

  const refreshMapContributions = useCallback(() => {
    if (!isDefined(tileSourceViewId)) {
      setLayerContributions([]);
      setControlContributions([]);

      return;
    }

    const abortController = new AbortController();

    void Promise.all(
      RECORD_MAP_EXTENSION_CONTRIBUTION_ROUTES.map((route) =>
        fetchContributionRoute({
          abortController,
          route,
          viewId: tileSourceViewId,
        }),
      ),
    )
      .then((responses) => {
        setLayerContributions(
          responses
            .flatMap((response) => response.layers)
            .sort(
              (firstLayer, secondLayer) =>
                firstLayer.position - secondLayer.position,
            ),
        );
        setControlContributions(
          responses
            .flatMap((response) => response.controls)
            .sort(
              (firstControl, secondControl) =>
                firstControl.position - secondControl.position,
            ),
        );
      })
      .catch((error: Error) => {
        if (error.name === 'AbortError') {
          return;
        }

        setLayerContributions([]);
        setControlContributions([]);
      });

    return () => {
      abortController.abort();
    };
  }, [tileSourceViewId]);

  useEffect(() => {
    return refreshMapContributions();
  }, [refreshMapContributions]);

  return {
    controlContributions,
    layerContributions,
    refreshMapContributions,
  };
};
