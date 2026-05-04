import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
  geoReferenceLayerCatalogSchema,
  geoReferenceLayerPropertyManifestSchema,
} from 'src/engine/core-modules/geo-map/reference-layer-catalog/geo-reference-layer-catalog.schema';
import {
  type GeoReferenceLayerCatalog,
  type GeoReferenceLayerCatalogLayer,
  type GeoReferenceLayerPropertyManifest,
} from 'src/engine/core-modules/geo-map/reference-layer-catalog/geo-reference-layer-catalog.types';

export type LoadedGeoReferenceLayerCatalogLayer =
  GeoReferenceLayerCatalogLayer & {
    exposedPropertiesManifest?: GeoReferenceLayerPropertyManifest;
  };

export type LoadedGeoReferenceLayerCatalog = GeoReferenceLayerCatalog & {
  catalogPath: string;
  catalogDirectory: string;
  catalogKey: string;
  layers: LoadedGeoReferenceLayerCatalogLayer[];
};

const readJsonFile = (filePath: string) =>
  JSON.parse(readFileSync(filePath, 'utf-8'));

export const loadGeoReferenceLayerCatalogFromFile = (
  catalogPath: string,
): LoadedGeoReferenceLayerCatalog => {
  const resolvedCatalogPath = resolve(catalogPath);
  const catalogDirectory = dirname(resolvedCatalogPath);
  const catalog = geoReferenceLayerCatalogSchema.parse(
    readJsonFile(resolvedCatalogPath),
  );
  const catalogKey = catalog.name ?? resolvedCatalogPath;

  return {
    ...catalog,
    catalogPath: resolvedCatalogPath,
    catalogDirectory,
    catalogKey,
    layers: catalog.layers.map((layer) => {
      if (!layer.propertyManifestPath) {
        return layer;
      }

      const manifestPath = resolve(
        catalogDirectory,
        layer.propertyManifestPath,
      );
      const manifest = geoReferenceLayerPropertyManifestSchema.parse(
        readJsonFile(manifestPath),
      );

      if (manifest.layerKey !== layer.key) {
        throw new Error(
          `Property manifest ${manifestPath} belongs to ${manifest.layerKey}, expected ${layer.key}`,
        );
      }

      return {
        ...layer,
        exposedProperties: manifest.properties.filter(
          (property) => property.isExposed !== false,
        ),
        exposedPropertiesManifest: manifest,
      };
    }),
  };
};
