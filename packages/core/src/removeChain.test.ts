import os from 'node:os';
import path from 'node:path';

import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';

import { applyInstallPlan } from './install/installer.js';
import { readLockfile, writeLockfile } from './lock/lockfile.js';
import { buildInstallPlan } from './plan/planBuilder.js';
import { buildRemovePlan, applyRemovePlan } from './remove/remover.js';
import { renderRemovePlan } from './remove/removeRenderer.js';

const fixturePackagePath = path.resolve(process.cwd(), '../../examples/packages/backend-review');

const tempDirs: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function installFixture(projectRoot: string): Promise<void> {
  const plan = await buildInstallPlan({ packageRoot: fixturePackagePath, projectRoot });
  const result = await applyInstallPlan(plan);
  expect(result.ok).toBe(true);
}

afterEach(async () => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    await fs.remove(dir);
  }
});

describe('remove chain', () => {
  it('buildRemovePlan returns error if lockfile is missing', async () => {
    const projectRoot = await makeTempDir('opm-remove-missing-lockfile-');

    const plan = await buildRemovePlan({ projectRoot, packageName: 'backend-review' });

    expect(plan.errors.some((error) => error.code === 'missing_lockfile')).toBe(true);
  });

  it('buildRemovePlan returns error if package is not installed', async () => {
    const projectRoot = await makeTempDir('opm-remove-missing-package-');
    await writeLockfile(projectRoot, {
      schema: 'opencode-packman/lock/v1',
      packages: {
        other: {
          version: '0.1.0',
          source: '/tmp/other',
          installedAt: new Date().toISOString(),
          scope: 'project'
        }
      },
      files: {},
      patches: {}
    });

    const plan = await buildRemovePlan({ projectRoot, packageName: 'backend-review' });

    expect(plan.errors.some((error) => error.code === 'package_not_installed')).toBe(true);
  });

  it('buildRemovePlan lists files and directories owned by package', async () => {
    const projectRoot = await makeTempDir('opm-remove-plan-owned-targets-');
    await installFixture(projectRoot);

    const plan = await buildRemovePlan({ projectRoot, packageName: 'backend-review' });

    const deleteFiles = plan.actions.filter((action) => action.type === 'deleteFile');
    const deleteDirectories = plan.actions.filter((action) => action.type === 'deleteDirectory');
    const notices = plan.actions.filter((action) => action.type === 'manualPatchNotice');

    expect(deleteFiles).toHaveLength(2);
    expect(deleteDirectories).toHaveLength(1);
    expect(notices).toHaveLength(1);
  });

  it('applyRemovePlan deletes owned files', async () => {
    const projectRoot = await makeTempDir('opm-remove-delete-files-');
    await installFixture(projectRoot);
    const plan = await buildRemovePlan({ projectRoot, packageName: 'backend-review' });

    const result = await applyRemovePlan(plan);

    expect(result.ok).toBe(true);
    expect(await fs.pathExists(path.join(projectRoot, '.opencode/agents/code-reviewer.md'))).toBe(false);
    expect(await fs.pathExists(path.join(projectRoot, '.opencode/commands/review.md'))).toBe(false);
  });

  it('applyRemovePlan deletes owned skill directory', async () => {
    const projectRoot = await makeTempDir('opm-remove-delete-skill-');
    await installFixture(projectRoot);
    const plan = await buildRemovePlan({ projectRoot, packageName: 'backend-review' });

    const result = await applyRemovePlan(plan);

    expect(result.ok).toBe(true);
    expect(await fs.pathExists(path.join(projectRoot, '.opencode/skills/api-review'))).toBe(false);
  });

  it('applyRemovePlan removes package entry from lockfile', async () => {
    const projectRoot = await makeTempDir('opm-remove-lock-package-entry-');
    await installFixture(projectRoot);
    const plan = await buildRemovePlan({ projectRoot, packageName: 'backend-review' });

    const result = await applyRemovePlan(plan);
    expect(result.ok).toBe(true);

    const lockfile = await readLockfile(projectRoot);
    expect(lockfile.packages['backend-review']).toBeUndefined();
  });

  it('applyRemovePlan removes file ownership entries from lockfile', async () => {
    const projectRoot = await makeTempDir('opm-remove-lock-file-entries-');
    await installFixture(projectRoot);
    const plan = await buildRemovePlan({ projectRoot, packageName: 'backend-review' });

    const result = await applyRemovePlan(plan);
    expect(result.ok).toBe(true);

    const lockfile = await readLockfile(projectRoot);
    expect(lockfile.files['.opencode/agents/code-reviewer.md']).toBeUndefined();
    expect(lockfile.files['.opencode/commands/review.md']).toBeUndefined();
    expect(lockfile.files['.opencode/skills/api-review']).toBeUndefined();
  });

  it('applyRemovePlan removes patch entries from lockfile', async () => {
    const projectRoot = await makeTempDir('opm-remove-lock-patches-');
    await installFixture(projectRoot);
    const plan = await buildRemovePlan({ projectRoot, packageName: 'backend-review' });

    const result = await applyRemovePlan(plan);
    expect(result.ok).toBe(true);

    const lockfile = await readLockfile(projectRoot);
    expect(lockfile.patches['opencode.json']).toBeUndefined();
  });

  it('applyRemovePlan does not modify opencode.json patch content', async () => {
    const projectRoot = await makeTempDir('opm-remove-opencode-stays-patched-');
    await installFixture(projectRoot);
    const before = await fs.readFile(path.join(projectRoot, 'opencode.json'), 'utf8');
    const plan = await buildRemovePlan({ projectRoot, packageName: 'backend-review' });

    const result = await applyRemovePlan(plan);
    expect(result.ok).toBe(true);

    const after = await fs.readFile(path.join(projectRoot, 'opencode.json'), 'utf8');
    expect(after).toBe(before);
    expect(after).toContain('"permission"');
  });

  it('applyRemovePlan refuses unsafe locked target', async () => {
    const projectRoot = await makeTempDir('opm-remove-unsafe-target-');
    await writeLockfile(projectRoot, {
      schema: 'opencode-packman/lock/v1',
      packages: {
        'backend-review': {
          version: '0.1.0',
          source: '/tmp/backend-review',
          installedAt: new Date().toISOString(),
          scope: 'project'
        }
      },
      files: {
        '../outside.txt': {
          owner: 'backend-review',
          version: '0.1.0',
          strategy: 'replace'
        }
      },
      patches: {}
    });

    const plan = await buildRemovePlan({ projectRoot, packageName: 'backend-review' });
    const result = await applyRemovePlan(plan);

    expect(plan.errors.some((error) => error.code === 'unsafe_locked_target')).toBe(true);
    expect(result.ok).toBe(false);
  });

  it('remove renderer includes manual patch notice', async () => {
    const projectRoot = await makeTempDir('opm-remove-renderer-manual-patch-');
    await installFixture(projectRoot);
    const plan = await buildRemovePlan({ projectRoot, packageName: 'backend-review' });

    const rendered = renderRemovePlan(plan);

    expect(rendered).toContain('Automatic JSON patch rollback is not available in MVP.');
    expect(rendered).toContain('Review opencode.json manually.');
  });
});
