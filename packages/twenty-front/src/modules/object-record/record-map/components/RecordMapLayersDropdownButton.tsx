import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { DropdownMenuHeader } from '@/ui/layout/dropdown/components/DropdownMenuHeader/DropdownMenuHeader';
import { DropdownMenuHeaderLeftComponent } from '@/ui/layout/dropdown/components/DropdownMenuHeader/internal/DropdownMenuHeaderLeftComponent';
import { StyledHeaderDropdownButton } from '@/ui/layout/dropdown/components/StyledHeaderDropdownButton';
import { GenericDropdownContentWidth } from '@/ui/layout/dropdown/constants/GenericDropdownContentWidth';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { isDropdownOpenComponentState } from '@/ui/layout/dropdown/states/isDropdownOpenComponentState';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useLingui } from '@lingui/react/macro';
import { IconX } from 'twenty-ui/display';

const RECORD_MAP_LAYERS_DROPDOWN_ID = 'record-map-layers-dropdown';

export const RecordMapLayersDropdownButton = () => {
  const { t } = useLingui();
  const { closeDropdown } = useCloseDropdown();

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
        </DropdownContent>
      }
    />
  );
};
