import { Logger } from '@nestjs/common';

import { Command, CommandRunner, Option } from 'nest-commander';

import { GeoReferenceLayerCatalogLoaderService } from 'src/engine/core-modules/geo-map/reference-layer-catalog/services/geo-reference-layer-catalog-loader.service';
import { GeoReferenceLayerCatalogValidationService } from 'src/engine/core-modules/geo-map/reference-layer-catalog/services/geo-reference-layer-catalog-validation.service';

type GeoReferenceLayerCatalogValidateOptions = {
  catalogPath?: string;
};

@Command({
  name: 'workspace:validate:geo-reference-layer-catalog',
  description:
    'Validate a geo reference layer catalog without materializing registry rows.',
})
export class GeoReferenceLayerCatalogValidateCommand extends CommandRunner {
  private readonly logger = new Logger(
    GeoReferenceLayerCatalogValidateCommand.name,
  );

  constructor(
    private readonly catalogLoaderService: GeoReferenceLayerCatalogLoaderService,
    private readonly catalogValidationService: GeoReferenceLayerCatalogValidationService,
  ) {
    super();
  }

  @Option({
    flags: '--catalog-path <catalogPath>',
    description:
      'Optional local path to the geo reference layer catalog JSON file. Falls back to configured storage/default catalog.',
  })
  parseCatalogPath(catalogPath: string): string {
    return catalogPath;
  }

  async run(
    _passedParams: string[],
    options: GeoReferenceLayerCatalogValidateOptions,
  ): Promise<void> {
    const catalog = await this.catalogLoaderService.loadCatalog({
      catalogPath: options.catalogPath,
    });
    const result = await this.catalogValidationService.validateCatalog({
      catalog,
    });

    this.logger.log(JSON.stringify(result, null, 2));

    if (!result.isValid) {
      throw new Error('Geo reference layer catalog validation failed');
    }
  }
}
