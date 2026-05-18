import { availableWorkspacesState } from '@/auth/states/availableWorkspacesState';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { AvailableWorkspaceItem } from '@/ui/navigation/navigation-drawer/components/MultiWorkspaceDropdown/internal/components/AvailableWorkspaceItem';
import { useFilteredAvailableWorkspaces } from '@/ui/navigation/navigation-drawer/hooks/useFilteredAvailableWorkspaces';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { type AvailableWorkspace } from '~/generated-metadata/graphql';

export const AvailableWorkspacesSearchableList = ({
  searchValue,
  workspaces,
}: {
  searchValue: string;
  workspaces?: AvailableWorkspace[];
}) => {
  const availableWorkspaces = useAtomStateValue(availableWorkspacesState);
  const currentWorkspace = useAtomStateValue(currentWorkspaceState);
  const { searchAvailableWorkspaces } = useFilteredAvailableWorkspaces();

  return (
    <DropdownMenuItemsContainer>
      {searchAvailableWorkspaces(
        searchValue,
        workspaces ?? availableWorkspaces.availableWorkspacesForSignIn,
      ).map((availableWorkspace) => (
        <AvailableWorkspaceItem
          key={availableWorkspace.id}
          availableWorkspace={availableWorkspace}
          isSelected={currentWorkspace?.id === availableWorkspace.id}
        />
      ))}
    </DropdownMenuItemsContainer>
  );
};
