import { type RecordMapLayerContribution } from '@/object-record/record-map/types/RecordMapContribution';

export type RecordMapRecordFeaturePickerItem = {
  type: 'record';
  recordId: string;
  swatchColor: string;
  title: string;
};

export type RecordMapContributedFeaturePickerItem = {
  type: 'contribution';
  contribution: RecordMapLayerContribution;
  contributionId: string;
  featureId: string;
  layerId: string;
  swatchColor: string;
  title: string;
  viewId: string;
};

export type RecordMapFeaturePickerItem =
  | RecordMapRecordFeaturePickerItem
  | RecordMapContributedFeaturePickerItem;

export type RecordMapRecordFeaturePickerState = {
  items: RecordMapFeaturePickerItem[];
  position: {
    x: number;
    y: number;
  };
  shouldToggleSelection?: boolean;
};
