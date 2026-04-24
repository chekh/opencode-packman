import path from 'node:path';

import type { InstallAction, InstallPlan } from '../plan/installPlan.js';
import { renderSection, renderNone } from '../render/format.js';

function toProjectRelative(plan: InstallPlan, targetPath: string): string {
  const relativePath = path.relative(plan.projectRoot, targetPath);
  if (relativePath === '') {
    return '.';
  }
  return relativePath;
}

function actionTargetLabel(plan: InstallPlan, action: InstallAction): string {
  if (action.type === 'copyDirectory') {
    return `${toProjectRelative(plan, action.to)}/`;
  }
  return toProjectRelative(plan, action.to);
}

function configPatchLabel(plan: InstallPlan, action: Extract<InstallAction, { type: 'patchJson' }>): string {
  const target = toProjectRelative(plan, action.to);
  const source = path.basename(action.from);
  return `${target} <- ${source}`;
}

export function renderInstallPlan(plan: InstallPlan): string {
  const addActions = plan.actions
    .filter((action) => action.type !== 'patchJson' && action.strategy === 'add')
    .map((action) => actionTargetLabel(plan, action));

  const replaceActions = plan.actions
    .filter((action) => action.type !== 'patchJson' && action.strategy === 'replace')
    .map((action) => actionTargetLabel(plan, action));

  const patchActions = plan.actions
    .filter((action): action is Extract<InstallAction, { type: 'patchJson' }> => action.type === 'patchJson')
    .map((action) => configPatchLabel(plan, action));

  const lines: string[] = [
    'Install preview',
    '',
    `Package: ${plan.packageName}@${plan.packageVersion}`,
    `Scope: ${plan.scope}`,
    ''
  ];

  lines.push(...renderSection('Will add:', addActions));
  lines.push('');
  lines.push(...renderSection('Will replace:', replaceActions));
  lines.push('');
  lines.push(...renderSection('Will patch:', patchActions));
  lines.push('');
  lines.push('Conflicts:');

  if (plan.conflicts.length === 0) {
    lines.push(renderNone());
  } else {
    for (const conflict of plan.conflicts) {
      lines.push(`  ${conflict.message}`);
    }
  }

  lines.push('', 'Validation:');
  if (plan.validation.ok) {
    lines.push('  OK');
  } else {
    lines.push('  FAILED');
    for (const error of plan.validation.errors) {
      lines.push(`  - [${error.code}] ${error.message}`);
    }
  }

  return lines.join('\n');
}
