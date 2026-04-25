import os from 'node:os';
import path from 'node:path';

import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';

import { applyInstallPlan } from './install/installer.js';
import { copyDirectorySafe, copyFileSafe } from './install/fileActions.js';
import { applyJsonPatchFile, deepMergeJsonObjects } from './install/jsonPatch.js';
import { readLockfile } from './lock/lockfile.js';
import { buildInstallPlan } from './plan/planBuilder.js';
import type { InstallPlan } from './plan/installPlan.js';

const fixturePackagePath = path.resolve(process.cwd(), '../../examples/packages/backend-review');

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

describe('install chain', () => {
  it('deepMergeJsonObjects merges nested objects', () => {
    const merged = deepMergeJsonObjects(
      {
        permission: {
          bash: {
            ls: 'ask'
          }
        }
      },
      {
        permission: {
          bash: {
            git: 'deny'
          }
        }
      }
    );

    expect(merged).toEqual({
      permission: {
        bash: {
          ls: 'ask',
          git: 'deny'
        }
      }
    });
  });

  it('deepMergeJsonObjects replaces arrays', () => {
    const merged = deepMergeJsonObjects(
      {
        models: ['a', 'b']
      },
      {
        models: ['c']
      }
    );

    expect(merged).toEqual({ models: ['c'] });
  });

  it('applyJsonPatchFile creates opencode.json if missing', async () => {
    const projectRoot = await makeTempDir('opm-json-patch-create-');
    const opencodeJsonPath = path.join(projectRoot, 'opencode.json');

    const result = await applyJsonPatchFile({
      projectRoot,
      patchFilePath: path.join(fixturePackagePath, 'opencode.patch.json'),
      targetPath: opencodeJsonPath
    });

    expect(result.ok).toBe(true);
    expect(await fs.pathExists(opencodeJsonPath)).toBe(true);

    const data = await fs.readJson(opencodeJsonPath);
    expect(data).toEqual({
      permission: {
        bash: {
          'rm *': 'deny',
          'git *': 'ask'
        }
      }
    });
  });

  it('applyJsonPatchFile rejects symlink target that points outside project root', async () => {
    const projectRoot = await makeTempDir('opm-json-patch-symlink-target-');
    const packageRoot = await makeTempDir('opm-json-patch-symlink-package-');
    const patchFilePath = path.join(packageRoot, 'opencode.patch.json');
    const outsideTarget = path.join(path.dirname(projectRoot), 'outside-opencode.json');
    const targetPath = path.join(projectRoot, 'opencode.json');

    await fs.writeFile(patchFilePath, '{"permission":{"bash":{"git *":"ask"}}}\n', 'utf8');
    await fs.writeFile(outsideTarget, '{}\n', 'utf8');
    await fs.symlink(outsideTarget, targetPath);

    const result = await applyJsonPatchFile({
      projectRoot,
      sourceRoot: packageRoot,
      patchFilePath,
      targetPath
    });

    expect(result.ok).toBe(false);
    expect(result.error?.includes('Unsafe patch target path')).toBe(true);

    const outsideData = await fs.readJson(outsideTarget);
    expect(outsideData).toEqual({});
  });

  it('applyInstallPlan copies agent file', async () => {
    const projectRoot = await makeTempDir('opm-install-agent-');
    const plan = await buildInstallPlan({ packageRoot: fixturePackagePath, projectRoot });

    const result = await applyInstallPlan(plan);

    expect(result.ok).toBe(true);
    expect(await fs.pathExists(path.join(projectRoot, '.opencode/agents/code-reviewer.md'))).toBe(true);
  });

  it('applyInstallPlan copies skill directory', async () => {
    const projectRoot = await makeTempDir('opm-install-skill-');
    const plan = await buildInstallPlan({ packageRoot: fixturePackagePath, projectRoot });

    const result = await applyInstallPlan(plan);

    expect(result.ok).toBe(true);
    expect(await fs.pathExists(path.join(projectRoot, '.opencode/skills/api-review/SKILL.md'))).toBe(true);
  });

  it('applyInstallPlan applies opencode.patch.json', async () => {
    const projectRoot = await makeTempDir('opm-install-patch-');
    const plan = await buildInstallPlan({ packageRoot: fixturePackagePath, projectRoot });

    const result = await applyInstallPlan(plan);

    expect(result.ok).toBe(true);
    const opencodeJson = await fs.readJson(path.join(projectRoot, 'opencode.json'));
    expect(opencodeJson.permission?.bash?.['rm *']).toBe('deny');
    expect(opencodeJson.permission?.bash?.['git *']).toBe('ask');
  });

  it('applyInstallPlan writes lockfile', async () => {
    const projectRoot = await makeTempDir('opm-install-lockfile-');
    const plan = await buildInstallPlan({ packageRoot: fixturePackagePath, projectRoot });

    const result = await applyInstallPlan(plan);

    expect(result.ok).toBe(true);
    expect(await fs.pathExists(path.join(projectRoot, '.opencode-packman/lock.yaml'))).toBe(true);

    const lockfile = await readLockfile(projectRoot);
    expect(lockfile.packages['backend-review']?.version).toBe('0.1.0');
    expect(lockfile.files['.opencode/agents/code-reviewer.md']?.owner).toBe('backend-review');
    expect(lockfile.patches['opencode.json']?.[0]?.patchFile).toBe('opencode.patch.json');
  });

  it('applyInstallPlan refuses when plan has conflicts', async () => {
    const projectRoot = await makeTempDir('opm-install-conflict-');
    await fs.ensureDir(path.join(projectRoot, '.opencode/commands'));
    await fs.writeFile(path.join(projectRoot, '.opencode/commands/review.md'), 'existing\n', 'utf8');

    const plan = await buildInstallPlan({ packageRoot: fixturePackagePath, projectRoot });
    const result = await applyInstallPlan(plan);

    expect(plan.conflicts.length).toBeGreaterThan(0);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.message.includes('conflicts'))).toBe(true);
  });

  it('add strategy does not overwrite existing target', async () => {
    const projectRoot = await makeTempDir('opm-add-no-overwrite-');
    const source = path.join(projectRoot, 'source.md');
    const target = path.join(projectRoot, '.opencode/commands/review.md');

    await fs.ensureDir(path.dirname(target));
    await fs.writeFile(source, 'new content\n', 'utf8');
    await fs.writeFile(target, 'old content\n', 'utf8');

    const action = {
      type: 'copyFile' as const,
      from: source,
      to: target,
      strategy: 'add' as const,
      objectType: 'command' as const,
      objectName: 'review'
    };

    const actionResult = await copyFileSafe({ projectRoot, action });

    expect(actionResult.ok).toBe(false);
    expect(await fs.readFile(target, 'utf8')).toBe('old content\n');
  });

  it('replace strategy swaps file content safely', async () => {
    const projectRoot = await makeTempDir('opm-replace-file-safe-');
    const source = path.join(projectRoot, 'source.md');
    const target = path.join(projectRoot, '.opencode/commands/review.md');

    await fs.ensureDir(path.dirname(target));
    await fs.writeFile(source, 'new content\n', 'utf8');
    await fs.writeFile(target, 'old content\n', 'utf8');

    const action = {
      type: 'copyFile' as const,
      from: source,
      to: target,
      strategy: 'replace' as const,
      objectType: 'command' as const,
      objectName: 'review'
    };

    const actionResult = await copyFileSafe({ projectRoot, action });

    expect(actionResult.ok).toBe(true);
    expect(await fs.readFile(target, 'utf8')).toBe('new content\n');
  });

  it('replace strategy swaps directory content safely', async () => {
    const projectRoot = await makeTempDir('opm-replace-dir-safe-');
    const sourceDir = path.join(projectRoot, 'source-skill');
    const targetDir = path.join(projectRoot, '.opencode/skills/api-review');

    await fs.ensureDir(sourceDir);
    await fs.writeFile(path.join(sourceDir, 'SKILL.md'), '# new\n', 'utf8');

    await fs.ensureDir(targetDir);
    await fs.writeFile(path.join(targetDir, 'SKILL.md'), '# old\n', 'utf8');
    await fs.writeFile(path.join(targetDir, 'obsolete.md'), '# remove\n', 'utf8');

    const action = {
      type: 'copyDirectory' as const,
      from: sourceDir,
      to: targetDir,
      strategy: 'replace' as const,
      objectType: 'skill' as const,
      objectName: 'api-review'
    };

    const actionResult = await copyDirectorySafe({ projectRoot, action });

    expect(actionResult.ok).toBe(true);
    expect(await fs.readFile(path.join(targetDir, 'SKILL.md'), 'utf8')).toBe('# new\n');
    expect(await fs.pathExists(path.join(targetDir, 'obsolete.md'))).toBe(false);
  });

  it('copyDirectorySafe rejects target path that resolves to project root', async () => {
    const projectRoot = await makeTempDir('opm-replace-dir-project-root-');
    const sourceDir = path.join(projectRoot, 'source-skill');

    await fs.ensureDir(sourceDir);
    await fs.writeFile(path.join(sourceDir, 'SKILL.md'), '# new\n', 'utf8');

    const action = {
      type: 'copyDirectory' as const,
      from: sourceDir,
      to: projectRoot,
      strategy: 'replace' as const,
      objectType: 'skill' as const,
      objectName: 'api-review'
    };

    const actionResult = await copyDirectorySafe({ projectRoot, action });

    expect(actionResult.ok).toBe(false);
    expect(actionResult.error?.includes('project root')).toBe(true);
  });

  it('applyInstallPlan rejects source paths that escape package root', async () => {
    const packageRoot = await makeTempDir('opm-install-source-escape-package-');
    const projectRoot = await makeTempDir('opm-install-source-escape-project-');
    const outsideSource = path.join(path.dirname(packageRoot), 'outside.md');
    await fs.writeFile(outsideSource, '# outside\n', 'utf8');

    const plan: InstallPlan = {
      packageName: 'malicious-package',
      packageVersion: '0.1.0',
      packageRoot,
      projectRoot,
      scope: 'project',
      actions: [
        {
          type: 'copyFile',
          from: outsideSource,
          to: path.join(projectRoot, '.opencode/commands/unsafe.md'),
          strategy: 'replace',
          objectType: 'command',
          objectName: 'unsafe'
        }
      ],
      conflicts: [],
      warnings: [],
      validation: { ok: true, errors: [], warnings: [] }
    };

    const result = await applyInstallPlan(plan);

    expect(result.ok).toBe(false);
    expect(result.errors.some((entry) => entry.message.includes('outside package root'))).toBe(true);
    expect(await fs.pathExists(path.join(projectRoot, '.opencode/commands/unsafe.md'))).toBe(false);
  });

  it('applyInstallPlan rejects target parent symlink that points outside project root', async () => {
    const packageRoot = await makeTempDir('opm-install-target-symlink-package-');
    const projectRoot = await makeTempDir('opm-install-target-symlink-project-');
    const outsideDir = await makeTempDir('opm-install-target-symlink-outside-');
    const source = path.join(packageRoot, 'safe.md');
    await fs.writeFile(source, '# safe\n', 'utf8');

    await fs.ensureDir(path.join(projectRoot, '.opencode'));
    await fs.symlink(outsideDir, path.join(projectRoot, '.opencode/commands'));

    const plan: InstallPlan = {
      packageName: 'safe-package',
      packageVersion: '0.1.0',
      packageRoot,
      projectRoot,
      scope: 'project',
      actions: [
        {
          type: 'copyFile',
          from: source,
          to: path.join(projectRoot, '.opencode/commands/review.md'),
          strategy: 'replace',
          objectType: 'command',
          objectName: 'review'
        }
      ],
      conflicts: [],
      warnings: [],
      validation: { ok: true, errors: [], warnings: [] }
    };

    const result = await applyInstallPlan(plan);

    expect(result.ok).toBe(false);
    expect(result.errors.some((entry) => entry.message.includes('Unsafe target path'))).toBe(true);
    expect(await fs.pathExists(path.join(outsideDir, 'review.md'))).toBe(false);
  });

  it('applyInstallPlan stores checksums for installed files in lockfile', async () => {
    const projectRoot = await makeTempDir('opm-install-checksum-');
    const plan = await buildInstallPlan({ packageRoot: fixturePackagePath, projectRoot });

    const result = await applyInstallPlan(plan);

    expect(result.ok).toBe(true);
    const lockfile = await readLockfile(projectRoot);
    const agentEntry = lockfile.files['.opencode/agents/code-reviewer.md'];
    expect(agentEntry?.checksum).toMatch(/^sha256:[a-f0-9]{64}$/);
    const skillEntry = lockfile.files['.opencode/skills/api-review'];
    expect(skillEntry?.checksum).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
});
