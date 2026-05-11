import { type RecordMapLayerContribution } from '@/object-record/record-map/types/RecordMapContribution';
import { getRecordMapContributionRenderOrder } from '@/object-record/record-map/utils/getRecordMapContributionRenderOrder';

const contribution = (
  contributionId: string,
  position: number,
): RecordMapLayerContribution => ({
  contributionId,
  displayName: contributionId,
  isVisible: true,
  layerId: contributionId,
  position,
  sourceLayerName: contributionId,
  tileJsonUrl: `https://example.com/${contributionId}.json`,
  viewId: 'view-1',
});

describe('getRecordMapContributionRenderOrder', () => {
  it('renders higher positions first so lower positions are visually on top', () => {
    expect(
      getRecordMapContributionRenderOrder([
        contribution('transactions', 10),
        contribution('parcels', 20),
        contribution('forecast-apartments', 30),
      ]).map((orderedContribution) => orderedContribution.contributionId),
    ).toEqual(['forecast-apartments', 'parcels', 'transactions']);
  });
});
