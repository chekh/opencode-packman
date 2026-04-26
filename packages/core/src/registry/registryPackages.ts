import path from 'node:path';

import fs from 'fs-extra';

import { loadPackage } from '../package/packageLoader.js';
import { readRegistryConfig } from './registryConfig.js';

export type RegistryPackageSummary = {
  registryName: string;
  packageName: string;
  packageRoot: string;
  manifestPath: string;
  version: string;
  type: string;
  description?: string;
  tags?: string[];
};

function comparePackages(
  a: RegistryPackageSummary,
  b: RegistryPackageSummary,
): number {
  if (a.registryName < b.registryName) {
    return -1;
  }
  if (a.registryName > b.registryName) {
    return 1;
  }
  if (a.packageName < b.packageName) {
    return -1;
  }
  if (a.packageName > b.packageName) {
    return 1;
  }
  return 0;
}

async function listPackagesFromLocalRegistry(
  registryName: string,
  registryPath: string,
): Promise<RegistryPackageSummary[]> {
  const packagesRoot = path.resolve(registryPath, 'packages');
  if (!(await fs.pathExists(packagesRoot))) {
    return [];
  }

  const stat = await fs.stat(packagesRoot);
  if (!stat.isDirectory()) {
    return [];
  }

  const entries = await fs.readdir(packagesRoot, { withFileTypes: true });
  const summaries: RegistryPackageSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const packageRoot = path.join(packagesRoot, entry.name);
    const manifestPath = path.join(packageRoot, 'package.yaml');
    if (!(await fs.pathExists(manifestPath))) {
      continue;
    }

    try {
      const loaded = await loadPackage(packageRoot);
      summaries.push({
        registryName,
        packageName: entry.name,
        packageRoot: loaded.packageRoot,
        manifestPath: loaded.absoluteManifestPath,
        version: loaded.manifest.version,
        type: loaded.manifest.type,
        ...(loaded.manifest.description === undefined
          ? {}
          : { description: loaded.manifest.description }),
        ...(loaded.manifest.metadata?.tags !== undefined
          ? { tags: loaded.manifest.metadata.tags }
          : {}),
      });
    } catch {
      continue;
    }
  }

  return summaries;
}

export async function listRegistryPackages(input: {
  registryName: string;
  configPath?: string;
}): Promise<RegistryPackageSummary[]> {
  const config = await readRegistryConfig(input.configPath);
  const registry = config.registries[input.registryName];
  if (registry === undefined) {
    throw new Error(`Registry '${input.registryName}' does not exist.`);
  }

  if (registry.type !== 'local') {
    throw new Error(
      `Unsupported registry type '${String(registry.type)}' for '${input.registryName}'.`,
    );
  }

  const items = await listPackagesFromLocalRegistry(
    input.registryName,
    registry.path,
  );
  items.sort(comparePackages);
  return items;
}

export async function listAllRegistryPackages(input?: {
  configPath?: string;
}): Promise<RegistryPackageSummary[]> {
  const config = await readRegistryConfig(input?.configPath);
  const registryNames = Object.keys(config.registries).sort();
  const all: RegistryPackageSummary[] = [];

  for (const registryName of registryNames) {
    const registry = config.registries[registryName];
    if (registry === undefined || registry.type !== 'local') {
      continue;
    }

    all.push(
      ...(await listPackagesFromLocalRegistry(registryName, registry.path)),
    );
  }

  all.sort(comparePackages);
  return all;
}

export async function searchRegistryPackages(input: {
  query: string;
  tag?: string;
  typeFilter?: string;
  configPath?: string;
}): Promise<RegistryPackageSummary[]> {
  const all = await listAllRegistryPackages(
    input.configPath === undefined
      ? undefined
      : { configPath: input.configPath },
  );
  const normalizedQuery = input.query.trim().toLowerCase();
  const normalizedTag = input.tag?.trim().toLowerCase();
  const normalizedType = input.typeFilter?.trim().toLowerCase();

  return all.filter((item) => {
    if (
      normalizedType !== undefined &&
      item.type.toLowerCase() !== normalizedType
    ) {
      return false;
    }

    if (normalizedTag !== undefined) {
      const itemTags = (item.tags ?? []).map((t) => t.toLowerCase());
      if (!itemTags.includes(normalizedTag)) {
        return false;
      }
    }

    if (normalizedQuery === '') {
      return true;
    }

    const description = (item.description ?? '').toLowerCase();
    const itemTags = (item.tags ?? []).map((t) => t.toLowerCase()).join(' ');
    return (
      item.packageName.toLowerCase().includes(normalizedQuery) ||
      item.type.toLowerCase().includes(normalizedQuery) ||
      description.includes(normalizedQuery) ||
      itemTags.includes(normalizedQuery)
    );
  });
}
