import { REACT_APP_SERVER_BASE_URL } from '~/config';

import { ensureTokenPairIsFresh } from '@/apollo/utils/ensureTokenPairIsFresh';
import { RECORD_MAP_REFERENCE_LAYERS_UPDATED_EVENT } from '@/object-record/record-map/constants/record-map-reference-layer.constants';
import { useRecordMapReferenceLayerContributions } from '@/object-record/record-map/hooks/useRecordMapReferenceLayerContributions';
import { type RecordMapReferenceLayerContribution } from '@/object-record/record-map/types/RecordMapReferenceLayerContribution';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { DropdownMenuHeader } from '@/ui/layout/dropdown/components/DropdownMenuHeader/DropdownMenuHeader';
import { DropdownMenuHeaderLeftComponent } from '@/ui/layout/dropdown/components/DropdownMenuHeader/internal/DropdownMenuHeaderLeftComponent';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { StyledHeaderDropdownButton } from '@/ui/layout/dropdown/components/StyledHeaderDropdownButton';
import { GenericDropdownContentWidth } from '@/ui/layout/dropdown/constants/GenericDropdownContentWidth';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { isDropdownOpenComponentState } from '@/ui/layout/dropdown/states/isDropdownOpenComponentState';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useGetCurrentViewOnly } from '@/views/hooks/useGetCurrentViewOnly';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { IconMap, IconX } from 'twenty-ui/display';
import { MenuItemToggle } from 'twenty-ui/navigation';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const RECORD_MAP_LAYERS_DROPDOWN_ID = 'record-map-layers-dropdown';

const StyledEmptyState = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  padding: ${themeCssVariables.spacing[3]};
`;

const persistReferenceLayerVisibility = async ({
  contribution,
  isVisible,
}: {
  contribution: RecordMapReferenceLayerContribution;
  isVisible: boolean;
}) => {
  if (!contribution.visibilityCallbackUrl) {
    throw new Error('Layer visibility route is unavailable.');
  }

  const tokenPair = await ensureTokenPairIsFresh();
  const token = tokenPair?.accessOrWorkspaceAgnosticToken?.token;
  const response = await fetch(
    `${REACT_APP_SERVER_BASE_URL}${contribution.visibilityCallbackUrl}`,
    {
      body: JSON.stringify({
        isVisible,
        layerId: contribution.layerId,
        viewId: contribution.viewId,
      }),
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      method: 'POST',
    },
  );

  if (!response.ok) {
    throw new Error('Unable to update map layer visibility.');
  }
};

export const RecordMapLayersDropdownButton = () => {
  const { t } = useLingui();
  const { closeDropdown } = useCloseDropdown();
  const { currentView } = useGetCurrentViewOnly();
  const { enqueueErrorSnackBar } = useSnackBar();
  const {
    referenceLayerContributions,
    refreshReferenceLayerContributions,
    setReferenceLayerContributions,
  } = useRecordMapReferenceLayerContributions({
    tileSourceViewId: currentView?.id,
  });

  const isDropdownOpen = useAtomComponentStateValue(
    isDropdownOpenComponentState,
    RECORD_MAP_LAYERS_DROPDOWN_ID,
  );

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
            {referenceLayerContributions.length === 0 ? (
              <StyledEmptyState>{t`No reference layers`}</StyledEmptyState>
            ) : (
              referenceLayerContributions.map((contribution) => (
                <MenuItemToggle
                  key={contribution.contributionId}
                  LeftIcon={IconMap}
                  onToggleChange={() => {
                    const nextIsVisible = !contribution.isVisible;
                    const previousContributions = referenceLayerContributions;

                    setReferenceLayerContributions((currentContributions) =>
                      currentContributions.map((currentContribution) =>
                        currentContribution.contributionId ===
                        contribution.contributionId
                          ? {
                              ...currentContribution,
                              isVisible: nextIsVisible,
                            }
                          : currentContribution,
                      ),
                    );

                    void persistReferenceLayerVisibility({
                      contribution,
                      isVisible: nextIsVisible,
                    })
                      .then(() => {
                        refreshReferenceLayerContributions();
                        window.dispatchEvent(
                          new CustomEvent(
                            RECORD_MAP_REFERENCE_LAYERS_UPDATED_EVENT,
                            { detail: { viewId: contribution.viewId } },
                          ),
                        );
                      })
                      .catch(() => {
                        setReferenceLayerContributions(previousContributions);
                        enqueueErrorSnackBar({
                          message: t`Unable to update map layer visibility.`,
                        });
                      });
                  }}
                  toggled={contribution.isVisible}
                  text={contribution.displayName}
                  toggleSize="small"
                />
              ))
            )}
          </DropdownMenuItemsContainer>
        </DropdownContent>
      }
    />
  );
};
