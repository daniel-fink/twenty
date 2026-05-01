import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';

import { Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { Command, CommandRunner, Option } from 'nest-commander';
import { isDefined } from 'twenty-shared/utils';
import { type DataSource } from 'typeorm';

import { assertGeoMapBenchmarkIdentifier } from 'src/database/commands/geo-map-benchmark/geo-map-benchmark-sql.util';
import { buildGeoMapBenchmarkTileExplainSql } from 'src/database/commands/geo-map-benchmark/geo-map-real-benchmark-sql.util';
import { computeTableName } from 'src/engine/utils/compute-table-name.util';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';

const DEFAULT_ITERATIONS = 3;
const DEFAULT_OUTPUT_PATH = '.local/geo-map-benchmarks/results/latest.json';
const DEFAULT_TILES = '0/0/0,1/0/0,1/1/1,4/8/5,8/128/85,12/2048/1365';

type GeoMapTileBenchmarkOptions = {
  baseUrl?: string;
  token?: string;
  viewId?: string;
  tiles?: string;
  iterations?: number;
  outputPath?: string;
  workspaceId?: string;
  objectNameSingular?: string;
  geometryFieldName?: string;
};

type TileCoordinate = {
  z: number;
  x: number;
  y: number;
};

type TileMetric = TileCoordinate & {
  status: number;
  rawBytes: number;
  gzipBytes: number;
  timingsMs: number[];
  p50Ms: number;
  p95Ms: number;
};

const parseTiles = (tiles: string): TileCoordinate[] =>
  tiles.split(',').map((tile) => {
    const [z, x, y] = tile.split('/').map(Number);

    if (
      !Number.isInteger(z) ||
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      z < 0 ||
      x < 0 ||
      y < 0
    ) {
      throw new Error(`Invalid tile coordinate ${tile}`);
    }

    return { z, x, y };
  });

const percentile = (values: number[], percentileValue: number) => {
  if (values.length === 0) {
    return 0;
  }

  const sortedValues = [...values].sort((first, second) => first - second);
  const index = Math.min(
    sortedValues.length - 1,
    Math.ceil((percentileValue / 100) * sortedValues.length) - 1,
  );

  return Number(sortedValues[index].toFixed(2));
};

const planUsesGistIndex = (plan: unknown): boolean => {
  if (!isDefined(plan) || typeof plan !== 'object') {
    return false;
  }

  const record = plan as Record<string, unknown>;
  const nodeType = record['Node Type'];
  const indexName = record['Index Name'];

  if (
    typeof nodeType === 'string' &&
    nodeType.includes('Index') &&
    typeof indexName === 'string' &&
    indexName.toLowerCase().includes('gist')
  ) {
    return true;
  }

  const childPlans = record.Plans;

  return (
    Array.isArray(childPlans) &&
    childPlans.some((childPlan) => planUsesGistIndex(childPlan))
  );
};

@Command({
  name: 'workspace:benchmark:geo-map-tiles',
  description:
    'Measure authenticated geo map tile endpoint latency and optional PostGIS tile predicate query plans.',
})
export class GeoMapTileBenchmarkCommand extends CommandRunner {
  private readonly logger = new Logger(GeoMapTileBenchmarkCommand.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {
    super();
  }

  @Option({ flags: '--base-url <baseUrl>' })
  parseBaseUrl(baseUrl: string): string {
    return baseUrl;
  }

  @Option({ flags: '--token <token>' })
  parseToken(token: string): string {
    return token;
  }

  @Option({ flags: '--view-id <viewId>' })
  parseViewId(viewId: string): string {
    return viewId;
  }

  @Option({ flags: '--tiles <tiles>' })
  parseTilesOption(tiles: string): string {
    return tiles;
  }

  @Option({ flags: '--iterations <iterations>' })
  parseIterations(iterations: string): number {
    const parsedIterations = Number(iterations);

    if (!Number.isInteger(parsedIterations) || parsedIterations <= 0) {
      throw new Error('Iterations must be a positive integer');
    }

    return parsedIterations;
  }

  @Option({ flags: '--output-path <outputPath>' })
  parseOutputPath(outputPath: string): string {
    return outputPath;
  }

  @Option({ flags: '--workspace-id <workspaceId>' })
  parseWorkspaceId(workspaceId: string): string {
    return workspaceId;
  }

  @Option({ flags: '--object-name-singular <objectNameSingular>' })
  parseObjectNameSingular(objectNameSingular: string): string {
    return objectNameSingular;
  }

  @Option({ flags: '--geometry-field-name <geometryFieldName>' })
  parseGeometryFieldName(geometryFieldName: string): string {
    return geometryFieldName;
  }

  async run(
    _passedParams: string[],
    options: GeoMapTileBenchmarkOptions,
  ): Promise<void> {
    const baseUrl = options.baseUrl;
    const token = options.token;
    const viewId = options.viewId;

    if (!isDefined(baseUrl) || baseUrl === '') {
      throw new Error('--base-url is required');
    }

    if (!isDefined(token) || token === '') {
      throw new Error('--token is required');
    }

    if (!isDefined(viewId) || viewId === '') {
      throw new Error('--view-id is required');
    }

    const tiles = parseTiles(options.tiles ?? DEFAULT_TILES);
    const iterations = options.iterations ?? DEFAULT_ITERATIONS;
    const tileMetrics: TileMetric[] = [];

    for (const tile of tiles) {
      const timingsMs: number[] = [];
      let status = 0;
      let rawBytes = 0;
      let gzipBytes = 0;

      for (let iteration = 0; iteration < iterations; iteration += 1) {
        const startedAt = performance.now();
        const response = await fetch(
          `${baseUrl.replace(/\/$/, '')}/rest/map/views/${viewId}/tiles/${tile.z}/${tile.x}/${tile.y}.mvt`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        const buffer = Buffer.from(await response.arrayBuffer());

        timingsMs.push(Number((performance.now() - startedAt).toFixed(2)));
        status = response.status;
        rawBytes = buffer.length;
        gzipBytes = gzipSync(buffer).length;
      }

      tileMetrics.push({
        ...tile,
        status,
        rawBytes,
        gzipBytes,
        timingsMs,
        p50Ms: percentile(timingsMs, 50),
        p95Ms: percentile(timingsMs, 95),
      });
    }

    const explainResults = await this.runExplainIfRequested({
      options,
      tiles,
    });

    const outputPath = resolve(options.outputPath ?? DEFAULT_OUTPUT_PATH);
    const output = {
      generatedAt: new Date().toISOString(),
      viewId,
      iterations,
      tiles: tileMetrics,
      explain: explainResults,
    };

    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(output, null, 2));

    this.logger.log(`Geo map tile benchmark written to ${outputPath}`);
  }

  private async runExplainIfRequested({
    options,
    tiles,
  }: {
    options: GeoMapTileBenchmarkOptions;
    tiles: TileCoordinate[];
  }) {
    if (
      !isDefined(options.workspaceId) ||
      !isDefined(options.objectNameSingular) ||
      !isDefined(options.geometryFieldName)
    ) {
      return [];
    }

    assertGeoMapBenchmarkIdentifier(options.objectNameSingular);
    assertGeoMapBenchmarkIdentifier(options.geometryFieldName);

    const schemaName = getWorkspaceSchemaName(options.workspaceId);
    const tableName = computeTableName(options.objectNameSingular, true);

    return Promise.all(
      tiles.map(async (tile) => {
        const [explainResult] = await this.dataSource.query(
          buildGeoMapBenchmarkTileExplainSql({
            schemaName,
            tableName,
            geometryColumnName: options.geometryFieldName as string,
            ...tile,
          }),
        );
        const plan = explainResult?.['QUERY PLAN']?.[0]?.Plan;

        return {
          ...tile,
          usesGistIndex: planUsesGistIndex(plan),
          plan,
        };
      }),
    );
  }
}
