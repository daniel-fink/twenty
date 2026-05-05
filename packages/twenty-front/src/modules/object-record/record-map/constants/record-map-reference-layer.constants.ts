import { REACT_APP_MAP_LAYER_CONTRIBUTION_ROUTES } from '~/config';

export const RECORD_MAP_REFERENCE_LAYER_CONTRIBUTION_ROUTES =
  REACT_APP_MAP_LAYER_CONTRIBUTION_ROUTES.split(',')
    .map((route) => route.trim())
    .filter(Boolean);

export const RECORD_MAP_REFERENCE_LAYER_ID_PREFIX =
  'record-map-reference-layer';

export const RECORD_MAP_REFERENCE_LAYERS_UPDATED_EVENT =
  'record-map-reference-layers-updated';
