import path from 'node:path';

import { Command } from 'commander';

import { initProject } from '@opencode-packman/core';

import { toErrorMessage } from './errorFormatter.js';

function renderPaths(label: string, paths: string[]): string[] {
  if (paths.length === 0) {
    return [`${label}:`, '  none'];
  }

  return [`${label}:`, ...paths.map((entry) => `  ${entry}`)];
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize OpenCode project layout')
    .action(async () => {
      try {
        const invocationRoot = process.env.INIT_CWD ?? process.cwd();
        const result = await initProject(invocationRoot);

        const created = result.created.map((entry) => path.relative(result.projectRoot, entry.path) || '.');
        const existing = result.existing.map((entry) => path.relative(result.projectRoot, entry.path) || '.');

        const lines: string[] = ['Init result', '', 'Status: initialized', ''];
        lines.push(...renderPaths('Created', created));
        lines.push('');
        lines.push(...renderPaths('Already existed', existing));

        process.stdout.write(`${lines.join('\n')}\n`);
        process.exitCode = 0;
      } catch (error) {
        process.stderr.write(`Init failed: ${toErrorMessage(error)}\n`);
        process.exitCode = 1;
      }
    });
}
