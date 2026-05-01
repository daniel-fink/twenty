export type RecordMapBounds = [number, number, number, number];

const MIN_BOUND_SPAN_DEGREES = 0.01;

export const getPaddedRecordMapBounds = (
  bounds: RecordMapBounds,
): [[number, number], [number, number]] => {
  const [west, south, east, north] = bounds;
  const longitudePadding = west === east ? MIN_BOUND_SPAN_DEGREES / 2 : 0;
  const latitudePadding = south === north ? MIN_BOUND_SPAN_DEGREES / 2 : 0;

  return [
    [west - longitudePadding, south - latitudePadding],
    [east + longitudePadding, north + latitudePadding],
  ];
};
