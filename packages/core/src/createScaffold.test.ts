import os from 'node:os';
import path from 'node:path';

import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';

import { loadPackage } from './package/packageLoader.js';
import { validatePackage } from './package/packageValidator.js';
import { addLocalRegistry } from './registry/registryConfig.js';
import { createPackageScaffold, resolveCreatePackageTarget } from './create/packageScaffold.js';

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

describe('create package scaffold', () => {
  it('create bundle scaffold creates expected files', async () => {
    const root = await makeTempDir('opm-create-bundle-');
    const targetDir = path.join(root, 'backend-review');

    const result = await createPackageScaffold({
      name: 'backend-review',
      type: 'bundle',
      targetDir
    });

    expect(result.ok).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, 'package.yaml'))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, 'agents/backend-review-reviewer.md'))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, 'commands/backend-review-review.md'))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, 'skills/backend-review-skill/SKILL.md'))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, 'opencode.patch.json'))).toBe(true);
  });

  it('created bundle package loads and validates', async () => {
    const root = await makeTempDir('opm-create-bundle-valid-');
    const targetDir = path.join(root, 'demo-review');

    const createResult = await createPackageScaffold({ name: 'demo-review', type: 'bundle', targetDir });
    expect(createResult.ok).toBe(true);

    const loaded = await loadPackage(targetDir);
    const validation = await validatePackage(loaded);
    expect(validation.ok).toBe(true);
  });

  it('create skill scaffold creates SKILL.md with valid frontmatter', async () => {
    const root = await makeTempDir('opm-create-skill-');
    const targetDir = path.join(root, 'api-review');

    const result = await createPackageScaffold({ name: 'api-review', type: 'skill', targetDir });
    expect(result.ok).toBe(true);

    const skillRaw = await fs.readFile(path.join(targetDir, 'skills/api-review/SKILL.md'), 'utf8');
    expect(skillRaw).toContain('name: api-review');
    expect(skillRaw).toContain('description: "TODO: describe the api-review skill"');
  });

  it('create agent scaffold creates agent file and valid package.yaml', async () => {
    const root = await makeTempDir('opm-create-agent-');
    const targetDir = path.join(root, 'security-auditor');

    const result = await createPackageScaffold({ name: 'security-auditor', type: 'agent', targetDir });
    expect(result.ok).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, 'agents/security-auditor.md'))).toBe(true);

    const loaded = await loadPackage(targetDir);
    expect(loaded.manifest.type).toBe('agent');
    expect(loaded.manifest.exports.agents?.[0]?.name).toBe('security-auditor');
  });

  it('create command scaffold creates command file and valid package.yaml', async () => {
    const root = await makeTempDir('opm-create-command-');
    const targetDir = path.join(root, 'review');

    const result = await createPackageScaffold({ name: 'review', type: 'command', targetDir });
    expect(result.ok).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, 'commands/review.md'))).toBe(true);

    const loaded = await loadPackage(targetDir);
    expect(loaded.manifest.type).toBe('command');
    expect(loaded.manifest.exports.commands?.[0]?.name).toBe('review');
  });

  it('create profile scaffold creates opencode.patch.json and valid package.yaml', async () => {
    const root = await makeTempDir('opm-create-profile-');
    const targetDir = path.join(root, 'base-profile');

    const result = await createPackageScaffold({ name: 'base-profile', type: 'profile', targetDir });
    expect(result.ok).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, 'opencode.patch.json'))).toBe(true);

    const loaded = await loadPackage(targetDir);
    expect(loaded.manifest.type).toBe('profile');
    expect(loaded.manifest.exports.config?.[0]?.path).toBe('opencode.patch.json');
  });

  it('invalid package name is rejected', async () => {
    const root = await makeTempDir('opm-create-invalid-name-');
    const targetDir = path.join(root, 'Foo Bar');

    const result = await createPackageScaffold({ name: 'Foo Bar', type: 'bundle', targetDir });

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.code === 'invalid_package_name')).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, 'package.yaml'))).toBe(false);
  });

  it('target non-empty dir fails without force', async () => {
    const root = await makeTempDir('opm-create-non-empty-fail-');
    const targetDir = path.join(root, 'existing');
    await fs.ensureDir(targetDir);
    await fs.writeFile(path.join(targetDir, 'existing.txt'), 'keep', 'utf8');

    const result = await createPackageScaffold({ name: 'existing', type: 'bundle', targetDir });

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.code === 'target_exists')).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, 'package.yaml'))).toBe(false);
  });

  it('target path as file is rejected', async () => {
    const root = await makeTempDir('opm-create-target-file-');
    const targetPath = path.join(root, 'not-a-directory');
    await fs.writeFile(targetPath, 'file\n', 'utf8');

    const result = await createPackageScaffold({ name: 'not-a-directory', type: 'bundle', targetDir: targetPath });

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.code === 'target_not_directory')).toBe(true);
  });

  it('target non-empty dir works with force', async () => {
    const root = await makeTempDir('opm-create-non-empty-force-');
    const targetDir = path.join(root, 'existing');
    await fs.ensureDir(targetDir);
    await fs.writeFile(path.join(targetDir, 'existing.txt'), 'keep', 'utf8');

    const result = await createPackageScaffold({ name: 'existing', type: 'bundle', targetDir, force: true });

    expect(result.ok).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, 'existing.txt'))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, 'package.yaml'))).toBe(true);
  });

  it('force mode does not overwrite existing scaffold file', async () => {
    const root = await makeTempDir('opm-create-force-no-overwrite-');
    const targetDir = path.join(root, 'existing');
    await fs.ensureDir(targetDir);
    await fs.writeFile(path.join(targetDir, 'package.yaml'), 'custom: true\n', 'utf8');

    const result = await createPackageScaffold({ name: 'existing', type: 'bundle', targetDir, force: true });

    expect(result.ok).toBe(true);
    expect(result.warnings.some((warning) => warning.code === 'target_file_exists_skipped')).toBe(true);
    expect(await fs.readFile(path.join(targetDir, 'package.yaml'), 'utf8')).toBe('custom: true\n');
  });

  it('scaffold rejects existing symlink directory that escapes target root', async () => {
    const root = await makeTempDir('opm-create-symlink-escape-');
    const targetDir = path.join(root, 'pkg');
    const outsideDir = await makeTempDir('opm-create-symlink-escape-outside-');
    await fs.ensureDir(targetDir);
    await fs.symlink(outsideDir, path.join(targetDir, 'agents'));

    const result = await createPackageScaffold({ name: 'pkg', type: 'bundle', targetDir, force: true });

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.code === 'unsafe_target_path')).toBe(true);
    expect(await fs.pathExists(path.join(outsideDir, 'pkg-reviewer.md'))).toBe(false);
  });

  it('scaffold target cannot escape target dir', async () => {
    const root = await makeTempDir('opm-create-safe-target-');
    const targetDir = path.join(root, 'safe-package');

    const result = await createPackageScaffold({ name: 'safe-package', type: 'bundle', targetDir });

    expect(result.ok).toBe(true);
    const createdPaths = [...result.filesCreated, ...result.directoriesCreated];
    for (const createdPath of createdPaths) {
      const resolved = path.resolve(createdPath);
      expect(resolved === targetDir || resolved.startsWith(`${targetDir}${path.sep}`)).toBe(true);
    }
  });

  it('registry create resolves target to registry.path/packages/<name>', async () => {
    const root = await makeTempDir('opm-create-registry-target-');
    const registryRoot = path.join(root, 'registry-root');
    const configPath = path.join(root, 'registries.yaml');
    await fs.ensureDir(registryRoot);
    await addLocalRegistry({ name: 'personal', path: registryRoot, configPath });

    const resolved = await resolveCreatePackageTarget({
      name: 'demo-review',
      baseDir: root,
      registryName: 'personal',
      configPath
    });

    expect(resolved.targetDir).toBe(path.resolve(registryRoot, 'packages/demo-review'));
  });
});
