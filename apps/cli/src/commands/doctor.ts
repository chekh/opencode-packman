import { Command } from 'commander';

import { renderDoctorReport, runDoctor } from '@opencode-packman/core';

import { toErrorMessage } from './errorFormatter.js';
import {
  printJson,
  formatDoctorIssues,
  type CommandJsonResult,
} from './jsonOutput.js';

type DoctorOptions = {
  global?: boolean;
  json?: boolean;
};

export async function executeDoctor(
  invocationRoot: string,
  global?: boolean,
  json?: boolean,
): Promise<void> {
  const report = await runDoctor(invocationRoot, global ? 'global' : undefined);

  if (json) {
    const jsonResult: CommandJsonResult<typeof report> = {
      ok: report.status !== 'broken',
      command: 'doctor',
      data: report,
      ...(report.issues.length > 0
        ? { issues: formatDoctorIssues(report.issues) }
        : {}),
    };
    printJson(jsonResult);
  } else {
    process.stdout.write(`${renderDoctorReport(report)}\n`);
  }

  process.exitCode = report.status === 'broken' ? 1 : 0;
}

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Run health checks for project state and lockfile consistency')
    .option(
      '--global',
      'Check global OpenCode config (~/.config/opencode)',
      false,
    )
    .option('--json', 'Output as JSON', false)
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
  1  broken`,
    )
    .action(async (options: DoctorOptions) => {
      try {
        const invocationRoot = process.env.INIT_CWD ?? process.cwd();
        await executeDoctor(invocationRoot, options.global, options.json);
      } catch (error) {
        if (options.json) {
          printJson({
            ok: false,
            command: 'doctor',
            issues: [
              {
                severity: 'error',
                code: 'doctor_failed',
                message: toErrorMessage(error),
              },
            ],
          });
        } else {
          process.stderr.write(`Doctor failed: ${toErrorMessage(error)}\n`);
        }
        process.exitCode = 1;
      }
    });
}
