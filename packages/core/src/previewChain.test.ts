import path from 'node:path';
import os from 'node:os';

import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';

import { buildInstallPlan } from './plan/planBuilder.js';
import { loadPackage } from './package/packageLoader.js';
import { validatePackage } from './package/packageValidator.js';
import { renderInstallPlan } from './diff/diffRenderer.js';

const fixturePackagePath = path.resolve(
  process.cwd(),
  '../../examples/packages/backend-review',
);

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

describe('preview chain', () => {
  it('loads valid example package', async () => {
    const loaded = await loadPackage(fixturePackagePath);

    expect(loaded.manifest.name).toBe('backend-review');
    expect(loaded.manifest.version).toBe('0.1.0');
    expect(loaded.absoluteManifestPath.endsWith('package.yaml')).toBe(true);
  });

  it('returns readable error for missing package.yaml', async () => {
    const missingRoot = await makeTempDir('opm-missing-manifest-');

    await expect(loadPackage(missingRoot)).rejects.toThrow(
      'package.yaml not found in package folder',
    );
  });

  it('fails validation when skill has no SKILL.md', async () => {
    const packageRoot = await makeTempDir('opm-missing-skill-md-');
    await fs.copy(fixturePackagePath, packageRoot);
    await fs.remove(path.join(packageRoot, 'skills/api-review/SKILL.md'));

    const loaded = await loadPackage(packageRoot);
    const validation = await validatePackage(loaded);

    expect(validation.ok).toBe(false);
    expect(
      validation.errors.some(
        (error) => error.code === 'SKILL_MISSING_SKILL_MD',
      ),
    ).toBe(true);
  });

  it('fails validation when SKILL.md has no frontmatter', async () => {
    const packageRoot = await makeTempDir('opm-skill-frontmatter-missing-');
    await fs.copy(fixturePackagePath, packageRoot);
    await fs.writeFile(
      path.join(packageRoot, 'skills/api-review/SKILL.md'),
      'No frontmatter\n',
      'utf8',
    );

    const loaded = await loadPackage(packageRoot);
    const validation = await validatePackage(loaded);

    expect(validation.ok).toBe(false);
    expect(
      validation.errors.some(
        (error) => error.code === 'SKILL_INVALID_FRONTMATTER',
      ),
    ).toBe(true);
  });

  it('fails validation when SKILL.md frontmatter misses required fields', async () => {
    const packageRoot = await makeTempDir('opm-skill-frontmatter-fields-');
    await fs.copy(fixturePackagePath, packageRoot);
    await fs.writeFile(
      path.join(packageRoot, 'skills/api-review/SKILL.md'),
      ['---', 'name: ', '---', '', 'Body'].join('\n'),
      'utf8',
    );

    const loaded = await loadPackage(packageRoot);
    const validation = await validatePackage(loaded);

    expect(validation.ok).toBe(false);
    expect(
      validation.errors.some(
        (error) => error.code === 'SKILL_FRONTMATTER_NAME_REQUIRED',
      ),
    ).toBe(true);
    expect(
      validation.errors.some(
        (error) => error.code === 'SKILL_FRONTMATTER_DESCRIPTION_REQUIRED',
      ),
    ).toBe(true);
  });

  it('fails validation when export path escapes package root via dot segments', async () => {
    const packageRoot = await makeTempDir('opm-export-outside-root-');
    await fs.copy(fixturePackagePath, packageRoot);

    const packageYamlPath = path.join(packageRoot, 'package.yaml');
    const packageYaml = await fs.readFile(packageYamlPath, 'utf8');
    await fs.writeFile(
      packageYamlPath,
      packageYaml.replace('agents/code-reviewer.md', '../outside.md'),
      'utf8',
    );

    const loaded = await loadPackage(packageRoot);
    const validation = await validatePackage(loaded);

    expect(validation.ok).toBe(false);
    expect(
      validation.errors.some(
        (error) => error.code === 'EXPORT_PATH_OUTSIDE_PACKAGE_ROOT',
      ),
    ).toBe(true);
  });

  it('fails validation when export path escapes package root through symlink', async () => {
    const packageRoot = await makeTempDir('opm-export-symlink-outside-root-');
    await fs.copy(fixturePackagePath, packageRoot);

    const outsideFile = path.join(
      path.dirname(packageRoot),
      'outside-agent.md',
    );
    await fs.writeFile(outsideFile, '# outside\n', 'utf8');
    await fs.remove(path.join(packageRoot, 'agents/code-reviewer.md'));
    await fs.symlink(
      outsideFile,
      path.join(packageRoot, 'agents/code-reviewer.md'),
    );

    const loaded = await loadPackage(packageRoot);
    const validation = await validatePackage(loaded);

    expect(validation.ok).toBe(false);
    expect(
      validation.errors.some(
        (error) => error.code === 'EXPORT_PATH_ESCAPES_PACKAGE_ROOT',
      ),
    ).toBe(true);
  });

  it('fails validation when skill export name contains dot segments', async () => {
    const packageRoot = await makeTempDir('opm-export-name-invalid-');
    await fs.copy(fixturePackagePath, packageRoot);

    const packageYamlPath = path.join(packageRoot, 'package.yaml');
    const packageYaml = await fs.readFile(packageYamlPath, 'utf8');
    await fs.writeFile(
      packageYamlPath,
      packageYaml.replace('name: api-review', 'name: ../../..'),
      'utf8',
    );

    const loaded = await loadPackage(packageRoot);
    const validation = await validatePackage(loaded);

    expect(validation.ok).toBe(false);
    expect(
      validation.errors.some((error) => error.code === 'EXPORT_NAME_INVALID'),
    ).toBe(true);
  });

  it('builds expected actions for backend-review package', async () => {
    const projectRoot = await makeTempDir('opm-plan-project-');

    const plan = await buildInstallPlan({
      packageRoot: fixturePackagePath,
      projectRoot,
    });

    expect(plan.validation.ok).toBe(true);
    expect(plan.conflicts).toHaveLength(0);
    expect(plan.actions).toHaveLength(4);

    const targets = plan.actions.map((action) => action.to);
    expect(targets).toContain(
      path.join(projectRoot, '.opencode/agents/code-reviewer.md'),
    );
    expect(targets).toContain(
      path.join(projectRoot, '.opencode/commands/review.md'),
    );
    expect(targets).toContain(
      path.join(projectRoot, '.opencode/skills/api-review'),
    );
    expect(targets).toContain(path.join(projectRoot, 'opencode.json'));
  });

  it('detects add conflict when target file already exists', async () => {
    const projectRoot = await makeTempDir('opm-conflict-project-');
    await fs.ensureDir(path.join(projectRoot, '.opencode/commands'));
    await fs.writeFile(
      path.join(projectRoot, '.opencode/commands/review.md'),
      '# existing\n',
      'utf8',
    );

    const plan = await buildInstallPlan({
      packageRoot: fixturePackagePath,
      projectRoot,
    });

    expect(
      plan.conflicts.some((conflict) => conflict.code === 'ADD_TARGET_EXISTS'),
    ).toBe(true);
    expect(
      plan.actions.some(
        (action) =>
          action.type === 'copyFile' &&
          action.objectType === 'command' &&
          action.objectName === 'review',
      ),
    ).toBe(false);
  });

  it('renders plan with package name and paths', async () => {
    const projectRoot = await makeTempDir('opm-render-project-');
    const plan = await buildInstallPlan({
      packageRoot: fixturePackagePath,
      projectRoot,
    });

    const rendered = renderInstallPlan(plan);

    expect(rendered).toContain('Package: backend-review@0.1.0');
    expect(rendered).toContain('.opencode/commands/review.md');
    expect(rendered).toContain('.opencode/agents/code-reviewer.md');
    expect(rendered).toContain('opencode.json <- opencode.patch.json');
  });
});
