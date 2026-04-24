import path from 'node:path';
import fs from 'fs-extra';

import type { CopyDirectoryAction, CopyFileAction, InstallAction } from '../plan/installPlan.js';

export type FileActionResult = {
  ok: boolean;
  action: InstallAction;
  written?: string[];
  error?: string;
};

export type CopyActionInput<TAction extends CopyFileAction | CopyDirectoryAction> = {
  projectRoot: string;
  action: TAction;
};

export async function ensureDir(targetPath: string): Promise<void> {
  await fs.ensureDir(targetPath);
}

function isPathInsideRoot(projectRoot: string, targetPath: string): boolean {
  const resolvedRoot = path.resolve(projectRoot);
  const resolvedTarget = path.resolve(targetPath);
  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`);
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

export async function copyFileSafe(input: CopyActionInput<CopyFileAction>): Promise<FileActionResult> {
  const { action, projectRoot } = input;
  const resolvedTarget = path.resolve(action.to);
  if (!isPathInsideRoot(projectRoot, resolvedTarget)) {
    return {
      ok: false,
      action,
      error: `Target path is outside project root: ${resolvedTarget}`
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

  try {
    await fs.ensureDir(path.dirname(resolvedTarget));

    if (action.strategy === 'replace' && targetExists) {
      await fs.remove(resolvedTarget);
    }

    await fs.copyFile(path.resolve(action.from), resolvedTarget);
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
  const { action, projectRoot } = input;
  const resolvedTarget = path.resolve(action.to);
  if (!isPathInsideRoot(projectRoot, resolvedTarget)) {
    return {
      ok: false,
      action,
      error: `Target path is outside project root: ${resolvedTarget}`
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

  try {
    await fs.ensureDir(path.dirname(resolvedTarget));

    if (action.strategy === 'replace' && targetExists) {
      await fs.remove(resolvedTarget);
    }

    await fs.copy(path.resolve(action.from), resolvedTarget, { overwrite: true, errorOnExist: false });
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
