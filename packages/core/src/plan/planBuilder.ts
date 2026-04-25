import path from 'node:path';
import fs from 'fs-extra';

import { loadPackage } from '../package/packageLoader.js';
import { validatePackage } from '../package/packageValidator.js';
import { extractAliasName } from '../model/modelAliases.js';
import type { InstallAction, InstallPlan, PlanConflict } from './installPlan.js';
import { getPathsByScope, type Scope } from '../project/projectPaths.js';
import { isPathInsideRoot } from '../utils/pathSafety.js';
import { readLockfile } from '../lock/lockfile.js';

export type BuildInstallPlanInput = {
  packageRoot: string;
  projectRoot: string;
  scope?: Scope;
  reinstall?: boolean;
};

function toConflict(code: string, message: string, targetPath: string): PlanConflict {
  return { code, message, path: targetPath };
}

export async function buildInstallPlan(input: BuildInstallPlanInput): Promise<InstallPlan> {
  const scope = input.scope ?? 'project';
  const loadedPackage = await loadPackage(input.packageRoot);
  const validation = await validatePackage(loadedPackage);
  const projectPaths = getPathsByScope(input.projectRoot, scope);
  const resolvedPackageRoot = path.resolve(loadedPackage.packageRoot);
  const realPackageRoot = path.resolve(await fs.realpath(resolvedPackageRoot));

  let ownedByThisPackage: Set<string> | null = null;
  if (input.reinstall === true) {
    try {
      const lockfile = await readLockfile(input.projectRoot);
      const ownedTargets = Object.entries(lockfile.files)
        .filter(([, entry]) => entry.owner === loadedPackage.manifest.name)
        .map(([relPath]) => relPath);
      ownedByThisPackage = new Set(ownedTargets);
    } catch {
      ownedByThisPackage = null;
    }
  }

  const actions: InstallAction[] = [];
  const conflicts: PlanConflict[] = [];

  async function resolveSourcePath(exportPath: string): Promise<string> {
    const resolvedSourcePath = path.resolve(resolvedPackageRoot, exportPath);
    if (!isPathInsideRoot(resolvedPackageRoot, resolvedSourcePath)) {
      throw new Error(`Export path resolves outside package root: ${exportPath}`);
    }

    if (!(await fs.pathExists(resolvedSourcePath))) {
      throw new Error(`Export path does not exist: ${exportPath}`);
    }

    const realSourcePath = path.resolve(await fs.realpath(resolvedSourcePath));
    if (!isPathInsideRoot(realPackageRoot, realSourcePath)) {
      throw new Error(`Export path points outside package root after resolving symlinks: ${exportPath}`);
    }

    return resolvedSourcePath;
  }

  if (!validation.ok) {
    return {
      packageName: loadedPackage.manifest.name,
      packageVersion: loadedPackage.manifest.version,
      packageRoot: loadedPackage.packageRoot,
      projectRoot: projectPaths.projectRoot,
      scope,
      actions,
      conflicts,
      warnings: validation.warnings,
      validation
    };
  }

  for (const item of loadedPackage.manifest.exports.agents ?? []) {
    if (item.strategy === 'patch') {
      continue;
    }

    const from = await resolveSourcePath(item.path);
    const to = path.join(projectPaths.agentsDir, `${item.name}.md`);
    const agentModelAlias = item.model !== undefined ? extractAliasName(item.model) : undefined;
    const agentAction = {
      type: 'copyFile' as const,
      from,
      to,
      strategy: item.strategy,
      objectType: 'agent' as const,
      objectName: item.name,
      ...(agentModelAlias !== undefined ? { modelAlias: agentModelAlias } : {})
    };

    if (item.strategy === 'add' && (await fs.pathExists(to))) {
      const relTarget = path.relative(projectPaths.projectRoot, to).replaceAll('\\', '/');
      if (ownedByThisPackage !== null && ownedByThisPackage.has(relTarget)) {
        actions.push({ ...agentAction, strategy: 'replace' });
        continue;
      }
      conflicts.push(
        toConflict('ADD_TARGET_EXISTS', `Target already exists for add strategy: ${relTarget}`, to)
      );
      continue;
    }

    actions.push(agentAction);
  }

  for (const item of loadedPackage.manifest.exports.commands ?? []) {
    if (item.strategy === 'patch') {
      continue;
    }

    const from = await resolveSourcePath(item.path);
    const to = path.join(projectPaths.commandsDir, `${item.name}.md`);
    const commandModelAlias = item.model !== undefined ? extractAliasName(item.model) : undefined;
    const commandAction = {
      type: 'copyFile' as const,
      from,
      to,
      strategy: item.strategy,
      objectType: 'command' as const,
      objectName: item.name,
      ...(commandModelAlias !== undefined ? { modelAlias: commandModelAlias } : {})
    };

    if (item.strategy === 'add' && (await fs.pathExists(to))) {
      const relTarget = path.relative(projectPaths.projectRoot, to).replaceAll('\\', '/');
      if (ownedByThisPackage !== null && ownedByThisPackage.has(relTarget)) {
        actions.push({ ...commandAction, strategy: 'replace' });
        continue;
      }
      conflicts.push(
        toConflict('ADD_TARGET_EXISTS', `Target already exists for add strategy: ${relTarget}`, to)
      );
      continue;
    }

    actions.push(commandAction);
  }

  for (const item of loadedPackage.manifest.exports.skills ?? []) {
    if (item.strategy === 'patch') {
      continue;
    }

    const from = await resolveSourcePath(item.path);
    const to = path.join(projectPaths.skillsDir, item.name);

    if (item.strategy === 'add' && (await fs.pathExists(to))) {
      const relTarget = path.relative(projectPaths.projectRoot, to).replaceAll('\\', '/');
      if (ownedByThisPackage !== null && ownedByThisPackage.has(relTarget)) {
        actions.push({ type: 'copyDirectory', from, to, strategy: 'replace', objectType: 'skill', objectName: item.name });
        continue;
      }
      conflicts.push(
        toConflict('ADD_TARGET_EXISTS', `Target already exists for add strategy: ${relTarget}/`, to)
      );
      continue;
    }

    actions.push({
      type: 'copyDirectory',
      from,
      to,
      strategy: item.strategy,
      objectType: 'skill',
      objectName: item.name
    });
  }

  for (const item of loadedPackage.manifest.exports.config ?? []) {
    const from = await resolveSourcePath(item.path);
    const to = projectPaths.opencodeJsonPath;

    let permissionsPreview: Record<string, unknown> | undefined;
    try {
      const patchContent = await fs.readJson(from) as Record<string, unknown>;
      if (typeof patchContent['permission'] === 'object' && patchContent['permission'] !== null) {
        permissionsPreview = patchContent['permission'] as Record<string, unknown>;
      }
    } catch {
      // non-fatal: permissions preview unavailable if patch file unreadable
    }

    const configAction = {
      type: 'patchJson' as const,
      from,
      to,
      strategy: 'patch' as const,
      objectType: 'config' as const,
      ...(permissionsPreview !== undefined ? { permissionsPreview } : {})
    };
    actions.push(configAction);
  }

  return {
    packageName: loadedPackage.manifest.name,
    packageVersion: loadedPackage.manifest.version,
    packageRoot: loadedPackage.packageRoot,
    projectRoot: projectPaths.projectRoot,
    scope,
    actions,
    conflicts,
    warnings: validation.warnings,
    validation
  };
}
