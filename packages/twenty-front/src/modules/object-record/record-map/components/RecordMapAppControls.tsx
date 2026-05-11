import { RECORD_MAP_CONTRIBUTIONS_UPDATED_EVENT } from '@/object-record/record-map/constants/record-map-contribution.constants';
import { useRecordMapContributions } from '@/object-record/record-map/hooks/useRecordMapContributions';
import { useRecordMapContributionFrontComponentResolver } from '@/object-record/record-map/hooks/useRecordMapContributionFrontComponentResolver';
import { FrontComponentRenderer } from '@/front-components/components/FrontComponentRenderer';
import { useGetCurrentViewOnly } from '@/views/hooks/useGetCurrentViewOnly';
import { styled } from '@linaria/react';
import { isDefined } from 'twenty-shared/utils';

const StyledControls = styled.div`
  align-items: center;
  display: flex;
  gap: 8px;
`;

const RecordMapAppControl = ({
  contributionId,
  frontComponentId,
  onRefreshMapContributions,
  params,
  viewId,
}: {
  contributionId: string;
  frontComponentId: string | null;
  onRefreshMapContributions: () => void;
  params?: Record<string, string>;
  viewId: string;
}) => {
  if (!isDefined(frontComponentId)) {
    return null;
  }

  return (
    <FrontComponentRenderer
      frontComponentId={frontComponentId}
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
  const resolveFrontComponentId =
    useRecordMapContributionFrontComponentResolver();

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
          contributionId={controlContribution.contributionId}
          frontComponentId={resolveFrontComponentId(controlContribution)}
          onRefreshMapContributions={handleRefreshMapContributions}
          params={controlContribution.params}
          viewId={tileSourceViewId}
        />
      ))}
    </StyledControls>
  );
};
