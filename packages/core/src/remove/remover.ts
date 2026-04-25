import path from 'node:path';

import fs from 'fs-extra';

import { readLockfile, updateLockfileFromRemove } from '../lock/lockfile.js';
import { getProjectPaths } from '../project/projectPaths.js';
import { isPathInsideRoot, validateWritablePathInsideRoot } from '../utils/pathSafety.js';

type RemoveMessage = { code: string; message: string; path?: string };

export type RemoveAction =
  | {
      type: 'deleteFile';
      path: string;
    }
  | {
      type: 'deleteDirectory';
      path: string;
    }
  | {
      type: 'revertPatch';
      target: string;
      snapshotPath: string;
    }
  | {
      type: 'manualPatchNotice';
      target: string;
      message: string;
    };

export type RemovePlan = {
  packageName: string;
  projectRoot: string;
  actions: RemoveAction[];
  warnings: RemoveMessage[];
  errors: RemoveMessage[];
};

export type RemoveResult = {
  ok: boolean;
  packageName: string;
  actionsApplied: RemoveAction[];
  filesDeleted: string[];
  directoriesDeleted: string[];
  warnings: RemoveMessage[];
  errors: RemoveMessage[];
};

function looksLikeSkillPath(relativePath: string): boolean {
  const normalized = relativePath.replaceAll('\\', '/');
  return normalized.startsWith('.opencode/skills/') || normalized.includes('/.opencode/skills/');
}

function isProjectRootPath(projectRoot: string, targetPath: string): boolean {
  return path.resolve(projectRoot) === path.resolve(targetPath);
}

export async function buildRemovePlan(input: {
  projectRoot: string;
  packageName: string;
  revertPatches?: boolean;
}): Promise<RemovePlan> {
  const paths = getProjectPaths(input.projectRoot);
  const warnings: RemoveMessage[] = [];
  const errors: RemoveMessage[] = [];
  const actions: RemoveAction[] = [];

  if (!(await fs.pathExists(paths.lockfilePath))) {
    errors.push({
      code: 'missing_lockfile',
      message: 'Lockfile is missing. No packages can be removed.',
      path: '.opencode-packman/lock.yaml'
    });
    return {
      packageName: input.packageName,
      projectRoot: paths.projectRoot,
      actions,
      warnings,
      errors
    };
  }

  let lockfile;
  try {
    lockfile = await readLockfile(paths.projectRoot);
  } catch {
    errors.push({
      code: 'invalid_lockfile',
      message: 'Lockfile is invalid and cannot be parsed.',
      path: '.opencode-packman/lock.yaml'
    });
    return {
      packageName: input.packageName,
      projectRoot: paths.projectRoot,
      actions,
      warnings,
      errors
    };
  }

  if (!(input.packageName in lockfile.packages)) {
    errors.push({
      code: 'package_not_installed',
      message: `Package '${input.packageName}' is not installed.`,
      path: '.opencode-packman/lock.yaml'
    });
    return {
      packageName: input.packageName,
      projectRoot: paths.projectRoot,
      actions,
      warnings,
      errors
    };
  }

  const ownedFileTargets = Object.entries(lockfile.files).filter(([, ownerEntry]) => ownerEntry.owner === input.packageName);
  for (const [relativeTarget] of ownedFileTargets) {
    const absoluteTarget = path.resolve(paths.projectRoot, relativeTarget);
    if (!isPathInsideRoot(paths.projectRoot, absoluteTarget)) {
      errors.push({
        code: 'unsafe_locked_target',
        message: 'Locked target resolves outside project root.',
        path: relativeTarget
      });
      continue;
    }

    if (isProjectRootPath(paths.projectRoot, absoluteTarget)) {
      errors.push({
        code: 'unsafe_locked_target',
        message: 'Locked target resolves to project root and cannot be removed.',
        path: relativeTarget
      });
      continue;
    }

    const safety = await validateWritablePathInsideRoot(paths.projectRoot, absoluteTarget);
    if (!safety.ok) {
      errors.push({
        code: 'unsafe_locked_target',
        message: `Locked target path is unsafe: ${safety.message}`,
        path: relativeTarget
      });
      continue;
    }

    if (!(await fs.pathExists(absoluteTarget))) {
      warnings.push({
        code: 'owned_target_missing',
        message: 'Owned target is already missing on disk.',
        path: relativeTarget
      });
      continue;
    }

    const stat = await fs.stat(absoluteTarget);
    if (stat.isDirectory() || looksLikeSkillPath(relativeTarget)) {
      actions.push({ type: 'deleteDirectory', path: absoluteTarget });
      continue;
    }

    actions.push({ type: 'deleteFile', path: absoluteTarget });
  }

  let ownedPatchCount = 0;
  for (const [target, patchEntries] of Object.entries(lockfile.patches)) {
    const ownsTargetPatch = patchEntries.some((patchEntry) => patchEntry.owner === input.packageName);
    if (!ownsTargetPatch) {
      continue;
    }

    ownedPatchCount += 1;

    if (input.revertPatches === true) {
      const snapshotPath = path.join(
        paths.projectRoot,
        '.opencode-packman',
        'snapshots',
        input.packageName,
        target
      );
      if (await fs.pathExists(snapshotPath)) {
        actions.push({ type: 'revertPatch', target, snapshotPath });
        continue;
      }
    }

    actions.push({
      type: 'manualPatchNotice',
      target,
      message: `Patch target '${target}' was modified by this package. Automatic JSON patch rollback is not available in MVP.`
    });
  }

  if (ownedFileTargets.length === 0 && ownedPatchCount === 0) {
    warnings.push({
      code: 'package_has_no_owned_targets',
      message: 'Package entry exists but no owned files or patches were found.',
      path: `.opencode-packman/lock.yaml#packages.${input.packageName}`
    });
  }

  return {
    packageName: input.packageName,
    projectRoot: paths.projectRoot,
    actions,
    warnings,
    errors
  };
}

export async function applyRemovePlan(plan: RemovePlan): Promise<RemoveResult> {
  const warnings = [...plan.warnings];
  const errors = [...plan.errors];
  const actionsApplied: RemoveAction[] = [];
  const filesDeleted: string[] = [];
  const directoriesDeleted: string[] = [];

  if (errors.length > 0) {
    return {
      ok: false,
      packageName: plan.packageName,
      actionsApplied,
      filesDeleted,
      directoriesDeleted,
      warnings,
      errors
    };
  }

  const deleteActions = plan.actions.filter(
    (action): action is Extract<RemoveAction, { type: 'deleteFile' | 'deleteDirectory' }> =>
      action.type === 'deleteFile' || action.type === 'deleteDirectory'
  );

  for (const action of deleteActions) {
    if (!isPathInsideRoot(plan.projectRoot, action.path)) {
      errors.push({
        code: 'unsafe_locked_target',
        message: 'Delete action path is outside project root.',
        path: action.path
      });
      continue;
    }

    if (isProjectRootPath(plan.projectRoot, action.path)) {
      errors.push({
        code: 'unsafe_locked_target',
        message: 'Delete action path resolves to project root and cannot be removed.',
        path: action.path
      });
      continue;
    }

    const safety = await validateWritablePathInsideRoot(plan.projectRoot, action.path);
    if (!safety.ok) {
      errors.push({
        code: 'unsafe_locked_target',
        message: `Delete action path is unsafe: ${safety.message}`,
        path: action.path
      });
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      packageName: plan.packageName,
      actionsApplied,
      filesDeleted,
      directoriesDeleted,
      warnings,
      errors
    };
  }

  try {
    for (const action of plan.actions) {
      if (action.type === 'manualPatchNotice') {
        warnings.push({
          code: 'manual_patch_notice',
          message: action.message,
          path: action.target
        });
        actionsApplied.push(action);
        continue;
      }

      if (action.type === 'revertPatch') {
        try {
          const absoluteTarget = path.resolve(plan.projectRoot, action.target);
          const snapshotContent = await fs.readJson(action.snapshotPath) as Record<string, unknown>;
          await fs.ensureDir(path.dirname(absoluteTarget));
          await fs.writeFile(absoluteTarget, `${JSON.stringify(snapshotContent, null, 2)}\n`, 'utf-8');
          await fs.remove(action.snapshotPath);
          actionsApplied.push(action);
        } catch (revertError) {
          warnings.push({
            code: 'revert_patch_failed',
            message: `Failed to revert patch for '${action.target}': ${revertError instanceof Error ? revertError.message : String(revertError)}`,
            path: action.target
          });
        }
        continue;
      }

      if (!(await fs.pathExists(action.path))) {
        warnings.push({
          code: 'owned_target_missing',
          message: 'Owned target is already missing on disk.',
          path: path.relative(plan.projectRoot, action.path).replaceAll('\\', '/')
        });
        actionsApplied.push(action);
        continue;
      }

      await fs.remove(action.path);
      actionsApplied.push(action);

      const relative = path.relative(plan.projectRoot, action.path).replaceAll('\\', '/');
      if (action.type === 'deleteFile') {
        filesDeleted.push(relative);
      } else {
        directoriesDeleted.push(relative);
      }
    }

    await updateLockfileFromRemove(plan.projectRoot, plan.packageName);

    try {
      const snapshotPackageDir = path.join(plan.projectRoot, '.opencode-packman', 'snapshots', plan.packageName);
      await fs.remove(snapshotPackageDir);
    } catch {
      // non-fatal: snapshot cleanup
    }

    return {
      ok: true,
      packageName: plan.packageName,
      actionsApplied,
      filesDeleted,
      directoriesDeleted,
      warnings,
      errors
    };
  } catch (error) {
    errors.push({
      code: 'remove_failed',
      message: error instanceof Error ? error.message : String(error)
    });

    return {
      ok: false,
      packageName: plan.packageName,
      actionsApplied,
      filesDeleted,
      directoriesDeleted,
      warnings,
      errors
    };
  }
}
