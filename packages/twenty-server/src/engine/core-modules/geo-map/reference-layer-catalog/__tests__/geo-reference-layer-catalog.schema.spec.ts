import {
  geoReferenceLayerCatalogSchema,
  geoReferenceLayerSidebarContractSchema,
} from 'src/engine/core-modules/geo-map/reference-layer-catalog/geo-reference-layer-catalog.schema';

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
      sidebarContractPath: './demo-parcels.contract.json',
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

  it('defaults v1 operational catalog fields', () => {
    expect(
      geoReferenceLayerCatalogSchema.parse(validCatalog).layers[0],
    ).toMatchObject({
      metadata: {},
      securityPolicy: {
        kind: 'AUTHENTICATED_WORKSPACE',
        propertyPolicy: 'ALLOWLIST_ONLY',
      },
      status: 'ACTIVE',
      tileProvider: 'TWENTY_POSTGIS',
    });
  });

  it('accepts disabled layers with attribution and metadata', () => {
    expect(() =>
      geoReferenceLayerCatalogSchema.parse({
        ...validCatalog,
        layers: [
          {
            ...validCatalog.layers[0],
            attribution: 'Demo source',
            metadata: { sourceUpdatedAt: '2026-05-04' },
            status: 'DISABLED',
          },
        ],
      }),
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

  it('rejects legacy property manifest fields', () => {
    expect(() =>
      geoReferenceLayerCatalogSchema.parse({
        ...validCatalog,
        layers: [
          {
            ...validCatalog.layers[0],
            propertyManifestPath: './demo.properties.json',
          },
        ],
      }),
    ).toThrow('Unrecognized key');
  });
});

describe('geoReferenceLayerSidebarContractSchema', () => {
  const validContract = {
    version: 1,
    tabId: 'attributes',
    title: 'Attributes',
    dataset: 'parcels',
    query: {
      type: 'single',
      selectedFeatureField: 'property_SHAPEUUID',
      targetField: 'property_SHAPEUUID',
      selectionTitle: {
        fields: ['address_ADDRESS'],
        fallback: 'selectedFeatureValue',
      },
      sort: [{ column: 'address_ADDRESS', direction: 'asc' }],
    },
    sections: [
      {
        id: 'address',
        title: 'Address',
        fields: [
          {
            column: 'address_ADDRESS',
            label: 'Address',
            type: 'text',
          },
        ],
      },
    ],
  };

  it('accepts a valid single-feature sidebar contract', () => {
    expect(() =>
      geoReferenceLayerSidebarContractSchema.parse(validContract),
    ).not.toThrow();
  });

  it('rejects unsupported query types', () => {
    expect(() =>
      geoReferenceLayerSidebarContractSchema.parse({
        ...validContract,
        query: {
          ...validContract.query,
          type: 'many',
        },
      }),
    ).toThrow();
  });

  it('requires every column-backed field to declare a type', () => {
    expect(() =>
      geoReferenceLayerSidebarContractSchema.parse({
        ...validContract,
        sections: [
          {
            ...validContract.sections[0],
            fields: [
              {
                column: 'address_ADDRESS',
                label: 'Address',
              },
            ],
          },
        ],
      }),
    ).toThrow();
  });

  it('requires currency fields to declare a currency code', () => {
    expect(() =>
      geoReferenceLayerSidebarContractSchema.parse({
        ...validContract,
        sections: [
          {
            ...validContract.sections[0],
            fields: [
              {
                column: 'model_psi_price',
                label: 'Price',
                type: 'number',
                format: 'currency',
              },
            ],
          },
        ],
      }),
    ).toThrow('currency format requires formatOptions.currencyCode');
  });

  it('rejects renderer-only contract fields', () => {
    expect(() =>
      geoReferenceLayerSidebarContractSchema.parse({
        ...validContract,
        sections: [
          {
            ...validContract.sections[0],
            fields: [
              {
                column: 'transaction_URL',
                label: 'Listing URL',
                type: 'url',
                renderer: 'externalLink',
              },
            ],
          },
        ],
      }),
    ).toThrow('Unrecognized key');
  });
});
