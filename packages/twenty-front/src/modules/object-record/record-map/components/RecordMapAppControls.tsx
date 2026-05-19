import { RECORD_MAP_CONTRIBUTIONS_UPDATED_EVENT } from '@/object-record/record-map/constants/record-map-contribution.constants';
import { useRecordMapContributions } from '@/object-record/record-map/hooks/useRecordMapContributions';
import { useRecordMapContributionFrontComponentResolver } from '@/object-record/record-map/hooks/useRecordMapContributionFrontComponentResolver';
import { FrontComponentRenderer } from '@/front-components/components/FrontComponentRenderer';
import {
  type RecordMapControlContribution,
  type RecordMapContributionScope,
} from '@/object-record/record-map/types/RecordMapContribution';
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
  recordMapScope,
  viewId,
}: {
  contributionId: string;
  frontComponentId: string | null;
  onRefreshMapContributions: () => void;
  params?: Record<string, string>;
  recordMapScope?: RecordMapContributionScope;
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
        ...(isDefined(recordMapScope)
          ? { recordMapScope: JSON.stringify(recordMapScope) }
          : {}),
        viewId,
      }}
    />
  );
};

type RecordMapAppControlsBaseProps = {
  controlContributions?: RecordMapControlContribution[];
  dispatchContributionUpdatedEvent?: boolean;
  recordMapScope?: RecordMapContributionScope;
  refreshMapContributions?: () => void;
  tileSourceViewId?: string;
};

const RecordMapAppControlsBase = ({
  controlContributions,
  dispatchContributionUpdatedEvent = true,
  recordMapScope,
  refreshMapContributions,
  tileSourceViewId,
}: RecordMapAppControlsBaseProps) => {
  const resolvedTileSourceViewId = tileSourceViewId;
  const shouldFetchControls =
    !isDefined(controlContributions) ||
    !isDefined(refreshMapContributions);
  const internalContributions = useRecordMapContributions({
    recordMapScope,
    tileSourceViewId: shouldFetchControls ? resolvedTileSourceViewId : undefined,
  });
  const resolveFrontComponentId =
    useRecordMapContributionFrontComponentResolver();
  const resolvedControlContributions =
    controlContributions ?? internalContributions.controlContributions;
  const resolvedRefreshMapContributions =
    refreshMapContributions ?? internalContributions.refreshMapContributions;

  if (
    !isDefined(resolvedTileSourceViewId) ||
    resolvedControlContributions.length === 0
  ) {
    return null;
  }

  const handleRefreshMapContributions = () => {
    resolvedRefreshMapContributions();
    if (!dispatchContributionUpdatedEvent) {
      return;
    }

    window.dispatchEvent(
      new CustomEvent(RECORD_MAP_CONTRIBUTIONS_UPDATED_EVENT, {
        detail: { viewId: resolvedTileSourceViewId },
      }),
    );
  };

  return (
    <StyledControls>
      {resolvedControlContributions.map((controlContribution) => (
        <RecordMapAppControl
          key={controlContribution.contributionId}
          contributionId={controlContribution.contributionId}
          frontComponentId={resolveFrontComponentId(controlContribution)}
          onRefreshMapContributions={handleRefreshMapContributions}
          params={controlContribution.params}
          recordMapScope={recordMapScope}
          viewId={resolvedTileSourceViewId}
        />
      ))}
    </StyledControls>
  );
};

const CurrentViewRecordMapAppControls = (
  props: Omit<RecordMapAppControlsBaseProps, 'tileSourceViewId'>,
) => {
  const { currentView } = useGetCurrentViewOnly();

  return (
    <RecordMapAppControlsBase
      {...props}
      tileSourceViewId={currentView?.id}
    />
  );
};

export const RecordMapAppControls = (props: RecordMapAppControlsBaseProps) => {
  if (isDefined(props.tileSourceViewId)) {
    return <RecordMapAppControlsBase {...props} />;
  }

  return (
    <CurrentViewRecordMapAppControls
      controlContributions={props.controlContributions}
      dispatchContributionUpdatedEvent={props.dispatchContributionUpdatedEvent}
      recordMapScope={props.recordMapScope}
      refreshMapContributions={props.refreshMapContributions}
    />
  );
};
