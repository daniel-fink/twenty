import { useLingui } from '@lingui/react/macro';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

import { WorkspacesForSignIn } from './components/WorkspacesForSignIn';
import { WorkspacesForSignUp } from './components/WorkspacesForSignUp';
import { availableWorkspacesState } from '@/auth/states/availableWorkspacesState';
import { WorkspaceListMenuPage } from '@/ui/navigation/navigation-drawer/components/MultiWorkspaceDropdown/internal/components/WorkspaceListMenuPage';

export const MultiWorkspaceDropdownWorkspacesListComponents = () => {
  const { t } = useLingui();

  const availableWorkspaces = useAtomStateValue(availableWorkspacesState);

  return (
    <WorkspaceListMenuPage title={t`Other workspaces`}>
      {(searchValue) => (
        <>
          <WorkspacesForSignIn searchValue={searchValue} />
          {availableWorkspaces.availableWorkspacesForSignUp.length > 0 && (
            <WorkspacesForSignUp searchValue={searchValue} />
          )}
        </>
      )}
    </WorkspaceListMenuPage>
  );
};
