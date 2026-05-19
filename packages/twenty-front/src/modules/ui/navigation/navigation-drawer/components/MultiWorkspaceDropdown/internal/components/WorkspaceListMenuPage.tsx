import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { DropdownMenuHeader } from '@/ui/layout/dropdown/components/DropdownMenuHeader/DropdownMenuHeader';
import { DropdownMenuHeaderLeftComponent } from '@/ui/layout/dropdown/components/DropdownMenuHeader/internal/DropdownMenuHeaderLeftComponent';
import { DropdownMenuSearchInput } from '@/ui/layout/dropdown/components/DropdownMenuSearchInput';
import { DropdownMenuSeparator } from '@/ui/layout/dropdown/components/DropdownMenuSeparator';
import { AvailableWorkspacesSearchableList } from '@/ui/navigation/navigation-drawer/components/MultiWorkspaceDropdown/internal/components/AvailableWorkspacesSearchableList';
import { multiWorkspaceDropdownState } from '@/ui/navigation/navigation-drawer/states/multiWorkspaceDropdownState';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { useLingui } from '@lingui/react/macro';
import { useState, type ReactNode } from 'react';
import { IconChevronLeft } from 'twenty-ui/display';
import { type AvailableWorkspace } from '~/generated-metadata/graphql';

export const WorkspaceListMenuPage = ({
  children,
  title,
  workspaces,
}: {
  children?: (searchValue: string) => ReactNode;
  title: ReactNode;
  workspaces?: AvailableWorkspace[];
}) => {
  const { t } = useLingui();
  const setMultiWorkspaceDropdown = useSetAtomState(
    multiWorkspaceDropdownState,
  );
  const [searchValue, setSearchValue] = useState('');

  return (
    <DropdownContent>
      <DropdownMenuHeader
        StartComponent={
          <DropdownMenuHeaderLeftComponent
            onClick={() => setMultiWorkspaceDropdown('default')}
            Icon={IconChevronLeft}
          />
        }
      >
        {title}
      </DropdownMenuHeader>
      <DropdownMenuSearchInput
        placeholder={t`Search`}
        autoFocus
        onChange={(event) => {
          setSearchValue(event.target.value);
        }}
      />
      <DropdownMenuSeparator />
      {children ? (
        children(searchValue)
      ) : (
        <AvailableWorkspacesSearchableList
          searchValue={searchValue}
          workspaces={workspaces}
        />
      )}
    </DropdownContent>
  );
};
