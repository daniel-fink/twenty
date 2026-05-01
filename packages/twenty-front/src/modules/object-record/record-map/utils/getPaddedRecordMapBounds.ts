export type RecordMapBounds = [number, number, number, number];

const MIN_BOUND_SPAN_DEGREES = 0.01;
const MIN_LONGITUDE = -180;
const MAX_LONGITUDE = 180;
const MIN_WEB_MERCATOR_LATITUDE = -85.05112878;
const MAX_WEB_MERCATOR_LATITUDE = 85.05112878;

const clamp = ({
  value,
  min,
  max,
}: {
  value: number;
  min: number;
  max: number;
}) => Math.min(Math.max(value, min), max);

export const getPaddedRecordMapBounds = (
  bounds: RecordMapBounds,
): [[number, number], [number, number]] => {
  const [west, south, east, north] = bounds;
  const longitudePadding = west === east ? MIN_BOUND_SPAN_DEGREES / 2 : 0;
  const latitudePadding = south === north ? MIN_BOUND_SPAN_DEGREES / 2 : 0;

  return [
    [
      clamp({
        value: west - longitudePadding,
        min: MIN_LONGITUDE,
        max: MAX_LONGITUDE,
      }),
      clamp({
        value: south - latitudePadding,
        min: MIN_WEB_MERCATOR_LATITUDE,
        max: MAX_WEB_MERCATOR_LATITUDE,
      }),
    ],
    [
      clamp({
        value: east + longitudePadding,
        min: MIN_LONGITUDE,
        max: MAX_LONGITUDE,
      }),
      clamp({
        value: north + latitudePadding,
        min: MIN_WEB_MERCATOR_LATITUDE,
        max: MAX_WEB_MERCATOR_LATITUDE,
      }),
    ],
  ];
};
