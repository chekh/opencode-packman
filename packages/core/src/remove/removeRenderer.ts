import path from 'node:path';

import { formatCount, renderNone, renderSection } from '../render/format.js';
import type { RemoveAction, RemovePlan, RemoveResult } from './remover.js';

function toRelative(projectRoot: string, targetPath: string): string {
  const relative = path.relative(projectRoot, targetPath).replaceAll('\\', '/');
  return relative === '' ? '.' : relative;
}

function splitRemoveActions(plan: RemovePlan): {
  files: string[];
  directories: string[];
  manualNotices: Extract<RemoveAction, { type: 'manualPatchNotice' }>[];
} {
  const files: string[] = [];
  const directories: string[] = [];
  const manualNotices: Extract<RemoveAction, { type: 'manualPatchNotice' }>[] = [];

  for (const action of plan.actions) {
    if (action.type === 'deleteFile') {
      files.push(toRelative(plan.projectRoot, action.path));
      continue;
    }

    if (action.type === 'deleteDirectory') {
      directories.push(`${toRelative(plan.projectRoot, action.path)}/`);
      continue;
    }

    manualNotices.push(action);
  }

  return { files, directories, manualNotices };
}

export function renderRemovePlan(plan: RemovePlan): string {
  const sections = splitRemoveActions(plan);
  const lines: string[] = ['Remove preview', '', `Package: ${plan.packageName}`, ''];
  lines.push(...renderSection('Will delete files:', sections.files));
  lines.push('');
  lines.push(...renderSection('Will delete directories:', sections.directories));
  lines.push('', 'Manual steps:');

  if (sections.manualNotices.length === 0) {
    lines.push(renderNone());
  } else {
    lines.push('  opencode.json was patched by this package.');
    lines.push('  Automatic JSON patch rollback is not available in MVP.');
    lines.push('  Review opencode.json manually.');
  }

  lines.push('', 'Warnings:');
  if (plan.warnings.length === 0) {
    lines.push(renderNone());
  } else {
    for (const warning of plan.warnings) {
      lines.push(`  [${warning.code}] ${warning.message}`);
    }
  }

  lines.push('', 'Errors:');
  if (plan.errors.length === 0) {
    lines.push(renderNone());
  } else {
    for (const error of plan.errors) {
      lines.push(`  [${error.code}] ${error.message}`);
    }
  }

  return lines.join('\n');
}

export function renderRemoveResult(result: RemoveResult): string {
  const status = result.ok ? 'removed' : 'failed';
  const lines: string[] = [
    'Remove result',
    '',
    `Package: ${result.packageName}`,
    `Status: ${status}`,
    '',
    formatCount('Deleted files', result.filesDeleted.length),
    formatCount('Deleted directories', result.directoriesDeleted.length)
  ];

  const hasManualPatchNotice = result.actionsApplied.some((action) => action.type === 'manualPatchNotice');
  lines.push('', 'Warnings:');
  if (result.warnings.length === 0 && !hasManualPatchNotice) {
    lines.push(renderNone());
  } else {
    for (const warning of result.warnings) {
      lines.push(`  [${warning.code}] ${warning.message}`);
    }
    if (hasManualPatchNotice) {
      lines.push('  JSON patches were not automatically reverted.');
      lines.push('  Please review opencode.json manually.');
    }
  }

  lines.push('', 'Errors:');
  if (result.errors.length === 0) {
    lines.push(renderNone());
  } else {
    for (const error of result.errors) {
      lines.push(`  [${error.code}] ${error.message}`);
    }
  }

  return lines.join('\n');
}
