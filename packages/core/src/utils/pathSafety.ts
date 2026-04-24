import path from 'node:path';

import fs from 'fs-extra';

export function isPathInsideRoot(rootPath: string, targetPath: string): boolean {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedTarget = path.resolve(targetPath);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export async function isRealPathInsideRoot(rootPath: string, targetPath: string): Promise<boolean> {
  const [realRoot, realTarget] = await Promise.all([fs.realpath(path.resolve(rootPath)), fs.realpath(path.resolve(targetPath))]);
  return isPathInsideRoot(realRoot, realTarget);
}

export type WritablePathValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'outside_root' | 'symlink_component' | 'parent_not_directory' | 'root_missing';
      message: string;
      path: string;
    };

export async function validateWritablePathInsideRoot(
  rootPath: string,
  targetPath: string
): Promise<WritablePathValidationResult> {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedTarget = path.resolve(targetPath);

  if (!isPathInsideRoot(resolvedRoot, resolvedTarget)) {
    return {
      ok: false,
      reason: 'outside_root',
      message: `Target path resolves outside root: ${resolvedTarget}`,
      path: resolvedTarget
    };
  }

  if (!(await fs.pathExists(resolvedRoot))) {
    return {
      ok: false,
      reason: 'root_missing',
      message: `Root path does not exist: ${resolvedRoot}`,
      path: resolvedRoot
    };
  }

  const relativePath = path.relative(resolvedRoot, resolvedTarget);
  const pathParts = relativePath === '' ? [] : relativePath.split(path.sep).filter((part) => part !== '');
  let currentPath = resolvedRoot;

  for (let index = 0; index < pathParts.length; index += 1) {
    const part = pathParts[index];
    if (part === undefined) {
      continue;
    }

    currentPath = path.join(currentPath, part);
    if (!(await fs.pathExists(currentPath))) {
      continue;
    }

    const stat = await fs.lstat(currentPath);
    if (stat.isSymbolicLink()) {
      return {
        ok: false,
        reason: 'symlink_component',
        message: `Target path contains symbolic link component: ${currentPath}`,
        path: currentPath
      };
    }

    const isLastPart = index === pathParts.length - 1;
    if (!isLastPart && !stat.isDirectory()) {
      return {
        ok: false,
        reason: 'parent_not_directory',
        message: `Target path parent is not a directory: ${currentPath}`,
        path: currentPath
      };
    }
  }

  return { ok: true };
}
