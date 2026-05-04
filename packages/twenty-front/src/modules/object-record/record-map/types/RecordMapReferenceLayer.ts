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
  source: {
    geometryType: string;
  };
  tile: {
    minZoom: number;
    maxZoom: number;
  };
  style: RecordMapReferenceLayerStyle;
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
  featureId: string;
  title: string;
  bounds: [number, number, number, number] | null;
  properties: {
    column: string;
    label: string;
    type: string;
    tab?: string | null;
    group?: string | null;
    role?: string | null;
    description?: string | null;
    value: unknown;
  }[];
};
