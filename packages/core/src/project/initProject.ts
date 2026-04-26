import path from 'node:path';

import fs from 'fs-extra';

import { emptyLockfile, writeLockfile } from '../lock/lockfile.js';
import {
  createProjectBaseline,
  readProjectBaseline,
  writeProjectBaseline,
} from './baseline.js';
import {
  getGlobalPaths,
  getProjectPaths,
  type ProjectPaths,
} from './projectPaths.js';

export type InitProjectResult = {
  projectRoot: string;
  created: string[];
  alreadyExisted: string[];
  baselineFiles: number;
  lockfilePath: string;
  baselinePath: string;
};

function toRelative(
  projectRoot: string,
  absolutePath: string,
  isDirectory: boolean,
): string {
  const relative = path
    .relative(projectRoot, absolutePath)
    .replaceAll('\\', '/');
  if (relative === '') {
    return isDirectory ? './' : '.';
  }

  if (isDirectory && !relative.endsWith('/')) {
    return `${relative}/`;
  }

  return relative;
}

export async function initProject(
  projectRoot: string,
): Promise<InitProjectResult> {
  return initFromPaths(getProjectPaths(projectRoot));
}

export async function initGlobal(): Promise<InitProjectResult> {
  return initFromPaths(getGlobalPaths());
}

async function initFromPaths(paths: ProjectPaths): Promise<InitProjectResult> {
  const created: string[] = [];
  const alreadyExisted: string[] = [];

  const dirTargets = [
    paths.opencodeDir,
    paths.agentsDir,
    paths.commandsDir,
    paths.skillsDir,
    paths.packmanDir,
  ];

  for (const dirTarget of dirTargets) {
    const exists = await fs.pathExists(dirTarget);
    await fs.ensureDir(dirTarget);
    const entry = toRelative(paths.projectRoot, dirTarget, true);
    if (exists) {
      alreadyExisted.push(entry);
    } else {
      created.push(entry);
    }
  }

  const hasOpencodeJson = await fs.pathExists(paths.opencodeJsonPath);
  if (!hasOpencodeJson) {
    await fs.writeFile(paths.opencodeJsonPath, '{}\n', 'utf8');
  }
  const opencodeEntry = toRelative(
    paths.projectRoot,
    paths.opencodeJsonPath,
    false,
  );
  if (hasOpencodeJson) {
    alreadyExisted.push(opencodeEntry);
  } else {
    created.push(opencodeEntry);
  }

  const hasLockfile = await fs.pathExists(paths.lockfilePath);
  if (!hasLockfile) {
    await writeLockfile(paths.projectRoot, emptyLockfile());
  }
  const lockfileEntry = toRelative(
    paths.projectRoot,
    paths.lockfilePath,
    false,
  );
  if (hasLockfile) {
    alreadyExisted.push(lockfileEntry);
  } else {
    created.push(lockfileEntry);
  }

  const baseline = await createProjectBaseline(paths);
  let baselineFilesCount = Object.keys(baseline.files).length;
  const hasBaseline = await fs.pathExists(paths.baselinePath);
  if (!hasBaseline) {
    await writeProjectBaseline(paths.projectRoot, baseline);
    created.push(toRelative(paths.projectRoot, paths.baselinePath, false));
  } else {
    alreadyExisted.push(
      toRelative(paths.projectRoot, paths.baselinePath, false),
    );
    const existingBaseline = await readProjectBaseline(paths.projectRoot);
    if (existingBaseline !== null) {
      baselineFilesCount = Object.keys(existingBaseline.files).length;
    }
  }

  return {
    projectRoot: paths.projectRoot,
    created,
    alreadyExisted,
    baselineFiles: baselineFilesCount,
    lockfilePath: toRelative(paths.projectRoot, paths.lockfilePath, false),
    baselinePath: toRelative(paths.projectRoot, paths.baselinePath, false),
  };
}
