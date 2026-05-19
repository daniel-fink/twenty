import { isDefined } from 'twenty-shared/utils';

import {
  frontComponentHostCommunicationApi,
  type OpenFrontComponentInSidePanelFunction,
} from '../globals/frontComponentHostCommunicationApi';

export const openFrontComponentInSidePanel: OpenFrontComponentInSidePanelFunction =
  (params) => {
    const openFrontComponentInSidePanelFunction =
      frontComponentHostCommunicationApi.openFrontComponentInSidePanel;

    if (!isDefined(openFrontComponentInSidePanelFunction)) {
      throw new Error('openFrontComponentInSidePanelFunction is not set');
    }

    return openFrontComponentInSidePanelFunction(params);
  };
