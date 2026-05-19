import { REACT_APP_SERVER_BASE_URL } from '~/config';

import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { RecordMap } from '@/object-record/record-map/components/RecordMap';
import { RecordMapAppControls } from '@/object-record/record-map/components/RecordMapAppControls';
import { useRecordMapContributions } from '@/object-record/record-map/hooks/useRecordMapContributions';
import {
  type RecordMapContributionScope,
  type RecordMapLayerContribution,
} from '@/object-record/record-map/types/RecordMapContribution';
import { type RecordMapPoint } from '@/object-record/record-map/types/RecordMapPoint';
import { type RecordMapBounds } from '@/object-record/record-map/utils/getPaddedRecordMapBounds';
import { isValidMapFieldMetadataItem } from '@/object-record/record-map/utils/isValidMapFieldMetadataItem';
import { useFilterValueDependencies } from '@/object-record/record-filter/hooks/useFilterValueDependencies';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { viewsSelector } from '@/views/states/selectors/viewsSelector';
import { mapViewFilterGroupsToRecordFilterGroups } from '@/views/utils/mapViewFilterGroupsToRecordFilterGroups';
import { mapViewFiltersToFilters } from '@/views/utils/mapViewFiltersToFilters';
import { getFilterableFields } from '@/views/utils/getFilterableFields';
import { styled } from '@linaria/react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { computeRecordGqlOperationFilter, isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';

export const OPPORTUNITY_RECORD_MAP_FRONT_COMPONENT_NAME =
  'Opportunity Parcel Map';

const OPPORTUNITY_RECORD_MAP_ROUTE =
  '/s/twenty-geo-layers/ui/opportunity-record-map';
const EMPTY_RECORD_MAP_POINTS: RecordMapPoint[] = [];

type OpportunityRecordMapDescriptor = {
  bounds: RecordMapBounds | null;
  layerId: string;
  opportunityId: string;
  pinnedOverlayContributions: RecordMapLayerContribution[];
  sourceViewId: string;
  status: 'success';
  warnings: Array<{ message: string }>;
};

type OpportunityRecordMapError = {
  message: string;
  status: 'error';
};

const StyledContainer = styled.div`
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 8px 24px;
  width: 100%;
`;

const StyledTitleBar = styled.div`
  align-items: center;
  display: flex;
  flex: 0 0 auto;
  justify-content: space-between;
  margin-bottom: ${themeCssVariables.spacing[4]};
  margin-top: ${themeCssVariables.spacing[4]};
  width: 100%;
`;

const StyledTitle = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

const StyledMapWindow = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 360px;
  min-width: 0;
  position: relative;
`;

const StyledState = styled.div`
  align-items: center;
  background: ${themeCssVariables.color.gray10};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  font-size: ${themeCssVariables.font.size.md};
  flex: 1 1 auto;
  justify-content: center;
  min-height: 320px;
  padding: ${themeCssVariables.spacing[8]};
  text-align: center;
`;

const StyledWarning = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-shadow: ${themeCssVariables.boxShadow.light};
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  left: ${themeCssVariables.spacing[3]};
  max-width: min(520px, calc(100% - 24px));
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  position: absolute;
  top: ${themeCssVariables.spacing[3]};
  z-index: 1;
`;

const OpportunityMapLayout = ({
  children,
  controls,
}: {
  children: ReactNode;
  controls?: ReactNode;
}) => (
  <StyledContainer>
    <StyledTitleBar>
      <StyledTitle>Map</StyledTitle>
      {controls}
    </StyledTitleBar>
    <StyledMapWindow>{children}</StyledMapWindow>
  </StyledContainer>
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isRecordMapBounds = (value: unknown): value is RecordMapBounds =>
  Array.isArray(value) &&
  value.length === 4 &&
  value.every((entry) => typeof entry === 'number' && Number.isFinite(entry));

const isOpportunityRecordMapDescriptor = (
  value: unknown,
): value is OpportunityRecordMapDescriptor =>
  isRecord(value) &&
  value.status === 'success' &&
  typeof value.sourceViewId === 'string' &&
  Array.isArray(value.pinnedOverlayContributions) &&
  (value.bounds === null || isRecordMapBounds(value.bounds));

const isOpportunityRecordMapError = (
  value: unknown,
): value is OpportunityRecordMapError =>
  isRecord(value) &&
  value.status === 'error' &&
  typeof value.message === 'string';

export const OpportunityRecordMapFrontComponentHost = ({
  applicationAccessToken,
  recordId,
}: {
  applicationAccessToken: string;
  recordId?: string;
}) => {
  const views = useAtomStateValue(viewsSelector);
  const { objectMetadataItems } = useObjectMetadataItems();
  const { filterValueDependencies } = useFilterValueDependencies();
  const [descriptor, setDescriptor] =
    useState<OpportunityRecordMapDescriptor | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const recordMapScope = useMemo<RecordMapContributionScope | undefined>(
    () =>
      isDefined(recordId)
        ? {
            objectNameSingular: 'opportunity',
            recordId,
            type: 'record',
          }
        : undefined,
    [recordId],
  );
  const {
    controlContributions,
    layerContributions,
    refreshMapContributions,
  } = useRecordMapContributions({
    recordMapScope,
    tileSourceViewId: descriptor?.sourceViewId,
  });

  useEffect(() => {
    if (!isDefined(recordId)) {
      setDescriptor(null);
      setErrorMessage('Opportunity record context is unavailable.');
      setIsLoading(false);

      return;
    }

    const abortController = new AbortController();

    setIsLoading(true);
    setErrorMessage(null);

    void fetch(`${REACT_APP_SERVER_BASE_URL}${OPPORTUNITY_RECORD_MAP_ROUTE}`, {
      body: JSON.stringify({ opportunityId: recordId }),
      headers: {
        authorization: `Bearer ${applicationAccessToken}`,
        'content-type': 'application/json',
      },
      method: 'POST',
      signal: abortController.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as unknown;

        if (isOpportunityRecordMapDescriptor(payload)) {
          setDescriptor(payload);
          setErrorMessage(null);
        } else if (isOpportunityRecordMapError(payload)) {
          setDescriptor(null);
          setErrorMessage(payload.message);
        } else {
          setDescriptor(null);
          setErrorMessage('Opportunity map data is unavailable.');
        }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        setDescriptor(null);
        setErrorMessage('Opportunity map data is unavailable.');
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [applicationAccessToken, recordId]);

  const sourceView = useMemo(
    () =>
      isDefined(descriptor)
        ? views.find((view) => view.id === descriptor.sourceViewId)
        : undefined,
    [descriptor, views],
  );
  const sourceObjectMetadataItem = useMemo(
    () =>
      isDefined(sourceView)
        ? objectMetadataItems.find(
            (metadataItem) => metadataItem.id === sourceView.objectMetadataId,
          )
        : undefined,
    [objectMetadataItems, sourceView],
  );
  const sourceViewFilter = useMemo(() => {
    if (!isDefined(sourceView) || !isDefined(sourceObjectMetadataItem)) {
      return {};
    }

    return computeRecordGqlOperationFilter({
      fields: sourceObjectMetadataItem.fields,
      filterValueDependencies,
      recordFilterGroups: mapViewFilterGroupsToRecordFilterGroups(
        sourceView.viewFilterGroups ?? [],
      ),
      recordFilters: mapViewFiltersToFilters(
        sourceView.viewFilters,
        getFilterableFields(sourceObjectMetadataItem),
      ),
    });
  }, [filterValueDependencies, sourceObjectMetadataItem, sourceView]);

  if (isLoading) {
    return (
      <OpportunityMapLayout>
        <StyledState>Loading map...</StyledState>
      </OpportunityMapLayout>
    );
  }

  if (!isDefined(descriptor)) {
    return (
      <OpportunityMapLayout>
        <StyledState>{errorMessage ?? 'Opportunity map unavailable.'}</StyledState>
      </OpportunityMapLayout>
    );
  }

  if (!isDefined(sourceView)) {
    return (
      <OpportunityMapLayout>
        <StyledState>Source map view is unavailable.</StyledState>
      </OpportunityMapLayout>
    );
  }

  if (!isDefined(sourceObjectMetadataItem)) {
    return (
      <OpportunityMapLayout>
        <StyledState>Source map object metadata is unavailable.</StyledState>
      </OpportunityMapLayout>
    );
  }

  const mapFieldMetadataItem = sourceObjectMetadataItem.readableFields.find(
    (field) =>
      field.id === sourceView.mapFieldMetadataId &&
      isValidMapFieldMetadataItem(field),
  );

  if (!isDefined(sourceView.mapFieldMetadataId) || !isDefined(mapFieldMetadataItem)) {
    return (
      <OpportunityMapLayout>
        <StyledState>Source view is not map-capable.</StyledState>
      </OpportunityMapLayout>
    );
  }

  return (
    <OpportunityMapLayout
      controls={
        <RecordMapAppControls
          controlContributions={controlContributions}
          dispatchContributionUpdatedEvent={false}
          recordMapScope={recordMapScope}
          refreshMapContributions={refreshMapContributions}
          tileSourceViewId={descriptor.sourceViewId}
        />
      }
    >
      <RecordMap
        cameraPersistenceKey={`opportunity:${descriptor.opportunityId}:${descriptor.sourceViewId}`}
        initialBounds={descriptor.bounds}
        layerContributions={layerContributions}
        loading={false}
        objectNameSingular={sourceObjectMetadataItem.nameSingular}
        pinnedOverlayContributions={descriptor.pinnedOverlayContributions}
        recordMapPoints={EMPTY_RECORD_MAP_POINTS}
        recordMapScope={recordMapScope}
        refreshMapContributions={refreshMapContributions}
        tileSource={{ filter: sourceViewFilter, viewId: descriptor.sourceViewId }}
      />
      {descriptor.warnings[0]?.message && (
        <StyledWarning>{descriptor.warnings[0].message}</StyledWarning>
      )}
    </OpportunityMapLayout>
  );
};
