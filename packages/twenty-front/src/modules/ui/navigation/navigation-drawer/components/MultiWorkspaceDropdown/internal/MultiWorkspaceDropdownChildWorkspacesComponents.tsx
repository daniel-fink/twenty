import { availableWorkspacesState } from '@/auth/states/availableWorkspacesState';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { WorkspaceListMenuPage } from '@/ui/navigation/navigation-drawer/components/MultiWorkspaceDropdown/internal/components/WorkspaceListMenuPage';
import { isChildWorkspaceOfCurrentWorkspace } from '@/ui/navigation/navigation-drawer/components/MultiWorkspaceDropdown/internal/utils/workspaceRelationshipUtils';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useLingui } from '@lingui/react/macro';

export const MultiWorkspaceDropdownChildWorkspacesComponents = () => {
  const { t } = useLingui();
  const availableWorkspaces = useAtomStateValue(availableWorkspacesState);
  const currentWorkspace = useAtomStateValue(currentWorkspaceState);

  const childWorkspaces =
    availableWorkspaces.availableWorkspacesForSignIn.filter(
      (availableWorkspace) =>
        isChildWorkspaceOfCurrentWorkspace({
          availableWorkspace,
          currentWorkspaceId: currentWorkspace?.id,
        }),
    );

  return (
    <WorkspaceListMenuPage
      title={t`Child Workspaces`}
      workspaces={childWorkspaces}
    />
  );
};
