import { useCallback, useMemo } from 'react';

import { useQuery } from '@apollo/client/react';

import { resolveRecordMapContributionFrontComponentId } from '@/object-record/record-map/utils/resolveRecordMapContributionFrontComponentId';
import { FindManyFrontComponentsDocument } from '~/generated-metadata/graphql';

export const useRecordMapContributionFrontComponentResolver = () => {
  const { data } = useQuery(FindManyFrontComponentsDocument);
  const frontComponents = useMemo(
    () => data?.frontComponents ?? [],
    [data?.frontComponents],
  );

  return useCallback(
    ({
      frontComponentUniversalIdentifier,
    }: {
      frontComponentUniversalIdentifier?: string | null;
    }) =>
      resolveRecordMapContributionFrontComponentId({
        frontComponents,
        frontComponentUniversalIdentifier,
      }),
    [frontComponents],
  );
};
