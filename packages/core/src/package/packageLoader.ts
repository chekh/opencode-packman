import path from 'node:path';
import fs from 'fs-extra';
import YAML from 'yaml';

import {
  packageManifestSchema,
  SUPPORTED_PACKAGE_SCHEMA,
  type PackageManifest
} from './packageSchema.js';

export type LoadedPackage = {
  packageRoot: string;
  manifest: PackageManifest;
  absoluteManifestPath: string;
};

export async function loadPackage(packageRoot: string): Promise<LoadedPackage> {
  const resolvedPackageRoot = path.resolve(packageRoot);
  const absoluteManifestPath = path.join(resolvedPackageRoot, 'package.yaml');

  const hasManifest = await fs.pathExists(absoluteManifestPath);
  if (!hasManifest) {
    throw new Error(`package.yaml not found in package folder: ${resolvedPackageRoot}`);
  }

  let rawManifest = '';
  try {
    rawManifest = await fs.readFile(absoluteManifestPath, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read package.yaml at ${absoluteManifestPath}: ${message}`);
  }

  let parsedYaml: unknown;
  try {
    parsedYaml = YAML.parse(rawManifest);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid YAML in ${absoluteManifestPath}: ${message}`);
  }

  const parsedManifest = packageManifestSchema.safeParse(parsedYaml);
  if (!parsedManifest.success) {
    throw new Error(
      `Invalid package.yaml format in ${absoluteManifestPath}: ${parsedManifest.error.issues
        .map((issue) => issue.message)
        .join('; ')}`
    );
  }

  if (parsedManifest.data.schema !== SUPPORTED_PACKAGE_SCHEMA) {
    throw new Error(
      `Unsupported package schema '${parsedManifest.data.schema}'. Supported schema: ${SUPPORTED_PACKAGE_SCHEMA}`
    );
  }

  return {
    packageRoot: resolvedPackageRoot,
    manifest: parsedManifest.data,
    absoluteManifestPath
  };
}
