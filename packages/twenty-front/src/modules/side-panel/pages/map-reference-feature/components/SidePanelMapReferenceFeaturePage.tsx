import { REACT_APP_SERVER_BASE_URL } from '~/config';

import { fetchWithFreshToken } from '@/object-record/record-map/hooks/useMapTileMetadata';
import {
  type RecordMapReferenceLayerFeature,
  type RecordMapReferenceLayerFeatureField,
} from '@/object-record/record-map/types/RecordMapReferenceLayer';
import { PageLayoutComponentInstanceContext } from '@/page-layout/states/contexts/PageLayoutComponentInstanceContext';
import { FieldsWidgetGroupContainer } from '@/page-layout/widgets/fields/components/FieldsWidgetGroupContainer';
import { WidgetCardContent } from '@/page-layout/widgets/widget-card/components/WidgetCardContent';
import { WidgetCardHeader } from '@/page-layout/widgets/widget-card/components/WidgetCardHeader';
import { useUpdateSidePanelPageInfo } from '@/side-panel/hooks/useUpdateSidePanelPageInfo';
import { sidePanelPageInfoState } from '@/side-panel/states/sidePanelPageInfoState';
import { BooleanDisplay } from '@/ui/field/display/components/BooleanDisplay';
import { DateDisplay } from '@/ui/field/display/components/DateDisplay';
import { JsonDisplay } from '@/ui/field/display/components/JsonDisplay';
import { NumberDisplay } from '@/ui/field/display/components/NumberDisplay';
import { TextDisplay } from '@/ui/field/display/components/TextDisplay';
import { URLDisplay } from '@/ui/field/display/components/URLDisplay';
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
  selectedFeatureValue: string;
};

const DEFAULT_REFERENCE_FEATURE_TAB_NAME = 'Attributes';

const parseReferenceFeaturePageId = (
  pageId: string,
): ReferenceFeaturePageId | null => {
  try {
    const parsed = JSON.parse(decodeURIComponent(pageId));

    if (
      typeof parsed?.viewId !== 'string' ||
      typeof parsed?.layerId !== 'string' ||
      typeof parsed?.selectedFeatureValue !== 'string'
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

const getFeatureListValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value;
  }

  return typeof value === 'string' ? parseStringifiedFeatureList(value) : null;
};

const formatFeatureValueLines = (value: unknown) => {
  const listValue = getFeatureListValue(value);

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

const getNumberValue = (value: unknown) => {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsedValue = Number(value);

    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  return null;
};

const formatNumberValue = (
  value: unknown,
  options?: Intl.NumberFormatOptions,
) => {
  const numberValue = getNumberValue(value);

  return isDefined(numberValue)
    ? new Intl.NumberFormat(undefined, options).format(numberValue)
    : formatFeatureScalarValue(value);
};

const getCurrencyCode = (field: RecordMapReferenceLayerFeatureField) =>
  typeof field.formatOptions?.currencyCode === 'string'
    ? field.formatOptions.currencyCode
    : 'USD';

const getAreaUnit = (field: RecordMapReferenceLayerFeatureField) =>
  typeof field.formatOptions?.unit === 'string'
    ? field.formatOptions.unit
    : 'sqm';

const getDisplayedMaxRows = (field: RecordMapReferenceLayerFeatureField) => {
  if (field.format !== 'multilineText') {
    return 1;
  }

  return typeof field.formatOptions?.maxLines === 'number' &&
    field.formatOptions.maxLines > 0
    ? field.formatOptions.maxLines
    : 12;
};

const getBooleanValue = (value: unknown) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLowerCase();

    if (normalizedValue === 'true') {
      return true;
    }

    if (normalizedValue === 'false') {
      return false;
    }
  }

  return null;
};

const ContractFieldValueDisplay = ({
  field,
}: {
  field: RecordMapReferenceLayerFeatureField;
}) => {
  if (!isDefined(field.value)) {
    return <TextDisplay text="" />;
  }

  if (field.format === 'currency') {
    return (
      <NumberDisplay
        value={formatNumberValue(field.value, {
          currency: getCurrencyCode(field),
          style: 'currency',
        })}
      />
    );
  }

  if (field.format === 'area') {
    return (
      <NumberDisplay
        value={`${formatNumberValue(field.value)} ${getAreaUnit(field)}`}
      />
    );
  }

  if (field.type === 'boolean') {
    return <BooleanDisplay value={getBooleanValue(field.value)} />;
  }

  if (field.type === 'date' || field.format === 'date') {
    return <DateDisplay value={formatFeatureScalarValue(field.value)} />;
  }

  if (field.type === 'json') {
    return <JsonDisplay text={formatFeatureScalarValue(field.value)} />;
  }

  if (field.type === 'number' || field.type === 'integer') {
    return <NumberDisplay value={formatNumberValue(field.value)} />;
  }

  if (field.type === 'url' || field.format === 'url') {
    return <URLDisplay value={formatFeatureScalarValue(field.value)} />;
  }

  return (
    <TextDisplay
      text={formatFeatureScalarValue(field.value)}
      displayedMaxRows={getDisplayedMaxRows(field)}
    />
  );
};

const ReferenceFeaturePropertyGroup = ({
  groupName,
  fields,
}: {
  groupName: string;
  fields: RecordMapReferenceLayerFeatureField[];
}) => {
  return (
    <StyledGroupWrapper>
      <FieldsWidgetGroupContainer title={groupName}>
        <StyledPropertyBox>
          {fields.map((field) => {
            const valueLines = formatFeatureValueLines(field.value);
            const shouldRenderValueLines = isDefined(
              getFeatureListValue(field.value),
            );
            const isMultilineValue =
              field.format === 'multilineText' || valueLines.length > 1;

            return (
              <StyledPropertyRow key={field.column}>
                <StyledLabelContainer>
                  <StyledPropertyLabel>
                    <OverflowingTextWithTooltip text={field.label} />
                  </StyledPropertyLabel>
                </StyledLabelContainer>
                <StyledValueContainer>
                  <StyledValueOuterContainer isMultiline={isMultilineValue}>
                    <StyledValueInnerContainer isMultiline={isMultilineValue}>
                      {isMultilineValue || shouldRenderValueLines ? (
                        valueLines.map((valueLine, index) => (
                          <StyledValueLine key={`${field.column}-${index}`}>
                            {valueLine}
                          </StyledValueLine>
                        ))
                      ) : (
                        <ContractFieldValueDisplay field={field} />
                      )}
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
  const tabs = useMemo(
    () =>
      isDefined(feature)
        ? [
            {
              id: feature.tab.id,
              title: feature.tab.title,
            },
          ]
        : [],
    [feature],
  );

  useEffect(() => {
    if (!isDefined(featureRequest)) {
      setFeature(null);
      setError(new Error('Invalid reference feature'));

      return;
    }

    const abortController = new AbortController();
    const url = `${REACT_APP_SERVER_BASE_URL}/rest/map/views/${featureRequest.viewId}/reference-layers/${featureRequest.layerId}/features/${encodeURIComponent(featureRequest.selectedFeatureValue)}`;

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
    const firstTabName = tabs[0]?.title;

    if (
      isDefined(firstTabName) &&
      !tabs.some((tab) => tab.title === activeTabName)
    ) {
      setActiveTabName(firstTabName);
    }
  }, [activeTabName, tabs]);

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
        tabs={tabs}
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
            {feature.sections.map((section) => (
              <ReferenceFeaturePropertyGroup
                key={section.id}
                groupName={section.title}
                fields={section.fields}
              />
            ))}
          </WidgetCardContent>
        </PageLayoutComponentInstanceContext.Provider>
      </StyledFieldsWidgetShell>
    </StyledContainer>
  );
};
