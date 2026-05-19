import { useLingui } from '@lingui/react/macro';
import { StyledDropdownMenuSubheader } from '@/ui/layout/dropdown/components/StyledDropdownMenuSubheader';
import { availableWorkspacesState } from '@/auth/states/availableWorkspacesState';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { AvailableWorkspacesSearchableList } from '@/ui/navigation/navigation-drawer/components/MultiWorkspaceDropdown/internal/components/AvailableWorkspacesSearchableList';
import {
  isChildWorkspaceOfCurrentWorkspace,
  isChildWorkspaceOfParentWorkspace,
  isParentWorkspaceOfCurrentWorkspace,
} from '@/ui/navigation/navigation-drawer/components/MultiWorkspaceDropdown/internal/utils/workspaceRelationshipUtils';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

export const WorkspacesForSignIn = ({
  searchValue,
}: {
  searchValue: string;
}) => {
  const { t } = useLingui();

  const availableWorkspaces = useAtomStateValue(availableWorkspacesState);
  const currentWorkspace = useAtomStateValue(currentWorkspaceState);

  const parentAvailableWorkspaces =
    availableWorkspaces.availableWorkspacesForSignIn.filter(
      (availableWorkspace) =>
        isParentWorkspaceOfCurrentWorkspace({
          availableWorkspace,
          currentWorkspaceId: currentWorkspace?.id,
        }),
    );

  const currentParentWorkspaceId =
    parentAvailableWorkspaces[0]?.workspaceRelationship?.parentWorkspaceId;

  const workspaces = availableWorkspaces.availableWorkspacesForSignIn.filter(
    (availableWorkspace) =>
      !isChildWorkspaceOfCurrentWorkspace({
        availableWorkspace,
        currentWorkspaceId: currentWorkspace?.id,
      }) &&
      !isChildWorkspaceOfParentWorkspace({
        availableWorkspace,
        parentWorkspaceId: currentParentWorkspaceId,
      }),
  );

  return (
    <>
      <StyledDropdownMenuSubheader>{t`Member of`}</StyledDropdownMenuSubheader>
      <AvailableWorkspacesSearchableList
        searchValue={searchValue}
        workspaces={workspaces}
      />
    </>
  );
};
