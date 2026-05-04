export type GeoReferenceLayerGeometryType =
  | 'POINT'
  | 'MULTIPOINT'
  | 'LINESTRING'
  | 'MULTILINESTRING'
  | 'POLYGON'
  | 'MULTIPOLYGON';

export type GeoReferenceLayerPropertyType =
  | 'TEXT'
  | 'NUMBER'
  | 'INTEGER'
  | 'BOOLEAN'
  | 'DATE'
  | 'JSON';

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

export type GeoReferenceLayerProperty = {
  column: string;
  label: string;
  type: GeoReferenceLayerPropertyType;
  tab?: string | null;
  group?: string | null;
  role?: string | null;
  description?: string | null;
  nullable?: boolean | null;
  isExposed?: boolean;
  source?: Record<string, unknown> | null;
};

export type GeoReferenceLayerPropertyManifest = {
  version: 1;
  kind?: 'geo-reference-layer-property-manifest';
  layerKey: string;
  exposure: {
    mode: 'EXPLICIT_ALLOWLIST';
    notes?: string | null;
  };
  title?: {
    fields: string[];
    fallback: 'featureId';
  };
  sourceMetadata?: Record<string, unknown> | null;
  properties: GeoReferenceLayerProperty[];
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
  propertyManifestPath?: string | null;
  exposedProperties?: GeoReferenceLayerProperty[];
  title: {
    fields: string[];
    fallback: 'featureId';
  };
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
