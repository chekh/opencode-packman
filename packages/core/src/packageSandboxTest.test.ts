import os from 'node:os';
import path from 'node:path';

import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';

import { runPackageSandboxTest } from './package/packageSandboxTest.js';

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

describe('package sandbox test', () => {
  it('runs fixture package through the sandbox lifecycle', async () => {
    const result = await runPackageSandboxTest({ packageRef: fixturePackagePath });

    expect(result.status).toBe('ok');
    expect(result.packageName).toBe('backend-review');
    expect(result.steps.map((step) => step.stage)).toEqual([
      'validate package',
      'init sandbox',
      'build install plan',
      'install package',
      'doctor before remove',
      'build remove plan',
      'remove package',
      'doctor after remove'
    ]);
    expect(result.sandboxRoot).toBeDefined();
    expect(await fs.pathExists(result.sandboxRoot ?? '')).toBe(false);
  });

  it('reports broken when package manifest is missing', async () => {
    const packageRoot = await makeTempDir('opm-package-test-missing-manifest-');

    const result = await runPackageSandboxTest({ packageRef: packageRoot });

    expect(result.status).toBe('broken');
    expect(result.errors.some((error) => error.includes('package.yaml not found'))).toBe(true);
    expect(result.sandboxRoot).toBeDefined();
    expect(await fs.pathExists(result.sandboxRoot ?? '')).toBe(false);
  });
});
