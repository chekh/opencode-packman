import { Command } from 'commander';

import { renderDoctorReport, runDoctor } from '@opencode-packman/core';

import { toErrorMessage } from './errorFormatter.js';

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Check project health')
    .action(async () => {
      try {
        const invocationRoot = process.env.INIT_CWD ?? process.cwd();
        const report = await runDoctor(invocationRoot);
        process.stdout.write(`${renderDoctorReport(report)}\n`);

        process.exitCode = report.status === 'broken' ? 1 : 0;
      } catch (error) {
        process.stderr.write(`Doctor failed: ${toErrorMessage(error)}\n`);
        process.exitCode = 1;
      }
    });
}
