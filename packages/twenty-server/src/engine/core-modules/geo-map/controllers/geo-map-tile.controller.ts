import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';

import { type Response } from 'express';
import { isDefined } from 'twenty-shared/utils';

import { type ObjectRecordFilter } from 'src/engine/api/graphql/workspace-query-builder/interfaces/object-record.interface';
import { getWorkspaceAuthContext } from 'src/engine/core-modules/auth/storage/workspace-auth-context.storage';
import { GeoMapTileService } from 'src/engine/core-modules/geo-map/services/geo-map-tile.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

@Controller('rest/map/views')
@UseGuards(JwtAuthGuard, WorkspaceAuthGuard, NoPermissionGuard)
export class GeoMapTileController {
  constructor(private readonly geoMapTileService: GeoMapTileService) {}

  private parseRecordFilter(
    filter: string | undefined,
  ): Partial<ObjectRecordFilter> | undefined {
    if (!isDefined(filter) || filter === '') {
      return undefined;
    }

    try {
      const parsedFilter = JSON.parse(filter);

      if (
        typeof parsedFilter !== 'object' ||
        parsedFilter === null ||
        Array.isArray(parsedFilter)
      ) {
        throw new BadRequestException('Invalid map filter');
      }

      return parsedFilter as Partial<ObjectRecordFilter>;
    } catch {
      throw new BadRequestException('Invalid map filter');
    }
  }

  @Get(':viewId/tile-json')
  @Header('Cache-Control', 'private, no-cache')
  async getTileJson(@Param('viewId') viewId: string) {
    return this.geoMapTileService.getTileJson({
      authContext: getWorkspaceAuthContext(),
      viewId,
    });
  }

  @Get(':viewId/bounds')
  @Header('Cache-Control', 'private, no-cache')
  async getGeometryBounds(
    @Param('viewId') viewId: string,
    @Query('filter') filter: string | undefined,
  ) {
    return this.geoMapTileService.getGeometryBounds({
      authContext: getWorkspaceAuthContext(),
      viewId,
      recordFilter: this.parseRecordFilter(filter),
    });
  }

  @Get(':viewId/tiles/:z/:x/:y.mvt')
  async getVectorTile(
    @Param('viewId') viewId: string,
    @Param('z', ParseIntPipe) z: number,
    @Param('x', ParseIntPipe) x: number,
    @Param('y', ParseIntPipe) y: number,
    @Query('filter') filter: string | undefined,
    @Res() response: Response,
  ) {
    const tile = await this.geoMapTileService.getVectorTile({
      authContext: getWorkspaceAuthContext(),
      viewId,
      z,
      x,
      y,
      recordFilter: this.parseRecordFilter(filter),
    });

    response.setHeader('Content-Type', 'application/vnd.mapbox-vector-tile');
    response.setHeader('Cache-Control', 'private, no-cache');
    response.send(tile);
  }
}
