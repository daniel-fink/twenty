import { resolveRecordMapContributionFillColor } from '@/object-record/record-map/utils/resolveRecordMapContributionFillColor';

describe('resolveRecordMapContributionFillColor', () => {
  it('returns the static fill color when no property is configured', () => {
    expect(
      resolveRecordMapContributionFillColor({
        fillColor: '#2563EB',
        fillOpacity: 0.5,
        type: 'fill',
      }),
    ).toBe('#2563EB');
  });

  it('returns a data-driven color expression when a property is configured', () => {
    expect(
      resolveRecordMapContributionFillColor({
        fillColor: '#2563EB',
        fillColorProperty: 'map_color_hex',
        fillOpacity: 0.5,
        type: 'fill',
      }),
    ).toEqual(['coalesce', ['get', 'map_color_hex'], '#2563EB']);
  });
});
