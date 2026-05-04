export type RecordMapReferenceLayerStyle =
  | {
      type: 'fill';
      fillColor: string;
      fillOpacity: number;
      lineColor?: string;
      lineOpacity?: number;
      lineWidth?: number;
    }
  | {
      type: 'line';
      lineColor: string;
      lineOpacity?: number;
      lineWidth: number;
    }
  | {
      type: 'circle';
      circleColor: string;
      circleOpacity?: number;
      circleRadius: number;
      circleStrokeColor?: string;
      circleStrokeWidth?: number;
    };

export type RecordMapReferenceLayer = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  attribution?: string | null;
  source: {
    geometryType: string;
  };
  tile: {
    minZoom: number;
    maxZoom: number;
  };
  style: RecordMapReferenceLayerStyle;
  query: {
    selectedFeatureField: string;
    sort: {
      column: string;
      direction: 'asc' | 'desc';
    }[];
  };
  attachment: {
    position: number;
    defaultIsVisible: boolean;
    isVisible: boolean;
  };
};

export type RecordMapReferenceLayerFeature = {
  layerId: string;
  layerKey: string;
  layerName: string;
  selectedFeatureValue: string;
  title: string;
  bounds: [number, number, number, number] | null;
  tab: {
    id: string;
    title: string;
  };
  sections: {
    id: string;
    title: string;
    fields: {
      column: string;
      label: string;
      type: 'text' | 'number' | 'integer' | 'boolean' | 'date' | 'json' | 'url';
      format?:
        | 'area'
        | 'currency'
        | 'date'
        | 'multilineText'
        | 'number'
        | 'text'
        | 'url'
        | null;
      formatOptions?: Record<string, unknown> | null;
      description?: string | null;
      value: unknown;
    }[];
  }[];
};

export type RecordMapReferenceLayerFeatureField =
  RecordMapReferenceLayerFeature['sections'][number]['fields'][number];

export type RecordMapReferenceFeaturePickerItem = {
  selectedFeatureValue: string;
  layerId: string;
  layerName: string;
  swatchColor: string;
  title: string;
};

export type RecordMapReferenceFeaturePickerState = {
  items: RecordMapReferenceFeaturePickerItem[];
  position: {
    x: number;
    y: number;
  };
};
