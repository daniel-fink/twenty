import { Logger } from '@nestjs/common';

import { Command, CommandRunner, Option } from 'nest-commander';
import { isDefined } from 'twenty-shared/utils';

import { GeoReferenceLayerCatalogSyncService } from 'src/engine/core-modules/geo-map/reference-layer-catalog/services/geo-reference-layer-catalog-sync.service';

type GeoReferenceLayerCatalogSyncOptions = {
  workspaceId?: string;
  viewId?: string;
  catalogPath?: string;
};

@Command({
  name: 'workspace:sync:geo-reference-layer-catalog',
  description:
    'Validate and materialize a geo reference layer catalog into a single workspace map view.',
})
export class GeoReferenceLayerCatalogSyncCommand extends CommandRunner {
  private readonly logger = new Logger(
    GeoReferenceLayerCatalogSyncCommand.name,
  );

  constructor(
    private readonly catalogSyncService: GeoReferenceLayerCatalogSyncService,
  ) {
    super();
  }

  @Option({
    flags: '--workspace-id <workspaceId>',
    description: 'Workspace id to sync into.',
  })
  parseWorkspaceId(workspaceId: string): string {
    return workspaceId;
  }

  @Option({
    flags: '--view-id <viewId>',
    description: 'Map view id to attach the catalog default layers to.',
  })
  parseViewId(viewId: string): string {
    return viewId;
  }

  @Option({
    flags: '--catalog-path <catalogPath>',
    description: 'Path to the geo reference layer catalog JSON file.',
  })
  parseCatalogPath(catalogPath: string): string {
    return catalogPath;
  }

  async run(
    _passedParams: string[],
    options: GeoReferenceLayerCatalogSyncOptions,
  ): Promise<void> {
    if (!isDefined(options.workspaceId) || options.workspaceId === '') {
      throw new Error('--workspace-id is required');
    }

    if (!isDefined(options.viewId) || options.viewId === '') {
      throw new Error('--view-id is required');
    }

    if (!isDefined(options.catalogPath) || options.catalogPath === '') {
      throw new Error('--catalog-path is required');
    }

    const result = await this.catalogSyncService.syncCatalog({
      workspaceId: options.workspaceId,
      viewId: options.viewId,
      catalogPath: options.catalogPath,
    });

    this.logger.log(
      `Synced ${result.layerCount} geo reference layers, ${result.attachmentCount} view attachments, archived ${result.archivedLayerCount} stale layers.`,
    );
  }
}
