import { z } from 'zod';

const sqlIdentifierSchema = z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/);
const colorSchema = z.string().min(1);

const geoReferenceLayerContractFieldTypeSchema = z.enum([
  'text',
  'number',
  'integer',
  'boolean',
  'date',
  'json',
  'url',
]);

const geoReferenceLayerContractFieldFormatSchema = z.enum([
  'area',
  'currency',
  'date',
  'multilineText',
  'number',
  'text',
  'url',
]);

export const geoReferenceLayerContractSortSchema = z
  .object({
    column: sqlIdentifierSchema,
    direction: z.enum(['asc', 'desc']).default('asc'),
  })
  .strict();

export const geoReferenceLayerContractSelectionTitleSchema = z
  .object({
    fields: z.array(sqlIdentifierSchema).min(1),
    fallback: z.literal('selectedFeatureValue'),
    format: geoReferenceLayerContractFieldFormatSchema.optional(),
  })
  .strict();

export const geoReferenceLayerContractFieldSchema = z
  .object({
    column: sqlIdentifierSchema,
    label: z.string().min(1),
    type: geoReferenceLayerContractFieldTypeSchema,
    description: z.string().nullable().optional(),
    format: geoReferenceLayerContractFieldFormatSchema.optional(),
    formatOptions: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .superRefine((field, context) => {
    if (
      field.format === 'currency' &&
      (typeof field.formatOptions?.currencyCode !== 'string' ||
        field.formatOptions.currencyCode.length === 0)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['formatOptions', 'currencyCode'],
        message: 'currency format requires formatOptions.currencyCode',
      });
    }
  });

export const geoReferenceLayerContractSectionSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    fields: z.array(geoReferenceLayerContractFieldSchema),
  })
  .strict();

export const geoReferenceLayerSidebarContractSchema = z
  .object({
    version: z.literal(1),
    tabId: z.string().min(1),
    title: z.string().min(1),
    dataset: z.string().min(1),
    query: z
      .object({
        type: z.literal('single'),
        selectedFeatureField: sqlIdentifierSchema,
        targetField: sqlIdentifierSchema,
        selectionTitle: geoReferenceLayerContractSelectionTitleSchema,
        sort: z.array(geoReferenceLayerContractSortSchema).default([]),
      })
      .strict(),
    sections: z.array(geoReferenceLayerContractSectionSchema),
  })
  .strict();

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
      z
        .object({
          key: z.string().min(1),
          name: z.string().min(1),
          description: z.string().nullable().optional(),
          source: z
            .object({
              provider: z.enum([
                'TWENTY_WORKSPACE_POSTGIS',
                'EXTERNAL_POSTGIS',
              ]),
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
            })
            .strict(),
          sidebarContractPath: z.string().min(1),
          tile: z
            .object({
              minZoom: z.number().int().min(0).max(22),
              maxZoom: z.number().int().min(0).max(22),
              maxFeatureCount: z
                .number()
                .int()
                .positive()
                .nullable()
                .optional(),
            })
            .strict(),
          style: styleSchema,
          defaultAttachment: z
            .object({
              isVisible: z.boolean(),
              position: z.number(),
            })
            .strict()
            .nullable()
            .optional(),
        })
        .strict(),
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
