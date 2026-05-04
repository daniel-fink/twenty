import { Injectable } from '@nestjs/common';

import { Client } from 'pg';

import { type GeoReferenceLayerSource } from 'src/engine/core-modules/geo-map/entities/geo-reference-layer.entity';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { type ConfigVariables } from 'src/engine/core-modules/twenty-config/config-variables';

@Injectable()
export class GeoReferenceLayerConnectionService {
  constructor(private readonly twentyConfigService: TwentyConfigService) {}

  resolveConnectionUri(uriEnv: string): string {
    let configValue: string | undefined;

    try {
      configValue = this.twentyConfigService.get(
        uriEnv as keyof ConfigVariables,
      ) as string | undefined;
    } catch {
      configValue = undefined;
    }

    const uri = configValue || process.env[uriEnv];

    if (!uri) {
      throw new Error(`Missing geospatial reference connection ${uriEnv}`);
    }

    return uri;
  }

  async connect(source: GeoReferenceLayerSource): Promise<Client> {
    const connectionString =
      source.provider === 'TWENTY_WORKSPACE_POSTGIS'
        ? process.env.PG_DATABASE_URL
        : source.connectionUriEnv
          ? this.resolveConnectionUri(source.connectionUriEnv)
          : undefined;

    if (!connectionString) {
      throw new Error('Missing geospatial reference layer connection string');
    }

    const client = new Client({ connectionString });

    await client.connect();

    return client;
  }
}
