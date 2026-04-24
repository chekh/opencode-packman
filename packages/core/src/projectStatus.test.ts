import os from 'node:os';
import path from 'node:path';

import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';

import { getProjectStatus } from './project/projectStatus.js';
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

describe('project status helper', () => {
  it('reports installed package count and baseline file count', async () => {
    const projectRoot = await makeTempDir('opm-project-status-');
    await initProject(projectRoot);

    const status = await getProjectStatus(projectRoot);

    expect(status.initialized).toBe(true);
    expect(status.installedPackages).toBe(0);
    expect(status.baselineFiles).toBe(1);
    expect(status.lockfileExists).toBe(true);
    expect(status.baselineExists).toBe(true);
  });
});
