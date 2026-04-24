import os from 'node:os';
import path from 'node:path';

import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';

import { readLockfile } from './lock/lockfile.js';
import { readProjectBaseline } from './project/baseline.js';
import { initProject } from './project/initProject.js';

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

describe('initProject', () => {
  it('creates project layout, empty lockfile and baseline', async () => {
    const projectRoot = await makeTempDir('opm-init-project-');

    const result = await initProject(projectRoot);

    expect(await fs.pathExists(path.join(projectRoot, 'opencode.json'))).toBe(true);
    expect(await fs.pathExists(path.join(projectRoot, '.opencode/agents'))).toBe(true);
    expect(await fs.pathExists(path.join(projectRoot, '.opencode/commands'))).toBe(true);
    expect(await fs.pathExists(path.join(projectRoot, '.opencode/skills'))).toBe(true);
    expect(await fs.pathExists(path.join(projectRoot, '.opencode-packman/lock.yaml'))).toBe(true);
    expect(await fs.pathExists(path.join(projectRoot, '.opencode-packman/baseline.yaml'))).toBe(true);

    const lockfile = await readLockfile(projectRoot);
    expect(lockfile.packages).toEqual({});
    expect(lockfile.files).toEqual({});
    expect(lockfile.patches).toEqual({});

    const baseline = await readProjectBaseline(projectRoot);
    expect(baseline).not.toBeNull();
    expect(baseline?.files['opencode.json']).toBeDefined();
    expect(result.baselineFiles).toBe(1);
    expect(result.created).toContain('.opencode-packman/baseline.yaml');
    expect(result.created).toContain('.opencode-packman/lock.yaml');
    expect(result.created).toContain('.opencode/');
    expect(result.created).toContain('.opencode/agents/');
    expect(result.created).toContain('.opencode/commands/');
    expect(result.created).toContain('.opencode/skills/');
  });

  it('does not overwrite existing opencode.json', async () => {
    const projectRoot = await makeTempDir('opm-init-existing-');
    await fs.writeFile(path.join(projectRoot, 'opencode.json'), '{"custom":true}\n', 'utf8');

    const result = await initProject(projectRoot);

    expect(await fs.readFile(path.join(projectRoot, 'opencode.json'), 'utf8')).toBe('{"custom":true}\n');
    expect(result.alreadyExisted).toContain('opencode.json');
  });

  it('records existing OpenCode resources in baseline.yaml', async () => {
    const projectRoot = await makeTempDir('opm-init-baseline-existing-');
    await fs.ensureDir(path.join(projectRoot, '.opencode/agents'));
    await fs.ensureDir(path.join(projectRoot, '.opencode/commands'));
    await fs.ensureDir(path.join(projectRoot, '.opencode/skills/api-review'));
    await fs.writeFile(path.join(projectRoot, 'opencode.json'), '{"existing":true}\n', 'utf8');
    await fs.writeFile(path.join(projectRoot, '.opencode/agents/reviewer.md'), 'agent\n', 'utf8');
    await fs.writeFile(path.join(projectRoot, '.opencode/commands/review.md'), 'command\n', 'utf8');
    await fs.writeFile(path.join(projectRoot, '.opencode/skills/api-review/SKILL.md'), 'skill\n', 'utf8');

    const result = await initProject(projectRoot);
    const baseline = await readProjectBaseline(projectRoot);

    expect(baseline).not.toBeNull();
    expect(baseline?.files['opencode.json']).toBeDefined();
    expect(baseline?.files['.opencode/agents/reviewer.md']).toBeDefined();
    expect(baseline?.files['.opencode/commands/review.md']).toBeDefined();
    expect(baseline?.files['.opencode/skills/api-review/SKILL.md']).toBeDefined();
    expect(result.baselineFiles).toBe(4);
  });

  it('does not add default packages or skills to lockfile', async () => {
    const projectRoot = await makeTempDir('opm-init-no-defaults-');

    await initProject(projectRoot);
    const lockfile = await readLockfile(projectRoot);

    expect(Object.keys(lockfile.packages)).toHaveLength(0);
    expect(Object.keys(lockfile.files)).toHaveLength(0);
    expect(Object.keys(lockfile.patches)).toHaveLength(0);
  });
});
