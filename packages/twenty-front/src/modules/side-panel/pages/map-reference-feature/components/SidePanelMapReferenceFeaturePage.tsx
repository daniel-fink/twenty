import { REACT_APP_SERVER_BASE_URL } from '~/config';

import { fetchWithFreshToken } from '@/object-record/record-map/hooks/useMapTileMetadata';
import { type RecordMapReferenceLayerFeature } from '@/object-record/record-map/types/RecordMapReferenceLayer';
import { PageLayoutComponentInstanceContext } from '@/page-layout/states/contexts/PageLayoutComponentInstanceContext';
import { FieldsWidgetGroupContainer } from '@/page-layout/widgets/fields/components/FieldsWidgetGroupContainer';
import { WidgetCardContent } from '@/page-layout/widgets/widget-card/components/WidgetCardContent';
import { WidgetCardHeader } from '@/page-layout/widgets/widget-card/components/WidgetCardHeader';
import { useUpdateSidePanelPageInfo } from '@/side-panel/hooks/useUpdateSidePanelPageInfo';
import { sidePanelPageInfoState } from '@/side-panel/states/sidePanelPageInfoState';
import { TabList } from '@/ui/layout/tab-list/components/TabList';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { styled } from '@linaria/react';
import { useEffect, useMemo, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { OverflowingTextWithTooltip } from 'twenty-ui/display';
import { themeCssVariables } from 'twenty-ui/theme-constants';

// Native fields use a 16px icon, 4px gap, and 90px label.
const REFERENCE_FEATURE_FIELD_LABEL_WIDTH = 110;

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
`;

const StyledTabList = styled(TabList)`
  padding-left: ${themeCssVariables.spacing[2]};
`;

const StyledFieldsWidgetShell = styled.div`
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: ${themeCssVariables.spacing[3]};
  width: 100%;
`;

const StyledGroupWrapper = styled.div`
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
`;

const StyledPropertyBox = styled.div`
  align-self: stretch;
  border-radius: ${themeCssVariables.border.radius.sm};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  padding-bottom: ${themeCssVariables.spacing[3]};
  padding-top: ${themeCssVariables.spacing[3]};
`;

const StyledPropertyRow = styled.div`
  align-items: center;
  box-sizing: border-box;
  cursor: default;
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  height: fit-content;
  user-select: none;
  width: 100%;
`;

const StyledLabelContainer = styled.div`
  align-items: center;
  align-self: flex-start;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  height: 24px;
  min-width: 0;
`;

const StyledPropertyLabel = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  min-width: 0;
  overflow: hidden;
  width: ${REFERENCE_FEATURE_FIELD_LABEL_WIDTH}px;
`;

const StyledValueContainer = styled.div`
  display: flex;
  min-width: 0;
  position: relative;
  width: 100%;
`;

const StyledValueOuterContainer = styled.div<{ isMultiline: boolean }>`
  align-items: ${({ isMultiline }) => (isMultiline ? 'flex-start' : 'center')};
  background-color: transparent;
  border-radius: ${themeCssVariables.border.radius.sm};
  cursor: default;
  display: flex;
  height: ${({ isMultiline }) => (isMultiline ? 'auto' : '16px')};
  min-height: 16px;
  overflow: ${({ isMultiline }) => (isMultiline ? 'visible' : 'hidden')};
  padding-left: ${themeCssVariables.spacing[1]};
  padding-right: ${themeCssVariables.spacing[1]};
`;

const StyledValueInnerContainer = styled.div<{ isMultiline: boolean }>`
  align-content: center;
  align-items: center;
  color: ${themeCssVariables.font.color.primary};
  height: fit-content;
  overflow: hidden;
  padding-bottom: 2px;
  padding-top: 2px;
  text-overflow: ellipsis;
  white-space: ${({ isMultiline }) => (isMultiline ? 'normal' : 'nowrap')};
`;

const StyledValueLine = styled.div`
  min-height: 16px;
`;

const StyledStatus = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[4]};
`;

type ReferenceFeaturePageId = {
  viewId: string;
  layerId: string;
  featureId: string;
};

type ReferenceFeatureProperty =
  RecordMapReferenceLayerFeature['properties'][number];

type GroupedReferenceFeatureTab = {
  tabName: string;
  groups: {
    groupName: string;
    properties: ReferenceFeatureProperty[];
  }[];
};

const DEFAULT_REFERENCE_FEATURE_TAB_NAME = 'Attributes';
const DEFAULT_REFERENCE_FEATURE_GROUP_NAME = 'Properties';

const parseReferenceFeaturePageId = (
  pageId: string,
): ReferenceFeaturePageId | null => {
  try {
    const parsed = JSON.parse(decodeURIComponent(pageId));

    if (
      typeof parsed?.viewId !== 'string' ||
      typeof parsed?.layerId !== 'string' ||
      typeof parsed?.featureId !== 'string'
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

const formatFeatureScalarValue = (value: unknown) => {
  if (!isDefined(value)) {
    return '';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
};

const parseStringifiedFeatureList = (value: string) => {
  const trimmedValue = value.trim();

  if (!trimmedValue.startsWith('[') || !trimmedValue.endsWith(']')) {
    return null;
  }

  try {
    const parsedValue: unknown = JSON.parse(trimmedValue);

    return Array.isArray(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
};

const formatFeatureValueLines = (value: unknown) => {
  const listValue =
    typeof value === 'string' ? parseStringifiedFeatureList(value) : value;

  if (Array.isArray(listValue)) {
    const definedListItems = listValue.filter((item) => isDefined(item));

    if (definedListItems.length === 0) {
      return [''];
    }

    return definedListItems.map(
      (item, index) =>
        `${formatFeatureScalarValue(item)}${
          index < definedListItems.length - 1 ? ',' : ''
        }`,
    );
  }

  return [formatFeatureScalarValue(value)];
};

const groupReferenceFeatureProperties = (
  properties: ReferenceFeatureProperty[],
): GroupedReferenceFeatureTab[] => {
  if (properties.length === 0) {
    return [
      {
        tabName: DEFAULT_REFERENCE_FEATURE_TAB_NAME,
        groups: [],
      },
    ];
  }

  const tabs = new Map<string, Map<string, ReferenceFeatureProperty[]>>();

  for (const property of properties) {
    const tabName = DEFAULT_REFERENCE_FEATURE_TAB_NAME;
    const groupName = property.group ?? DEFAULT_REFERENCE_FEATURE_GROUP_NAME;
    const tabGroups = tabs.get(tabName) ?? new Map();
    const groupProperties = tabGroups.get(groupName) ?? [];

    tabGroups.set(groupName, [...groupProperties, property]);
    tabs.set(tabName, tabGroups);
  }

  return [...tabs.entries()].map(([tabName, groups]) => ({
    tabName,
    groups: [...groups.entries()].map(([groupName, groupProperties]) => ({
      groupName,
      properties: groupProperties,
    })),
  }));
};

const ReferenceFeaturePropertyGroup = ({
  groupName,
  properties,
}: {
  groupName: string;
  properties: ReferenceFeatureProperty[];
}) => {
  return (
    <StyledGroupWrapper>
      <FieldsWidgetGroupContainer title={groupName}>
        <StyledPropertyBox>
          {properties.map((property) => {
            const valueLines = formatFeatureValueLines(property.value);
            const isMultilineValue = valueLines.length > 1;

            return (
              <StyledPropertyRow key={property.column}>
                <StyledLabelContainer>
                  <StyledPropertyLabel>
                    <OverflowingTextWithTooltip text={property.label} />
                  </StyledPropertyLabel>
                </StyledLabelContainer>
                <StyledValueContainer>
                  <StyledValueOuterContainer isMultiline={isMultilineValue}>
                    <StyledValueInnerContainer isMultiline={isMultilineValue}>
                      {valueLines.map((valueLine, index) => (
                        <StyledValueLine key={`${property.column}-${index}`}>
                          {valueLine}
                        </StyledValueLine>
                      ))}
                    </StyledValueInnerContainer>
                  </StyledValueOuterContainer>
                </StyledValueContainer>
              </StyledPropertyRow>
            );
          })}
        </StyledPropertyBox>
      </FieldsWidgetGroupContainer>
    </StyledGroupWrapper>
  );
};

export const SidePanelMapReferenceFeaturePage = () => {
  const sidePanelPageInfo = useAtomStateValue(sidePanelPageInfoState);
  const { updateSidePanelPageInfo } = useUpdateSidePanelPageInfo();
  const featureRequest = useMemo(
    () => parseReferenceFeaturePageId(sidePanelPageInfo.instanceId),
    [sidePanelPageInfo.instanceId],
  );
  const [feature, setFeature] = useState<RecordMapReferenceLayerFeature | null>(
    null,
  );
  const [error, setError] = useState<Error | null>(null);
  const [activeTabName, setActiveTabName] = useState(
    DEFAULT_REFERENCE_FEATURE_TAB_NAME,
  );
  const groupedTabs = useMemo(
    () =>
      isDefined(feature)
        ? groupReferenceFeatureProperties(feature.properties)
        : [],
    [feature],
  );
  const activeTab = groupedTabs.find(
    (groupedTab) => groupedTab.tabName === activeTabName,
  );

  useEffect(() => {
    if (!isDefined(featureRequest)) {
      setFeature(null);
      setError(new Error('Invalid reference feature'));

      return;
    }

    const abortController = new AbortController();
    const url = `${REACT_APP_SERVER_BASE_URL}/rest/map/views/${featureRequest.viewId}/reference-layers/${featureRequest.layerId}/features/${encodeURIComponent(featureRequest.featureId)}`;

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
          throw new Error('Failed to load reference feature');
        }

        return response.json() as Promise<RecordMapReferenceLayerFeature>;
      })
      .then((featureResponse) => {
        setFeature(featureResponse);
        setError(null);
      })
      .catch((fetchError: Error) => {
        if (fetchError.name === 'AbortError') {
          return;
        }

        setFeature(null);
        setError(fetchError);
      });

    return () => {
      abortController.abort();
    };
  }, [featureRequest]);

  useEffect(() => {
    const firstTabName = groupedTabs[0]?.tabName;

    if (
      isDefined(firstTabName) &&
      !groupedTabs.some((groupedTab) => groupedTab.tabName === activeTabName)
    ) {
      setActiveTabName(firstTabName);
    }
  }, [activeTabName, groupedTabs]);

  useEffect(() => {
    if (
      isDefined(feature) &&
      feature.title !== '' &&
      sidePanelPageInfo.title !== feature.title
    ) {
      updateSidePanelPageInfo({
        pageTitle: feature.title,
      });
    }
  }, [feature, sidePanelPageInfo.title, updateSidePanelPageInfo]);

  if (isDefined(error)) {
    return <StyledStatus>{error.message}</StyledStatus>;
  }

  if (!isDefined(feature)) {
    return <StyledStatus>Loading feature</StyledStatus>;
  }

  return (
    <StyledContainer>
      <StyledTabList
        tabs={groupedTabs.map((groupedTab) => ({
          id: groupedTab.tabName,
          title: groupedTab.tabName,
        }))}
        behaveAsLinks={false}
        componentInstanceId="map-reference-feature-tabs"
        isInSidePanel
        onChangeTab={setActiveTabName}
      />
      <StyledFieldsWidgetShell>
        <PageLayoutComponentInstanceContext.Provider
          value={{ instanceId: 'map-reference-feature-fields' }}
        >
          <WidgetCardHeader
            widgetId="map-reference-feature-fields"
            componentInstanceId="map-reference-feature-fields"
            variant="side-column"
            isInEditMode={false}
            isResizing={false}
            isReorderEnabled={false}
            isDeletingWidgetEnabled={false}
            title="Fields"
          />
          <WidgetCardContent
            variant="side-column"
            hasHeader
            isEditable={false}
            isInVerticalListTab={false}
            isMobile={false}
          >
            {activeTab?.groups.map((group) => (
              <ReferenceFeaturePropertyGroup
                key={group.groupName}
                groupName={group.groupName}
                properties={group.properties}
              />
            ))}
          </WidgetCardContent>
        </PageLayoutComponentInstanceContext.Provider>
      </StyledFieldsWidgetShell>
    </StyledContainer>
  );
};
