import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
  geoReferenceLayerCatalogSchema,
  geoReferenceLayerSidebarContractSchema,
} from 'src/engine/core-modules/geo-map/reference-layer-catalog/geo-reference-layer-catalog.schema';
import {
  type GeoReferenceLayerCatalog,
  type GeoReferenceLayerCatalogLayer,
  type GeoReferenceLayerSidebarContract,
} from 'src/engine/core-modules/geo-map/reference-layer-catalog/geo-reference-layer-catalog.types';

export type LoadedGeoReferenceLayerCatalogLayer =
  GeoReferenceLayerCatalogLayer & {
    sidebarContract: GeoReferenceLayerSidebarContract;
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
      const sidebarContractPath = resolve(
        catalogDirectory,
        layer.sidebarContractPath,
      );
      const sidebarContract = geoReferenceLayerSidebarContractSchema.parse(
        readJsonFile(sidebarContractPath),
      );

      return {
        ...layer,
        sidebarContract,
      };
    }),
  };
};
