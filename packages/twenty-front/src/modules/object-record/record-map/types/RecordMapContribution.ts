export type RecordMapLayerContributionStyle =
  | {
      type: 'fill';
      fillColor: string;
      fillColorProperty?: string;
      fillOpacity?: number;
      fillOpacityProperty?: string;
      lineColor?: string;
      lineOpacity?: number;
      lineWidth?: number;
      swatch?: {
        colors?: unknown;
        name?: string;
        type?: unknown;
      };
      selectedStyle?: {
        fillColor: string;
        fillOpacity?: number;
        lineColor?: string;
        lineOpacity?: number;
        lineWidth?: number;
      };
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

export type RecordMapOpenFrontComponentAction = {
  applicationUniversalIdentifier: string;
  frontComponentUniversalIdentifier: string;
  params?: Record<string, string>;
  type: 'OPEN_FRONT_COMPONENT';
};

export type RecordMapLayerContribution = {
  attribution?: string | null;
  bounds?: Record<string, unknown> | number[] | null;
  contributionId: string;
  displayName: string;
  featureIdProperty?: string;
  featureSelectionAction?: RecordMapOpenFrontComponentAction;
  isMultiSelectEnabled: boolean;
  isVisible: boolean;
  layerId: string;
  maxZoom?: number | null;
  minZoom?: number | null;
  position: number;
  sourceLayerName: string;
  style?: RecordMapLayerContributionStyle | null;
  titleProperty?: string;
  tileJsonUrl: string;
  viewId: string;
};

export type RecordMapControlContribution = {
  applicationUniversalIdentifier: string;
  contributionId: string;
  frontComponentUniversalIdentifier: string;
  params?: Record<string, string>;
  position: number;
};

export type RecordMapContributionsResponse = {
  controls?: RecordMapControlContribution[];
  layers: RecordMapLayerContribution[];
  status: 'success';
  viewId: string;
};

export type RecordMapRenderedContributionLayer = {
  contribution: RecordMapLayerContribution;
  hitLayerIds: string[];
  layerIds: string[];
};

export type RecordMapSelectedContributionFeature = {
  activeFeatureId: string;
  contributionId: string;
  featureIds: string[];
};
