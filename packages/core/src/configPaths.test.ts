import os from 'node:os';
import path from 'node:path';

import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';

import { getConfigPathsSummary } from './config/pathsSummary.js';
import { addLocalRegistry } from './registry/registryConfig.js';

const tempDirs: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    await fs.remove(dir);
  }
});

describe('config paths helper', () => {
  it('returns project, user and registries paths', async () => {
    const projectRoot = await makeTempDir('opm-config-paths-project-');
    const configRoot = await makeTempDir('opm-config-paths-user-');
    const registryRoot = await makeTempDir('opm-config-paths-registry-');
    const configPath = path.join(configRoot, 'registries.yaml');

    await addLocalRegistry({
      name: 'personal',
      path: registryRoot,
      configPath,
    });

    const summary = await getConfigPathsSummary(projectRoot, {
      registryConfigPath: configPath,
    });

    expect(summary.project.root).toBe(path.resolve(projectRoot));
    expect(summary.project.lockfile).toBe(
      path.resolve(projectRoot, '.opencode-packman/lock.yaml'),
    );
    expect(summary.project.baseline).toBe(
      path.resolve(projectRoot, '.opencode-packman/baseline.yaml'),
    );
    expect(summary.user.configDir).toBe(path.resolve(configRoot));
    expect(summary.user.registriesConfig).toBe(path.resolve(configPath));
    expect(summary.registries).toEqual([
      { name: 'personal', path: path.resolve(registryRoot) },
    ]);
  });
});
