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

export type LoadedGeoReferenceLayerCatalog = Omit<
  GeoReferenceLayerCatalog,
  'layers'
> & {
  catalogPath: string;
  catalogDirectory: string;
  catalogKey: string;
  layers: LoadedGeoReferenceLayerCatalogLayer[];
};

const readJsonFile = (filePath: string) =>
  JSON.parse(readFileSync(filePath, 'utf-8'));

export const loadGeoReferenceLayerCatalog = async ({
  catalogKey,
  catalogDirectory,
  catalogPath,
  catalogJson,
  readJson,
  resolvePath,
}: {
  catalogKey?: string;
  catalogDirectory: string;
  catalogPath: string;
  catalogJson: unknown;
  readJson: (filePath: string) => Promise<unknown>;
  resolvePath: (directory: string, filePath: string) => string;
}): Promise<LoadedGeoReferenceLayerCatalog> => {
  const catalog = geoReferenceLayerCatalogSchema.parse(catalogJson);
  const resolvedCatalogKey = catalog.name ?? catalogKey ?? catalogPath;

  return {
    ...catalog,
    catalogPath,
    catalogDirectory,
    catalogKey: resolvedCatalogKey,
    layers: await Promise.all(
      catalog.layers.map(async (layer) => {
        const sidebarContractPath = resolvePath(
          catalogDirectory,
          layer.sidebarContractPath,
        );
        const sidebarContract = geoReferenceLayerSidebarContractSchema.parse(
          await readJson(sidebarContractPath),
        );

        return {
          ...layer,
          sidebarContract,
        };
      }),
    ),
  };
};

export const loadGeoReferenceLayerCatalogFromFile = (
  catalogPath: string,
): LoadedGeoReferenceLayerCatalog => {
  const resolvedCatalogPath = resolve(catalogPath);
  const catalogDirectory = dirname(resolvedCatalogPath);
  const catalog = geoReferenceLayerCatalogSchema.parse(
    readJsonFile(resolvedCatalogPath),
  );

  return {
    ...catalog,
    catalogPath: resolvedCatalogPath,
    catalogDirectory,
    catalogKey: catalog.name ?? resolvedCatalogPath,
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
