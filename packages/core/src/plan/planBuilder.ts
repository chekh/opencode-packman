import path from 'node:path';
import fs from 'fs-extra';

import { loadPackage } from '../package/packageLoader.js';
import { validatePackage } from '../package/packageValidator.js';
import type { InstallAction, InstallPlan, PlanConflict } from './installPlan.js';
import { getProjectPaths } from '../project/projectPaths.js';

export type BuildInstallPlanInput = {
  packageRoot: string;
  projectRoot: string;
  scope?: 'project';
};

function toConflict(code: string, message: string, targetPath: string): PlanConflict {
  return { code, message, path: targetPath };
}

export async function buildInstallPlan(input: BuildInstallPlanInput): Promise<InstallPlan> {
  const scope = input.scope ?? 'project';
  if (scope !== 'project') {
    throw new Error(`Unsupported scope '${String(scope)}'. Only 'project' scope is supported in this step.`);
  }

  const loadedPackage = await loadPackage(input.packageRoot);
  const validation = await validatePackage(loadedPackage);
  const projectPaths = getProjectPaths(input.projectRoot);

  const actions: InstallAction[] = [];
  const conflicts: PlanConflict[] = [];

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

    const from = path.resolve(loadedPackage.packageRoot, item.path);
    const to = path.join(projectPaths.agentsDir, `${item.name}.md`);
    if (item.strategy === 'add' && (await fs.pathExists(to))) {
      conflicts.push(
        toConflict('ADD_TARGET_EXISTS', `Target already exists for add strategy: .opencode/agents/${item.name}.md`, to)
      );
      continue;
    }

    actions.push({
      type: 'copyFile',
      from,
      to,
      strategy: item.strategy,
      objectType: 'agent',
      objectName: item.name
    });
  }

  for (const item of loadedPackage.manifest.exports.commands ?? []) {
    if (item.strategy === 'patch') {
      continue;
    }

    const from = path.resolve(loadedPackage.packageRoot, item.path);
    const to = path.join(projectPaths.commandsDir, `${item.name}.md`);
    if (item.strategy === 'add' && (await fs.pathExists(to))) {
      conflicts.push(
        toConflict(
          'ADD_TARGET_EXISTS',
          `Target already exists for add strategy: .opencode/commands/${item.name}.md`,
          to
        )
      );
      continue;
    }

    actions.push({
      type: 'copyFile',
      from,
      to,
      strategy: item.strategy,
      objectType: 'command',
      objectName: item.name
    });
  }

  for (const item of loadedPackage.manifest.exports.skills ?? []) {
    if (item.strategy === 'patch') {
      continue;
    }

    const from = path.resolve(loadedPackage.packageRoot, item.path);
    const to = path.join(projectPaths.skillsDir, item.name);
    if (item.strategy === 'add' && (await fs.pathExists(to))) {
      conflicts.push(
        toConflict('ADD_TARGET_EXISTS', `Target already exists for add strategy: .opencode/skills/${item.name}/`, to)
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
    const from = path.resolve(loadedPackage.packageRoot, item.path);
    const to = projectPaths.opencodeJsonPath;
    actions.push({
      type: 'patchJson',
      from,
      to,
      strategy: 'patch',
      objectType: 'config'
    });
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
