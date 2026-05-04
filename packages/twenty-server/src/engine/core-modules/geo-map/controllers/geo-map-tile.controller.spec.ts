import { BadRequestException } from '@nestjs/common';

import { GeoMapTileController } from 'src/engine/core-modules/geo-map/controllers/geo-map-tile.controller';

jest.mock(
  'src/engine/core-modules/auth/storage/workspace-auth-context.storage',
  () => ({
    getWorkspaceAuthContext: jest.fn(() => ({
      type: 'user',
      userWorkspaceId: 'user-workspace-id',
      workspace: { id: 'workspace-id' },
    })),
  }),
);

describe('GeoMapTileController', () => {
  it('should reject non-object filter payloads before they reach the tile service', async () => {
    const geoMapTileService = {
      getGeometryBounds: jest.fn(),
      getTileJson: jest.fn(),
      getVectorTile: jest.fn(),
    };
    const geoReferenceLayerService = {};
    const controller = new GeoMapTileController(
      geoMapTileService as never,
      geoReferenceLayerService as never,
    );

    for (const filter of ['null', '[]', '"name"', '{']) {
      await expect(
        controller.getGeometryBounds('view-id', filter),
      ).rejects.toThrow(BadRequestException);
    }

    expect(geoMapTileService.getGeometryBounds).not.toHaveBeenCalled();
  });

  it('should forward parsed object filters to bounds and vector tile requests', async () => {
    const tile = Buffer.from('tile');
    const geoMapTileService = {
      getGeometryBounds: jest.fn().mockResolvedValue({
        bounds: [1, 2, 3, 4],
        recordCount: 1,
      }),
      getTileJson: jest.fn(),
      getVectorTile: jest.fn().mockResolvedValue(tile),
    };
    const response = {
      send: jest.fn(),
      setHeader: jest.fn(),
    };
    const geoReferenceLayerService = {};
    const controller = new GeoMapTileController(
      geoMapTileService as never,
      geoReferenceLayerService as never,
    );
    const filter = '{"id":{"in":["record-id"]}}';

    await controller.getGeometryBounds('view-id', filter);
    await controller.getVectorTile(
      'view-id',
      4,
      8,
      5,
      filter,
      response as never,
    );

    expect(geoMapTileService.getGeometryBounds).toHaveBeenCalledWith(
      expect.objectContaining({
        recordFilter: { id: { in: ['record-id'] } },
      }),
    );
    expect(geoMapTileService.getVectorTile).toHaveBeenCalledWith(
      expect.objectContaining({
        recordFilter: { id: { in: ['record-id'] } },
        x: 8,
        y: 5,
        z: 4,
      }),
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/vnd.mapbox-vector-tile',
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'private, no-cache',
    );
    expect(response.send).toHaveBeenCalledWith(tile);
  });

  it('should apply a private cache strategy to reference vector tiles', async () => {
    const tile = Buffer.from('reference-tile');
    const geoMapTileService = {};
    const geoReferenceLayerService = {
      getVectorTile: jest.fn().mockResolvedValue(tile),
    };
    const response = {
      send: jest.fn(),
      setHeader: jest.fn(),
    };
    const controller = new GeoMapTileController(
      geoMapTileService as never,
      geoReferenceLayerService as never,
    );

    await controller.getReferenceLayerVectorTile(
      'view-id',
      'layer-id',
      4,
      8,
      5,
      response as never,
    );

    expect(geoReferenceLayerService.getVectorTile).toHaveBeenCalledWith(
      expect.objectContaining({
        layerId: 'layer-id',
        viewId: 'view-id',
        x: 8,
        y: 5,
        z: 4,
      }),
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/vnd.mapbox-vector-tile',
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'private, max-age=300, stale-while-revalidate=60',
    );
    expect(response.send).toHaveBeenCalledWith(tile);
  });
});
