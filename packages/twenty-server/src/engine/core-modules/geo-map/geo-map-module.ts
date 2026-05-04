import { Module } from '@nestjs/common';

import { TokenModule } from 'src/engine/core-modules/auth/token/token.module';
import { GeoMapTileController } from 'src/engine/core-modules/geo-map/controllers/geo-map-tile.controller';
import { GeoMapResolver } from 'src/engine/core-modules/geo-map/resolver/geo-map.resolver';
import { GeoReferenceLayerCatalogSyncService } from 'src/engine/core-modules/geo-map/reference-layer-catalog/services/geo-reference-layer-catalog-sync.service';
import { GeoReferenceLayerConnectionService } from 'src/engine/core-modules/geo-map/reference-layer-catalog/services/geo-reference-layer-connection.service';
import { GeoReferenceLayerService } from 'src/engine/core-modules/geo-map/services/geo-reference-layer.service';
import { GeoReferenceLayerVisibilityPreferenceService } from 'src/engine/core-modules/geo-map/services/geo-reference-layer-visibility-preference.service';
import { GeoMapService } from 'src/engine/core-modules/geo-map/services/geo-map.service';
import { GeoMapTileService } from 'src/engine/core-modules/geo-map/services/geo-map-tile.service';
import { WorkspaceManyOrAllFlatEntityMapsCacheModule } from 'src/engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.module';
import { SecureHttpClientModule } from 'src/engine/core-modules/secure-http-client/secure-http-client.module';
import { TwentyConfigModule } from 'src/engine/core-modules/twenty-config/twenty-config.module';
import { UserVarsModule } from 'src/engine/core-modules/user/user-vars/user-vars.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';

@Module({
  imports: [
    WorkspaceCacheStorageModule,
    TokenModule,
    SecureHttpClientModule,
    WorkspaceManyOrAllFlatEntityMapsCacheModule,
    TwentyConfigModule,
    UserVarsModule,
  ],
  controllers: [GeoMapTileController],
  providers: [
    GeoMapService,
    GeoMapResolver,
    GeoMapTileService,
    GeoReferenceLayerCatalogSyncService,
    GeoReferenceLayerConnectionService,
    GeoReferenceLayerService,
    GeoReferenceLayerVisibilityPreferenceService,
  ],
  exports: [GeoReferenceLayerCatalogSyncService],
})
export class GeoMapModule {}
