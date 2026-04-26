import path from 'node:path';

import fs from 'fs-extra';

import { updateLockfileFromInstall } from '../lock/lockfile.js';
import type { InstallAction, InstallPlan } from '../plan/installPlan.js';
import { copyDirectorySafe, copyFileSafe } from './fileActions.js';
import { applyJsonPatchFile } from './jsonPatch.js';

export type AppliedAction = {
  action: InstallAction;
  written: string[];
};

export type InstallResult = {
  ok: boolean;
  packageName: string;
  packageVersion: string;
  actionsApplied: AppliedAction[];
  filesWritten: string[];
  patchesApplied: string[];
  errors: Array<{ message: string; path?: string }>;
};

type BackupEntry = {
  targetAbsPath: string;
  backupAbsPath: string | null;
};

function createEmptyResult(plan: InstallPlan): InstallResult {
  return {
    ok: false,
    packageName: plan.packageName,
    packageVersion: plan.packageVersion,
    actionsApplied: [],
    filesWritten: [],
    patchesApplied: [],
    errors: [],
  };
}

function withError(
  result: InstallResult,
  message: string,
  targetPath?: string,
): InstallResult {
  const errorEntry =
    targetPath === undefined ? { message } : { message, path: targetPath };
  return {
    ...result,
    ok: false,
    errors: [...result.errors, errorEntry],
  };
}

export async function applyInstallPlan(
  plan: InstallPlan,
): Promise<InstallResult> {
  const result = createEmptyResult(plan);

  if (!plan.validation.ok) {
    return withError(result, 'Install plan contains validation errors.');
  }

  if (plan.conflicts.length > 0) {
    return withError(result, 'Install plan contains conflicts.');
  }

  const backupDir = path.join(
    plan.projectRoot,
    '.opencode-packman',
    'backups',
    `${plan.packageName}-${Date.now()}`,
  );

  const targetBackupMap = new Map<string, string | null>();
  const appliedEntries: BackupEntry[] = [];
  const prePatchSnapshots = new Map<string, Record<string, unknown>>();

  async function createBackup(targetAbsPath: string): Promise<string | null> {
    if (targetBackupMap.has(targetAbsPath)) {
      return targetBackupMap.get(targetAbsPath) ?? null;
    }

    const exists = await fs.pathExists(targetAbsPath);
    if (!exists) {
      targetBackupMap.set(targetAbsPath, null);
      return null;
    }

    const relPath = path
      .relative(path.resolve(plan.projectRoot), targetAbsPath)
      .replaceAll('\\', '/');
    const backupAbsPath = path.join(backupDir, relPath);
    await fs.ensureDir(path.dirname(backupAbsPath));
    await fs.copy(targetAbsPath, backupAbsPath);
    targetBackupMap.set(targetAbsPath, backupAbsPath);
    return backupAbsPath;
  }

  async function restoreEntry(entry: BackupEntry): Promise<void> {
    try {
      if (entry.backupAbsPath !== null) {
        await fs.remove(entry.targetAbsPath);
        await fs.copy(entry.backupAbsPath, entry.targetAbsPath);
      } else {
        await fs.remove(entry.targetAbsPath);
      }
    } catch {
      // non-fatal: best-effort restore
    }
  }

  async function rollbackApplied(): Promise<void> {
    for (let i = appliedEntries.length - 1; i >= 0; i--) {
      await restoreEntry(appliedEntries[i]!);
    }
    try {
      await fs.remove(backupDir);
    } catch {
      // non-fatal: backup cleanup
    }
  }

  let state = { ...result };

  for (const action of plan.actions) {
    const targetAbsPath = path.resolve(action.to);
    let backupAbsPath: string | null;

    try {
      backupAbsPath = await createBackup(targetAbsPath);
    } catch (error) {
      await rollbackApplied();
      return withError(
        state,
        `Failed to create backup for ${action.to}: ${error instanceof Error ? error.message : String(error)}`,
        action.to,
      );
    }

    const currentEntry: BackupEntry = { targetAbsPath, backupAbsPath };

    if (action.type === 'copyFile') {
      const actionResult = await copyFileSafe({
        action,
        projectRoot: plan.projectRoot,
        sourceRoot: plan.packageRoot,
      });
      if (!actionResult.ok) {
        await restoreEntry(currentEntry);
        await rollbackApplied();
        return withError(
          state,
          actionResult.error ?? 'copyFile action failed.',
          action.to,
        );
      }

      const written = actionResult.written ?? [];
      state.actionsApplied.push({ action, written });
      state.filesWritten.push(
        ...written.map((filePath) => path.resolve(filePath)),
      );
      appliedEntries.push(currentEntry);
      continue;
    }

    if (action.type === 'copyDirectory') {
      const actionResult = await copyDirectorySafe({
        action,
        projectRoot: plan.projectRoot,
        sourceRoot: plan.packageRoot,
      });
      if (!actionResult.ok) {
        await restoreEntry(currentEntry);
        await rollbackApplied();
        return withError(
          state,
          actionResult.error ?? 'copyDirectory action failed.',
          action.to,
        );
      }

      const written = actionResult.written ?? [];
      state.actionsApplied.push({ action, written });
      state.filesWritten.push(
        ...written.map((filePath) => path.resolve(filePath)),
      );
      appliedEntries.push(currentEntry);
      continue;
    }

    if (action.type === 'patchJson') {
      const relPath = path
        .relative(path.resolve(plan.projectRoot), targetAbsPath)
        .replaceAll('\\', '/');
      if (!prePatchSnapshots.has(relPath)) {
        try {
          const prePatchContent =
            backupAbsPath !== null
              ? ((await fs.readJson(backupAbsPath)) as Record<string, unknown>)
              : {};
          prePatchSnapshots.set(relPath, prePatchContent);
        } catch {
          prePatchSnapshots.set(relPath, {});
        }
      }

      const actionResult = await applyJsonPatchFile({
        action,
        projectRoot: plan.projectRoot,
        sourceRoot: plan.packageRoot,
        patchFilePath: action.from,
        targetPath: action.to,
      });
      if (!actionResult.ok) {
        await restoreEntry(currentEntry);
        await rollbackApplied();
        return withError(
          state,
          actionResult.error ?? 'patchJson action failed.',
          action.to,
        );
      }

      const written = actionResult.written ?? [];
      state.actionsApplied.push({ action, written });
      state.filesWritten.push(
        ...written.map((filePath) => path.resolve(filePath)),
      );
      state.patchesApplied.push(path.resolve(action.to));
      appliedEntries.push(currentEntry);
    }
  }

  const finalResult: InstallResult = {
    ...state,
    ok: true,
  };

  try {
    await updateLockfileFromInstall(plan, finalResult);
  } catch (error) {
    await rollbackApplied();
    return withError(
      {
        ...finalResult,
        ok: false,
      },
      error instanceof Error ? error.message : String(error),
    );
  }

  for (const [relPath, content] of prePatchSnapshots) {
    try {
      const snapshotPath = path.join(
        plan.projectRoot,
        '.opencode-packman',
        'snapshots',
        plan.packageName,
        relPath,
      );
      await fs.ensureDir(path.dirname(snapshotPath));
      await fs.writeFile(
        snapshotPath,
        `${JSON.stringify(content, null, 2)}\n`,
        'utf-8',
      );
    } catch {
      // non-fatal: snapshot write failure
    }
  }

  try {
    await fs.remove(backupDir);
  } catch {
    // non-fatal: backup cleanup
  }

  return finalResult;
}
