import { gql } from '@apollo/client';
import { useApolloClient } from '@apollo/client/react';
import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { DropdownMenuHeader } from '@/ui/layout/dropdown/components/DropdownMenuHeader/DropdownMenuHeader';
import { DropdownMenuHeaderLeftComponent } from '@/ui/layout/dropdown/components/DropdownMenuHeader/internal/DropdownMenuHeaderLeftComponent';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { StyledHeaderDropdownButton } from '@/ui/layout/dropdown/components/StyledHeaderDropdownButton';
import { GenericDropdownContentWidth } from '@/ui/layout/dropdown/constants/GenericDropdownContentWidth';
import { RECORD_MAP_REFERENCE_LAYERS_CHANGED } from '@/object-record/record-map/constants/record-map-reference-layer.constants';
import { useMapReferenceLayers } from '@/object-record/record-map/hooks/useMapReferenceLayers';
import { getRecordMapReferenceLayerSwatchColor } from '@/object-record/record-map/utils/getRecordMapReferenceLayerSwatchColor';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { isDropdownOpenComponentState } from '@/ui/layout/dropdown/states/isDropdownOpenComponentState';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useGetCurrentViewOnly } from '@/views/hooks/useGetCurrentViewOnly';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { isDefined } from 'twenty-shared/utils';
import { IconX } from 'twenty-ui/display';
import { Toggle } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const RECORD_MAP_LAYERS_DROPDOWN_ID = 'record-map-layers-dropdown';

const SET_MAP_REFERENCE_LAYER_VISIBILITY_PREFERENCE = gql`
  mutation SetMapReferenceLayerVisibilityPreference(
    $viewId: String!
    $layerId: String!
    $isVisible: Boolean!
  ) {
    setMapReferenceLayerVisibilityPreference(
      viewId: $viewId
      layerId: $layerId
      isVisible: $isVisible
    )
  }
`;

const StyledSectionTitle = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[2]}
    ${themeCssVariables.spacing[1]};
`;

const StyledLayerRow = styled.div`
  align-items: center;
  border-radius: ${themeCssVariables.border.radius.sm};
  display: grid;
  gap: ${themeCssVariables.spacing[2]};
  grid-template-columns: 16px 1fr auto;
  min-height: 32px;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
`;

const StyledLayerSwatch = styled.div<{ color: string }>`
  background: ${({ color }) => color};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.xs};
  height: 12px;
  width: 12px;
`;

const StyledLayerText = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledStatusText = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[2]};
`;

const StyledLayerStateText = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
`;

export const RecordMapLayersDropdownButton = () => {
  const { t } = useLingui();
  const apolloClient = useApolloClient();
  const { closeDropdown } = useCloseDropdown();
  const { currentView } = useGetCurrentViewOnly();
  const currentViewId = currentView?.id;
  const {
    isLoadingReferenceLayers,
    referenceLayers,
    referenceLayersError,
    reloadReferenceLayers,
  } = useMapReferenceLayers({ viewId: currentViewId });

  const isDropdownOpen = useAtomComponentStateValue(
    isDropdownOpenComponentState,
    RECORD_MAP_LAYERS_DROPDOWN_ID,
  );
  const handleReferenceLayerToggle = async ({
    isVisible,
    layerId,
  }: {
    isVisible: boolean;
    layerId: string;
  }) => {
    if (!isDefined(currentViewId)) {
      return;
    }

    await apolloClient.mutate({
      mutation: SET_MAP_REFERENCE_LAYER_VISIBILITY_PREFERENCE,
      variables: {
        isVisible,
        layerId,
        viewId: currentViewId,
      },
    });

    window.dispatchEvent(new Event(RECORD_MAP_REFERENCE_LAYERS_CHANGED));
    reloadReferenceLayers();
  };

  return (
    <Dropdown
      dropdownId={RECORD_MAP_LAYERS_DROPDOWN_ID}
      dropdownOffset={{ y: 8 }}
      clickableComponent={
        <StyledHeaderDropdownButton isUnfolded={isDropdownOpen}>
          {t`Layers`}
        </StyledHeaderDropdownButton>
      }
      dropdownComponents={
        <DropdownContent widthInPixels={GenericDropdownContentWidth.ExtraLarge}>
          <DropdownMenuHeader
            StartComponent={
              <DropdownMenuHeaderLeftComponent
                Icon={IconX}
                onClick={() => closeDropdown(RECORD_MAP_LAYERS_DROPDOWN_ID)}
              />
            }
          >
            {t`Layers`}
          </DropdownMenuHeader>
          <DropdownMenuItemsContainer>
            <StyledSectionTitle>{t`Records`}</StyledSectionTitle>
            <StyledLayerRow>
              <StyledLayerSwatch color="currentColor" />
              <StyledLayerText>{t`Mapped records`}</StyledLayerText>
              <StyledLayerStateText>{t`On`}</StyledLayerStateText>
            </StyledLayerRow>
            <StyledSectionTitle>{t`Reference`}</StyledSectionTitle>
            {isLoadingReferenceLayers && (
              <StyledStatusText>{t`Loading layers`}</StyledStatusText>
            )}
            {isDefined(referenceLayersError) && (
              <StyledStatusText>{t`Unable to load layers`}</StyledStatusText>
            )}
            {!isLoadingReferenceLayers &&
              !isDefined(referenceLayersError) &&
              referenceLayers.length === 0 && (
                <StyledStatusText>{t`No reference layers`}</StyledStatusText>
              )}
            {referenceLayers.map((layer) => (
              <StyledLayerRow key={layer.id}>
                <StyledLayerSwatch
                  color={getRecordMapReferenceLayerSwatchColor(layer.style)}
                />
                <StyledLayerText>{layer.name}</StyledLayerText>
                <Toggle
                  value={layer.attachment.isVisible}
                  onChange={() =>
                    void handleReferenceLayerToggle({
                      isVisible: !layer.attachment.isVisible,
                      layerId: layer.id,
                    })
                  }
                />
              </StyledLayerRow>
            ))}
          </DropdownMenuItemsContainer>
        </DropdownContent>
      }
    />
  );
};
