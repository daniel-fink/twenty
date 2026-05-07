import { RECORD_MAP_CONTRIBUTIONS_UPDATED_EVENT } from '@/object-record/record-map/constants/record-map-contribution.constants';
import { useRecordMapContributions } from '@/object-record/record-map/hooks/useRecordMapContributions';
import { FrontComponentRenderer } from '@/front-components/components/FrontComponentRenderer';
import { useGetCurrentViewOnly } from '@/views/hooks/useGetCurrentViewOnly';
import { styled } from '@linaria/react';
import { useQuery } from '@apollo/client/react';
import { isDefined } from 'twenty-shared/utils';
import { FindOneApplicationByUniversalIdentifierDocument } from '~/generated-metadata/graphql';

const StyledControls = styled.div`
  align-items: center;
  display: flex;
  gap: 8px;
`;

const RecordMapAppControl = ({
  applicationUniversalIdentifier,
  contributionId,
  frontComponentUniversalIdentifier,
  onRefreshMapContributions,
  params,
  viewId,
}: {
  applicationUniversalIdentifier: string;
  contributionId: string;
  frontComponentUniversalIdentifier: string;
  onRefreshMapContributions: () => void;
  params?: Record<string, string>;
  viewId: string;
}) => {
  const { data } = useQuery(FindOneApplicationByUniversalIdentifierDocument, {
    variables: {
      universalIdentifier: applicationUniversalIdentifier,
    },
  });

  const frontComponent = data?.findOneApplication?.frontComponents.find(
    (candidate) =>
      candidate.universalIdentifier === frontComponentUniversalIdentifier,
  );

  if (!isDefined(frontComponent)) {
    return null;
  }

  return (
    <FrontComponentRenderer
      frontComponentId={frontComponent.id}
      onRefreshMapContributions={onRefreshMapContributions}
      params={{
        ...params,
        contributionId,
        viewId,
      }}
    />
  );
};

export const RecordMapAppControls = () => {
  const { currentView } = useGetCurrentViewOnly();
  const tileSourceViewId = currentView?.id;
  const { controlContributions, refreshMapContributions } =
    useRecordMapContributions({
      tileSourceViewId,
    });

  if (!isDefined(tileSourceViewId) || controlContributions.length === 0) {
    return null;
  }

  const handleRefreshMapContributions = () => {
    refreshMapContributions();
    window.dispatchEvent(
      new CustomEvent(RECORD_MAP_CONTRIBUTIONS_UPDATED_EVENT, {
        detail: { viewId: tileSourceViewId },
      }),
    );
  };

  return (
    <StyledControls>
      {controlContributions.map((controlContribution) => (
        <RecordMapAppControl
          key={controlContribution.contributionId}
          applicationUniversalIdentifier={
            controlContribution.applicationUniversalIdentifier
          }
          contributionId={controlContribution.contributionId}
          frontComponentUniversalIdentifier={
            controlContribution.frontComponentUniversalIdentifier
          }
          onRefreshMapContributions={handleRefreshMapContributions}
          params={controlContribution.params}
          viewId={tileSourceViewId}
        />
      ))}
    </StyledControls>
  );
};
