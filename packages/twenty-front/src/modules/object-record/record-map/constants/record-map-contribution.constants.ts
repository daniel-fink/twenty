import { REACT_APP_MAP_EXTENSION_CONTRIBUTION_ROUTES } from '~/config';

export const RECORD_MAP_EXTENSION_CONTRIBUTION_ROUTES =
  REACT_APP_MAP_EXTENSION_CONTRIBUTION_ROUTES.split(',')
    .map((route) => route.trim())
    .filter(Boolean);

export const RECORD_MAP_CONTRIBUTED_LAYER_ID_PREFIX =
  'record-map-contributed-layer';

export const RECORD_MAP_CONTRIBUTIONS_UPDATED_EVENT =
  'record-map-contributions-updated';
