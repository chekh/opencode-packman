import os from 'node:os';
import path from 'node:path';

import fs from 'fs-extra';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readLockfile, writeLockfile } from './lock/lockfile.js';
import { applyInstallPlan } from './install/installer.js';
import {
  extractAliasName,
  listModelAliases,
  readModelAliases,
  removeModelAlias,
  setModelAlias,
} from './model/modelAliases.js';
import { SUPPORTED_MODEL_ALIAS_SCHEMA } from './model/modelAliasSchema.js';
import { buildInstallPlan } from './plan/planBuilder.js';
import { runDoctor } from './doctor/doctor.js';
import type { CopyFileAction } from './plan/installPlan.js';

vi.mock('./model/modelAliases.js', async (importActual) => {
  const actual = await importActual<typeof import('./model/modelAliases.js')>();
  return {
    ...actual,
    readModelAliases: vi.fn().mockImplementation(actual.readModelAliases),
  };
});

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

async function createSyntheticPackage(dir: string): Promise<void> {
  const packageYaml =
    [
      'schema: opencode-packman/package/v1',
      'name: test-pkg',
      'version: 0.1.0',
      'type: bundle',
      'description: test',
      'exports:',
      '  agents:',
      '    - name: my-agent',
      '      path: agents/my-agent.md',
      '      strategy: add',
      '      model: alias:reviewer',
    ].join('\n') + '\n';

  await fs.ensureDir(path.join(dir, 'agents'));
  await fs.writeFile(path.join(dir, 'package.yaml'), packageYaml, 'utf8');
  await fs.writeFile(
    path.join(dir, 'agents/my-agent.md'),
    '# My Agent\n',
    'utf8',
  );
}

describe('extractAliasName', () => {
  it("returns the alias name for 'alias:reviewer'", () => {
    expect(extractAliasName('alias:reviewer')).toBe('reviewer');
  });

  it("returns undefined for non-alias model string 'openai/gpt-4o'", () => {
    expect(extractAliasName('openai/gpt-4o')).toBeUndefined();
  });

  it("returns undefined for 'alias:' with empty name", () => {
    expect(extractAliasName('alias:')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(extractAliasName('')).toBeUndefined();
  });
});

describe('setModelAlias / readModelAliases / listModelAliases', () => {
  it('setModelAlias creates the file if it does not exist', async () => {
    const tmpDir = await makeTempDir('opm-alias-create-');
    const configPath = path.join(tmpDir, 'model-aliases.yaml');

    await setModelAlias({
      alias: 'reviewer',
      model: 'openai/gpt-4o',
      configPath,
    });

    expect(await fs.pathExists(configPath)).toBe(true);
  });

  it('setModelAlias stores the correct alias to model mapping', async () => {
    const tmpDir = await makeTempDir('opm-alias-store-');
    const configPath = path.join(tmpDir, 'model-aliases.yaml');

    await setModelAlias({
      alias: 'reviewer',
      model: 'openai/gpt-4o',
      configPath,
    });

    const config = await readModelAliases(configPath);
    expect(config.aliases['reviewer']).toBe('openai/gpt-4o');
  });

  it('setModelAlias updates an existing alias', async () => {
    const tmpDir = await makeTempDir('opm-alias-update-');
    const configPath = path.join(tmpDir, 'model-aliases.yaml');

    await setModelAlias({
      alias: 'reviewer',
      model: 'openai/gpt-4o',
      configPath,
    });
    await setModelAlias({
      alias: 'reviewer',
      model: 'anthropic/claude-3',
      configPath,
    });

    const config = await readModelAliases(configPath);
    expect(config.aliases['reviewer']).toBe('anthropic/claude-3');
  });

  it('listModelAliases returns empty aliases when file does not exist', async () => {
    const tmpDir = await makeTempDir('opm-alias-list-empty-');
    const configPath = path.join(tmpDir, 'nonexistent.yaml');

    const config = await listModelAliases({ configPath });
    expect(config.aliases).toEqual({});
  });

  it('listModelAliases returns stored aliases', async () => {
    const tmpDir = await makeTempDir('opm-alias-list-stored-');
    const configPath = path.join(tmpDir, 'model-aliases.yaml');

    await setModelAlias({
      alias: 'reviewer',
      model: 'openai/gpt-4o',
      configPath,
    });
    await setModelAlias({
      alias: 'coder',
      model: 'anthropic/claude-3',
      configPath,
    });

    const config = await listModelAliases({ configPath });
    expect(config.aliases['reviewer']).toBe('openai/gpt-4o');
    expect(config.aliases['coder']).toBe('anthropic/claude-3');
  });
});

describe('removeModelAlias', () => {
  it('removes an existing alias', async () => {
    const tmpDir = await makeTempDir('opm-alias-remove-');
    const configPath = path.join(tmpDir, 'model-aliases.yaml');

    await setModelAlias({
      alias: 'reviewer',
      model: 'openai/gpt-4o',
      configPath,
    });
    await removeModelAlias({ alias: 'reviewer', configPath });

    const config = await readModelAliases(configPath);
    expect(config.aliases['reviewer']).toBeUndefined();
  });

  it('throws when alias does not exist', async () => {
    const tmpDir = await makeTempDir('opm-alias-remove-missing-');
    const configPath = path.join(tmpDir, 'model-aliases.yaml');

    await expect(
      removeModelAlias({ alias: 'nonexistent', configPath }),
    ).rejects.toThrow("Model alias 'nonexistent' does not exist.");
  });
});

describe('planBuilder carries modelAlias in CopyFileAction', () => {
  it('includes modelAlias when agent export has model: alias:reviewer', async () => {
    const packageRoot = await makeTempDir('opm-plan-alias-pkg-');
    const projectRoot = await makeTempDir('opm-plan-alias-proj-');

    await createSyntheticPackage(packageRoot);

    const plan = await buildInstallPlan({ packageRoot, projectRoot });

    const agentAction = plan.actions.find(
      (action): action is CopyFileAction =>
        action.type === 'copyFile' && action.objectType === 'agent',
    );

    expect(agentAction).toBeDefined();
    expect(agentAction?.modelAlias).toBe('reviewer');
  });
});

describe('updateLockfileFromInstall stores modelAlias + resolvedModel', () => {
  it('stores modelAlias without resolvedModel when alias is not defined in config', async () => {
    const packageRoot = await makeTempDir('opm-lockfile-unresolved-pkg-');
    const projectRoot = await makeTempDir('opm-lockfile-unresolved-proj-');

    await createSyntheticPackage(packageRoot);

    const plan = await buildInstallPlan({ packageRoot, projectRoot });

    vi.mocked(readModelAliases).mockResolvedValueOnce({
      schema: SUPPORTED_MODEL_ALIAS_SCHEMA,
      aliases: {},
    });

    const result = await applyInstallPlan(plan);

    expect(result.ok).toBe(true);

    const lockfile = await readLockfile(projectRoot);
    const agentEntry = lockfile.files['.opencode/agents/my-agent.md'];
    expect(agentEntry?.modelAlias).toBe('reviewer');
    expect(agentEntry?.resolvedModel).toBeUndefined();
  });

  it('stores modelAlias and resolvedModel when alias is defined in config', async () => {
    const packageRoot = await makeTempDir('opm-lockfile-resolved-pkg-');
    const projectRoot = await makeTempDir('opm-lockfile-resolved-proj-');

    await createSyntheticPackage(packageRoot);

    const plan = await buildInstallPlan({ packageRoot, projectRoot });

    vi.mocked(readModelAliases).mockResolvedValueOnce({
      schema: SUPPORTED_MODEL_ALIAS_SCHEMA,
      aliases: { reviewer: 'openai/gpt-4o' },
    });

    const result = await applyInstallPlan(plan);

    expect(result.ok).toBe(true);

    const lockfile = await readLockfile(projectRoot);
    const agentEntry = lockfile.files['.opencode/agents/my-agent.md'];
    expect(agentEntry?.modelAlias).toBe('reviewer');
    expect(agentEntry?.resolvedModel).toBe('openai/gpt-4o');
  });
});

describe('doctor emits unknown_model_alias warning', () => {
  it('emits unknown_model_alias warning when alias is not defined', async () => {
    const projectRoot = await makeTempDir('opm-doctor-alias-warn-');

    await fs.writeFile(path.join(projectRoot, 'opencode.json'), '{}\n', 'utf8');
    await fs.ensureDir(path.join(projectRoot, '.opencode/agents'));
    await fs.writeFile(
      path.join(projectRoot, '.opencode/agents/my-agent.md'),
      '# Agent\n',
      'utf8',
    );

    await writeLockfile(projectRoot, {
      schema: 'opencode-packman/lock/v1',
      packages: {
        'test-pkg': {
          version: '0.1.0',
          source: '/tmp/test-pkg',
          installedAt: new Date().toISOString(),
          scope: 'project',
        },
      },
      files: {
        '.opencode/agents/my-agent.md': {
          owner: 'test-pkg',
          version: '0.1.0',
          strategy: 'add',
          modelAlias: 'missing-alias',
        },
      },
      patches: {},
    });

    const report = await runDoctor(projectRoot);

    const unknownAliasIssue = report.issues.find(
      (issue) => issue.code === 'unknown_model_alias',
    );
    expect(unknownAliasIssue).toBeDefined();
    expect(unknownAliasIssue?.severity).toBe('warning');
  });
});
