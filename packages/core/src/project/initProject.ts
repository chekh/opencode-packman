import fs from 'fs-extra';

import { emptyLockfile, writeLockfile } from '../lock/lockfile.js';
import { getProjectPaths } from './projectPaths.js';

export type InitEntry = {
  path: string;
  status: 'created' | 'exists';
};

export type InitResult = {
  projectRoot: string;
  created: InitEntry[];
  existing: InitEntry[];
};

function toEntry(pathValue: string, exists: boolean): InitEntry {
  return {
    path: pathValue,
    status: exists ? 'exists' : 'created'
  };
}

export async function initProject(projectRoot: string): Promise<InitResult> {
  const paths = getProjectPaths(projectRoot);
  const created: InitEntry[] = [];
  const existing: InitEntry[] = [];

  const dirTargets = [paths.opencodeDir, paths.agentsDir, paths.commandsDir, paths.skillsDir, paths.packmanDir];

  for (const dirTarget of dirTargets) {
    const exists = await fs.pathExists(dirTarget);
    await fs.ensureDir(dirTarget);
    const entry = toEntry(dirTarget, exists);
    if (exists) {
      existing.push(entry);
    } else {
      created.push(entry);
    }
  }

  const hasOpencodeJson = await fs.pathExists(paths.opencodeJsonPath);
  if (!hasOpencodeJson) {
    await fs.writeFile(paths.opencodeJsonPath, '{}\n', 'utf8');
  }
  const opencodeEntry = toEntry(paths.opencodeJsonPath, hasOpencodeJson);
  if (hasOpencodeJson) {
    existing.push(opencodeEntry);
  } else {
    created.push(opencodeEntry);
  }

  const hasLockfile = await fs.pathExists(paths.lockfilePath);
  if (!hasLockfile) {
    await writeLockfile(paths.projectRoot, emptyLockfile());
  }
  const lockfileEntry = toEntry(paths.lockfilePath, hasLockfile);
  if (hasLockfile) {
    existing.push(lockfileEntry);
  } else {
    created.push(lockfileEntry);
  }

  return {
    projectRoot: paths.projectRoot,
    created,
    existing
  };
}
