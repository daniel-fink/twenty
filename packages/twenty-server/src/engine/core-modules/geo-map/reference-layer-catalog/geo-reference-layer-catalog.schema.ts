import { z } from 'zod';

const sqlIdentifierSchema = z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/);
const colorSchema = z.string().min(1);

const geoReferenceLayerPropertyTypeSchema = z.enum([
  'TEXT',
  'NUMBER',
  'INTEGER',
  'BOOLEAN',
  'DATE',
  'JSON',
]);

export const geoReferenceLayerPropertySchema = z.object({
  column: sqlIdentifierSchema,
  label: z.string().min(1),
  type: geoReferenceLayerPropertyTypeSchema,
  tab: z.string().nullable().optional(),
  group: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  nullable: z.boolean().nullable().optional(),
  isExposed: z.boolean().optional(),
  source: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const geoReferenceLayerPropertyManifestSchema = z.object({
  version: z.literal(1),
  kind: z.literal('geo-reference-layer-property-manifest').optional(),
  layerKey: z.string().min(1),
  exposure: z.object({
    mode: z.literal('EXPLICIT_ALLOWLIST'),
    notes: z.string().nullable().optional(),
  }),
  title: z
    .object({
      fields: z.array(sqlIdentifierSchema).min(1),
      fallback: z.literal('featureId'),
    })
    .optional(),
  sourceMetadata: z.record(z.string(), z.unknown()).nullable().optional(),
  properties: z.array(geoReferenceLayerPropertySchema),
});

const styleSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('fill'),
    fillColor: colorSchema,
    fillOpacity: z.number().min(0).max(1),
    lineColor: colorSchema.optional(),
    lineOpacity: z.number().min(0).max(1).optional(),
    lineWidth: z.number().min(0).optional(),
  }),
  z.object({
    type: z.literal('line'),
    lineColor: colorSchema,
    lineOpacity: z.number().min(0).max(1).optional(),
    lineWidth: z.number().min(0),
  }),
  z.object({
    type: z.literal('circle'),
    circleColor: colorSchema,
    circleOpacity: z.number().min(0).max(1).optional(),
    circleRadius: z.number().min(0),
    circleStrokeColor: colorSchema.optional(),
    circleStrokeWidth: z.number().min(0).optional(),
  }),
]);

export const geoReferenceLayerCatalogSchema = z
  .object({
    version: z.literal(1),
    kind: z.literal('geo-reference-layer-catalog').optional(),
    name: z.string().nullable().optional(),
    private: z.boolean().optional(),
    connections: z.record(
      z.string().min(1),
      z.object({
        type: z.literal('POSTGIS'),
        uriEnv: z.string().min(1),
      }),
    ),
    layers: z.array(
      z.object({
        key: z.string().min(1),
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        source: z.object({
          provider: z.enum(['TWENTY_WORKSPACE_POSTGIS', 'EXTERNAL_POSTGIS']),
          connectionKey: z.string().nullable().optional(),
          schemaName: sqlIdentifierSchema,
          tableName: sqlIdentifierSchema,
          idColumnName: sqlIdentifierSchema,
          geometryColumnName: sqlIdentifierSchema,
          geometrySrid: z.number().int().positive(),
          geometryType: z.enum([
            'POINT',
            'MULTIPOINT',
            'LINESTRING',
            'MULTILINESTRING',
            'POLYGON',
            'MULTIPOLYGON',
          ]),
        }),
        propertyManifestPath: z.string().nullable().optional(),
        exposedProperties: z.array(geoReferenceLayerPropertySchema).optional(),
        title: z.object({
          fields: z.array(sqlIdentifierSchema).min(1),
          fallback: z.literal('featureId'),
        }),
        tile: z.object({
          minZoom: z.number().int().min(0).max(22),
          maxZoom: z.number().int().min(0).max(22),
          maxFeatureCount: z.number().int().positive().nullable().optional(),
        }),
        style: styleSchema,
        defaultAttachment: z
          .object({
            isVisible: z.boolean(),
            position: z.number(),
          })
          .nullable()
          .optional(),
      }),
    ),
    defaultViewAttachments: z
      .array(
        z.object({
          layerKey: z.string().min(1),
          isVisible: z.boolean(),
          position: z.number(),
        }),
      )
      .optional(),
  })
  .superRefine((catalog, context) => {
    const layerKeys = new Set<string>();

    for (const [index, layer] of catalog.layers.entries()) {
      if (layerKeys.has(layer.key)) {
        context.addIssue({
          code: 'custom',
          path: ['layers', index, 'key'],
          message: `Duplicate layer key ${layer.key}`,
        });
      }

      layerKeys.add(layer.key);

      if (layer.tile.minZoom > layer.tile.maxZoom) {
        context.addIssue({
          code: 'custom',
          path: ['layers', index, 'tile'],
          message: 'minZoom must be less than or equal to maxZoom',
        });
      }

      if (
        layer.source.provider === 'EXTERNAL_POSTGIS' &&
        !layer.source.connectionKey
      ) {
        context.addIssue({
          code: 'custom',
          path: ['layers', index, 'source', 'connectionKey'],
          message: 'External PostGIS layers require a connectionKey',
        });
      }

      if (
        layer.source.connectionKey &&
        !catalog.connections[layer.source.connectionKey]
      ) {
        context.addIssue({
          code: 'custom',
          path: ['layers', index, 'source', 'connectionKey'],
          message: `Unknown connectionKey ${layer.source.connectionKey}`,
        });
      }
    }

    for (const [index, attachment] of (
      catalog.defaultViewAttachments ?? []
    ).entries()) {
      if (!layerKeys.has(attachment.layerKey)) {
        context.addIssue({
          code: 'custom',
          path: ['defaultViewAttachments', index, 'layerKey'],
          message: `Unknown layerKey ${attachment.layerKey}`,
        });
      }
    }
  });
