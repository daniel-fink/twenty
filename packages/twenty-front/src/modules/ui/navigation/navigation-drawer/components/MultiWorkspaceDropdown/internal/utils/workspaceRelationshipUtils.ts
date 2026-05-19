import {
  type AvailableWorkspace,
  WorkspaceRelationshipType,
} from '~/generated-metadata/graphql';

export const isChildWorkspaceOfCurrentWorkspace = ({
  availableWorkspace,
  currentWorkspaceId,
}: {
  availableWorkspace: AvailableWorkspace;
  currentWorkspaceId?: string;
}) =>
  availableWorkspace.workspaceRelationship?.relationshipType ===
    WorkspaceRelationshipType.CHILD &&
  availableWorkspace.workspaceRelationship.parentWorkspaceId ===
    currentWorkspaceId &&
  availableWorkspace.workspaceRelationship.childWorkspaceId ===
    availableWorkspace.id;

export const isParentWorkspaceOfCurrentWorkspace = ({
  availableWorkspace,
  currentWorkspaceId,
}: {
  availableWorkspace: AvailableWorkspace;
  currentWorkspaceId?: string;
}) =>
  availableWorkspace.workspaceRelationship?.relationshipType ===
    WorkspaceRelationshipType.CHILD &&
  availableWorkspace.workspaceRelationship.childWorkspaceId ===
    currentWorkspaceId &&
  availableWorkspace.workspaceRelationship.parentWorkspaceId ===
    availableWorkspace.id;

export const isChildWorkspaceOfParentWorkspace = ({
  availableWorkspace,
  parentWorkspaceId,
}: {
  availableWorkspace: AvailableWorkspace;
  parentWorkspaceId?: string;
}) =>
  parentWorkspaceId !== undefined &&
  availableWorkspace.workspaceRelationship?.relationshipType ===
    WorkspaceRelationshipType.CHILD &&
  availableWorkspace.workspaceRelationship.parentWorkspaceId ===
    parentWorkspaceId &&
  availableWorkspace.workspaceRelationship.childWorkspaceId ===
    availableWorkspace.id;
