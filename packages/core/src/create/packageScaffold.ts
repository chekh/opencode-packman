import path from 'node:path';

import fs from 'fs-extra';

import { readRegistryConfig } from '../registry/registryConfig.js';

export type CreatePackageType = 'skill' | 'agent' | 'command' | 'bundle' | 'profile';

export type CreatePackageInput = {
  name: string;
  type: CreatePackageType;
  targetDir: string;
  force?: boolean;
};

export type CreatePackageResult = {
  ok: boolean;
  packageName: string;
  packageRoot: string;
  filesCreated: string[];
  directoriesCreated: string[];
  warnings: Array<{ code: string; message: string; path?: string }>;
  errors: Array<{ code: string; message: string; path?: string }>;
};

export type ResolveCreateTargetInput = {
  name: string;
  baseDir: string;
  dir?: string;
  registryName?: string;
  configPath?: string;
};

export type ResolveCreateTargetResult = {
  targetDir: string;
  registryName?: string;
};

type ScaffoldDefinition = {
  directories: string[];
  files: Array<{ relativePath: string; content: string }>;
};

function isPathInsideRoot(root: string, target: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`);
}

function validatePackageName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed === '') {
    return 'Package name cannot be empty.';
  }

  if (path.isAbsolute(trimmed)) {
    return 'Package name cannot be an absolute path.';
  }

  if (trimmed.includes('/') || trimmed.includes('\\')) {
    return 'Package name cannot contain path separators.';
  }

  if (trimmed.includes('..') || trimmed === '.' || trimmed === '..') {
    return 'Package name cannot contain dot segments.';
  }

  if (trimmed.includes(' ')) {
    return 'Package name cannot contain spaces.';
  }

  if (!/^[a-z0-9_-]+$/.test(trimmed)) {
    return 'Package name can only use lowercase letters, numbers, dash, and underscore.';
  }

  return null;
}

function buildScaffoldDefinition(name: string, type: CreatePackageType): ScaffoldDefinition {
  if (type === 'bundle') {
    return {
      directories: ['agents', 'commands', `skills/${name}-skill`],
      files: [
        {
          relativePath: 'package.yaml',
          content: `schema: opencode-packman/package/v1
name: ${name}
version: 0.1.0
type: bundle
description: "TODO: describe this package"

exports:
  agents:
    - name: ${name}-reviewer
      path: agents/${name}-reviewer.md
      strategy: add

  commands:
    - name: ${name}-review
      path: commands/${name}-review.md
      strategy: add

  skills:
    - name: ${name}-skill
      path: skills/${name}-skill
      strategy: add

  config:
    - path: opencode.patch.json
      strategy: patch
`
        },
        {
          relativePath: `agents/${name}-reviewer.md`,
          content: `---
description: "TODO: describe the ${name} reviewer agent"
mode: subagent
tools:
  write: false
  edit: false
  bash: false
---

You are the ${name} reviewer agent.

TODO: describe review goals.
`
        },
        {
          relativePath: `commands/${name}-review.md`,
          content: `---
description: "TODO: run ${name} review"
agent: ${name}-reviewer
---

Run a ${name} review for this project.
`
        },
        {
          relativePath: `skills/${name}-skill/SKILL.md`,
          content: `---
name: ${name}-skill
description: "TODO: describe the ${name} skill"
compatibility: opencode
---

Use this skill when working on ${name}-related tasks.
`
        },
        {
          relativePath: 'opencode.patch.json',
          content: '{}\n'
        }
      ]
    };
  }

  if (type === 'skill') {
    return {
      directories: [`skills/${name}`],
      files: [
        {
          relativePath: 'package.yaml',
          content: `schema: opencode-packman/package/v1
name: ${name}
version: 0.1.0
type: skill
description: "TODO: describe this package"

exports:
  skills:
    - name: ${name}
      path: skills/${name}
      strategy: add
`
        },
        {
          relativePath: `skills/${name}/SKILL.md`,
          content: `---
name: ${name}
description: "TODO: describe the ${name} skill"
compatibility: opencode
---

Use this skill when working on ${name}-related tasks.
`
        }
      ]
    };
  }

  if (type === 'agent') {
    return {
      directories: ['agents'],
      files: [
        {
          relativePath: 'package.yaml',
          content: `schema: opencode-packman/package/v1
name: ${name}
version: 0.1.0
type: agent
description: "TODO: describe this package"

exports:
  agents:
    - name: ${name}
      path: agents/${name}.md
      strategy: add
`
        },
        {
          relativePath: `agents/${name}.md`,
          content: `---
description: "TODO: describe the ${name} agent"
mode: subagent
tools:
  write: false
  edit: false
  bash: false
---

You are the ${name} agent.

TODO: describe goals.
`
        }
      ]
    };
  }

  if (type === 'command') {
    return {
      directories: ['commands'],
      files: [
        {
          relativePath: 'package.yaml',
          content: `schema: opencode-packman/package/v1
name: ${name}
version: 0.1.0
type: command
description: "TODO: describe this package"

exports:
  commands:
    - name: ${name}
      path: commands/${name}.md
      strategy: add
`
        },
        {
          relativePath: `commands/${name}.md`,
          content: `---
description: "TODO: run ${name}"
---

Run ${name} for this project.
`
        }
      ]
    };
  }

  return {
    directories: [],
    files: [
      {
        relativePath: 'package.yaml',
        content: `schema: opencode-packman/package/v1
name: ${name}
version: 0.1.0
type: profile
description: "TODO: describe this package"

exports:
  config:
    - path: opencode.patch.json
      strategy: patch
`
      },
      {
        relativePath: 'opencode.patch.json',
        content: '{}\n'
      }
    ]
  };
}

export async function resolveCreatePackageTarget(input: ResolveCreateTargetInput): Promise<ResolveCreateTargetResult> {
  if (input.registryName !== undefined && input.dir !== undefined) {
    throw new Error('Cannot use --registry and --dir together. Choose one target mode.');
  }

  if (input.registryName !== undefined) {
    const config = await readRegistryConfig(input.configPath);
    const registry = config.registries[input.registryName];
    if (registry === undefined) {
      throw new Error(`Registry '${input.registryName}' does not exist.`);
    }

    if (registry.type !== 'local') {
      throw new Error(`Unsupported registry type '${String(registry.type)}' for '${input.registryName}'.`);
    }

    return {
      targetDir: path.resolve(registry.path, 'packages', input.name),
      registryName: input.registryName
    };
  }

  const parentDir = path.resolve(input.baseDir, input.dir ?? '.');
  return { targetDir: path.resolve(parentDir, input.name) };
}

export async function createPackageScaffold(input: CreatePackageInput): Promise<CreatePackageResult> {
  const packageName = input.name.trim();
  const packageRoot = path.resolve(input.targetDir);
  const result: CreatePackageResult = {
    ok: false,
    packageName,
    packageRoot,
    filesCreated: [],
    directoriesCreated: [],
    warnings: [],
    errors: []
  };

  const nameError = validatePackageName(packageName);
  if (nameError !== null) {
    result.errors.push({
      code: 'invalid_package_name',
      message: nameError,
      path: input.name
    });
    return result;
  }

  const targetExists = await fs.pathExists(packageRoot);
  if (targetExists) {
    const entries = await fs.readdir(packageRoot);
    const isEmpty = entries.length === 0;
    if (!isEmpty && !input.force) {
      result.errors.push({
        code: 'target_exists',
        message: `Target directory is not empty: ${packageRoot}`,
        path: packageRoot
      });
      return result;
    }
  } else {
    await fs.ensureDir(packageRoot);
    result.directoriesCreated.push(packageRoot);
  }

  const definition = buildScaffoldDefinition(packageName, input.type);
  const allRelativePaths = [...definition.directories, ...definition.files.map((item) => item.relativePath)];

  for (const relativePath of allRelativePaths) {
    const absolutePath = path.resolve(packageRoot, relativePath);
    if (!isPathInsideRoot(packageRoot, absolutePath)) {
      result.errors.push({
        code: 'unsafe_target_path',
        message: `Generated scaffold path escapes target directory: ${relativePath}`,
        path: absolutePath
      });
      return result;
    }
  }

  for (const relativeDir of definition.directories) {
    const absoluteDir = path.resolve(packageRoot, relativeDir);
    if (!(await fs.pathExists(absoluteDir))) {
      await fs.ensureDir(absoluteDir);
      result.directoriesCreated.push(absoluteDir);
    }
  }

  for (const file of definition.files) {
    const absolutePath = path.resolve(packageRoot, file.relativePath);
    await fs.ensureDir(path.dirname(absolutePath));
    await fs.writeFile(absolutePath, file.content, 'utf8');
    result.filesCreated.push(absolutePath);
  }

  result.ok = true;
  return result;
}
