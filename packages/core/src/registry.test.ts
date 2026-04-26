import os from 'node:os';
import path from 'node:path';

import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';

import {
  addLocalRegistry,
  readRegistryConfig,
  removeRegistry,
} from './registry/registryConfig.js';
import {
  listAllRegistryPackages,
  listRegistryPackages,
  searchRegistryPackages,
} from './registry/registryPackages.js';
import { resolvePackageReference } from './registry/registryResolver.js';

const tempDirs: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function getConfigPath(testRoot: string): string {
  return path.join(testRoot, 'registries.yaml');
}

async function createPackage(
  root: string,
  packageName: string,
): Promise<string> {
  const packageRoot = path.join(root, 'packages', packageName);
  await fs.ensureDir(packageRoot);
  await fs.writeFile(
    path.join(packageRoot, 'package.yaml'),
    `schema: opencode-packman/package/v1\nname: ${packageName}\nversion: 0.1.0\ntype: bundle\ndescription: ${packageName} description\nexports: {}\n`,
    'utf8',
  );
  return packageRoot;
}

async function createCustomPackage(
  root: string,
  packageName: string,
  manifest: {
    name: string;
    version: string;
    type: string;
    description?: string;
  },
): Promise<string> {
  const packageRoot = path.join(root, 'packages', packageName);
  await fs.ensureDir(packageRoot);
  const descriptionLine =
    manifest.description === undefined
      ? ''
      : `description: ${manifest.description}\n`;
  await fs.writeFile(
    path.join(packageRoot, 'package.yaml'),
    `schema: opencode-packman/package/v1\nname: ${manifest.name}\nversion: ${manifest.version}\ntype: ${manifest.type}\n${descriptionLine}exports: {}\n`,
    'utf8',
  );
  return packageRoot;
}

afterEach(async () => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    await fs.remove(dir);
  }
});

describe('registry config and resolver', () => {
  it('readRegistryConfig returns empty config when file is missing', async () => {
    const root = await makeTempDir('opm-registry-read-empty-');
    const config = await readRegistryConfig(getConfigPath(root));

    expect(config.schema).toBe('opencode-packman/registries/v1');
    expect(config.registries).toEqual({});
  });

  it('addLocalRegistry writes config', async () => {
    const root = await makeTempDir('opm-registry-add-');
    const registryRoot = path.join(root, 'registry');
    await fs.ensureDir(registryRoot);

    const config = await addLocalRegistry({
      name: 'personal',
      path: registryRoot,
      configPath: getConfigPath(root),
    });

    expect(config.registries.personal?.type).toBe('local');
    expect(config.registries.personal?.path).toBe(path.resolve(registryRoot));
  });

  it('removeRegistry removes config entry', async () => {
    const root = await makeTempDir('opm-registry-remove-');
    const registryRoot = path.join(root, 'registry');
    await fs.ensureDir(registryRoot);

    await addLocalRegistry({
      name: 'personal',
      path: registryRoot,
      configPath: getConfigPath(root),
    });

    const updated = await removeRegistry({
      name: 'personal',
      configPath: getConfigPath(root),
    });
    expect(updated.registries.personal).toBeUndefined();
  });

  it('resolvePackageReference resolves direct package path', async () => {
    const root = await makeTempDir('opm-registry-resolve-path-');
    const packageRoot = path.join(root, 'direct-package');
    await fs.ensureDir(packageRoot);
    await fs.writeFile(
      path.join(packageRoot, 'package.yaml'),
      'schema: opencode-packman/package/v1\n',
      'utf8',
    );

    const resolved = await resolvePackageReference({
      reference: packageRoot,
      baseDir: root,
      configPath: getConfigPath(root),
    });

    expect(resolved.packageRoot).toBe(path.resolve(packageRoot));
    expect(resolved.registryName).toBeUndefined();
  });

  it('resolvePackageReference resolves personal/backend-review', async () => {
    const root = await makeTempDir('opm-registry-resolve-name-');
    const registryRoot = path.join(root, 'registry');
    await fs.ensureDir(registryRoot);
    await createPackage(registryRoot, 'backend-review');
    await addLocalRegistry({
      name: 'personal',
      path: registryRoot,
      configPath: getConfigPath(root),
    });

    const resolved = await resolvePackageReference({
      reference: 'personal/backend-review',
      baseDir: root,
      configPath: getConfigPath(root),
    });

    expect(resolved.registryName).toBe('personal');
    expect(resolved.packageName).toBe('backend-review');
    expect(resolved.packageRoot).toBe(
      path.resolve(registryRoot, 'packages/backend-review'),
    );
  });

  it('resolvePackageReference errors on unknown registry', async () => {
    const root = await makeTempDir('opm-registry-unknown-');
    await expect(
      resolvePackageReference({
        reference: 'unknown/backend-review',
        baseDir: root,
        configPath: getConfigPath(root),
      }),
    ).rejects.toThrow("Unknown registry 'unknown'");
  });

  it('resolvePackageReference errors when package does not exist', async () => {
    const root = await makeTempDir('opm-registry-missing-package-');
    const registryRoot = path.join(root, 'registry');
    await fs.ensureDir(registryRoot);
    await addLocalRegistry({
      name: 'personal',
      path: registryRoot,
      configPath: getConfigPath(root),
    });

    await expect(
      resolvePackageReference({
        reference: 'personal/backend-review',
        baseDir: root,
        configPath: getConfigPath(root),
      }),
    ).rejects.toThrow("Package 'backend-review' was not found");
  });

  it('addLocalRegistry requires existing directory', async () => {
    const root = await makeTempDir('opm-registry-requires-dir-');
    const missingPath = path.join(root, 'missing-registry');

    await expect(
      addLocalRegistry({
        name: 'personal',
        path: missingPath,
        configPath: getConfigPath(root),
      }),
    ).rejects.toThrow('Registry path does not exist');
  });

  it('addLocalRegistry refuses overwrite unless force is true', async () => {
    const root = await makeTempDir('opm-registry-force-');
    const firstRoot = path.join(root, 'registry-a');
    const secondRoot = path.join(root, 'registry-b');
    await fs.ensureDir(firstRoot);
    await fs.ensureDir(secondRoot);

    await addLocalRegistry({
      name: 'personal',
      path: firstRoot,
      configPath: getConfigPath(root),
    });

    await expect(
      addLocalRegistry({
        name: 'personal',
        path: secondRoot,
        configPath: getConfigPath(root),
      }),
    ).rejects.toThrow(
      "Registry 'personal' already exists. Use --force to overwrite.",
    );

    const forced = await addLocalRegistry({
      name: 'personal',
      path: secondRoot,
      configPath: getConfigPath(root),
      force: true,
    });
    expect(forced.registries.personal?.path).toBe(path.resolve(secondRoot));
  });
});

describe('registry package listing and search', () => {
  it('listRegistryPackages returns packages from local registry', async () => {
    const root = await makeTempDir('opm-registry-list-');
    const registryRoot = path.join(root, 'registry');
    await fs.ensureDir(registryRoot);
    await createPackage(registryRoot, 'backend-review');
    await createPackage(registryRoot, 'docs-helper');

    await addLocalRegistry({
      name: 'personal',
      path: registryRoot,
      configPath: getConfigPath(root),
    });

    const listed = await listRegistryPackages({
      registryName: 'personal',
      configPath: getConfigPath(root),
    });
    expect(listed.map((item) => item.packageName)).toEqual([
      'backend-review',
      'docs-helper',
    ]);
  });

  it('listRegistryPackages skips directories without package.yaml', async () => {
    const root = await makeTempDir('opm-registry-skip-no-manifest-');
    const registryRoot = path.join(root, 'registry');
    await fs.ensureDir(path.join(registryRoot, 'packages/empty-dir'));
    await createPackage(registryRoot, 'backend-review');

    await addLocalRegistry({
      name: 'personal',
      path: registryRoot,
      configPath: getConfigPath(root),
    });
    const listed = await listRegistryPackages({
      registryName: 'personal',
      configPath: getConfigPath(root),
    });

    expect(listed.map((item) => item.packageName)).toEqual(['backend-review']);
  });

  it('listRegistryPackages sorts packages by name', async () => {
    const root = await makeTempDir('opm-registry-sort-');
    const registryRoot = path.join(root, 'registry');
    await fs.ensureDir(registryRoot);
    await createPackage(registryRoot, 'zeta');
    await createPackage(registryRoot, 'alpha');
    await createPackage(registryRoot, 'middle');
    await addLocalRegistry({
      name: 'personal',
      path: registryRoot,
      configPath: getConfigPath(root),
    });

    const listed = await listRegistryPackages({
      registryName: 'personal',
      configPath: getConfigPath(root),
    });
    expect(listed.map((item) => item.packageName)).toEqual([
      'alpha',
      'middle',
      'zeta',
    ]);
  });

  it('listRegistryPackages errors on unknown registry', async () => {
    const root = await makeTempDir('opm-registry-list-unknown-');
    await expect(
      listRegistryPackages({
        registryName: 'missing',
        configPath: getConfigPath(root),
      }),
    ).rejects.toThrow("Registry 'missing' does not exist.");
  });

  it('searchRegistryPackages matches package name', async () => {
    const root = await makeTempDir('opm-registry-search-name-');
    const registryRoot = path.join(root, 'registry');
    await fs.ensureDir(registryRoot);
    await createPackage(registryRoot, 'backend-review');
    await createPackage(registryRoot, 'docs-helper');
    await addLocalRegistry({
      name: 'personal',
      path: registryRoot,
      configPath: getConfigPath(root),
    });

    const found = await searchRegistryPackages({
      query: 'backend',
      configPath: getConfigPath(root),
    });
    expect(found.map((item) => item.packageName)).toEqual(['backend-review']);
  });

  it('searchRegistryPackages matches description', async () => {
    const root = await makeTempDir('opm-registry-search-description-');
    const registryRoot = path.join(root, 'registry');
    await fs.ensureDir(registryRoot);
    await createCustomPackage(registryRoot, 'docs-helper', {
      name: 'docs-helper',
      version: '0.1.0',
      type: 'skill',
      description: 'Documentation helper skills',
    });
    await addLocalRegistry({
      name: 'personal',
      path: registryRoot,
      configPath: getConfigPath(root),
    });

    const found = await searchRegistryPackages({
      query: 'helper',
      configPath: getConfigPath(root),
    });
    expect(found.map((item) => item.packageName)).toEqual(['docs-helper']);
  });

  it('searchRegistryPackages is case-insensitive', async () => {
    const root = await makeTempDir('opm-registry-search-case-');
    const registryRoot = path.join(root, 'registry');
    await fs.ensureDir(registryRoot);
    await createCustomPackage(registryRoot, 'backend-review', {
      name: 'Backend-Review',
      version: '0.1.0',
      type: 'bundle',
      description: 'Basic Backend review setup',
    });
    await addLocalRegistry({
      name: 'personal',
      path: registryRoot,
      configPath: getConfigPath(root),
    });

    const found = await searchRegistryPackages({
      query: 'BACKEND',
      configPath: getConfigPath(root),
    });
    expect(found.map((item) => item.packageName)).toEqual(['backend-review']);
  });

  it('searchRegistryPackages with empty query returns all packages', async () => {
    const root = await makeTempDir('opm-registry-search-empty-');
    const personalRoot = path.join(root, 'personal-registry');
    const teamRoot = path.join(root, 'team-registry');
    await fs.ensureDir(personalRoot);
    await fs.ensureDir(teamRoot);
    await createPackage(personalRoot, 'backend-review');
    await createPackage(teamRoot, 'frontend-review');
    await addLocalRegistry({
      name: 'personal',
      path: personalRoot,
      configPath: getConfigPath(root),
    });
    await addLocalRegistry({
      name: 'team',
      path: teamRoot,
      configPath: getConfigPath(root),
    });

    const all = await searchRegistryPackages({
      query: '   ',
      configPath: getConfigPath(root),
    });
    expect(
      all.map((item) => `${item.registryName}/${item.packageName}`),
    ).toEqual(['personal/backend-review', 'team/frontend-review']);
  });

  it('invalid package.yaml does not crash listing', async () => {
    const root = await makeTempDir('opm-registry-invalid-manifest-');
    const registryRoot = path.join(root, 'registry');
    await fs.ensureDir(path.join(registryRoot, 'packages/valid-package'));
    await fs.ensureDir(path.join(registryRoot, 'packages/invalid-package'));
    await fs.writeFile(
      path.join(registryRoot, 'packages/valid-package/package.yaml'),
      'schema: opencode-packman/package/v1\nname: valid-package\nversion: 0.1.0\ntype: bundle\nexports: {}\n',
      'utf8',
    );
    await fs.writeFile(
      path.join(registryRoot, 'packages/invalid-package/package.yaml'),
      'schema: [',
      'utf8',
    );

    await addLocalRegistry({
      name: 'personal',
      path: registryRoot,
      configPath: getConfigPath(root),
    });

    const listed = await listRegistryPackages({
      registryName: 'personal',
      configPath: getConfigPath(root),
    });
    expect(listed.map((item) => item.packageName)).toEqual(['valid-package']);
  });

  it('listAllRegistryPackages sorts by registry then package', async () => {
    const root = await makeTempDir('opm-registry-list-all-');
    const bRoot = path.join(root, 'b-registry');
    const aRoot = path.join(root, 'a-registry');
    await fs.ensureDir(bRoot);
    await fs.ensureDir(aRoot);
    await createPackage(bRoot, 'zeta');
    await createPackage(aRoot, 'alpha');
    await addLocalRegistry({
      name: 'team',
      path: bRoot,
      configPath: getConfigPath(root),
    });
    await addLocalRegistry({
      name: 'personal',
      path: aRoot,
      configPath: getConfigPath(root),
    });

    const all = await listAllRegistryPackages({
      configPath: getConfigPath(root),
    });
    expect(
      all.map((item) => `${item.registryName}/${item.packageName}`),
    ).toEqual(['personal/alpha', 'team/zeta']);
  });
});
