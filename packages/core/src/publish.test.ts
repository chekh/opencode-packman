import os from 'node:os';
import path from 'node:path';

import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';

import { addLocalRegistry } from './registry/registryConfig.js';
import { publishPackage } from './package/packagePublisher.js';

const tempDirs: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function getConfigPath(testRoot: string): string {
  return path.join(testRoot, 'registries.yaml');
}

async function createValidPackage(
  root: string,
  packageName: string,
  extraFiles: string[] = [],
): Promise<string> {
  const packageRoot = path.join(root, packageName);
  await fs.ensureDir(packageRoot);
  await fs.writeFile(
    path.join(packageRoot, 'package.yaml'),
    `schema: opencode-packman/package/v1
name: ${packageName}
version: 0.1.0
type: bundle
description: ${packageName} test package

exports:
  config:
    - path: opencode.patch.json
      strategy: patch
`,
    'utf8',
  );
  await fs.writeFile(
    path.join(packageRoot, 'opencode.patch.json'),
    '{}\n',
    'utf8',
  );

  for (const extraFile of extraFiles) {
    const filePath = path.join(packageRoot, extraFile);
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, `extra content: ${extraFile}\n`, 'utf8');
  }

  return packageRoot;
}

afterEach(async () => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    await fs.remove(dir);
  }
});

describe('publishPackage', () => {
  it('publishes a valid package to registry', async () => {
    const testRoot = await makeTempDir('opm-publish-');
    const registryRoot = path.join(testRoot, 'registry');
    const sourceRoot = path.join(testRoot, 'source');

    await fs.ensureDir(registryRoot);
    await addLocalRegistry({
      name: 'test-registry',
      path: registryRoot,
      configPath: getConfigPath(testRoot),
    });

    const packageRoot = await createValidPackage(sourceRoot, 'test-package');
    const result = await publishPackage({
      packagePath: packageRoot,
      registryName: 'test-registry',
      registryConfigPath: getConfigPath(testRoot),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.packageName).toBe('test-package');
      expect(result.registryName).toBe('test-registry');
      expect(
        await fs.pathExists(
          path.join(registryRoot, 'packages', 'test-package', 'package.yaml'),
        ),
      ).toBe(true);
    }
  });

  it('publishes with --as name override', async () => {
    const testRoot = await makeTempDir('opm-publish-as-');
    const registryRoot = path.join(testRoot, 'registry');
    const sourceRoot = path.join(testRoot, 'source');

    await fs.ensureDir(registryRoot);
    await addLocalRegistry({
      name: 'test-registry',
      path: registryRoot,
      configPath: getConfigPath(testRoot),
    });

    const packageRoot = await createValidPackage(sourceRoot, 'original-name');
    const result = await publishPackage({
      packagePath: packageRoot,
      registryName: 'test-registry',
      asName: 'custom-name',
      registryConfigPath: getConfigPath(testRoot),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.packageName).toBe('custom-name');
      expect(
        await fs.pathExists(
          path.join(registryRoot, 'packages', 'custom-name', 'package.yaml'),
        ),
      ).toBe(true);
    }
  });

  it('force publish removes stale files from previous version', async () => {
    const testRoot = await makeTempDir('opm-publish-force-');
    const registryRoot = path.join(testRoot, 'registry');
    const sourceRoot = path.join(testRoot, 'source');

    await fs.ensureDir(registryRoot);
    await addLocalRegistry({
      name: 'test-registry',
      path: registryRoot,
      configPath: getConfigPath(testRoot),
    });

    const packageRoot = await createValidPackage(sourceRoot, 'stale-test', [
      'agents/reviewer.md',
    ]);

    const result1 = await publishPackage({
      packagePath: packageRoot,
      registryName: 'test-registry',
      registryConfigPath: getConfigPath(testRoot),
    });
    expect(result1.ok).toBe(true);

    const publishedPath = path.join(registryRoot, 'packages', 'stale-test');
    const staleFilePath = path.join(publishedPath, 'agents', 'reviewer.md');

    expect(await fs.pathExists(staleFilePath)).toBe(true);

    await fs.remove(path.join(packageRoot, 'agents', 'reviewer.md'));

    const result2 = await publishPackage({
      packagePath: packageRoot,
      registryName: 'test-registry',
      force: true,
      registryConfigPath: getConfigPath(testRoot),
    });
    expect(result2.ok).toBe(true);

    expect(await fs.pathExists(staleFilePath)).toBe(false);

    expect(await fs.pathExists(path.join(publishedPath, 'package.yaml'))).toBe(
      true,
    );
  });

  it('rejects invalid package', async () => {
    const testRoot = await makeTempDir('opm-publish-invalid-');
    const registryRoot = path.join(testRoot, 'registry');
    const sourceRoot = path.join(testRoot, 'source');

    await fs.ensureDir(registryRoot);
    await addLocalRegistry({
      name: 'test-registry',
      path: registryRoot,
      configPath: getConfigPath(testRoot),
    });

    const packageRoot = path.join(sourceRoot, 'invalid-package');
    await fs.ensureDir(packageRoot);
    await fs.writeFile(
      path.join(packageRoot, 'package.yaml'),
      'schema: opencode-packman/package/v1\n',
      'utf8',
    );

    const result = await publishPackage({
      packagePath: packageRoot,
      registryName: 'test-registry',
      registryConfigPath: getConfigPath(testRoot),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Failed to load package');
    }
  });

  it('rejects duplicate package without force', async () => {
    const testRoot = await makeTempDir('opm-publish-dup-');
    const registryRoot = path.join(testRoot, 'registry');
    const sourceRoot = path.join(testRoot, 'source');

    await fs.ensureDir(registryRoot);
    await addLocalRegistry({
      name: 'test-registry',
      path: registryRoot,
      configPath: getConfigPath(testRoot),
    });

    const packageRoot = await createValidPackage(sourceRoot, 'dup-package');

    const result1 = await publishPackage({
      packagePath: packageRoot,
      registryName: 'test-registry',
      registryConfigPath: getConfigPath(testRoot),
    });
    expect(result1.ok).toBe(true);

    const result2 = await publishPackage({
      packagePath: packageRoot,
      registryName: 'test-registry',
      registryConfigPath: getConfigPath(testRoot),
    });
    expect(result2.ok).toBe(false);
    if (!result2.ok) {
      expect(result2.error).toContain('already exists');
    }
  });

  it('rejects unknown registry', async () => {
    const testRoot = await makeTempDir('opm-publish-unknown-');
    const sourceRoot = path.join(testRoot, 'source');

    const packageRoot = await createValidPackage(sourceRoot, 'test-package');

    const result = await publishPackage({
      packagePath: packageRoot,
      registryName: 'nonexistent-registry',
      registryConfigPath: getConfigPath(testRoot),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('not found');
    }
  });
});
