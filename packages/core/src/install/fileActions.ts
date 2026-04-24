import path from 'node:path';
import fs from 'fs-extra';

import type { CopyDirectoryAction, CopyFileAction, InstallAction } from '../plan/installPlan.js';
import { isPathInsideRoot, isRealPathInsideRoot, validateWritablePathInsideRoot } from '../utils/pathSafety.js';

export type FileActionResult = {
  ok: boolean;
  action: InstallAction;
  written?: string[];
  error?: string;
};

export type CopyActionInput<TAction extends CopyFileAction | CopyDirectoryAction> = {
  projectRoot: string;
  sourceRoot?: string;
  action: TAction;
};

export async function ensureDir(targetPath: string): Promise<void> {
  await fs.ensureDir(targetPath);
}

async function listFilesRecursively(targetPath: string): Promise<string[]> {
  const stat = await fs.stat(targetPath);
  if (stat.isFile()) {
    return [targetPath];
  }

  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const all: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      all.push(...(await listFilesRecursively(entryPath)));
    } else if (entry.isFile()) {
      all.push(entryPath);
    }
  }
  return all;
}

function buildTempPath(targetPath: string): string {
  const token = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return path.join(path.dirname(targetPath), `.${path.basename(targetPath)}.opm-tmp-${token}`);
}

function buildBackupPath(targetPath: string): string {
  const token = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return path.join(path.dirname(targetPath), `.${path.basename(targetPath)}.opm-bak-${token}`);
}

export async function copyFileSafe(input: CopyActionInput<CopyFileAction>): Promise<FileActionResult> {
  const { action, projectRoot, sourceRoot } = input;
  const resolvedProjectRoot = path.resolve(projectRoot);
  const resolvedSource = path.resolve(action.from);
  const resolvedTarget = path.resolve(action.to);

  if (sourceRoot !== undefined) {
    if (!isPathInsideRoot(sourceRoot, resolvedSource)) {
      return {
        ok: false,
        action,
        error: `Source path is outside package root: ${resolvedSource}`
      };
    }

    if (!(await fs.pathExists(resolvedSource))) {
      return {
        ok: false,
        action,
        error: `Source path does not exist: ${resolvedSource}`
      };
    }

    if (!(await isRealPathInsideRoot(sourceRoot, resolvedSource))) {
      return {
        ok: false,
        action,
        error: `Source path points outside package root after resolving symlinks: ${resolvedSource}`
      };
    }
  }

  if (!isPathInsideRoot(projectRoot, resolvedTarget)) {
    return {
      ok: false,
      action,
      error: `Target path is outside project root: ${resolvedTarget}`
    };
  }

  if (resolvedTarget === resolvedProjectRoot) {
    return {
      ok: false,
      action,
      error: `Target path resolves to project root and cannot be replaced: ${resolvedTarget}`
    };
  }

  const targetSafety = await validateWritablePathInsideRoot(projectRoot, resolvedTarget);
  if (!targetSafety.ok) {
    return {
      ok: false,
      action,
      error: `Unsafe target path: ${targetSafety.message}`
    };
  }

  const targetExists = await fs.pathExists(resolvedTarget);
  if (action.strategy === 'add' && targetExists) {
    return {
      ok: false,
      action,
      error: `Target already exists for add strategy: ${resolvedTarget}`
    };
  }

  if (targetExists) {
    const targetStat = await fs.lstat(resolvedTarget);
    if (targetStat.isDirectory()) {
      return {
        ok: false,
        action,
        error: `Target for copyFile action is a directory: ${resolvedTarget}`
      };
    }
  }

  try {
    await fs.ensureDir(path.dirname(resolvedTarget));

    if (action.strategy === 'replace' && targetExists) {
      const tempPath = buildTempPath(resolvedTarget);
      const backupPath = buildBackupPath(resolvedTarget);

      await fs.copyFile(resolvedSource, tempPath);
      let movedToBackup = false;

      try {
        await fs.move(resolvedTarget, backupPath, { overwrite: false });
        movedToBackup = true;
        await fs.move(tempPath, resolvedTarget, { overwrite: false });
        await fs.remove(backupPath);
      } catch (error) {
        if (await fs.pathExists(tempPath)) {
          await fs.remove(tempPath);
        }

        if (movedToBackup) {
          const targetMissing = !(await fs.pathExists(resolvedTarget));
          if (targetMissing) {
            await fs.move(backupPath, resolvedTarget, { overwrite: false });
          }
        }

        throw error;
      }
    } else {
      await fs.copyFile(resolvedSource, resolvedTarget);
    }

    return {
      ok: true,
      action,
      written: [resolvedTarget]
    };
  } catch (error) {
    return {
      ok: false,
      action,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function copyDirectorySafe(input: CopyActionInput<CopyDirectoryAction>): Promise<FileActionResult> {
  const { action, projectRoot, sourceRoot } = input;
  const resolvedProjectRoot = path.resolve(projectRoot);
  const resolvedSource = path.resolve(action.from);
  const resolvedTarget = path.resolve(action.to);

  if (sourceRoot !== undefined) {
    if (!isPathInsideRoot(sourceRoot, resolvedSource)) {
      return {
        ok: false,
        action,
        error: `Source path is outside package root: ${resolvedSource}`
      };
    }

    if (!(await fs.pathExists(resolvedSource))) {
      return {
        ok: false,
        action,
        error: `Source path does not exist: ${resolvedSource}`
      };
    }

    if (!(await isRealPathInsideRoot(sourceRoot, resolvedSource))) {
      return {
        ok: false,
        action,
        error: `Source path points outside package root after resolving symlinks: ${resolvedSource}`
      };
    }
  }

  if (!isPathInsideRoot(projectRoot, resolvedTarget)) {
    return {
      ok: false,
      action,
      error: `Target path is outside project root: ${resolvedTarget}`
    };
  }

  if (resolvedTarget === resolvedProjectRoot) {
    return {
      ok: false,
      action,
      error: `Target path resolves to project root and cannot be replaced: ${resolvedTarget}`
    };
  }

  const targetSafety = await validateWritablePathInsideRoot(projectRoot, resolvedTarget);
  if (!targetSafety.ok) {
    return {
      ok: false,
      action,
      error: `Unsafe target path: ${targetSafety.message}`
    };
  }

  const targetExists = await fs.pathExists(resolvedTarget);
  if (action.strategy === 'add' && targetExists) {
    return {
      ok: false,
      action,
      error: `Target already exists for add strategy: ${resolvedTarget}`
    };
  }

  if (targetExists) {
    const targetStat = await fs.lstat(resolvedTarget);
    if (!targetStat.isDirectory()) {
      return {
        ok: false,
        action,
        error: `Target for copyDirectory action is not a directory: ${resolvedTarget}`
      };
    }
  }

  try {
    await fs.ensureDir(path.dirname(resolvedTarget));

    if (action.strategy === 'replace' && targetExists) {
      const tempPath = buildTempPath(resolvedTarget);
      const backupPath = buildBackupPath(resolvedTarget);

      await fs.copy(resolvedSource, tempPath, { overwrite: true, errorOnExist: false });
      let movedToBackup = false;

      try {
        await fs.move(resolvedTarget, backupPath, { overwrite: false });
        movedToBackup = true;
        await fs.move(tempPath, resolvedTarget, { overwrite: false });
        await fs.remove(backupPath);
      } catch (error) {
        if (await fs.pathExists(tempPath)) {
          await fs.remove(tempPath);
        }

        if (movedToBackup) {
          const targetMissing = !(await fs.pathExists(resolvedTarget));
          if (targetMissing) {
            await fs.move(backupPath, resolvedTarget, { overwrite: false });
          }
        }

        throw error;
      }
    } else {
      await fs.copy(resolvedSource, resolvedTarget, { overwrite: true, errorOnExist: false });
    }

    const written = await listFilesRecursively(resolvedTarget);
    return {
      ok: true,
      action,
      written: written.length > 0 ? written : [resolvedTarget]
    };
  } catch (error) {
    return {
      ok: false,
      action,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
