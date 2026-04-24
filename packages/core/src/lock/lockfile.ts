import path from 'node:path';

import fs from 'fs-extra';
import YAML from 'yaml';

import type { InstallResult } from '../install/installer.js';
import type { InstallPlan } from '../plan/installPlan.js';
import { getProjectPaths } from '../project/projectPaths.js';
import {
  lockfileSchema,
  SUPPORTED_LOCK_SCHEMA,
  type LockFileOwnerEntry,
  type LockPatchEntry,
  type Lockfile
} from './lockSchema.js';

function toProjectRelative(projectRoot: string, targetPath: string): string {
  return path.relative(path.resolve(projectRoot), path.resolve(targetPath)).replaceAll('\\', '/');
}

export function emptyLockfile(): Lockfile {
  return {
    schema: SUPPORTED_LOCK_SCHEMA,
    packages: {},
    files: {},
    patches: {}
  };
}

export async function readLockfile(projectRoot: string): Promise<Lockfile> {
  const { lockfilePath } = getProjectPaths(projectRoot);
  if (!(await fs.pathExists(lockfilePath))) {
    return emptyLockfile();
  }

  const raw = await fs.readFile(lockfilePath, 'utf8');
  const parsed = YAML.parse(raw);
  const validated = lockfileSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`Invalid lockfile format at ${lockfilePath}`);
  }

  return validated.data;
}

export async function writeLockfile(projectRoot: string, lockfile: Lockfile): Promise<void> {
  const { packmanDir, lockfilePath } = getProjectPaths(projectRoot);
  await fs.ensureDir(packmanDir);
  await fs.writeFile(lockfilePath, YAML.stringify(lockfile), 'utf8');
}

export async function updateLockfileFromInstall(plan: InstallPlan, result: InstallResult): Promise<void> {
  if (!result.ok) {
    return;
  }

  const lockfile = await readLockfile(plan.projectRoot);
  lockfile.packages[plan.packageName] = {
    version: plan.packageVersion,
    source: plan.packageRoot,
    installedAt: new Date().toISOString(),
    scope: 'project'
  };

  for (const applied of result.actionsApplied) {
    if (applied.action.type === 'copyFile' || applied.action.type === 'copyDirectory') {
      const relativeTarget = toProjectRelative(plan.projectRoot, applied.action.to);
      const fileEntry: LockFileOwnerEntry = {
        owner: plan.packageName,
        version: plan.packageVersion,
        strategy: applied.action.strategy
      };
      lockfile.files[relativeTarget] = fileEntry;
    }

    if (applied.action.type === 'patchJson') {
      const targetKey = toProjectRelative(plan.projectRoot, applied.action.to);
      const patchEntry: LockPatchEntry = {
        owner: plan.packageName,
        version: plan.packageVersion,
        patchFile: toProjectRelative(plan.packageRoot, applied.action.from)
      };
      const existing = lockfile.patches[targetKey] ?? [];
      const filtered = existing.filter((entry) => entry.owner !== plan.packageName);
      lockfile.patches[targetKey] = [...filtered, patchEntry];
    }
  }

  await writeLockfile(plan.projectRoot, lockfile);
}

export async function updateLockfileFromRemove(projectRoot: string, packageName: string): Promise<void> {
  const lockfile = await readLockfile(projectRoot);

  delete lockfile.packages[packageName];

  for (const [targetPath, fileEntry] of Object.entries(lockfile.files)) {
    if (fileEntry.owner === packageName) {
      delete lockfile.files[targetPath];
    }
  }

  for (const [targetPath, patchEntries] of Object.entries(lockfile.patches)) {
    const nextEntries = patchEntries.filter((entry) => entry.owner !== packageName);
    if (nextEntries.length === 0) {
      delete lockfile.patches[targetPath];
      continue;
    }

    lockfile.patches[targetPath] = nextEntries;
  }

  await writeLockfile(projectRoot, lockfile);
}
