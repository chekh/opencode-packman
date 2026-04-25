import { Command } from 'commander';

import { initGlobal, initProject } from '@opencode-packman/core';

import { toErrorMessage } from './errorFormatter.js';

function renderPaths(label: string, paths: string[]): string[] {
  if (paths.length === 0) {
    return [`${label}:`, '  none'];
  }

  return [`${label}:`, ...paths.map((entry) => `  ${entry}`)];
}

export async function executeInit(invocationRoot: string): Promise<void> {
  const result = await initProject(invocationRoot);

  const lines: string[] = ['Init result', '', 'Status: initialized', ''];
  lines.push(...renderPaths('Created', result.created));
  lines.push('');
  lines.push(...renderPaths('Already existed', result.alreadyExisted));
  lines.push('');
  lines.push('Baseline:');
  lines.push(`  Files recorded: ${result.baselineFiles}`);
  lines.push('');
  lines.push('Next:');
  lines.push('  opm create package base-review');
  lines.push('  opm preview <packageRef>');
  lines.push('  opm install <packageRef> --yes');

  process.stdout.write(`${lines.join('\n')}\n`);
  process.exitCode = 0;
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Create missing project files and directories for opm')
    .option('--global', 'Initialize global OpenCode config (~/.config/opencode)', false)
    .addHelpText(
      'after',
      `
Examples:
  opm init
  opm project init
  opm init --global

Creates when missing:
  - opencode.json
  - .opencode/
  - .opencode/agents
  - .opencode/commands
  - .opencode/skills
  - .opencode-packman/lock.yaml
  - .opencode-packman/baseline.yaml

Existing files are never overwritten.`
    )
    .action(async (options: { global?: boolean }) => {
      try {
        const invocationRoot = process.env.INIT_CWD ?? process.cwd();
        if (options.global) {
          const result = await initGlobal();

          const lines: string[] = ['Init result', '', 'Status: initialized', ''];
          lines.push(...renderPaths('Created', result.created));
          lines.push('');
          lines.push(...renderPaths('Already existed', result.alreadyExisted));
          lines.push('');
          lines.push('Baseline:');
          lines.push(`  Files recorded: ${result.baselineFiles}`);
          lines.push('');
          lines.push('Next:');
          lines.push('  opm preview <packageRef> --global');
          lines.push('  opm install <packageRef> --global --yes');

          process.stdout.write(`${lines.join('\n')}\n`);
          process.exitCode = 0;
          return;
        }

        await executeInit(invocationRoot);
      } catch (error) {
        process.stderr.write(`Init failed: ${toErrorMessage(error)}\n`);
        process.exitCode = 1;
      }
    });
}
