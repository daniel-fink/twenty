import { getPaddedRecordMapBounds } from '@/object-record/record-map/utils/getPaddedRecordMapBounds';

describe('getPaddedRecordMapBounds', () => {
  it('should preserve non-empty bounds', () => {
    expect(getPaddedRecordMapBounds([-10, -20, 10, 20])).toEqual([
      [-10, -20],
      [10, 20],
    ]);
  });

  it('should pad single-point bounds', () => {
    expect(getPaddedRecordMapBounds([10, 20, 10, 20])).toEqual([
      [9.995, 19.995],
      [10.005, 20.005],
    ]);
  });

  it('should pad flat latitude bounds', () => {
    expect(getPaddedRecordMapBounds([-180, -85, -80, -85])).toEqual([
      [-180, -85.005],
      [-80, -84.995],
    ]);
  });

  it('should clamp bounds to valid Web Mercator display bounds', () => {
    expect(getPaddedRecordMapBounds([-190, -90, 190, 90])).toEqual([
      [-180, -85.05112878],
      [180, 85.05112878],
    ]);
  });
});
