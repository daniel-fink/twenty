const RECORD_MAP_CONTRIBUTED_LAYER_ID_PREFIX = 'record-map-contributed-layer';

export const getRecordMapContributedLayerPrefix = (contributionId: string) =>
  `${RECORD_MAP_CONTRIBUTED_LAYER_ID_PREFIX}-${contributionId.replace(
    /[^a-zA-Z0-9_-]/g,
    '-',
  )}`;
