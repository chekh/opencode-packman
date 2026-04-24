import { Command } from 'commander';

import { getConfigPathsSummary } from '@opencode-packman/core';

import { toErrorMessage } from './errorFormatter.js';

export function registerConfigCommands(program: Command): void {
  const config = program.command('config').description('Configuration diagnostics');

  config
    .command('paths')
    .description('Show resolved project, user config and registry paths')
    .action(async () => {
      try {
        const invocationRoot = process.env.INIT_CWD ?? process.cwd();
        const summary = await getConfigPathsSummary(invocationRoot);

        const lines: string[] = [
          'opencode-packman paths',
          '',
          'Project:',
          `  Root: ${summary.project.root}`,
          `  OpenCode config: ${summary.project.opencodeConfig}`,
          `  OpenCode dir: ${summary.project.opencodeDir}`,
          `  Packman state: ${summary.project.packmanState}`,
          `  Lockfile: ${summary.project.lockfile}`,
          `  Baseline: ${summary.project.baseline}`,
          '',
          'User:',
          `  Config dir: ${summary.user.configDir}`,
          `  Registries config: ${summary.user.registriesConfig}`,
          '',
          'Registries:'
        ];

        if (summary.registries.length === 0) {
          lines.push('  none');
        } else {
          for (const registry of summary.registries) {
            lines.push(`  ${registry.name}: ${registry.path}`);
          }
        }

        process.stdout.write(`${lines.join('\n')}\n`);
        process.exitCode = 0;
      } catch (error) {
        process.stderr.write(`Config paths failed: ${toErrorMessage(error)}\n`);
        process.exitCode = 1;
      }
    });
}
