import { Command } from 'commander';
import prompts from 'prompts';

import { applyRemovePlan, buildRemovePlan, renderRemovePlan, renderRemoveResult } from '@opencode-packman/core';

import { toErrorMessage } from './errorFormatter.js';

type RemoveOptions = {
  yes?: boolean;
  dryRun?: boolean;
};

export function registerRemoveCommand(program: Command): void {
  program
    .command('remove <packageName>')
    .description('Remove installed package by lockfile ownership')
    .option('--yes', 'Skip confirmation prompt and apply immediately', false)
    .option('--dry-run', 'Only print remove preview without changes', false)
    .addHelpText(
      'after',
      `
Arguments:
  packageName  Name recorded in .opencode-packman/lock.yaml

Examples:
  opm remove backend-review --dry-run
  opm remove backend-review --yes

Note:
  JSON patches in opencode.json are not auto-rolled back in MVP.
  Review opencode.json manually after remove.`
    )
    .action(async (packageName: string, options: RemoveOptions) => {
      try {
        const invocationRoot = process.env.INIT_CWD ?? process.cwd();
        const plan = await buildRemovePlan({
          projectRoot: invocationRoot,
          packageName
        });

        process.stdout.write(`${renderRemovePlan(plan)}\n`);

        if (plan.errors.length > 0) {
          process.stderr.write('Remove aborted: plan has errors.\n');
          for (const error of plan.errors) {
            process.stderr.write(`- ${error.code}: ${error.message}${error.path ? ` (${error.path})` : ''}\n`);
          }
          process.exitCode = 1;
          return;
        }

        if (options.dryRun) {
          process.exitCode = 0;
          return;
        }

        if (!options.yes) {
          const answer = await prompts({
            type: 'confirm',
            name: 'confirmRemove',
            message: `Remove package '${packageName}' from ${invocationRoot}?`,
            initial: false
          });

          if (!answer.confirmRemove) {
            process.stderr.write('Removal cancelled.\n');
            process.exitCode = 1;
            return;
          }
        }

        const result = await applyRemovePlan(plan);
        process.stdout.write(`${renderRemoveResult(result)}\n`);
        process.exitCode = result.ok ? 0 : 1;
      } catch (error) {
        process.stderr.write(`Remove failed: ${toErrorMessage(error)}\n`);
        process.exitCode = 1;
      }
    });
}
