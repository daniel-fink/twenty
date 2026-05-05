import { type RecordMapReferenceLayerContribution } from '@/object-record/record-map/types/RecordMapReferenceLayerContribution';

export type RecordMapRecordFeaturePickerItem = {
  type: 'record';
  recordId: string;
  swatchColor: string;
  title: string;
};

export type RecordMapReferenceFeaturePickerItem = {
  type: 'reference';
  contribution: RecordMapReferenceLayerContribution;
  contributionId: string;
  featureId: string;
  layerId: string;
  swatchColor: string;
  title: string;
  viewId: string;
};

export type RecordMapFeaturePickerItem =
  | RecordMapRecordFeaturePickerItem
  | RecordMapReferenceFeaturePickerItem;

export type RecordMapRecordFeaturePickerState = {
  items: RecordMapFeaturePickerItem[];
  position: {
    x: number;
    y: number;
  };
};
