import path from 'node:path';

import fs from 'fs-extra';

import { runDoctor } from '../doctor/doctor.js';
import { readLockfile } from '../lock/lockfile.js';
import { readProjectBaseline } from './baseline.js';
import { getProjectPaths } from './projectPaths.js';

export type ProjectStatusResult = {
  projectRoot: string;
  opencodeJsonExists: boolean;
  opencodeDirExists: boolean;
  initialized: boolean;
  lockfilePath: string;
  lockfileExists: boolean;
  baselinePath: string;
  baselineExists: boolean;
  installedPackages: number;
  baselineFiles: number;
  doctorStatus: 'healthy' | 'warning' | 'broken';
};

function toRelative(projectRoot: string, absolutePath: string): string {
  return path.relative(projectRoot, absolutePath).replaceAll('\\', '/');
}

export async function getProjectStatus(
  projectRoot: string,
): Promise<ProjectStatusResult> {
  const paths = getProjectPaths(projectRoot);

  const [
    opencodeJsonExists,
    opencodeDirExists,
    lockfileExists,
    baselineExists,
  ] = await Promise.all([
    fs.pathExists(paths.opencodeJsonPath),
    fs.pathExists(paths.opencodeDir),
    fs.pathExists(paths.lockfilePath),
    fs.pathExists(paths.baselinePath),
  ]);

  let installedPackages = 0;
  if (lockfileExists) {
    const lockfile = await readLockfile(paths.projectRoot);
    installedPackages = Object.keys(lockfile.packages).length;
  }

  let baselineFiles = 0;
  if (baselineExists) {
    const baseline = await readProjectBaseline(paths.projectRoot);
    baselineFiles = baseline === null ? 0 : Object.keys(baseline.files).length;
  }

  const doctorReport = await runDoctor(paths.projectRoot);

  return {
    projectRoot: paths.projectRoot,
    opencodeJsonExists,
    opencodeDirExists,
    initialized: lockfileExists && baselineExists,
    lockfilePath: toRelative(paths.projectRoot, paths.lockfilePath),
    lockfileExists,
    baselinePath: toRelative(paths.projectRoot, paths.baselinePath),
    baselineExists,
    installedPackages,
    baselineFiles,
    doctorStatus: doctorReport.status,
  };
}
