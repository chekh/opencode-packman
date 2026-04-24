import path from 'node:path';

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

function createEmptyResult(plan: InstallPlan): InstallResult {
  return {
    ok: false,
    packageName: plan.packageName,
    packageVersion: plan.packageVersion,
    actionsApplied: [],
    filesWritten: [],
    patchesApplied: [],
    errors: []
  };
}

function withError(result: InstallResult, message: string, targetPath?: string): InstallResult {
  const errorEntry = targetPath === undefined ? { message } : { message, path: targetPath };
  return {
    ...result,
    ok: false,
    errors: [...result.errors, errorEntry]
  };
}

export async function applyInstallPlan(plan: InstallPlan): Promise<InstallResult> {
  const result = createEmptyResult(plan);

  if (!plan.validation.ok) {
    return withError(result, 'Install plan contains validation errors.');
  }

  if (plan.conflicts.length > 0) {
    return withError(result, 'Install plan contains conflicts.');
  }

  let state = { ...result };

  for (const action of plan.actions) {
    if (action.type === 'copyFile') {
      const actionResult = await copyFileSafe({ action, projectRoot: plan.projectRoot });
      if (!actionResult.ok) {
        return withError(state, actionResult.error ?? 'copyFile action failed.', action.to);
      }

      const written = actionResult.written ?? [];
      state.actionsApplied.push({ action, written });
      state.filesWritten.push(...written.map((filePath) => path.resolve(filePath)));
      continue;
    }

    if (action.type === 'copyDirectory') {
      const actionResult = await copyDirectorySafe({ action, projectRoot: plan.projectRoot });
      if (!actionResult.ok) {
        return withError(state, actionResult.error ?? 'copyDirectory action failed.', action.to);
      }

      const written = actionResult.written ?? [];
      state.actionsApplied.push({ action, written });
      state.filesWritten.push(...written.map((filePath) => path.resolve(filePath)));
      continue;
    }

    if (action.type === 'patchJson') {
      const actionResult = await applyJsonPatchFile({
        action,
        projectRoot: plan.projectRoot,
        patchFilePath: action.from,
        targetPath: action.to
      });
      if (!actionResult.ok) {
        return withError(state, actionResult.error ?? 'patchJson action failed.', action.to);
      }

      const written = actionResult.written ?? [];
      state.actionsApplied.push({ action, written });
      state.filesWritten.push(...written.map((filePath) => path.resolve(filePath)));
      state.patchesApplied.push(path.resolve(action.to));
    }
  }

  const finalResult: InstallResult = {
    ...state,
    ok: true
  };

  try {
    await updateLockfileFromInstall(plan, finalResult);
  } catch (error) {
    return withError(
      {
        ...finalResult,
        ok: false
      },
      error instanceof Error ? error.message : String(error)
    );
  }

  return finalResult;
}
