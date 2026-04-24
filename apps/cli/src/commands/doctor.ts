import { Command } from 'commander';

import { renderDoctorReport, runDoctor } from '@opencode-packman/core';

import { toErrorMessage } from './errorFormatter.js';

export async function executeDoctor(invocationRoot: string): Promise<void> {
  const report = await runDoctor(invocationRoot);
  process.stdout.write(`${renderDoctorReport(report)}\n`);
  process.exitCode = report.status === 'broken' ? 1 : 0;
}

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Run health checks for project state and lockfile consistency')
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
    .action(async () => {
      try {
        const invocationRoot = process.env.INIT_CWD ?? process.cwd();
        await executeDoctor(invocationRoot);
      } catch (error) {
        process.stderr.write(`Doctor failed: ${toErrorMessage(error)}\n`);
        process.exitCode = 1;
      }
    });
}
