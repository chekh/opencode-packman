import path from 'node:path';

import fs from 'fs-extra';
import YAML from 'yaml';
import { z } from 'zod';

import { loadPackage } from './packageLoader.js';
import { validatePackage } from './packageValidator.js';
import { readRegistryConfig } from '../registry/registryConfig.js';
import { isPathInsideRoot } from '../utils/pathSafety.js';

const SUPPORTED_PUBLISHED_SCHEMA = 'opencode-packman/published/v1';

const publishedMetaSchema = z.object({
  schema: z.literal(SUPPORTED_PUBLISHED_SCHEMA),
  registry: z.string(),
  packageName: z.string(),
  version: z.string(),
  publishedAt: z.string(),
  sourcePath: z.string()
});

type PublishedMeta = z.infer<typeof publishedMetaSchema>;

export type PublishPackageInput = {
  packagePath: string;
  registryName: string;
  asName?: string;
  force?: boolean;
  registryConfigPath?: string;
};

export type PublishPackageResult =
  | {
      ok: true;
      packageName: string;
      version: string;
      registryName: string;
      targetDir: string;
    }
  | {
      ok: false;
      error: string;
    };

export async function publishPackage(input: PublishPackageInput): Promise<PublishPackageResult> {
  let pkg: Awaited<ReturnType<typeof loadPackage>>;
  try {
    pkg = await loadPackage(input.packagePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Failed to load package: ${message}` };
  }

  const validation = await validatePackage(pkg);
  if (!validation.ok) {
    const summary = validation.errors.map((e) => `[${e.code}] ${e.message}`).join('; ');
    return { ok: false, error: `Package validation failed: ${summary}` };
  }

  let registryConfig: Awaited<ReturnType<typeof readRegistryConfig>>;
  try {
    registryConfig = await readRegistryConfig(input.registryConfigPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Failed to read registry config: ${message}` };
  }

  const registry = registryConfig.registries[input.registryName];
  if (registry === undefined) {
    return { ok: false, error: `Registry '${input.registryName}' not found. Run 'opm registry add' to register it.` };
  }

  const targetName = input.asName ?? pkg.manifest.name;
  if (!/^[a-z0-9_-]+$/.test(targetName)) {
    return { ok: false, error: `Invalid package name '${targetName}'. Use lowercase letters, numbers, dash, underscore.` };
  }

  const registryPackagesDir = path.join(registry.path, 'packages');
  const targetDir = path.join(registryPackagesDir, targetName);

  if (!isPathInsideRoot(registry.path, targetDir)) {
    return { ok: false, error: `Target directory resolves outside registry root: ${targetDir}` };
  }

  const targetManifestPath = path.join(targetDir, 'package.yaml');
  if (!input.force && (await fs.pathExists(targetManifestPath))) {
    return {
      ok: false,
      error: `Package '${targetName}' already exists in registry '${input.registryName}'. Use --force to overwrite.`
    };
  }

  try {
    await fs.ensureDir(registryPackagesDir);
    if (input.force && (await fs.pathExists(targetDir))) {
      await fs.remove(targetDir);
    }
    await fs.copy(pkg.packageRoot, targetDir, { overwrite: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Failed to copy package to registry: ${message}` };
  }

  const meta: PublishedMeta = {
    schema: SUPPORTED_PUBLISHED_SCHEMA,
    registry: input.registryName,
    packageName: targetName,
    version: pkg.manifest.version,
    publishedAt: new Date().toISOString(),
    sourcePath: pkg.packageRoot
  };

  try {
    const opmDir = path.join(targetDir, '.opm');
    await fs.ensureDir(opmDir);
    await fs.writeFile(path.join(opmDir, 'published.yaml'), YAML.stringify(meta), 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Warning: failed to write .opm/published.yaml: ${message}\n`);
  }

  return {
    ok: true,
    packageName: targetName,
    version: pkg.manifest.version,
    registryName: input.registryName,
    targetDir
  };
}
