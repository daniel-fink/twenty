export {
  pageType,
  isInSidePanel,
  isDashboardPageLayoutInEditMode,
  isLayoutCustomizationModeEnabled,
  favoriteRecordIds,
  isSelectAll,
  hasAnySoftDeleteFilterOnView,
  numberOfSelectedRecords,
  objectPermissions,
  selectedRecords,
  featureFlags,
  targetObjectReadPermissions,
  targetObjectWritePermissions,
  isDefined,
  isNonEmptyString,
  includes,
  every,
  everyDefined,
  everyEquals,
  some,
  someDefined,
  someEquals,
  none,
  noneDefined,
  noneEquals,
  someNonEmptyString,
  includesEvery,
  objectMetadataItem,
} from './conditional-availability/conditional-availability-variables';
export { closeSidePanel } from './functions/closeSidePanel';
export { enqueueSnackbar } from './functions/enqueueSnackbar';
export { navigate } from './functions/navigate';
export { openCommandConfirmationModal } from './functions/openCommandConfirmationModal';
export { openFrontComponentInSidePanel } from './functions/openFrontComponentInSidePanel';
export { openSidePanelPage } from './functions/openSidePanelPage';
export { refreshMapContributions } from './functions/refreshMapContributions';
export { unmountFrontComponent } from './functions/unmountFrontComponent';
export { updateProgress } from './functions/updateProgress';
export { useFrontComponentExecutionContext } from './hooks/useFrontComponentExecutionContext';
export { useFrontComponentId } from './hooks/useFrontComponentId';
export { useRecordId } from './hooks/useRecordId';
export { useUserId } from './hooks/useUserId';
export type { FrontComponentExecutionContext } from './types/FrontComponentExecutionContext';
export { getFrontComponentCommandErrorDedupeKey } from './utils/getFrontComponentCommandErrorDedupeKey';
export type {
  CloseSidePanelFunction,
  CommandConfirmationModalAccent,
  CommandConfirmationModalResult,
  EnqueueSnackbarFunction,
  NavigateFunction,
  OpenCommandConfirmationModalFunction,
  OpenCommandConfirmationModalHostFunction,
  OpenFrontComponentInSidePanelFunction,
  OpenSidePanelPageFunction,
  RefreshMapContributionsFunction,
  RequestAccessTokenRefreshFunction,
  UnmountFrontComponentFunction,
  UpdateProgressFunction,
} from './globals/frontComponentHostCommunicationApi';

export {
  Command,
  CommandLink,
  CommandModal,
  CommandOpenSidePanelPage,
} from './command';
export type {
  CommandLinkProps,
  CommandModalProps,
  CommandOpenSidePanelPageProps,
  CommandProps,
} from './command';

export { AppPath, SidePanelPages } from 'twenty-shared/types';
export type {
  EnqueueSnackbarParams,
  SnackBarVariant,
} from 'twenty-shared/types';
