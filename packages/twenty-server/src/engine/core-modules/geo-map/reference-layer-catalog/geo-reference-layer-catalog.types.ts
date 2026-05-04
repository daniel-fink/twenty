export type GeoReferenceLayerGeometryType =
  | 'POINT'
  | 'MULTIPOINT'
  | 'LINESTRING'
  | 'MULTILINESTRING'
  | 'POLYGON'
  | 'MULTIPOLYGON';

export type GeoReferenceLayerStyle =
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

export type GeoReferenceLayerContractFieldType =
  | 'text'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'date'
  | 'json'
  | 'url';

export type GeoReferenceLayerContractFieldFormat =
  | 'area'
  | 'currency'
  | 'date'
  | 'multilineText'
  | 'number'
  | 'text'
  | 'url';

export type GeoReferenceLayerContractSort = {
  column: string;
  direction: 'asc' | 'desc';
};

export type GeoReferenceLayerContractSelectionTitle = {
  fields: string[];
  fallback: 'selectedFeatureValue';
  format?: GeoReferenceLayerContractFieldFormat;
};

export type GeoReferenceLayerContractField = {
  column: string;
  label: string;
  type: GeoReferenceLayerContractFieldType;
  description?: string | null;
  format?: GeoReferenceLayerContractFieldFormat;
  formatOptions?: Record<string, unknown>;
};

export type GeoReferenceLayerContractSection = {
  id: string;
  title: string;
  fields: GeoReferenceLayerContractField[];
};

export type GeoReferenceLayerSidebarContract = {
  version: 1;
  tabId: string;
  title: string;
  dataset: string;
  query: {
    type: 'single';
    selectedFeatureField: string;
    targetField: string;
    selectionTitle: GeoReferenceLayerContractSelectionTitle;
    sort: GeoReferenceLayerContractSort[];
  };
  sections: GeoReferenceLayerContractSection[];
};

export type GeoReferenceLayerCatalogConnection = {
  type: 'POSTGIS';
  uriEnv: string;
};

export type GeoReferenceLayerCatalogLayer = {
  key: string;
  name: string;
  description?: string | null;
  source: {
    provider: 'TWENTY_WORKSPACE_POSTGIS' | 'EXTERNAL_POSTGIS';
    connectionKey?: string | null;
    schemaName: string;
    tableName: string;
    idColumnName: string;
    geometryColumnName: string;
    geometrySrid: number;
    geometryType: GeoReferenceLayerGeometryType;
  };
  sidebarContractPath: string;
  sidebarContract?: GeoReferenceLayerSidebarContract;
  tile: {
    minZoom: number;
    maxZoom: number;
    maxFeatureCount?: number | null;
  };
  style: GeoReferenceLayerStyle;
  defaultAttachment?: {
    isVisible: boolean;
    position: number;
  } | null;
};

export type GeoReferenceLayerCatalog = {
  version: 1;
  kind?: 'geo-reference-layer-catalog';
  name?: string | null;
  private?: boolean;
  connections: Record<string, GeoReferenceLayerCatalogConnection>;
  layers: GeoReferenceLayerCatalogLayer[];
  defaultViewAttachments?: {
    layerKey: string;
    isVisible: boolean;
    position: number;
  }[];
};
