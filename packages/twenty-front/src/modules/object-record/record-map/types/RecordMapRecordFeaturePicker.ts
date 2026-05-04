export type RecordMapRecordFeaturePickerItem = {
  recordId: string;
  swatchColor: string;
  title: string;
};

export type RecordMapRecordFeaturePickerState = {
  items: RecordMapRecordFeaturePickerItem[];
  position: {
    x: number;
    y: number;
  };
};
