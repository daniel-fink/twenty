import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { LocalDriver } from 'src/engine/core-modules/logic-function/logic-function-drivers/drivers/local.driver';

const createDriver = () =>
  new LocalDriver({
    cacheLockService: {},
    logicFunctionResourceService: {},
    sdkClientArchiveService: {},
    workspaceCacheService: {},
  } as ConstructorParameters<typeof LocalDriver>[0]);

const createRunner = async (handlerSource: string) => {
  const dir = await mkdtemp(join(tmpdir(), 'twenty-local-driver-'));
  const builtFileAbsPath = join(dir, 'function.mjs');
  const driver = createDriver();

  await writeFile(builtFileAbsPath, handlerSource, 'utf8');

  const runnerPath = await driver.writeBootstrapRunner({
    dir,
    builtFileAbsPath,
    handlerName: 'handler',
  });

  return { dir, driver, runnerPath };
};

describe('LocalDriver child runner IPC', () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  it('waits for large IPC payloads before exiting', async () => {
    const largeValue = 'x'.repeat(256 * 1024);
    const { dir, driver, runnerPath } = await createRunner(`
      export async function handler() {
        return { marker: 'large-result', value: ${JSON.stringify(largeValue)} };
      }
    `);

    try {
      const result = await driver.runChildWithEnv({
        runnerPath,
        env: {},
        payload: {},
        timeoutMs: 5000,
      });

      expect(result.ok).toBe(true);
      expect(result.result).toEqual({
        marker: 'large-result',
        value: largeValue,
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('treats exit 0 without an IPC result as an error', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'twenty-local-driver-'));
    const runnerPath = join(dir, '__runner.cjs');
    const driver = createDriver();

    await writeFile(runnerPath, 'process.exit(0);', 'utf8');

    try {
      const result = await driver.runChildWithEnv({
        runnerPath,
        env: {},
        payload: {},
        timeoutMs: 5000,
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe(
        'Exited with code 0 before sending a result',
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('preserves intentional undefined returns over IPC', async () => {
    const { dir, driver, runnerPath } = await createRunner(`
      export async function handler() {
        return undefined;
      }
    `);

    try {
      const result = await driver.runChildWithEnv({
        runnerPath,
        env: {},
        payload: {},
        timeoutMs: 5000,
      });

      expect(result.ok).toBe(true);
      expect(result.result).toBeUndefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
