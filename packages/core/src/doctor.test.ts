import os from 'node:os';
import path from 'node:path';

import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';

import { applyInstallPlan } from './install/installer.js';
import { writeLockfile } from './lock/lockfile.js';
import { buildInstallPlan } from './plan/planBuilder.js';
import { runDoctor } from './doctor/doctor.js';
import { renderDoctorReport } from './doctor/doctorRenderer.js';
import { initProject } from './project/initProject.js';

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

describe('doctor', () => {
  it('reports warning when opencode.json is missing', async () => {
    const projectRoot = await makeTempDir('opm-doctor-missing-json-');

    const report = await runDoctor(projectRoot);

    expect(report.issues.some((issue) => issue.code === 'missing_opencode_json')).toBe(true);
    expect(report.status).toBe('warning');
  });

  it('reports warning when lockfile is missing', async () => {
    const projectRoot = await makeTempDir('opm-doctor-missing-lock-');
    await fs.writeFile(path.join(projectRoot, 'opencode.json'), '{}\n', 'utf8');
    await fs.ensureDir(path.join(projectRoot, '.opencode'));

    const report = await runDoctor(projectRoot);

    expect(report.issues.some((issue) => issue.code === 'missing_lockfile')).toBe(true);
    expect(report.status).toBe('warning');
  });

  it('reports healthy after installing backend-review package', async () => {
    const projectRoot = await makeTempDir('opm-doctor-healthy-');
    await initProject(projectRoot);
    const plan = await buildInstallPlan({ packageRoot: fixturePackagePath, projectRoot });
    const installResult = await applyInstallPlan(plan);

    expect(installResult.ok).toBe(true);

    const report = await runDoctor(projectRoot);
    expect(report.status).toBe('healthy');
    expect(report.issues).toHaveLength(0);
  });

  it('reports error when locked file is deleted', async () => {
    const projectRoot = await makeTempDir('opm-doctor-missing-locked-');
    await initProject(projectRoot);
    const plan = await buildInstallPlan({ packageRoot: fixturePackagePath, projectRoot });
    const installResult = await applyInstallPlan(plan);

    expect(installResult.ok).toBe(true);
    await fs.remove(path.join(projectRoot, '.opencode/agents/code-reviewer.md'));

    const report = await runDoctor(projectRoot);
    expect(report.status).toBe('broken');
    expect(report.issues.some((issue) => issue.code === 'missing_locked_target')).toBe(true);
  });

  it('reports error when opencode.json is invalid JSON', async () => {
    const projectRoot = await makeTempDir('opm-doctor-invalid-json-');
    await fs.writeFile(path.join(projectRoot, 'opencode.json'), '{ invalid', 'utf8');
    await fs.ensureDir(path.join(projectRoot, '.opencode'));

    const report = await runDoctor(projectRoot);

    expect(report.status).toBe('broken');
    expect(report.issues.some((issue) => issue.code === 'invalid_opencode_json')).toBe(true);
  });

  it('reports error when skill directory lacks SKILL.md', async () => {
    const projectRoot = await makeTempDir('opm-doctor-missing-skill-file-');
    await initProject(projectRoot);
    const plan = await buildInstallPlan({ packageRoot: fixturePackagePath, projectRoot });
    const installResult = await applyInstallPlan(plan);

    expect(installResult.ok).toBe(true);
    await fs.remove(path.join(projectRoot, '.opencode/skills/api-review/SKILL.md'));

    const report = await runDoctor(projectRoot);
    expect(report.status).toBe('broken');
    expect(report.issues.some((issue) => issue.code === 'missing_skill_file')).toBe(true);
  });

  it('reports warning when package has no owned targets', async () => {
    const projectRoot = await makeTempDir('opm-doctor-orphan-package-');
    await fs.writeFile(path.join(projectRoot, 'opencode.json'), '{}\n', 'utf8');
    await fs.ensureDir(path.join(projectRoot, '.opencode'));

    await writeLockfile(projectRoot, {
      schema: 'opencode-packman/lock/v1',
      packages: {
        orphan: {
          version: '0.1.0',
          source: '/tmp/orphan',
          installedAt: new Date().toISOString(),
          scope: 'project'
        }
      },
      files: {},
      patches: {}
    });

    const report = await runDoctor(projectRoot);
    expect(report.status).toBe('warning');
    expect(report.issues.some((issue) => issue.code === 'package_has_no_owned_targets')).toBe(true);
  });

  it('renderer contains status and issue codes', async () => {
    const projectRoot = await makeTempDir('opm-doctor-render-');
    const report = await runDoctor(projectRoot);

    const rendered = renderDoctorReport(report);

    expect(rendered).toContain('Status: warning');
    expect(rendered).toContain('missing_opencode_json');
    expect(rendered).toContain('missing_lockfile');
  });

  it('reports warning when baseline is missing in initialized project', async () => {
    const projectRoot = await makeTempDir('opm-doctor-missing-baseline-');
    await initProject(projectRoot);
    await fs.remove(path.join(projectRoot, '.opencode-packman/baseline.yaml'));

    const report = await runDoctor(projectRoot);

    expect(report.status).toBe('warning');
    expect(report.issues.some((issue) => issue.code === 'missing_baseline')).toBe(true);
  });

  it('does not treat baseline files as installed package targets', async () => {
    const projectRoot = await makeTempDir('opm-doctor-baseline-not-locked-');
    await fs.ensureDir(path.join(projectRoot, '.opencode/agents'));
    await fs.writeFile(path.join(projectRoot, '.opencode/agents/existing.md'), 'existing\n', 'utf8');
    await initProject(projectRoot);

    const report = await runDoctor(projectRoot);

    expect(report.issues.some((issue) => issue.code === 'missing_locked_target')).toBe(false);
    expect(report.issues.some((issue) => issue.code === 'package_has_no_owned_targets')).toBe(false);
  });

  it('reports baseline_file_modified when baseline checksum changes', async () => {
    const projectRoot = await makeTempDir('opm-doctor-baseline-modified-');
    await fs.ensureDir(path.join(projectRoot, '.opencode/agents'));
    await fs.writeFile(path.join(projectRoot, '.opencode/agents/existing.md'), 'before\n', 'utf8');
    await initProject(projectRoot);
    await fs.writeFile(path.join(projectRoot, '.opencode/agents/existing.md'), 'after\n', 'utf8');

    const report = await runDoctor(projectRoot);

    expect(report.status).toBe('warning');
    expect(report.issues.some((issue) => issue.code === 'baseline_file_modified')).toBe(true);
  });

  it('reports baseline_file_missing when baseline file is deleted', async () => {
    const projectRoot = await makeTempDir('opm-doctor-baseline-file-missing-');
    await fs.ensureDir(path.join(projectRoot, '.opencode/agents'));
    await fs.writeFile(path.join(projectRoot, '.opencode/agents/existing.md'), 'before\n', 'utf8');
    await initProject(projectRoot);
    await fs.remove(path.join(projectRoot, '.opencode/agents/existing.md'));

    const report = await runDoctor(projectRoot);

    expect(report.status).toBe('warning');
    expect(report.issues.some((issue) => issue.code === 'baseline_file_missing')).toBe(true);
  });

  it('reports warning when installed file is modified after install', async () => {
    const projectRoot = await makeTempDir('opm-doctor-drift-');
    await initProject(projectRoot);
    const plan = await buildInstallPlan({ packageRoot: fixturePackagePath, projectRoot });
    const installResult = await applyInstallPlan(plan);

    expect(installResult.ok).toBe(true);
    await fs.writeFile(path.join(projectRoot, '.opencode/agents/code-reviewer.md'), 'tampered\n', 'utf8');

    const report = await runDoctor(projectRoot);

    expect(report.status).toBe('warning');
    expect(report.issues.some((issue) => issue.code === 'locked_target_modified')).toBe(true);
  });

  it('remains healthy when installed files are unmodified', async () => {
    const projectRoot = await makeTempDir('opm-doctor-no-drift-');
    await initProject(projectRoot);
    const plan = await buildInstallPlan({ packageRoot: fixturePackagePath, projectRoot });
    const installResult = await applyInstallPlan(plan);

    expect(installResult.ok).toBe(true);

    const report = await runDoctor(projectRoot);

    expect(report.status).toBe('healthy');
    expect(report.issues.some((issue) => issue.code === 'locked_target_modified')).toBe(false);
  });
});
