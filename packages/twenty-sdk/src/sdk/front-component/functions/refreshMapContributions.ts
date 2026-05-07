import {
  frontComponentHostCommunicationApi,
  type RefreshMapContributionsFunction,
} from '../globals/frontComponentHostCommunicationApi';

export const refreshMapContributions: RefreshMapContributionsFunction = () => {
  const refreshMapContributionsFunction =
    frontComponentHostCommunicationApi.refreshMapContributions;

  if (!refreshMapContributionsFunction) {
    return Promise.resolve();
  }

  return refreshMapContributionsFunction();
};
