import { Module } from '@nestjs/common';

import { WorkspaceIteratorModule } from 'src/database/commands/command-runners/workspace-iterator.module';
import { BackfillCompanyLocationGeometryCommand } from 'src/database/commands/upgrade-version-command/2-2/2-2-workspace-command-1777455269305-backfill-company-location-geometry.command';
import { SetCalendarEventDescriptionDisplayedMaxRowsCommand } from 'src/database/commands/upgrade-version-command/2-2/2-2-workspace-command-1786000000000-set-calendar-event-description-displayed-max-rows.command';
import { ApplicationModule } from 'src/engine/core-modules/application/application.module';
import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';
import { WorkspaceMigrationModule } from 'src/engine/workspace-manager/workspace-migration/workspace-migration.module';

@Module({
  imports: [
    ApplicationModule,
    WorkspaceCacheModule,
    WorkspaceIteratorModule,
    WorkspaceMigrationModule,
  ],
  providers: [
    BackfillCompanyLocationGeometryCommand,
    SetCalendarEventDescriptionDisplayedMaxRowsCommand,
  ],
})
export class V2_2_UpgradeVersionCommandModule {}
