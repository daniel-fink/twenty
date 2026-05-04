import { geoReferenceLayerCatalogSchema } from 'src/engine/core-modules/geo-map/reference-layer-catalog/geo-reference-layer-catalog.schema';

const validCatalog = {
  version: 1,
  connections: {
    demo: {
      type: 'POSTGIS',
      uriEnv: 'GEO_REFERENCE_CONNECTION_DEMO',
    },
  },
  layers: [
    {
      key: 'demo-parcels',
      name: 'Demo parcels',
      source: {
        provider: 'EXTERNAL_POSTGIS',
        connectionKey: 'demo',
        schemaName: 'model',
        tableName: 'parcels',
        idColumnName: 'property_PROPID',
        geometryColumnName: 'geometry',
        geometrySrid: 7856,
        geometryType: 'MULTIPOLYGON',
      },
      title: {
        fields: ['address_ADDRESS'],
        fallback: 'featureId',
      },
      tile: {
        minZoom: 12,
        maxZoom: 18,
      },
      style: {
        type: 'fill',
        fillColor: '#2563eb',
        fillOpacity: 0.2,
      },
    },
  ],
  defaultViewAttachments: [
    {
      layerKey: 'demo-parcels',
      isVisible: true,
      position: 10,
    },
  ],
};

describe('geoReferenceLayerCatalogSchema', () => {
  it('accepts a valid external PostGIS catalog', () => {
    expect(() =>
      geoReferenceLayerCatalogSchema.parse(validCatalog),
    ).not.toThrow();
  });

  it('requires external PostGIS layers to declare a connection key', () => {
    expect(() =>
      geoReferenceLayerCatalogSchema.parse({
        ...validCatalog,
        layers: [
          {
            ...validCatalog.layers[0],
            source: {
              ...validCatalog.layers[0].source,
              connectionKey: undefined,
            },
          },
        ],
      }),
    ).toThrow('External PostGIS layers require a connectionKey');
  });

  it('rejects unknown default attachment layer keys', () => {
    expect(() =>
      geoReferenceLayerCatalogSchema.parse({
        ...validCatalog,
        defaultViewAttachments: [
          {
            layerKey: 'missing-layer',
            isVisible: true,
            position: 10,
          },
        ],
      }),
    ).toThrow('Unknown layerKey missing-layer');
  });

  it('rejects invalid tile zoom ranges', () => {
    expect(() =>
      geoReferenceLayerCatalogSchema.parse({
        ...validCatalog,
        layers: [
          {
            ...validCatalog.layers[0],
            tile: {
              minZoom: 18,
              maxZoom: 12,
            },
          },
        ],
      }),
    ).toThrow('minZoom must be less than or equal to maxZoom');
  });
});
