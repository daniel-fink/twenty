import { type RecordMapLayerContribution } from '@/object-record/record-map/types/RecordMapContribution';

export const getRecordMapContributionRenderOrder = (
  contributions: RecordMapLayerContribution[],
) =>
  [...contributions].sort(
    (firstContribution, secondContribution) =>
      secondContribution.position - firstContribution.position,
  );
