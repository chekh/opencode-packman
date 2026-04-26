import path from 'node:path';

import fs from 'fs-extra';

import { readRegistryConfig } from './registryConfig.js';

type ResolveInput = {
  reference: string;
  configPath?: string;
  baseDir?: string;
};

type ResolveOutput = {
  packageRoot: string;
  registryName?: string;
  packageName?: string;
};

function parseRegistryReference(
  reference: string,
): { registryName: string; packageName: string } | null {
  const match = /^([^/]+)\/([^/]+)$/.exec(reference.trim());
  if (match === null) {
    return null;
  }

  const registryName = match[1];
  const packageName = match[2];
  if (registryName === undefined || packageName === undefined) {
    return null;
  }

  return { registryName, packageName };
}

export async function resolvePackageReference(
  input: ResolveInput,
): Promise<ResolveOutput> {
  const baseDir = path.resolve(input.baseDir ?? process.cwd());
  const directPath = path.resolve(baseDir, input.reference);
  if (await fs.pathExists(directPath)) {
    return {
      packageRoot: directPath,
    };
  }

  const parsed = parseRegistryReference(input.reference);
  if (parsed === null) {
    throw new Error(
      `Cannot resolve package reference '${input.reference}'. Provide an existing package path or <registry>/<package>.`,
    );
  }

  const config = await readRegistryConfig(input.configPath);
  const registry = config.registries[parsed.registryName];
  if (registry === undefined) {
    throw new Error(
      `Unknown registry '${parsed.registryName}'. Run 'opm registry list' to inspect configured registries.`,
    );
  }

  if (registry.type !== 'local') {
    throw new Error(
      `Unsupported registry type '${String(registry.type)}' for '${parsed.registryName}'.`,
    );
  }

  const packageRoot = path.resolve(
    registry.path,
    'packages',
    parsed.packageName,
  );
  if (!(await fs.pathExists(packageRoot))) {
    throw new Error(
      `Package '${parsed.packageName}' was not found in registry '${parsed.registryName}' at ${packageRoot}.`,
    );
  }

  const packageYamlPath = path.join(packageRoot, 'package.yaml');
  if (!(await fs.pathExists(packageYamlPath))) {
    throw new Error(
      `Package '${parsed.registryName}/${parsed.packageName}' is missing package.yaml at ${packageYamlPath}.`,
    );
  }

  return {
    packageRoot,
    registryName: parsed.registryName,
    packageName: parsed.packageName,
  };
}
