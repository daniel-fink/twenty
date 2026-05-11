import { resolveRecordMapContributionFrontComponentId } from '@/object-record/record-map/utils/resolveRecordMapContributionFrontComponentId';

describe('resolveRecordMapContributionFrontComponentId', () => {
  const frontComponents = [
    {
      id: 'front-component-1',
      universalIdentifier: '4dc7dffc-1b6a-4cf3-989c-981ff2a5f46c',
    },
    {
      id: 'front-component-2',
      universalIdentifier: '81af59b8-e0ff-4a68-8c77-442bc12c736b',
    },
  ];

  it('resolves a contributed front component by universal identifier', () => {
    expect(
      resolveRecordMapContributionFrontComponentId({
        frontComponents,
        frontComponentUniversalIdentifier:
          '4dc7dffc-1b6a-4cf3-989c-981ff2a5f46c',
      }),
    ).toBe('front-component-1');
  });

  it('returns null when the contributed front component is not found', () => {
    expect(
      resolveRecordMapContributionFrontComponentId({
        frontComponents,
        frontComponentUniversalIdentifier:
          '2fa63878-6ca7-47f6-bb85-c39a6ddf88e5',
      }),
    ).toBeNull();
  });

  it('returns null for empty contributed front component identifiers', () => {
    expect(
      resolveRecordMapContributionFrontComponentId({
        frontComponents,
        frontComponentUniversalIdentifier: null,
      }),
    ).toBeNull();

    expect(
      resolveRecordMapContributionFrontComponentId({
        frontComponents,
      }),
    ).toBeNull();
  });
});
