export type RecordMapReferenceLayerStyle =
  | {
      type: 'fill';
      fillColor: string;
      fillOpacity?: number;
      lineColor?: string;
      lineOpacity?: number;
      lineWidth?: number;
    }
  | {
      type: 'line';
      lineColor: string;
      lineOpacity?: number;
      lineWidth?: number;
    }
  | {
      type: 'circle';
      circleColor: string;
      circleOpacity?: number;
      circleRadius?: number;
      circleStrokeColor?: string;
      circleStrokeWidth?: number;
    };

export type RecordMapReferenceLayerContribution = {
  attribution?: string | null;
  bounds?: Record<string, unknown> | number[] | null;
  contributionId: string;
  displayName: string;
  featureDetailApplicationUniversalIdentifier: string;
  featureDetailCallbackUrl: string;
  featureDetailFrontComponentUniversalIdentifier: string;
  featureIdProperty?: string;
  isVisible: boolean;
  layerId: string;
  maxZoom?: number | null;
  minZoom?: number | null;
  position: number;
  sourceLayerName: string;
  style?: RecordMapReferenceLayerStyle | null;
  titleProperty?: string;
  tileJsonUrl: string;
  tileToken?: string;
  visibilityCallbackUrl?: string;
  viewId: string;
};

export type RecordMapReferenceLayerContributionsResponse = {
  layers: RecordMapReferenceLayerContribution[];
  status: 'success';
  viewId: string;
};

export type RecordMapRenderedReferenceLayer = {
  contribution: RecordMapReferenceLayerContribution;
  layerIds: string[];
};
