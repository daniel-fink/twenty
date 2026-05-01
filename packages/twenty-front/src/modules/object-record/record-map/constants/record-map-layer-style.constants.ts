import { BACKGROUND_LIGHT, MAIN_COLORS_LIGHT } from 'twenty-ui/theme';

import { convertDisplayP3ToMapLibreRgb } from '@/object-record/record-map/utils/convertDisplayP3ToMapLibreRgb.util';

export const RECORD_MAP_LAYER_COLORS = {
  // MapLibre does not accept color(display-p3 ...) values emitted by the theme.
  blue: convertDisplayP3ToMapLibreRgb(MAIN_COLORS_LIGHT.blue),
  white: convertDisplayP3ToMapLibreRgb(BACKGROUND_LIGHT.primary),
} as const;
