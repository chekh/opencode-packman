import { Command } from 'commander';

import { getProjectStatus } from '@opencode-packman/core';

import { toErrorMessage } from './errorFormatter.js';
import { executeDoctor } from './doctor.js';
import { executeInit } from './init.js';

function existsLabel(exists: boolean): string {
  return exists ? 'exists' : 'missing';
}

export function registerProjectCommands(program: Command): void {
  const project = program.command('project').description('Project domain commands');

  project.command('init').description('Alias for opm init').action(async () => {
    try {
      const invocationRoot = process.env.INIT_CWD ?? process.cwd();
      await executeInit(invocationRoot);
    } catch (error) {
      process.stderr.write(`Init failed: ${toErrorMessage(error)}\n`);
      process.exitCode = 1;
    }
  });

  project.command('doctor').description('Alias for opm doctor').action(async () => {
    try {
      const invocationRoot = process.env.INIT_CWD ?? process.cwd();
      await executeDoctor(invocationRoot);
    } catch (error) {
      process.stderr.write(`Doctor failed: ${toErrorMessage(error)}\n`);
      process.exitCode = 1;
    }
  });

  project
    .command('status')
    .description('Show project initialization and installation summary')
    .action(async () => {
      try {
        const invocationRoot = process.env.INIT_CWD ?? process.cwd();
        const status = await getProjectStatus(invocationRoot);

        const lines: string[] = [
          'Project status',
          '',
          `Root: ${status.projectRoot}`,
          '',
          'OpenCode:',
          `  opencode.json: ${existsLabel(status.opencodeJsonExists)}`,
          `  .opencode/: ${existsLabel(status.opencodeDirExists)}`,
          '',
          'opencode-packman:',
          `  initialized: ${status.initialized ? 'yes' : 'no'}`,
          `  lockfile: ${status.lockfileExists ? status.lockfilePath : `missing (${status.lockfilePath})`}`,
          `  baseline: ${status.baselineExists ? status.baselinePath : `missing (${status.baselinePath})`}`,
          `  installed packages: ${status.installedPackages}`,
          `  baseline files: ${status.baselineFiles}`,
          '',
          'Doctor:',
          `  Status: ${status.doctorStatus}`
        ];

        process.stdout.write(`${lines.join('\n')}\n`);
        process.exitCode = status.doctorStatus === 'broken' ? 1 : 0;
      } catch (error) {
        process.stderr.write(`Project status failed: ${toErrorMessage(error)}\n`);
        process.exitCode = 1;
      }
    });
}
