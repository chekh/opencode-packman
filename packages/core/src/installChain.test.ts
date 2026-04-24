import os from 'node:os';
import path from 'node:path';

import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';

import { applyInstallPlan } from './install/installer.js';
import { copyFileSafe } from './install/fileActions.js';
import { applyJsonPatchFile, deepMergeJsonObjects } from './install/jsonPatch.js';
import { readLockfile } from './lock/lockfile.js';
import { buildInstallPlan } from './plan/planBuilder.js';

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
});
