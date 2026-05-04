import { Injectable } from '@nestjs/common';

import { dirname, join, normalize } from 'node:path/posix';
import { join as joinPath } from 'node:path';

import { FileStorageDriverFactory } from 'src/engine/core-modules/file-storage/file-storage-driver.factory';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import {
  type LoadedGeoReferenceLayerCatalog,
  loadGeoReferenceLayerCatalog,
  loadGeoReferenceLayerCatalogFromFile,
} from 'src/engine/core-modules/geo-map/reference-layer-catalog/utils/load-geo-reference-layer-catalog.util';
import { streamToBuffer } from 'src/utils/stream-to-buffer';

const DEFAULT_GEO_REFERENCE_LAYER_CATALOG_PATH = joinPath(
  __dirname,
  '..',
  'default-geo-reference-layer-catalog.json',
);

@Injectable()
export class GeoReferenceLayerCatalogLoaderService {
  constructor(
    private readonly fileStorageDriverFactory: FileStorageDriverFactory,
    private readonly twentyConfigService: TwentyConfigService,
  ) {}

  async loadCatalog({
    catalogPath,
  }: {
    catalogPath?: string;
  }): Promise<LoadedGeoReferenceLayerCatalog> {
    if (catalogPath) {
      return loadGeoReferenceLayerCatalogFromFile(catalogPath);
    }

    const storageCatalogPath = this.twentyConfigService.get(
      'GEO_REFERENCE_LAYER_CATALOG_STORAGE_PATH',
    );

    if (!storageCatalogPath) {
      return loadGeoReferenceLayerCatalogFromFile(
        DEFAULT_GEO_REFERENCE_LAYER_CATALOG_PATH,
      );
    }

    const driver = this.fileStorageDriverFactory.getCurrentDriver();
    const readJson = async (filePath: string): Promise<unknown> => {
      const stream = await driver.readFile({ filePath });
      const body = (await streamToBuffer(stream)).toString('utf-8');

      return JSON.parse(body);
    };
    const catalogDirectory = dirname(storageCatalogPath);

    return loadGeoReferenceLayerCatalog({
      catalogDirectory,
      catalogJson: await readJson(storageCatalogPath),
      catalogKey: storageCatalogPath,
      catalogPath: storageCatalogPath,
      readJson,
      resolvePath: (directory, filePath) =>
        normalize(join(directory, filePath)),
    });
  }
}
