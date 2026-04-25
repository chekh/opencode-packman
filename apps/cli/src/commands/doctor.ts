import { Command } from 'commander';

import { renderDoctorReport, runDoctor } from '@opencode-packman/core';

import { toErrorMessage } from './errorFormatter.js';

export async function executeDoctor(invocationRoot: string, global?: boolean): Promise<void> {
  const report = await runDoctor(invocationRoot, global ? 'global' : undefined);
  process.stdout.write(`${renderDoctorReport(report)}\n`);
  process.exitCode = report.status === 'broken' ? 1 : 0;
}

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Run health checks for project state and lockfile consistency')
    .option('--global', 'Check global OpenCode config (~/.config/opencode)', false)
    .addHelpText(
      'after',
      `
Checks include:
  - opencode.json exists and is valid JSON object
  - .opencode directory exists
  - lockfile format and tracked target presence
  - skill directories contain SKILL.md

Exit codes:
  0  healthy or warning
  1  broken`
    )
    .action(async (options: { global?: boolean }) => {
      try {
        const invocationRoot = process.env.INIT_CWD ?? process.cwd();
        await executeDoctor(invocationRoot, options.global);
      } catch (error) {
        process.stderr.write(`Doctor failed: ${toErrorMessage(error)}\n`);
        process.exitCode = 1;
      }
    });
}
