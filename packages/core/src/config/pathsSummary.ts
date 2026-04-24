import path from 'node:path';

import { getProjectPaths } from '../project/projectPaths.js';
import {
  getDefaultRegistryConfigDir,
  getDefaultRegistryConfigPath,
  readRegistryConfig
} from '../registry/registryConfig.js';

export type ConfigPathsSummary = {
  project: {
    root: string;
    opencodeConfig: string;
    opencodeDir: string;
    packmanState: string;
    lockfile: string;
    baseline: string;
  };
  user: {
    configDir: string;
    registriesConfig: string;
  };
  registries: Array<{ name: string; path: string }>;
};

export async function getConfigPathsSummary(
  projectRoot: string,
  options?: { registryConfigPath?: string }
): Promise<ConfigPathsSummary> {
  const projectPaths = getProjectPaths(projectRoot);
  const registryConfigPath = path.resolve(options?.registryConfigPath ?? getDefaultRegistryConfigPath());
  const config = await readRegistryConfig(registryConfigPath);

  const registries = Object.entries(config.registries)
    .map(([name, entry]) => ({ name, path: entry.path }))
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    project: {
      root: projectPaths.projectRoot,
      opencodeConfig: projectPaths.opencodeJsonPath,
      opencodeDir: projectPaths.opencodeDir,
      packmanState: projectPaths.packmanDir,
      lockfile: projectPaths.lockfilePath,
      baseline: projectPaths.baselinePath
    },
    user: {
      configDir: options?.registryConfigPath === undefined ? getDefaultRegistryConfigDir() : path.dirname(registryConfigPath),
      registriesConfig: registryConfigPath
    },
    registries
  };
}
